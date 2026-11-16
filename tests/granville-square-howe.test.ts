import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import clip from "polygon-clipping";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  pointInPoly,
  segmentPoint,
  type CityData,
  type Point,
} from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  buildGranvilleSquareHowe,
  granvilleSquareHowe,
  granvilleHoweReflection,
} from "../src/world/granville-square-howe";
import {
  createGranvilleHoweMaterials,
  GRANVILLE_HOWE_MINERAL_REPEAT_METRES as repeat,
} from "../src/world/granville-square-howe-materials";
import {
  GRANVILLE_HOWE_ID as ID,
  GRANVILLE_HOWE_RING as ring,
  GRANVILLE_HOWE_LOW_RING as lowRing,
  GRANVILLE_HOWE_HIGH_ROOF as highRoof,
  GRANVILLE_HOWE_HIGH_TOP as highTop,
  GRANVILLE_HOWE_LOW_TOP as lowTop,
  GRANVILLE_HOWE_SECTION as section,
  granvilleHoweFacades,
} from "../src/world/granville-square-howe-site";
import source from "../src/world/granville-square-howe-parts.json";
import { SceneReflections } from "../src/rendering/reflection-probes";

const library = { texture: () => new T.Texture<HTMLImageElement>() },
  materials = createGranvilleHoweMaterials(library, new T.Texture()),
  root = new T.Group(),
  batch = new Batcher(root);
assert.equal(
  buildGranvilleSquareHowe(batch, { id: ID, pts: ring.flat() }, materials),
  true,
);
const meshes = batch.finish();
root.updateMatrixWorld(true);
const vector = (p: [number, number, number]) => new T.Vector3(...p);
const ray = (a: T.Vector3, b: T.Vector3) =>
  new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b),
  ).intersectObject(root, true);
const materialOf = (hit: T.Intersection) => (hit.object as T.Mesh).material;
const near = (a: number, b: number, e = 0.0001) =>
  assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const area = (p: Point[]) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  ) / 2;
const polygonArea = (polys: Point[][][]) =>
  polys.reduce(
    (s, p) =>
      s + area(p[0]) - p.slice(1).reduce((h, hole) => h + area(hole), 0),
    0,
  );
function activeMap() {
  const data = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540,
    convert = (pts: number[]) => pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const group of [data.buildings, data.areas])
    for (const item of group) {
      item.pts = convert(item.pts);
      if (item.holes) item.holes = item.holes.map(convert);
    }
  data.ocean = [];
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return data as CityData;
}

test("dedicated Howe-wing dispatch retains the actual mapped collision footprint and excludes neighbours", () => {
  const data = activeMap(),
    building = data.buildings.find((b) => b.id === ID)!;
  assert.ok(building);
  const original = Array.from({ length: building.pts.length / 2 }, (_, i) =>
    building.pts.slice(i * 2, i * 2 + 2),
  ).reverse();
  assert.deepEqual(ring, original);
  const collision = new CollisionWorld(data);
  assert.equal(collision.blocked(518.0486, -427.2967, 0.3, 4.7), true);
  for (const id of [
    "w128409618",
    "w116527978",
    "w138256216",
    "w363651936",
    "n3633792226",
  ]) {
    const fresh = new Batcher(new T.Group());
    assert.equal(
      buildGranvilleSquareHowe(fresh, { id, pts: ring.flat() }, materials),
      false,
    );
    assert.equal(
      granvilleSquareHowe({ id, pts: ring.flat() }, fresh, library, []),
      false,
    );
    assert.equal(fresh.groups.size, 0);
  }
  const architecture = fs.readFileSync("src/world/architecture.ts", "utf8");
  assert.ok(
    architecture.indexOf("granvilleSquareHowe(b, shell, m, reflections)") <
      architecture.indexOf("heritage ="),
  );
});

test("City shared roof boundary is registered without holes, overlaps, or slender leftover roofs", () => {
  assert.deepEqual(
    source.sourceParts.map((p) => p.id).sort(),
    [161153, 162139],
  );
  for (const [index, edge] of [
    [0, 5],
    [2, 1],
  ]) {
    const p = source.sharedBoundary.source[index] as Point,
      q = source.sharedBoundary.registered[index] as Point,
      registered = segmentPoint(
        ...p,
        ...ring[edge],
        ...ring[(edge + 1) % ring.length],
      );
    near(
      q[0],
      ring[edge][0] +
        registered.t * (ring[(edge + 1) % ring.length][0] - ring[edge][0]),
    );
    near(
      q[1],
      ring[edge][1] +
        registered.t * (ring[(edge + 1) % ring.length][1] - ring[edge][1]),
    );
    assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.4);
  }
  assert.deepEqual(
    source.sharedBoundary.registered[1],
    source.sharedBoundary.source[1],
  );
  near(polygonArea(highRoof) + area(lowRing), area(ring), 1e-7);
  assert.equal(
    polygonArea(clip.intersection(highRoof, [lowRing]) as Point[][][]),
    0,
  );
  assert.deepEqual(clip.difference([ring], [lowRing]), highRoof);
  near(highTop - lowTop, 34.4 - 30.12);
  near(
    highTop,
    source.sourceParts.find((p) => p.id === 161153)!.topElevation -
      source.cityDatumOffset,
  );
  assert.equal(
    granvilleHoweFacades().filter((f) => f.edge === 3)[0].top,
    highTop,
  );
});

test("each source roof has one upward closure and the height break has an opaque facing wall", () => {
  for (const [x, z, y] of [
    [529, -410, lowTop],
    [527, -440, highTop],
  ]) {
    const hits = ray(new T.Vector3(x, 22, z), new T.Vector3(x, 0.1, z)).filter(
      (h) => materialOf(h) === materials.roof,
    );
    assert.equal(hits.length, 1);
    near(hits[0].point.y, y);
    assert.ok(hits[0].face!.normal.y > 0.999);
  }
  const shared = source.sharedBoundary.registered as Point[],
    f = facadeFrame(shared[0], shared[1]),
    y = (lowTop + highTop) / 2;
  const hits = ray(
    vector(f.p(f.length * 0.43, y, -1)),
    vector(f.p(f.length * 0.43, y, 1)),
  );
  assert.equal(materialOf(hits[0]), materials.concrete);
});

test("ordinary eye-height windows and upper windows have metre-deep closed glass and four concrete reveals", () => {
  const f = facadeFrame(ring[3], ring[4]),
    count = Math.round(f.length / section.targetBay),
    width = f.length / count,
    u = width * 3.5,
    left = width * 3 + section.pier / 2;
  for (const row of [section.lower, section.middle, section.upper]) {
    const y = (row.sill + row.head) / 2,
      hits = ray(
        vector(f.p(u + 0.2, y, -0.3)),
        vector(f.p(u + 0.2, y, row.recess + 0.3)),
      );
    assert.equal(materialOf(hits[0]), materials.glass);
    near(hits[0].distance, row.recess - 0.006 + 0.3);
    const floor = ray(
      vector(f.p(u, row.sill + 0.25, row.recess / 2)),
      vector(f.p(u, row.sill - 0.25, row.recess / 2)),
    );
    const ceiling = ray(
      vector(f.p(u, row.head - 0.25, row.recess / 2)),
      vector(f.p(u, row.head + 0.25, row.recess / 2)),
    );
    const side = ray(
      vector(f.p(left + 0.2, y, row.recess / 2)),
      vector(f.p(left - 0.2, y, row.recess / 2)),
    );
    for (const list of [floor, ceiling, side])
      assert.equal(materialOf(list[0]), materials.concrete);
  }
});

test("the concrete belt is a physical splay, with closed recessed joints and end returns", () => {
  const f = facadeFrame(ring[3], ring[4]),
    b = section.belt,
    y = 9.2,
    width = f.length / Math.round(f.length / section.targetBay),
    expected =
      b.lowDepth +
      ((b.highDepth - b.lowDepth) * (y - b.low)) / (b.knee - b.low);
  for (const [u, extra, material] of [
    [width * 2.5, 0, materials.concrete],
    [width * 3 - 0.012, 0.025, materials.frame],
  ] as const) {
    const hits = ray(vector(f.p(u, y, -0.2)), vector(f.p(u, y, 1.6)));
    assert.equal(materialOf(hits[0]), material);
    near(hits[0].distance, expected + extra + 0.2);
    assert.ok(
      hits[0].face!.normal.y < -0.3,
      "splayed face has real downward normal",
    );
  }
  const endHits = ray(vector(f.p(-0.05, 9.3, 0.2)), vector(f.p(0.1, 9.3, 0.2)));
  assert.ok(
    endHits.some((hit) => materialOf(hit) === materials.concrete),
    "the concrete belt terminates behind the overlapping closed sign return",
  );
});

test("sign is a closed two-metre-deep volume with street-facing left-to-right lettering", () => {
  const f = facadeFrame(ring[2], ring[3]),
    y = (highTop + section.signTop) / 2;
  const front = ray(vector(f.p(4.1, y, -0.3)), vector(f.p(4.1, y, 0.4)));
  const rear = ray(vector(f.p(4.1, y, 2.3)), vector(f.p(4.1, y, 1.7)));
  const top = ray(vector(f.p(4.1, 16.2, 1)), vector(f.p(4.1, 15.7, 1)));
  for (const list of [front, rear, top])
    assert.equal(materialOf(list[0]), materials.sign);
  const letters = meshes.find(
      (mesh) => mesh.material === materials.lettering,
    )!.geometry,
    p = letters.getAttribute("position"),
    uv = letters.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    near(p.getY(i), uv.getY(i) ? 5.95 : 4.6);
    const expected = f.p(uv.getX(i) ? 2.08 : 5.68, p.getY(i), 0.106);
    near(p.getX(i), expected[0]);
    near(p.getZ(i), expected[2]);
  }
  // Test the outside observer's screen axes, independently of façade-local
  // along direction. Merely checking local vertex U values missed mirroring.
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 30),
    centre = vector(f.p(3.88, 5.275, 0.106)),
    letterMesh = meshes.find((mesh) => mesh.material === materials.lettering)!;
  camera.position.copy(vector(f.p(3.88, 5.275, -5)));
  camera.lookAt(centre);
  camera.updateMatrixWorld(true);
  const screenRight = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  for (const [screenX, expectedU] of [
    [-0.9, 0.25],
    [0.9, 0.75],
  ]) {
    const target = centre.clone().addScaledVector(screenRight, screenX),
      caster = new T.Raycaster(
        camera.position,
        target.clone().sub(camera.position).normalize(),
        0,
        10,
      ),
      hits = caster.intersectObject(letterMesh);
    assert.equal(
      hits.length,
      1,
      "the actual outward face is visible from the street",
    );
    near(hits[0].uv!.x, expectedU);
    near(hits[0].uv!.y, 0.5);
  }
});

test("all geometry remains inside the collision outline, normals are finite and concrete UVs are metric", () => {
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        distance = Math.min(
          ...ring.map(
            (a, j) =>
              segmentPoint(x, z, ...a, ...ring[(j + 1) % ring.length]).d,
          ),
        );
      assert.ok(pointInPoly(x, z, ring.flat()) || distance < 0.0001);
      near(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)), 1);
    }
  }
  const g = meshes.find(
      (mesh) => mesh.material === materials.concrete,
    )!.geometry,
    p = g.getAttribute("position"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < p.count; i += 4)
    for (const j of [i + 1, i + 3]) {
      near(
        Math.hypot(
          p.getX(j) - p.getX(i),
          p.getY(j) - p.getY(i),
          p.getZ(j) - p.getZ(i),
        ),
        Math.hypot(uv.getX(j) - uv.getX(i), uv.getY(j) - uv.getY(i)),
      );
    }
  assert.ok(meshes.reduce((s, m) => s + m.geometry.index!.count / 3, 0) < 3200);
  assert.equal(meshes.length, 6);
});

test("materials reuse isolated CC0 samplers and do not add photographic facades or emissive fill", () => {
  const original = new T.Texture<HTMLImageElement>();
  original.repeat.set(7, 9);
  const requested: string[] = [],
    m = createGranvilleHoweMaterials({
      texture(path: string) {
        requested.push(path);
        return original;
      },
    });
  assert.deepEqual(
    requested,
    ["color", "normal", "roughness"].map(
      (s) => `canada-place-plinth/${s}.webp`,
    ),
  );
  assert.deepEqual(original.repeat.toArray(), [7, 9]);
  for (const t of [
    m.concrete.map!,
    m.concrete.normalMap!,
    m.concrete.roughnessMap!,
  ]) {
    assert.notEqual(t, original);
    near(t.repeat.x, 1 / repeat);
    near(t.repeat.y, 1 / repeat);
  }
  assert.equal(m.concrete.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(m.concrete.normalMap!.colorSpace, T.NoColorSpace);
  assert.equal(m.concrete.metalness, 0);
  assert.equal(m.sign.metalness, 0);
  for (const material of Object.values(m)) {
    assert.equal(material.transparent, material === m.glass);
    assert.equal(material.emissive.getHex(), 0);
  }
  assert.equal(m.glass.clearcoat, 0);
  assert.equal(m.glass.metalness, 0);
  assert.equal(m.glass.ior, 1.5);
  assert.equal(m.glass.roughness, 0.12);
  assert.equal(m.glass.color.getHex(), 0xffffff);
  assert.equal(m.glass.depthWrite, false);
  assert.equal(m.glass.blending, T.CustomBlending);
  assert.equal(m.glass.blendSrc, T.OneFactor);
  assert.equal(m.glass.blendDst, T.OneMinusSrcAlphaFactor);
  assert.equal(m.glass.userData.castShadow, false);
  const shader = {
    uniforms: {},
    vertexShader: "",
    fragmentShader: "#include <common>\n#include <opaque_fragment>",
  };
  m.glass.onBeforeCompile(shader as never, {} as T.WebGLRenderer);
  assert.deepEqual(shader.uniforms, { lobbyThroughput: { value: 0.82 } });
  assert.match(
    shader.fragmentShader,
    /outgoingLight=totalSpecular\*lobbyReflectionGain/,
  );
  assert.match(shader.fragmentShader, /diffuseColor.a=1.0-lobbyTransmission/);
});

test("shared forecourt supports the wing while its building datum stays horizontal", () => {
  const collision = new CollisionWorld(activeMap()),
    f = facadeFrame(ring[3], ring[4]);
  const outside = f.p(f.length / 2, 0, -0.4);
  assert.ok(
    Math.abs(collision.baselineGroundHeight(outside[0], outside[2]) - 7.93) <
      0.5,
    "the shared station terrace replaces the unsupported zero near adopted H15.6",
  );
  assert.ok(collision.baselineGroundHeight(484.88676475, -454.8268214) > 4.5);
  const shiftedRoot = new T.Group(),
    shifted = new Batcher(shiftedRoot);
  shifted.offsetY = 2.3;
  buildGranvilleSquareHowe(shifted, { id: ID, pts: ring.flat() }, materials);
  const shiftedMeshes = shifted.finish();
  shiftedMeshes.forEach((mesh, i) => {
    const a = mesh.geometry.getAttribute("position"),
      b = meshes[i].geometry.getAttribute("position");
    assert.equal(a.count, b.count);
    for (let j = 0; j < a.count; j++) near(a.getY(j), b.getY(j) + 2.3);
  });
});

test("Howe ribbon capture is outside the owning facade at bounded resolution and tracks datum", () => {
  const collision = new CollisionWorld(activeMap());
  const datum = collision.groundHeight(518.048598556, -427.296666667);
  const spec = granvilleHoweReflection(materials.glass, datum);
  const f = facadeFrame(ring[3], ring[4]);
  const midpoint = vector(f.p(f.length / 2, datum + 9.75, 0));
  const delta = vector(spec.position).sub(midpoint);
  near(delta.length(), 1.2);
  near(delta.dot(new T.Vector3(f.outward[0], 0, f.outward[1])), 1.2);
  assert.equal(
    collision.blocked(
      spec.position[0],
      spec.position[2],
      0.15,
      spec.position[1],
    ),
    false,
  );
  assert.equal(spec.resolution, 256);
  assert.deepEqual(spec.materials, [materials.glass]);
  assert.deepEqual(spec.intensity, { day: 0.9, night: 0.9 });
  const moved = granvilleHoweReflection(materials.glass, datum + 2.3);
  near(moved.position[1] - spec.position[1], 2.3);
  near(moved.position[0], spec.position[0]);
  near(moved.position[2], spec.position[2]);
});

test("dielectric glazing keeps the original closed backing immediately behind every visible ribbon", () => {
  const f = facadeFrame(ring[3], ring[4]);
  for (const row of [section.lower, section.middle, section.upper]) {
    const width = f.length / Math.round(f.length / section.targetBay);
    for (let i = 0; i < Math.round(f.length / section.targetBay); i++) {
      const u = width * (i + 0.3),
        y = (row.sill + row.head) / 2;
      const hits = ray(
        vector(f.p(u, y, -0.1)),
        vector(f.p(u, y, row.recess + 0.1)),
      );
      assert.equal(materialOf(hits[0]), materials.glass);
      assert.equal(materialOf(hits[1]), materials.frame);
      near(hits[1].distance - hits[0].distance, 0.006, 0.0003);
    }
  }
});

test("local capture hides every wing receiver, keeps the real surroundings, and restores the borrowed scene", () => {
  const scene = new T.Scene(),
    sun = new T.DirectionalLight(),
    actor = new T.Group();
  sun.position.set(100, 330, 250);
  const neighbor = new T.Mesh(
    new T.BoxGeometry(),
    new T.MeshPhysicalMaterial(),
  );
  neighbor.position.set(505, 12, -440);
  root.add(neighbor);
  scene.add(root, sun, sun.target, actor);
  scene.updateMatrixWorld(true);
  const spec = granvilleHoweReflection(materials.glass, 0);
  const captures = new SceneReflections(scene, root, meshes, sun, [spec]);
  const receivers = meshes.filter((mesh) => mesh.material === materials.glass);
  assert.equal(
    receivers.length,
    1,
    "all wing panes share one uniquely owned capture receiver",
  );
  const backing = meshes.find((mesh) => mesh.material === materials.frame)!;
  const original = {
    receivers: receivers.map((mesh) => mesh.visible),
    backing: backing.visible,
  };
  let sampled = false;
  captures.probes[0].camera.update = () => {
    sampled = true;
    for (const mesh of receivers) assert.equal(mesh.visible, false);
    assert.equal(
      backing.visible,
      true,
      "existing dark window closures remain real scene geometry",
    );
    assert.equal(
      neighbor.visible,
      true,
      "neighboring glass is not excluded by a broad material class",
    );
    assert.equal(
      actor.visible,
      false,
      "moving gameplay actors are not baked into the cube",
    );
  };
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: false },
    xr: { enabled: false },
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget() {},
  } as unknown as T.WebGLRenderer;
  captures.setNight(false);
  try {
    captures.update(renderer, vector(spec.position));
    assert.equal(sampled, true);
    assert.equal(captures.lastError, null);
    assert.equal(captures.captures, 1);
    assert.equal(materials.glass.envMap, captures.probes[0].target.texture);
    assert.deepEqual(
      receivers.map((mesh) => mesh.visible),
      original.receivers,
    );
    assert.equal(backing.visible, original.backing);
    assert.equal(actor.visible, true);
    assert.equal(neighbor.material.envMap, null);
    captures.invalidate();
    assert.equal(
      materials.glass.envMap,
      null,
      "invalidated lighting falls back without retaining a stale capture",
    );
  } finally {
    captures.dispose();
    root.remove(neighbor);
    scene.remove(root);
    neighbor.geometry.dispose();
    neighbor.material.dispose();
  }
});
