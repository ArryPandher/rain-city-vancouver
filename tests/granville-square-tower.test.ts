import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import fs from "node:fs";
import polygonClipping from "polygon-clipping";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  pointInPoly,
  segmentPoint,
  centroid,
  KX,
  ORIGIN,
} from "../src/world/data";
import { buildGranvilleSquareTower } from "../src/world/granville-square-tower";
import { createGranvilleSquareTowerMaterials } from "../src/world/granville-square-tower-materials";
import {
  GRANVILLE_SQUARE_TOWER as D,
  GRANVILLE_SQUARE_TOWER_ID as ID,
  GRANVILLE_SQUARE_TOWER_RING as ring,
  GRANVILLE_SQUARE_TOWER_PARTS as parts,
  granvilleSquareTowerLevel as level,
} from "../src/world/granville-square-tower-data";
const centre = centroid(ring.flat()),
  ground = (x: number, z: number) =>
    6.93 + 0.013 * (x - centre[0]) + 0.008 * (z - centre[1]),
  base = ground(...centre),
  root = new T.Group(),
  batch = new Batcher(root),
  m = createGranvilleSquareTowerMaterials({ texture: () => new T.Texture() });
batch.offsetY = base;
assert.equal(
  buildGranvilleSquareTower(batch, { id: ID, pts: ring.flat() }, m, ground),
  true,
);
assert.equal(batch.offsetY, base);
const meshes = batch.finish();
root.updateMatrixWorld(true);
const cast = (a: number[], b: number[]) => {
  const p = new T.Vector3(...a),
    q = new T.Vector3(...b);
  return new T.Raycaster(
    p,
    q.clone().sub(p).normalize(),
    0,
    q.distanceTo(p) + 0.002,
  ).intersectObject(root, true);
};
const material = (h: T.Intersection) => (h.object as T.Mesh).material;

test("exact mapped tower replaces only its own generic shell and retains contained roof parts", () => {
  const data = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    b = data.buildings.find((b: any) => b.id === ID),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  b.pts.forEach((v: number, i: number) =>
    assert.ok(Math.abs(v / 2 - (i % 2 ? oz : ox) - ring.flat()[i]) < 1e-9),
  );
  const other = new Batcher(new T.Group());
  for (const id of ["w208599553", "w116527978", "w138256216"])
    assert.equal(
      buildGranvilleSquareTower(other, { id, pts: ring.flat() }, m),
      false,
    );
  assert.equal(other.groups.size, 0);
  for (const p of parts)
    assert.deepEqual(
      polygonClipping.difference([p.ring], [[...ring, ring[0]]]),
      [],
    );
  assert.equal(D.roof, 125.46);
  assert.ok(Math.abs(D.mechanical - D.roof - 8.24) < 1e-10);
  assert.ok(Math.abs(D.cab - D.roof - 12.86) < 1e-10);
});

test("all12 by8 bay rows have recessed glazing with a separate midheight louver course", () => {
  let windows = 0,
    louvers = 0;
  for (let edge = 0; edge < 4; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]),
      pitch = f.length / D.bays[edge];
    for (let col = 0; col < D.bays[edge]; col++)
      for (let row = 0; row < 28; row++) {
        const u = (col + 0.37) * pitch,
          y = (level(row, base) + level(row + 1, base)) / 2,
          hit = cast(f.p(u, y, -0.3), f.p(u, y, 1.3))[0];
        assert.ok(hit, `missing edge${edge}/bay${col}/row${row}`);
        if (row === D.louverRow) {
          assert.equal(material(hit), m.frame);
          louvers++;
        } else {
          assert.equal(material(hit), m.glass);
          assert.ok(
            hit.point.distanceTo(new T.Vector3(...f.p(u, y, 0.78))) < 0.00005,
          );
          windows++;
        }
      }
  }
  assert.equal(windows, 1080);
  assert.equal(louvers, 40);
});

test("real splayed stone, solid corners and closed two-level base replace the thin lattice", () => {
  for (let edge = 0; edge < 4; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]),
      pitch = f.length / D.bays[edge],
      y = level(7, base) + 1.5;
    for (const u of [0.12, f.length - 0.12])
      assert.equal(
        material(cast(f.p(u, y, -0.3), f.p(u, y, 1.3))[0]),
        m.concrete,
      );
    const u = D.openingSide + D.splay * 0.5,
      hit = cast(f.p(u, y, -0.3), f.p(u, y, 1.3))[0];
    assert.equal(material(hit), m.concrete);
    assert.ok(hit.point.distanceTo(new T.Vector3(...f.p(u, y, 0.39))) < 0.0001);
    assert.ok(Math.abs(hit.face!.normal.x) + Math.abs(hit.face!.normal.z) > 1);
    for (const y of [base + 2.4, base + 7.0]) {
      const u = f.length * 0.08,
        hits = cast(f.p(u, y, -0.3), f.p(u, y, 1.6));
      assert.equal(material(hits[0]), m.lobbyGlass);
      assert.ok(hits.some((h) => material(h) === m.backing));
    }
    for (let j = 0; j < 20; j++) {
      const u = ((j + 0.5) * f.length) / 20,
        p = f.p(u, 0),
        y = ground(p[0], p[2]) + 0.05;
      assert.equal(
        material(cast(f.p(u, y, -0.3), f.p(u, y, 0.2))[0]),
        m.concrete,
      );
    }
    assert.ok(pitch > 3.5 && pitch < 3.8);
  }
});

test("roof, mechanical and control cab close at City world heights with no duplicate lower cap", () => {
  for (const [x, z, y] of [
    [ring[0][0] - 0.8, ring[0][1] + 0.4, D.roof],
    [550, -408, D.mechanical],
  ].map((p) => p as [number, number, number])) {
    const hit = cast([x, y + 1, z], [x, y - 0.05, z])[0];
    assert.ok(hit, `missing roof at ${x},${z},${y}`);
    assert.ok(Math.abs(hit.point.y - y) < 0.00005);
    assert.ok(hit.face!.normal.y > 0.999);
  }
  const cab = parts.find((p) => p.id === 165377)!,
    c = centroid(cab.ring.flat()),
    x = c[0] + 1,
    z = c[1];
  const h = cast([x, D.cab + 1, z], [x, D.cab - 0.1, z])[0];
  assert.ok(h);
  assert.ok(Math.abs(h.point.y - D.cab) < 0.00005);
  // At the middle of each roof part, no main-roof triangle is retained inside.
  for (const p of parts) {
    const c = centroid(p.ring.flat());
    const h = cast([c[0], D.roof + 0.02, c[1]], [c[0], D.roof - 0.02, c[1]]);
    assert.equal(h.length, 0);
  }
});

test("geometry remains inside the source route boundary with six bounded material batches", (t) => {
  assert.equal(meshes.length, 6);
  let count = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    count += mesh.geometry.index!.count / 3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      assert.ok(Number.isFinite(x + y + z));
      assert.ok(y <= D.cab + 4.00002);
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 0.00001,
      );
      assert.ok(
        pointInPoly(x, z, ring.flat()) ||
          ring.some(
            (a, j) =>
              segmentPoint(x, z, ...a, ...ring[(j + 1) % 4]).d < 0.00005,
          ),
      );
    }
  }
  assert.ok(count < 65000);
  t.diagnostic(`${count} triangles / six material batches`);
  assert.equal(m.glass.metalness, 0);
  assert.equal(m.glass.emissive.getHex(), 0);
  assert.equal(m.concrete.map!.repeat.x, 0.5);
  assert.equal(m.concrete.map!.colorSpace, T.SRGBColorSpace);
});
