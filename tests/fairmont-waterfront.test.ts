import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import { KX, ORIGIN, pointInPoly, segmentPoint } from "../src/world/data";
import {
  buildFairmontWaterfront,
  type FairmontWaterfrontMaterials,
} from "../src/world/fairmont-waterfront";
import { createFairmontWaterfrontMaterials } from "../src/world/fairmont-waterfront-materials";
import {
  FAIRMONT_WATERFRONT_ID as ID,
  FAIRMONT_WATERFRONT_HEIGHT as H,
  FAIRMONT_WATERFRONT_RING as ring,
  FAIRMONT_WATERFRONT_PARTS as parts,
  FAIRMONT_WATERFRONT_CANOPY_RING as canopy,
  FAIRMONT_WATERFRONT_CANOPY_SOURCE_RING as canopySource,
  FAIRMONT_WATERFRONT_CANOPY_TOP as canopyTop,
  FAIRMONT_WATERFRONT_CANOPY_UNDERSIDE as canopyBottom,
  fairmontWaterfrontLevel,
  fairmontWaterfrontPartHeight,
} from "../src/world/fairmont-waterfront-site";
import { fairmontWaterfront } from "../src/world/fairmont-waterfront-building";
import type { Building } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
import { CollisionWorld } from "../src/world/collision";
import { createFairmontArcadeSite } from "../src/world/fairmont-arcade-site";

function fixture() {
  const root = new T.Group(),
    batch = new Batcher(root);
  const m = createFairmontWaterfrontMaterials({
    texture: () => new T.Texture(),
  });
  batch.offsetY = 0;
  assert.equal(
    buildFairmontWaterfront(batch, { id: ID, pts: ring.flat() }, m),
    true,
  );
  assert.equal(batch.offsetY, 0);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { root, meshes, m };
}
const built = fixture();
const ray = (from: T.Vector3, to: T.Vector3) =>
  new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to) + 0.01,
  ).intersectObject(built.root, true);

test("Fairmont Waterfront replaces only the correct hotel and retains the existing collision outline", () => {
  const batch = new Batcher(new T.Group());
  for (const id of ["w143683980", "w143683979", "w138256216"])
    assert.equal(
      buildFairmontWaterfront(batch, { id, pts: ring.flat() }, built.m),
      false,
    );
  assert.equal(batch.groups.size, 0);
  const d = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8"));
  const b = d.buildings.find((b: { id: string }) => b.id === ID);
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const actual: number[] = b.pts.map(
    (v: number, i: number) => v / 2 - (i % 2 ? oz : ox),
  );
  assert.equal(ring.length, actual.length / 2);
  for (const [x, z] of ring)
    assert.ok(
      actual.some(
        (v, i) => i % 2 === 0 && Math.hypot(v - x, actual[i + 1] - z) < 0.00001,
      ),
    );
});

test("registered curved tower, inset crown and stepped wing use bounded separate source parts", () => {
  assert.equal(H, 69.44);
  assert.equal(fairmontWaterfrontLevel(23), H);
  assert.equal(fairmontWaterfrontLevel(2), 8);
  assert.equal(fairmontWaterfrontLevel(21), 64);
  assert.deepEqual(
    parts.map((p) => p.high),
    [64, 69.44, 26, 20, 14],
  );
  assert.ok(parts[0].ring.length > 20);
  assert.ok(parts[1].ring.length > 20);
  for (const part of parts)
    for (const [x, z] of part.ring) {
      const edge = ring.reduce(
        (d, a, i) =>
          Math.min(
            d,
            segmentPoint(x, z, ...a, ...ring[(i + 1) % ring.length]).d,
          ),
        Infinity,
      );
      assert.ok(
        pointInPoly(x, z, ring.flat()) || edge < 0.00001,
        "parts stay in mapped hotel envelope",
      );
    }
  assert.equal(fairmontWaterfrontPartHeight(450, -467), 69.44);
  assert.equal(fairmontWaterfrontPartHeight(432, -478), 26);
  assert.equal(fairmontWaterfrontPartHeight(421, -477), 20);
  assert.equal(fairmontWaterfrontPartHeight(418, -477), 14);
  assert.equal(fairmontWaterfrontPartHeight(400, -472), 8);
});

test("complete hotel geometry has finite outward faces, metric panel UVs and bounded cost", () => {
  let triangles = 0,
    max = -Infinity,
    min = Infinity;
  for (const mesh of built.meshes) {
    const g = mesh.geometry,
      p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      uv = g.getAttribute("uv"),
      ix = g.index!;
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
        ].every(Number.isFinite),
      );
      max = Math.max(max, p.getY(i));
      min = Math.min(min, p.getY(i));
    }
    for (let i = 0; i < ix.count; i += 3) {
      const a = ix.getX(i),
        b = ix.getX(i + 1),
        c = ix.getX(i + 2);
      const cross = new T.Vector3()
        .fromBufferAttribute(p, b)
        .sub(new T.Vector3().fromBufferAttribute(p, a))
        .cross(
          new T.Vector3()
            .fromBufferAttribute(p, c)
            .sub(new T.Vector3().fromBufferAttribute(p, a)),
        );
      if (cross.lengthSq() > 1e-12)
        assert.ok(
          cross.dot(new T.Vector3().fromBufferAttribute(n, a)) >= -1e-6,
        );
    }
    triangles += ix.count / 3;
    if (mesh.material === built.m.panel)
      assert.ok(Array.from(uv.array).some((v) => Math.abs(v) > 3));
  }
  assert.ok(Math.abs(max - H) < 0.00001);
  assert.equal(min, 0);
  assert.ok(
    triangles > 12000 && triangles < 55000,
    `hotel triangles ${triangles}`,
  );
  assert.ok(built.meshes.length <= 9);
});

test("tower and lobby windows have real recesses with glass ahead of closed backings", () => {
  const check = (
    a: [number, number],
    b: [number, number],
    y: number,
    lobby = false,
  ) => {
    const f = facadeFrame(a, b),
      cols = Math.max(1, Math.round(f.length / (lobby ? 5.5 : 3.8)));
    const u = (f.length / cols) * 0.27;
    const outside = f.p(u, y, -2),
      inside = f.p(u, y, 1.2);
    const hits = ray(new T.Vector3(...outside), new T.Vector3(...inside));
    assert.ok(hits.length > 1, "glass and backing both present");
    assert.equal((hits[0].object as T.Mesh).material, built.m.glass);
    assert.ok(hits.some((h) => (h.object as T.Mesh).material === built.m.dark));
    const glassDepth = lobby ? 0.7 : 0.32;
    assert.ok(Math.abs(hits[0].distance - (2 + glassDepth)) < 0.003);
  };
  const tower = parts[0].ring;
  const index = tower.findIndex(
    (a, i) =>
      Math.hypot(
        tower[(i + 1) % tower.length][0] - a[0],
        tower[(i + 1) % tower.length][1] - a[1],
      ) > 20,
  );
  assert.ok(index >= 0);
  check(tower[index], tower[(index + 1) % tower.length], 40);
  const baseIndex = ring.findIndex(
    (a, i) =>
      i > 2 &&
      Math.hypot(
        ring[(i + 1) % ring.length][0] - a[0],
        ring[(i + 1) % ring.length][1] - a[1],
      ) > 20,
  );
  check(ring[baseIndex], ring[(baseIndex + 1) % ring.length], 2, true);
});

test("each roof stage is closed at its source-bound height rather than one generic slab", () => {
  for (const [x, z, h] of [
    [450, -467, H],
    [468, -467, 64],
    [432, -478, 26],
    [421, -477, 20],
    [418, -477, 14],
    [400, -472, 8],
  ]) {
    const hits = ray(new T.Vector3(x, 90, z), new T.Vector3(x, -1, z));
    assert.ok(hits.length);
    assert.ok(
      Math.abs(hits[0].point.y - h) < 0.001,
      `${x},${z}: ${hits[0].point.y}, expected ${h}`,
    );
  }
});

test("Howe canopy retains its mapped projection and has one transparent sheet with no opaque ceiling", () => {
  assert.equal(canopy.length, 15);
  for (let i = 0; i < canopy.length; i++) {
    if (i >= 1 && i <= 7) {
      assert.ok(
        pointInPoly(...canopy[i], ring.flat()),
        "attachment enters the retained wall",
      );
      assert.ok(
        Math.hypot(
          canopy[i][0] - canopySource[i][0],
          canopy[i][1] - canopySource[i][1],
        ) < 2.7,
      );
    } else assert.deepEqual(canopy[i], canopySource[i]);
  }
  for (const [x, z] of [
    [475, -466],
    [473, -480],
    [475, -456],
  ]) {
    assert.ok(pointInPoly(x, z, canopy.flat()));
    assert.ok(!pointInPoly(x, z, ring.flat()));
    const top = ray(new T.Vector3(x, 15, z), new T.Vector3(x, 0, z));
    const underside = ray(new T.Vector3(x, 0, z), new T.Vector3(x, 15, z));
    assert.ok(
      top.length && underside.length,
      "both sides of the canopy have actual faces",
    );
    assert.ok(
      top[0].point.y >= canopyTop - 0.061 &&
        top[0].point.y <= canopyTop + 0.001,
    );
    const sheetAbove = top.filter(
      (h) => (h.object as T.Mesh).material === built.m.canopyGlass,
    );
    const sheetBelow = underside.filter(
      (h) => (h.object as T.Mesh).material === built.m.canopyGlass,
    );
    // A ray on a tessellation vertex may hit adjacent triangles of the same
    // sheet. Count distinct surface depths, not those coincident boundary hits.
    assert.equal(new Set(sheetAbove.map((h) => h.point.y.toFixed(4))).size, 1);
    assert.equal(new Set(sheetBelow.map((h) => h.point.y.toFixed(4))).size, 1);
    assert.ok(Math.abs(sheetAbove[0].point.y - sheetBelow[0].point.y) < 1e-5);
    assert.ok(
      !underside.some((h) => (h.object as T.Mesh).material === built.m.dark),
      "no opaque full-area soffit remains below the glazed roof",
    );
  }
});

test("Howe canopy clears the active approach grade and adds no low posts outside the hotel", () => {
  const d = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8"));
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (pts: number[]) =>
    pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const group of [d.buildings, d.areas])
    for (const item of group) {
      item.pts = convert(item.pts);
      if (item.holes) item.holes = item.holes.map(convert);
    }
  d.ocean = [];
  d.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const collision = new CollisionWorld(d);
  assert.ok(
    collision.canada,
    "use current named roads so the raised Canada approach is active",
  );
  const grade = collision.baselineGroundHeight.bind(collision),
    site = createFairmontArcadeSite(grade),
    activeRoot = new T.Group(),
    activeBatch = new Batcher(activeRoot);
  buildFairmontWaterfront(
    activeBatch,
    { id: ID, pts: ring.flat() },
    built.m,
    grade,
  );
  const activeMeshes = activeBatch.finish();
  activeRoot.updateMatrixWorld(true);
  let minimum = Infinity,
    samples = 0;
  const check = (x: number, z: number) => {
    if (pointInPoly(x, z, ring.flat())) return;
    minimum = Math.min(
      minimum,
      site.canopyTopAt(x, z) - 0.64 - collision.baselineGroundHeight(x, z),
    );
    samples++;
  };
  for (let x = 463; x <= 480; x += 0.5)
    for (let z = -494; z <= -450; z += 0.5)
      if (pointInPoly(x, z, canopy.flat())) check(x, z);
  for (let i = 0; i < canopy.length; i++) {
    const a = canopy[i],
      b = canopy[(i + 1) % canopy.length];
    for (let j = 0; j <= 32; j++)
      check(a[0] + ((b[0] - a[0]) * j) / 32, a[1] + ((b[1] - a[1]) * j) / 32);
  }
  assert.ok(samples > 1000);
  assert.ok(minimum > 4.5, `minimum modeled head clearance ${minimum}`);
  for (const mesh of activeMeshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      if (pointInPoly(x, z, ring.flat())) continue;
      const distance = ring.reduce(
        (d, a, j) =>
          Math.min(
            d,
            segmentPoint(x, z, ...a, ...ring[(j + 1) % ring.length]).d,
          ),
        Infinity,
      );
      if (distance > 0.08)
        assert.ok(
          p.getY(i) >= site.canopyTopAt(x, z) - 0.67,
          "no low posts or floors beyond the hotel boundary",
        );
    }
  }
});

test("hotel materials own sampler state and stay distinct from glass and opaque backing", () => {
  const texture = new T.Texture<HTMLImageElement>();
  texture.repeat.set(3, 4);
  const m = createFairmontWaterfrontMaterials({ texture: () => texture });
  assert.deepEqual(texture.repeat.toArray(), [3, 4]);
  assert.notEqual(m.panel.map, texture);
  assert.deepEqual(m.panel.map!.repeat.toArray(), [0.5, 0.5]);
  assert.equal(m.glass.transparent, false);
  assert.equal(m.glass.transmission, 0);
  assert.ok(m.glass.roughness < 0.2);
  assert.ok(m.dark.roughness > 0.5);
});

test("caller ground offsets all hotel geometry and its reflection capture together", () => {
  const batch = new Batcher(new T.Group());
  batch.offsetY = 3.4;
  const reflections: ReflectionProbeSpec[] = [];
  const library = {
    texture: () => new T.Texture<HTMLImageElement>(),
  } as unknown as Materials;
  assert.equal(
    fairmontWaterfront(
      { id: ID, pts: ring.flat() } as Building,
      batch,
      library,
      reflections,
    ),
    true,
  );
  assert.equal(batch.offsetY, 3.4);
  assert.equal(reflections.length, 2);
  assert.equal(reflections[0].position[1], 38.4);
  assert.ok(Math.abs(reflections[1].position[1] - 5.6) < 1e-8);
  let min = Infinity,
    max = -Infinity;
  for (const mesh of batch.finish()) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      min = Math.min(min, p.getY(i));
      max = Math.max(max, p.getY(i));
    }
  }
  assert.ok(Math.abs(min - 3.4) < 0.00001);
  assert.ok(Math.abs(max - H - 3.4) < 0.00001);
});

test("canopy roof optical flags survive batching while the physical grille retains shadows", () => {
  const glass = built.meshes.find(
    (mesh) => mesh.material === built.m.canopyGlass,
  )!;
  assert.ok(glass);
  assert.equal(glass.castShadow, false);
  assert.equal(glass.userData.allowShadow, false);
  assert.equal(built.m.canopyGlass.transparent, true);
  assert.equal(built.m.canopyGlass.depthWrite, false);
  assert.equal(built.m.canopyGlass.forceSinglePass, true);
  assert.equal(built.m.canopyGlass.side, T.DoubleSide);
  assert.equal(built.m.canopyGlass.transmission, 0);
  assert.ok(
    built.m.canopyGlass.opacity > 0 && built.m.canopyGlass.opacity < 0.4,
  );
  assert.equal(built.m.glass.transparent, false, "tower glazing is unaffected");
  const metal = built.meshes.find((mesh) => mesh.material === built.m.metal)!;
  assert.equal(metal.castShadow, true);
  let open = 0,
    frames = 0;
  for (let x = 463.23; x < 480; x += 0.43)
    for (let z = -493.19; z < -450; z += 0.47) {
      if (!pointInPoly(x, z, canopy.flat()) || pointInPoly(x, z, ring.flat()))
        continue;
      const hits = ray(
        new T.Vector3(x, canopyBottom - 0.1, z),
        new T.Vector3(x, canopyTop + 0.2, z),
      );
      const opaque = hits.filter(
        (h) => (h.object as T.Mesh).material !== built.m.canopyGlass,
      );
      if (opaque.length) frames++;
      else open++;
    }
  assert.ok(frames > 20, "real frame members still cross the roof area");
  assert.ok(
    open > frames,
    "most canopy roof area admits daylight between physical members",
  );
});
