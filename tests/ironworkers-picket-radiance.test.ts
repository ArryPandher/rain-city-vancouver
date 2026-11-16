import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  ironworkersFirstHitCoverage,
  createIronworkersRadianceCoverageMaterial,
} from "../src/world/ironworkers-picket-radiance";
import {
  createIronworkersPathBoundary,
  IRONWORKERS_PATH,
} from "../src/world/ironworkers-path-boundary";
const section = { width: 0.05, depth: 0.04, pitch: 0.13 };
test("first-hit front and side coverage matches independent physical box rays before and after overlap", () => {
  const boxes = Array.from(
    { length: 101 },
    (_, i) =>
      new T.Box3(
        new T.Vector3(
          (i - 50) * section.pitch - section.width / 2,
          0,
          -section.depth / 2,
        ),
        new T.Vector3(
          (i - 50) * section.pitch + section.width / 2,
          3,
          section.depth / 2,
        ),
      ),
  );
  const samples = 4096;
  for (const slope of [0, 0.5, 1.25, 2, 5, -5])
    for (const width of [0.3, 1, 4.7])
      for (const cell of [0.06, 0.5, 0.93]) {
        let front = 0,
          side = 0;
        for (let i = 0; i < samples; i++) {
          const x =
              (cell - 0.5 + ((i + 0.5) / samples - 0.5) * width) *
              section.pitch,
            ray = new T.Ray(
              new T.Vector3(x + slope, 1, 1),
              new T.Vector3(-slope, 0, -1).normalize(),
            );
          let nearest = Infinity,
            face = "";
          for (const box of boxes) {
            const hit = ray.intersectBox(box, new T.Vector3());
            if (!hit) continue;
            const distance = hit.distanceTo(ray.origin);
            if (distance < nearest) {
              nearest = distance;
              face =
                Math.abs(hit.z - section.depth / 2) < 1e-8 ? "front" : "side";
            }
          }
          if (face === "front") front++;
          if (face === "side") side++;
        }
        const result = ironworkersFirstHitCoverage(section, cell, width, slope);
        assert.ok(Math.abs(result.front - front / samples) < 0.0008);
        assert.ok(Math.abs(result.side - side / samples) < 0.0008);
        assert.ok(result.total <= 1 && result.total >= 0);
      }
  for (const slope of [2, 5, 20]) {
    const p = ironworkersFirstHitCoverage(section, 0.5, 1, slope);
    assert.ok(Math.abs(p.front - section.width / section.pitch) < 1e-12);
    assert.ok(Math.abs(p.side - (1 - section.width / section.pitch)) < 1e-12);
    assert.equal(p.total, 1);
  }
});
test("trial averages separately lit face radiance, keeps source steel, and applies continuous coverage once", () => {
  const source = new T.MeshStandardMaterial({
    color: 0xa7afac,
    metalness: 0.75,
    roughness: 0.5,
  });
  const m = createIronworkersRadianceCoverageMaterial(source, section);
  assert.equal(m.transparent, true);
  assert.equal(m.depthWrite, false);
  assert.equal(m.depthTest, true);
  assert.equal(m.alphaToCoverage, false);
  assert.equal(m.premultipliedAlpha, false);
  assert.equal(m.alphaTest, 0);
  assert.deepEqual(m.color, source.color);
  assert.equal(m.roughness, source.roughness);
  assert.equal(m.metalness, source.metalness);
  assert.equal(source.transparent, false);
  const shader = {
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as T.WebGLRenderer);
  for (const chunk of [
    "lights_physical_fragment",
    "lights_fragment_begin",
    "lights_fragment_maps",
    "lights_fragment_end",
    "aomap_fragment",
  ])
    assert.equal(
      shader.fragmentShader.split(`#include <${chunk}>`).length - 1,
      2,
      `two complete lighting evaluations: ${chunk}`,
    );
  assert.ok(
    shader.fragmentShader.includes(
      "normal=fenceFront;nonPerturbedNormal=fenceFront;",
    ),
  );
  assert.ok(
    shader.fragmentShader.includes(
      "normal=fenceSide;nonPerturbedNormal=fenceSide;",
    ),
  );
  assert.ok(shader.fragmentShader.includes("reflectedLight=fenceSum;"));
  assert.ok(shader.fragmentShader.includes("1.-fenceFrontDuty"));
  assert.ok(shader.fragmentShader.includes("diffuseColor.a=fenceTotal;"));
  assert.ok(!shader.fragmentShader.includes("normal=normalize(normal*"));
  assert.equal(
    shader.fragmentShader.split("#include <opaque_fragment>").length - 1,
    1,
  );
  assert.throws(() =>
    createIronworkersRadianceCoverageMaterial(
      new T.MeshPhysicalMaterial(),
      section,
    ),
  );
  assert.throws(() =>
    createIronworkersRadianceCoverageMaterial(source, { ...section, pitch: 0 }),
  );
});
test("projected rendering preserves exact physical members, contacts, split side domains and bounded draw capacity", () => {
  const boundary = createIronworkersPathBoundary(
    (t) => 5 + 40 * Math.sin(Math.PI * t),
    () => 0.07,
  );
  const original = boundary.members.map((m) => m.matrix.elements.slice());
  // Query the live finite support/contact providers before either rendering mode
  // exists. Include real top-surface centroids and physical member centres.
  const queries = [
    ...boundary.topTriangles
      .filter((_, i) => i % 173 === 0)
      .map((tri) =>
        [0, 1, 2].map((axis) => tri.reduce((n, p) => n + p[axis], 0) / 3),
      ),
    ...boundary.members.filter((_, i) => i % 1024 === 0).map((m) => m.centre),
  ];
  const contacts = () =>
    queries.map(([x, y, z]) => [
      boundary.supportAt(x, z),
      boundary.blockedAt(x, z, 0.25, y, true),
      boundary.blockedAt(x, z, 0.25, y, false),
      boundary.blockedAt(x, z, 0.25, y + 8, false),
    ]);
  const originalContacts = contacts();
  const steel = new T.MeshStandardMaterial(),
    plain = boundary.createRenderGroup(new T.MeshBasicMaterial(), steel),
    trial = boundary.createRenderGroup(new T.MeshBasicMaterial(), steel, {
      filterTrial: true,
    });
  const a = plain.group.children.filter((x): x is T.LOD => x instanceof T.LOD);
  const b = trial.group.children.filter((x) => x instanceof T.Group);
  assert.equal(a.length, b.length);
  assert.equal(plain.stats.maxDrawCalls, 24);
  assert.equal(trial.stats.maxDrawCalls, 87);
  const matrices = (mesh: T.InstancedMesh) =>
    Array.from({ length: mesh.instanceMatrix.count }, (_, i) =>
      Array.from(mesh.instanceMatrix.array.slice(i * 16, (i + 1) * 16)).join(
        ",",
      ),
    ).sort();
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].levels[1].distance, 2000);
    const old = a[i].levels[0].object as T.InstancedMesh;
    assert.equal(b[i].children.length, 4);
    const near = b[i].children.filter(
        (_, j) => j % 2 === 0,
      ) as T.InstancedMesh[],
      far = b[i].children.filter((_, j) => j % 2 === 1) as T.InstancedMesh[];
    assert.deepEqual(near.flatMap(matrices).sort(), matrices(old));
    for (const mesh of near) {
      assert.equal(mesh.material, steel);
      assert.equal(mesh.castShadow, true);
    }
    for (const mesh of far) {
      assert.equal(mesh.count, 0);
      assert.equal(mesh.castShadow, false);
      assert.equal((mesh.material as T.Material).depthWrite, false);
      assert.ok(mesh.boundingSphere);
    }
    assert.ok(
      far[0].boundingSphere!.center.distanceTo(far[1].boundingSphere!.center) >
        35,
    );
  }
  assert.deepEqual(
    boundary.members.map((m) => m.matrix.elements),
    original,
  );
  assert.deepEqual(
    (plain.group.children[0] as T.Mesh).geometry.attributes.position.array,
    (trial.group.children[0] as T.Mesh).geometry.attributes.position.array,
  );
  assert.deepEqual(contacts(), originalContacts);
  // Native Scene hook partitions matrices at render time; contacts must still
  // be backed by the original source members, including above-fence clearance.
  const scene = new T.Scene();
  scene.add(trial.group);
  scene.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(62, 821 / 839, 0.1, 3000);
  camera.position.set(6815.87, 6.8, -983.15);
  camera.lookAt(6815.7, 3.75, -994.85);
  camera.updateMatrixWorld(true);
  const renderer = {
    getCurrentViewport: (v: T.Vector4) => v.set(0, 0, 1108, 1133),
  } as T.WebGLRenderer;
  (scene.onBeforeRender as Function)(renderer, scene, camera, null);
  assert.deepEqual(contacts(), originalContacts);
  assert.deepEqual(
    boundary.members.map((m) => m.matrix.elements),
    original,
  );
  trial.disposeSelection?.();
});
