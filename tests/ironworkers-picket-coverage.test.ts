import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createIronworkersPicketCoverageMaterial,
  ironworkersFilteredPicketCoverage,
  ironworkersProjectedPicketDuty,
} from "../src/world/ironworkers-picket-coverage";
import {
  createIronworkersPathBoundary,
  IRONWORKERS_PATH,
} from "../src/world/ironworkers-path-boundary";
import {
  IRONWORKERS_PLAN_LENGTH,
  ironworkersPoint,
  ironworkersTAtDistance,
  ironworkersGradeT,
} from "../src/world/ironworkers-alignment";
import { BRIDGES, bridgeY } from "../src/world/collision";

const section = { width: 0.05, depth: 0.04, pitch: 0.13 };

test("grazing coverage agrees with rays through actual rectangular bars, including closed projected gaps", () => {
  const boxes = [-2, -1, 0, 1, 2].map(
    (i) =>
      new T.Box3(
        new T.Vector3(
          i * section.pitch - section.width / 2,
          0,
          -section.depth / 2,
        ),
        new T.Vector3(
          i * section.pitch + section.width / 2,
          3,
          section.depth / 2,
        ),
      ),
  );
  const ray = new T.Ray(),
    hit = new T.Vector3(),
    samples = 4096;
  for (const slope of [0, 0.5, -1, 2, -5]) {
    let hits = 0;
    for (let i = 0; i < samples; i++) {
      const x = ((i + 0.5) / samples - 0.5) * section.pitch;
      ray.origin.set(x - slope, 1, -1);
      ray.direction.set(slope, 0, 1).normalize();
      if (boxes.some((b) => ray.intersectBox(b, hit))) hits++;
    }
    assert.ok(
      Math.abs(
        hits / samples - ironworkersProjectedPicketDuty(section, slope, 1),
      ) <
        2 / samples,
    );
  }
  assert.equal(ironworkersProjectedPicketDuty(section, 1, 0), 1);
  assert.ok(
    ironworkersProjectedPicketDuty(section, 0, 1) < 0.4,
    "frontal fence must retain its real open fraction",
  );
});

test("pixel-footprint filtering preserves average coverage and agrees with dense independent samples", () => {
  for (const duty of [0.05 / 0.13, 0.7, 1]) {
    for (const cell of [-2.27, 0.06, 0.5, 1.93]) {
      for (const width of [0.02, 0.3, 1, 4.7, 12]) {
        let covered = 0;
        const n = 16384;
        for (let i = 0; i < n; i++) {
          const s = cell + ((i + 0.5) / n - 0.5) * width;
          const frac = s - Math.floor(s);
          if (Math.abs(frac - 0.5) <= duty * 0.5) covered++;
        }
        const actual = ironworkersFilteredPicketCoverage(cell, width, duty);
        assert.ok(Math.abs(actual - covered / n) < 0.001);
        assert.ok(Number.isFinite(actual) && actual >= 0 && actual <= 1);
        if (Number.isInteger(width)) assert.ok(Math.abs(actual - duty) < 1e-10);
      }
    }
  }
});

test("far shader preserves steel response and applies coverage once without alpha-test cutoff", () => {
  const source = new T.MeshStandardMaterial({
    color: 0xa7afac,
    metalness: 0.75,
    roughness: 0.5,
  });
  const material = createIronworkersPicketCoverageMaterial(source, section);
  assert.deepEqual(material.color, source.color);
  assert.equal(material.metalness, source.metalness);
  assert.equal(material.roughness, source.roughness);
  assert.equal(material.alphaToCoverage, true);
  assert.equal(
    material.transparent,
    false,
    "MSAA coverage must not also be alpha blended",
  );
  assert.equal(material.alphaTest, 0, "no threshold may erase subpixel bars");
  assert.equal(material.depthWrite, true);
  assert.equal(source.alphaToCoverage, false);
  const shader = {
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  assert.ok(
    shader.vertexShader.includes("mat3(instanceMatrix)*ironworkersAlong"),
  );
  assert.ok(shader.fragmentShader.includes("fwidth(vIronworkersPicketCell)"));
  assert.ok(
    shader.fragmentShader.indexOf("diffuseColor.a=ironworkersBarCoverage") <
      shader.fragmentShader.indexOf("#include <opaque_fragment>"),
  );
  assert.deepEqual(
    shader.uniforms.ironworkersPicketSection.value.toArray(),
    [0.05, 0.04, 0.13],
  );
  assert.throws(() =>
    createIronworkersPicketCoverageMaterial(source, { ...section, pitch: 0 }),
  );
  material.dispose();
  source.dispose();
});

test("installed far cells preserve physical member centres, near boxes and LOD/contact budgets", () => {
  const boundary = createIronworkersPathBoundary(
    (t) => 5 + 40 * Math.sin(Math.PI * t),
    () => 0.07,
  );
  const memberCount = boundary.members.length;
  const memberMatrices = boundary.members.map((m) => m.matrix.elements.slice());
  const view = boundary.createRenderGroup(
    new T.MeshBasicMaterial(),
    new T.MeshStandardMaterial(),
  );
  const actualPitch =
    IRONWORKERS_PLAN_LENGTH /
    Math.ceil(IRONWORKERS_PLAN_LENGTH / IRONWORKERS_PATH.picketPitch);
  const a = new T.Matrix4(),
    b = new T.Matrix4();
  let lods = 0;
  for (const child of view.group.children) {
    if (!(child instanceof T.LOD)) continue;
    lods++;
    assert.equal(child.levels[1].distance, IRONWORKERS_PATH.nearDistance);
    assert.equal(child.levels[1].hysteresis, IRONWORKERS_PATH.nearHysteresis);
    const near = child.levels[0].object as T.InstancedMesh;
    const far = child.levels[1].object as T.InstancedMesh;
    assert.equal(near.count, far.count);
    assert.equal(near.geometry.type, "BoxGeometry");
    assert.equal(far.geometry.type, "PlaneGeometry");
    assert.equal((near.material as T.Material).alphaToCoverage, false);
    assert.equal(
      (far.material as T.Material).userData.ironworkersPicketCoverage.pitch,
      actualPitch,
    );
    for (const i of [0, near.count - 1]) {
      near.getMatrixAt(i, a);
      far.getMatrixAt(i, b);
      assert.deepEqual(a.elements.slice(12, 15), b.elements.slice(12, 15));
      assert.ok(
        Math.abs(
          Math.hypot(...a.elements.slice(0, 3)) - IRONWORKERS_PATH.picketWidth,
        ) < 1e-7,
      );
      assert.ok(
        Math.abs(Math.hypot(...b.elements.slice(0, 3)) - actualPitch) < 1e-7,
      );
    }
  }
  assert.equal(view.stats.maxDrawCalls, lods + 3);
  assert.equal(boundary.members.length, memberCount);
  assert.deepEqual(
    boundary.members.map((m) => m.matrix.elements),
    memberMatrices,
  );
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  view.group.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
});

test("mid-distance LOD protects close physical bars across walking/car chunk phases, including hysteresis", () => {
  const bridge = BRIDGES.find((b) => b.id === "ironworkers")!;
  const height = (t: number) => bridgeY(bridge, t, [0, 0]);
  const boundary = createIronworkersPathBoundary(height, () => 0.07);
  const view = boundary.createRenderGroup(
    new T.MeshBasicMaterial(),
    new T.MeshStandardMaterial(),
  );
  const lods = view.group.children.filter(
    (o): o is T.LOD => o instanceof T.LOD,
  );
  view.group.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(),
    matrix = new T.Matrix4(),
    p = new T.Vector3();
  // Include the fine full-span sweep's worst transition stations plus phases
  // across a whole chunk at the slope and crest. Force far visibility first so
  // the return threshold, not only the easier outward threshold, is exercised.
  const stations = [
    74.5,
    75.5,
    77,
    1208,
    1268,
    ...Array.from({ length: 33 }, (_, i) => 64 + i * 2),
    ...Array.from({ length: 33 }, (_, i) => 640 + i * 2),
  ];
  for (const mode of [
    { side: 16.55, y: 2.632 },
    { side: 8, y: 3.808 },
    { side: 12.5, y: 3.808 },
  ]) {
    for (const sign of [-1, 1])
      for (const s of stations) {
        camera.position.set(0, 1000, 0);
        camera.updateMatrixWorld(true);
        for (const lod of lods) lod.update(camera);
        const [x, z] = ironworkersPoint(
          ironworkersTAtDistance(s),
          sign * mode.side,
        );
        camera.position.set(
          x,
          height(ironworkersGradeT(x, z)) + 0.12 + mode.y,
          z,
        );
        camera.updateMatrixWorld(true);
        for (const lod of lods) {
          lod.update(camera);
          if (lod.getCurrentLevel() !== 1) continue;
          const near = lod.levels[0].object as T.InstancedMesh;
          // First/last pickets bound the closest end of each unbent short cell.
          for (const i of [0, near.count - 1]) {
            near.getMatrixAt(i, matrix);
            p.setFromMatrixPosition(matrix).add(lod.position);
            const horizontal = Math.hypot(p.x - x, p.z - z);
            const vertical = Math.max(
              0,
              Math.abs(p.y - camera.position.y) - 1.5,
            );
            assert.ok(
              Math.hypot(horizontal, vertical) - 0.033 > 10,
              `physical bar switched too close at station ${s}, side ${sign * mode.side}`,
            );
          }
        }
      }
  }
  assert.equal(view.stats.maxDrawCalls, 24);
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  view.group.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
});
