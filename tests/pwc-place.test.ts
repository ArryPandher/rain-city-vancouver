import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  KX,
  ORIGIN,
  pointInPoly,
  segmentPoint,
  type Building,
} from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
import { buildingHeight } from "../src/world/building-profile";
import { buildPwcPlace, type PwcPlaceMaterials } from "../src/world/pwc-place";
import { createPwcPlaceMaterials } from "../src/world/pwc-place-materials";
import { pwcPlace } from "../src/world/pwc-place-building";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
import {
  PWC_PLACE_ID as ID,
  PWC_PLACE_RING as base,
  PWC_PLACE_TOWER_RING as tower,
  PWC_PLACE_SPINE_RING as spine,
  PWC_PLACE_CROWN_RING as crown,
  PWC_PLACE_BODY_TOP as bodyTop,
  PWC_PLACE_SPINE_TOP as spineTop,
  PWC_PLACE_HEIGHT as height,
  PWC_PLACE_ENTRANCE as entrance,
  pwcPlaceFacadeStyle,
  pwcPlaceLevel,
  pwcPlaceHeight,
  pwcPlaceEntranceFrame,
} from "../src/world/pwc-place-site";

const root = new T.Group(),
  batch = new Batcher(root);
const materials = Object.fromEntries(
  ["stone", "glass", "spandrel", "lobbyGlass", "metal", "backing", "roof"].map(
    (name) => [name, new T.MeshStandardMaterial({ name })],
  ),
) as unknown as PwcPlaceMaterials;
assert.equal(
  buildPwcPlace(batch, { id: ID, pts: base.flat() }, materials),
  true,
);
const meshes = batch.finish();
root.updateMatrixWorld(true);
const ray = (a: T.Vector3, b: T.Vector3) =>
  new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b) + 0.01,
  ).intersectObject(root, true);

function mapData() {
  const d = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8")),
    ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const group of [d.buildings, d.areas])
    for (const item of group) {
      item.pts = convert(item.pts);
      if (item.holes) item.holes = item.holes.map(convert);
    }
  d.ocean = [];
  const metadata = JSON.parse(
    fs.readFileSync("public/data/vancouver-building-tags.json", "utf8"),
  );
  for (const building of d.buildings) {
    const attrs = metadata.buildings?.[building.id];
    if (attrs)
      Object.assign(building, attrs, {
        levels: building.levels ?? attrs.levels,
      });
  }
  d.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return d;
}

test("PwC dispatch retains its map boundary and never claims the shared parkade or neighbours", () => {
  const fresh = new Batcher(new T.Group());
  for (const id of ["w116527978", "w208599553", "w128409618", "w363651936"])
    assert.equal(
      buildPwcPlace(fresh, { id, pts: base.flat() }, materials),
      false,
    );
  assert.equal(fresh.groups.size, 0);
  const b = mapData().buildings.find((b: Building) => b.id === ID);
  assert.equal(
    b.levels,
    27,
    "stale base-map level count remains metadata only",
  );
  assert.equal(
    buildingHeight(b),
    10,
    "the live generic shell used explicit podium height, not 27 levels",
  );
  assert.equal(base.length * 2, b.pts.length);
  base.flat().forEach((v, i) => assert.ok(Math.abs(v - b.pts[i]) < 0.000001));
  for (const ring of [tower, spine, crown])
    for (const [x, z] of ring) {
      const distance = base.reduce(
        (d, a, i) =>
          Math.min(
            d,
            segmentPoint(x, z, ...a, ...base[(i + 1) % base.length]).d,
          ),
        Infinity,
      );
      assert.ok(pointInPoly(x, z, base.flat()) || distance < 0.000002);
    }
});

test("source roof differences and twenty-level schedule restore the tower omitted by podium-only metadata", () => {
  assert.equal(height, 83);
  assert.ok(Math.abs(height - spineTop - (102.32 - 97.64)) < 1e-9);
  assert.ok(Math.abs(spineTop - bodyTop - (97.64 - 93.74)) < 1e-9);
  assert.equal(pwcPlaceLevel(2), 8.2);
  assert.equal(pwcPlaceLevel(20), bodyTop);
  for (const [x, z, y] of [
    [469, -398, bodyTop],
    [484, -414, spineTop],
    [493, -399, height],
  ]) {
    assert.equal(pwcPlaceHeight(x, z), y);
    const hits = ray(new T.Vector3(x, 100, z), new T.Vector3(x, -1, z));
    assert.ok(Math.abs(hits[0].point.y - y) < 0.00001);
    assert.equal(
      hits.filter((h) => h.point.y > 20).length,
      1,
      "no concealed duplicate roof directly under raised parts",
    );
  }
});

test("two registered facade rhythms keep physical glass, spandrels and shadow cavities distinct", () => {
  const styles = tower.map((a, i) => {
    const f = facadeFrame(a, tower[(i + 1) % tower.length]),
      p = f.p(f.length / 2, 0, 0.12);
    return { f, style: pwcPlaceFacadeStyle(p[0], p[2]) };
  });
  for (const style of ["vertical", "horizontal"]) {
    const { f } = styles.find((s) => s.style === style && s.f.length > 8)!;
    const bays = Math.max(
        1,
        Math.round(f.length / (style === "vertical" ? 1.016 : 1.25)),
      ),
      u = (f.length / bays) * 0.43,
      y = pwcPlaceLevel(8) + 1.4;
    const hits = ray(
      new T.Vector3(...f.p(u, y, -1)),
      new T.Vector3(...f.p(u, y, 1)),
    );
    assert.equal((hits[0].object as T.Mesh).material, materials.glass);
    assert.ok(Math.abs(hits[0].distance - 1.2) < 0.002);
    const back = hits.find(
      (h) => (h.object as T.Mesh).material === materials.backing,
    )!;
    assert.ok(back.distance - hits[0].distance > 0.075);
    const band = ray(
      new T.Vector3(...f.p(u, pwcPlaceLevel(8) + 0.5, -1)),
      new T.Vector3(...f.p(u, pwcPlaceLevel(8) + 0.5, 1)),
    );
    assert.equal((band[0].object as T.Mesh).material, materials.spandrel);
  }
});

test("Howe lobby has genuine recess depth and a level supported frontage without road posts", () => {
  const collision = new CollisionWorld(mapData()),
    f = pwcPlaceEntranceFrame();
  assert.ok(collision.canada);
  for (const u of [
    entrance.left,
    (entrance.left + entrance.right) / 2,
    entrance.right,
  ]) {
    const p = f.p(u, 0, -1.2);
    assert.ok(Math.abs(collision.groundHeight(p[0], p[2])) < 0.00001);
  }
  const hits = ray(
    new T.Vector3(...f.p(9.1, 2, -1)),
    new T.Vector3(...f.p(9.1, 2, 1.2)),
  );
  assert.equal((hits[0].object as T.Mesh).material, materials.lobbyGlass);
  assert.ok(Math.abs(hits[0].distance - 1.8) < 0.002);
  assert.ok(
    hits.some((h) => (h.object as T.Mesh).material === materials.backing),
  );
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) >= 7.75 || pointInPoly(p.getX(i), p.getZ(i), base.flat()))
        continue;
      const distance = base.reduce(
        (d, a, j) =>
          Math.min(
            d,
            segmentPoint(
              p.getX(i),
              p.getZ(i),
              ...a,
              ...base[(j + 1) % base.length],
            ).d,
          ),
        Infinity,
      );
      assert.ok(
        distance < 0.081,
        "ground-level geometry remains within the original PwC outline",
      );
    }
  }
});

test("PwC geometry is finite, outward and bounded in seven material batches", () => {
  let triangles = 0,
    min = Infinity,
    max = -Infinity;
  for (const mesh of meshes) {
    const g = mesh.geometry,
      p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
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
      min = Math.min(min, p.getY(i));
      max = Math.max(max, p.getY(i));
    }
    for (let i = 0; i < ix.count; i += 3) {
      const a = ix.getX(i),
        b = ix.getX(i + 1),
        c = ix.getX(i + 2),
        cross = new T.Vector3()
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
  }
  assert.equal(min, 0);
  assert.ok(Math.abs(max - height) < 0.00001);
  assert.ok(triangles > 12000 && triangles < 26000, `triangles ${triangles}`);
  assert.equal(meshes.length, 7);
});

test("shared maps keep their samplers and caller datum shifts geometry and probe together", () => {
  const texture = new T.Texture<HTMLImageElement>();
  texture.repeat.set(3, 4);
  const library = { texture: () => texture } as unknown as Materials,
    m = createPwcPlaceMaterials(library);
  assert.deepEqual(texture.repeat.toArray(), [3, 4]);
  assert.notEqual(m.stone.map, texture);
  assert.ok(m.glass.roughness < m.spandrel.roughness);
  assert.equal(m.glass.transparent, false);
  const batch = new Batcher(new T.Group()),
    reflections: ReflectionProbeSpec[] = [];
  batch.offsetY = 2.75;
  assert.equal(
    pwcPlace(
      { id: ID, pts: base.flat() } as Building,
      batch,
      library,
      reflections,
    ),
    true,
  );
  assert.equal(batch.offsetY, 2.75);
  assert.equal(reflections[0].position[1], 37.75);
  let min = Infinity,
    max = -Infinity;
  for (const mesh of batch.finish()) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      min = Math.min(min, p.getY(i));
      max = Math.max(max, p.getY(i));
    }
  }
  assert.equal(min, 2.75);
  assert.ok(Math.abs(max - 85.75) < 0.00001);
});
