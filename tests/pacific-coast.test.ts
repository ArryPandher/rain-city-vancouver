import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import { KX, ORIGIN, pointInPoly, segmentPoint } from "../src/world/data";
import { buildPacificCoast } from "../src/world/pacific-coast";
import {
  PACIFIC_COAST_ID as ID,
  PACIFIC_COAST_RING as ring,
  PACIFIC_COAST_CENTRE as centre,
  PACIFIC_COAST_SECTION as s,
  PACIFIC_COAST_PLANT_RING as plantRing,
  PACIFIC_COAST_ENTRANCE_THRESHOLDS as thresholds,
  pacificCoastBays,
} from "../src/world/pacific-coast-site";
const materials = {
  stone: new T.MeshStandardMaterial(),
  base: new T.MeshStandardMaterial(),
  brick: new T.MeshStandardMaterial(),
  trim: new T.MeshStandardMaterial(),
  glass: new T.MeshStandardMaterial(),
  frame: new T.MeshStandardMaterial(),
  roof: new T.MeshStandardMaterial(),
  lining: new T.MeshStandardMaterial(),
  blind: new T.MeshStandardMaterial(),
};
const root = new T.Group(),
  batch = new Batcher(root);
assert.equal(
  buildPacificCoast(batch, { id: ID, pts: ring.flat() }, materials),
  true,
);
const meshes = batch.finish();
root.updateMatrixWorld(true);
const vec = (p: [number, number, number]) => new T.Vector3(...p);
const ray = (a: T.Vector3, b: T.Vector3) =>
  new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b),
  ).intersectObject(root, true);
const mat = (hit: T.Intersection) => (hit.object as T.Mesh).material;
const near = (a: number, b: number, e = 0.0002) =>
  assert.ok(Math.abs(a - b) < e, `${a}≈${b}`);

test("325 Howe exact dispatch preserves map footprint and the source3/7 bay and7level hierarchy", () => {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const b = data.buildings.find((b: { id: string }) => b.id === ID);
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  b.pts.forEach((v: number, i: number) =>
    near(v / 2 - (i % 2 ? oz : ox), ring.flat()[i], 1e-9),
  );
  for (const id of ["w1363485360", "w208599553", "325Howe"]) {
    const fresh = new Batcher(new T.Group());
    assert.equal(
      buildPacificCoast(fresh, { id, pts: ring.flat() }, materials),
      false,
    );
    assert.equal(fresh.groups.size, 0);
  }
  assert.equal(pacificCoastBays(0).length, 3);
  assert.equal(pacificCoastBays(1).length, 7);
  assert.equal(s.rows.length, 6);
});

test("all six upper courses on both street faces have clear physical recesses and paired rectangular sash frames", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const b of pacificCoastBays(edge))
      for (const row of s.rows) {
        const u = b.left + (b.right - b.left) * 0.28,
          y = row.sill + 0.38;
        const hits = ray(vec(f.p(u, y, -0.5)), vec(f.p(u, y, 0.6)));
        assert.equal(mat(hits[0]), materials.glass);
        near(hits[0].distance, 0.5 + s.windowRecess - 0.018);
        assert.equal(
          ray(vec(f.p(u, y, 0.02)), vec(f.p(u, y, s.windowRecess - 0.08)))
            .length,
          0,
        );
        const mullion = ray(
          vec(f.p(b.centre, y, -0.5)),
          vec(f.p(b.centre, y, 0.6)),
        )[0];
        assert.equal(mat(mullion), materials.frame);
        near(mullion.distance, 0.5 + s.windowRecess - 0.065);
        const above = ray(
          vec(f.p(u, row.head + 0.16, -0.5)),
          vec(f.p(u, row.head + 0.16, 0.15)),
        )[0];
        assert.equal(
          mat(above),
          edge === 1 ? materials.brick : materials.stone,
        );
      }
  }
});

test("windows expose closed side/head/sill reveals with horizontal material courses", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]),
      b = pacificCoastBays(edge)[1],
      row = s.rows[2],
      d = s.windowRecess / 2;
    const u = b.left + 0.45;
    const down = ray(
      vec(f.p(u, row.sill + 0.2, d)),
      vec(f.p(u, row.sill - 0.2, d)),
    )[0];
    const up = ray(
      vec(f.p(u, row.head - 0.2, d)),
      vec(f.p(u, row.head + 0.2, d)),
    )[0];
    const side = ray(
      vec(f.p(b.left + 0.15, row.sill + 0.4, d)),
      vec(f.p(b.left - 0.15, row.sill + 0.4, d)),
    )[0];
    for (const h of [down, up, side]) assert.equal(mat(h), materials.stone);
    near(down.point.y, row.sill);
    near(up.point.y, row.head);
    near(side.uv!.y, side.point.y);
    assert.ok(down.face!.normal.y > 0.99);
    assert.ok(up.face!.normal.y < -0.99);
  }
});

test("grounded closed Howe entrances and Cordova windows stay clear of opaque base fill", () => {
  const howe = facadeFrame(ring[1], ring[2]);
  for (const i of [2, 3]) {
    const b = pacificCoastBays(1)[i],
      threshold = thresholds[i];
    assert.ok(
      threshold < 0,
      "threshold follows the raised street datum rather than floating .76m aboveit",
    );
    const u = b.left + 0.6,
      y = threshold + 0.4;
    const hit = ray(vec(howe.p(u, y, -0.5)), vec(howe.p(u, y, 0.7)))[0];
    assert.equal(mat(hit), materials.glass);
    near(hit.distance, 0.5 + s.baseRecess - 0.018);
    const sill = ray(
      vec(howe.p(u, threshold + 0.15, 0.2)),
      vec(howe.p(u, threshold - 0.15, 0.2)),
    )[0];
    assert.equal(mat(sill), materials.base);
    near(sill.point.y, threshold);
  }
  const end = facadeFrame(ring[0], ring[1]),
    b = pacificCoastBays(0)[1];
  const hit = ray(
    vec(end.p(b.left + 0.5, 0.55, -0.5)),
    vec(end.p(b.left + 0.5, 0.55, 0.7)),
  )[0];
  assert.equal(mat(hit), materials.glass);
});

test("simple current parapet and flat roof close the footprint; only the small source rooftop part rises above them", () => {
  for (const edge of [0, 1, 2, 3]) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]);
    const cap = ray(
      vec(f.p(f.length * 0.43, 30, 0.08)),
      vec(f.p(f.length * 0.43, 23, 0.08)),
    )[0];
    assert.equal(mat(cap), materials.trim);
    near(cap.point.y, s.parapet);
    assert.ok(cap.face!.normal.y > 0.99);
  }
  const samples: [[number, number], number][] = [
    [[400, -384], s.roof],
    [[421, -397], s.roof],
  ];
  for (const [p, height] of samples) {
    const hit = ray(
      new T.Vector3(p[0], 31, p[1]),
      new T.Vector3(p[0], 23, p[1]),
    )[0];
    assert.equal(mat(hit), materials.roof);
    near(hit.point.y, height);
  }
  const plant = new T.Vector2(
    plantRing.reduce((n, p) => n + p[0], 0) / 4,
    plantRing.reduce((n, p) => n + p[1], 0) / 4,
  );
  const hit = ray(
    new T.Vector3(plant.x + 1.1, 31, plant.y),
    new T.Vector3(plant.x + 1.1, 23, plant.y),
  )[0];
  assert.equal(mat(hit), materials.roof);
  near(hit.point.y, s.plantRoom);
  assert.ok(s.plantRoom < s.historicalHighestElement);
  for (const p of plantRing) assert.ok(pointInPoly(...p, ring.flat()));
});

test("nine batches have finite outward geometry, continuous metric facade UVs and bounded projection/cost", () => {
  let triangles = 0;
  for (const mesh of meshes) {
    const g = mesh.geometry,
      p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      ix = g.index!;
    triangles += ix.count / 3;
    for (let i = 0; i < p.count; i++) {
      near(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)), 1, 0.0001);
      assert.ok(
        p.getY(i) >= s.baseBottom - 0.0001 &&
          p.getY(i) < s.historicalHighestElement,
      );
      const x = p.getX(i),
        z = p.getZ(i);
      if (!pointInPoly(x, z, ring.flat())) {
        const d = Math.min(
          ...ring.map(
            (a, j) => segmentPoint(x, z, ...a, ...ring[(j + 1) % 4]).d,
          ),
        );
        assert.ok(d < 0.22);
        assert.ok(
          d < 0.002 || p.getY(i) >= s.baseTop - 0.0001,
          "walking-height geometry staysinsidecollision",
        );
      }
    }
    for (let i = 0; i < ix.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, ix.getX(i)),
        b = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 1)),
        c = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 2));
      const cross = b.sub(a).cross(c.sub(a));
      assert.ok(cross.length() > 1e-7);
      assert.ok(
        cross.dot(new T.Vector3().fromBufferAttribute(n, ix.getX(i))) > 0,
      );
    }
  }
  assert.equal(meshes.length, 9);
  assert.ok(
    triangles <= 10742 + 5200,
    `${triangles} triangles: bounded cavity/blind addition`,
  );
  const g = meshes.find((m) => m.material === materials.brick)!.geometry,
    p = g.getAttribute("position"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < p.count; i++) near(p.getY(i), uv.getY(i));
});

test("caller datum translates every facade course and roof without warping the elevations", () => {
  const shifted = new Batcher(new T.Group());
  shifted.offsetY = 9.25777315521867;
  buildPacificCoast(shifted, { id: ID, pts: ring.flat() }, materials);
  const moved = shifted.finish();
  moved.forEach((mesh, i) => {
    const a = mesh.geometry.getAttribute("position"),
      b = meshes[i].geometry.getAttribute("position");
    assert.equal(a.count, b.count);
    for (let j = 0; j < a.count; j++) {
      near(a.getX(j), b.getX(j));
      near(a.getZ(j), b.getZ(j));
      near(a.getY(j), b.getY(j) + shifted.offsetY, 1e-5);
    }
  });
});

test("modern proportions retain the taller street base and uninterrupted top frieze after native reference review", () => {
  assert.ok(s.baseTop > 4.5 && s.baseTop < 4.9);
  const frieze = s.parapet - s.rows[s.rows.length - 1].head;
  assert.ok(
    frieze > 1.1 && frieze < 1.6,
    "the removed historic cornice is not substituted for the plain frieze",
  );
  for (let i = 1; i < s.rows.length; i++)
    near(s.rows[i].sill - s.rows[i - 1].sill, 3.15);
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]),
      b = pacificCoastBays(edge)[1];
    const u = b.centre + 0.4;
    const baseHead = ray(vec(f.p(u, 4.35, -0.5)), vec(f.p(u, 4.35, 0.7)))[0];
    assert.equal(
      mat(baseHead),
      materials.base,
      "baseheader closes above taller street glazing",
    );
    const upper = ray(vec(f.p(u, 21.45, -0.5)), vec(f.p(u, 21.45, 0.7)))[0];
    assert.equal(
      mat(upper),
      materials.glass,
      "stringcourse does not cut through the revised top window",
    );
  }
});

test("glazing is backed by a closed shallow cavity rather than an opaque frame wall", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const b of pacificCoastBays(edge))
      for (const row of s.rows) {
        const u = b.left + (b.right - b.left) * 0.28,
          y = row.sill + 0.38;
        const through = ray(
          vec(f.p(u, y, s.windowRecess + 0.03)),
          vec(f.p(u, y, s.windowRecess + 1.0)),
        );
        assert.equal(
          mat(through[0]),
          materials.lining,
          "the lower uncovered pane looks into an actual closed recess",
        );
        near(through[0].distance, 0.83);
        const before = ray(
          vec(f.p(u, y, s.windowRecess - 0.01)),
          vec(f.p(u, y, s.windowRecess + 0.1)),
        );
        assert.equal(
          before.length,
          0,
          "no opaque frame plane immediately behind the clear pane",
        );
        const insideDepth = s.windowRecess + 0.72;
        const floor = ray(
          vec(f.p(u, row.sill + 0.3, insideDepth)),
          vec(f.p(u, row.sill - 0.1, insideDepth)),
        )[0];
        const ceiling = ray(
          vec(f.p(u, row.head - 0.3, insideDepth)),
          vec(f.p(u, row.head + 0.1, insideDepth)),
        )[0];
        const wall = ray(
          vec(f.p(b.left + 0.25, y, insideDepth)),
          vec(f.p(b.left - 0.1, y, insideDepth)),
        )[0];
        for (const hit of [floor, ceiling, wall])
          assert.equal(mat(hit), materials.lining);
        near(floor.point.y, row.sill + 0.075);
        near(ceiling.point.y, row.head - 0.075);
        assert.ok(floor.face!.normal.y > 0.99);
        assert.ok(ceiling.face!.normal.y < -0.99);
      }
  }
  // Entrance threshold geometry stays fixed while the backing moves inside.
  const f = facadeFrame(ring[1], ring[2]),
    b = pacificCoastBays(1)[2],
    lo = thresholds[2];
  const hit = ray(
    vec(f.p(b.left + 0.6, lo + 0.4, s.baseRecess + 0.03)),
    vec(f.p(b.left + 0.6, lo + 0.4, s.baseRecess + 1.0)),
  )[0];
  assert.equal(mat(hit), materials.lining);
  near(hit.distance, 0.83);
});

test("upper sashes contain varied partial blinds wholly behind the original panes, with open lower views", () => {
  const blindMesh = meshes.find((mesh) => mesh.material === materials.blind)!;
  const p = blindMesh.geometry.getAttribute("position");
  let variations = new Set<string>(),
    open = 0,
    partial = 0;
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const b of pacificCoastBays(edge))
      for (const row of s.rows) {
        for (const ratio of [0.28, 0.72]) {
          const u = b.left + (b.right - b.left) * ratio;
          let count = 0;
          for (const fraction of [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85]) {
            const y = row.sill + (row.head - row.sill) * fraction;
            const hits = ray(
              vec(f.p(u, y, s.windowRecess + 0.04)),
              vec(f.p(u, y, s.windowRecess + 0.4)),
            ).filter((hit) => mat(hit) === materials.blind);
            if (hits.length) count++;
          }
          if (count === 0) open++;
          else partial++;
          variations.add(String(count));
        }
      }
  }
  assert.ok(
    open >= 15 && partial >= 30,
    `${open} open, ${partial} partly lowered`,
  );
  assert.ok(
    variations.size >= 3,
    "several observed coverage levels rather than uniform repeated backing",
  );
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      y = p.getY(i);
    const edge =
      Math.abs(
        (x - ring[0][0]) * facadeFrame(ring[0], ring[1]).outward[0] +
          (z - ring[0][1]) * facadeFrame(ring[0], ring[1]).outward[1],
      ) < 1
        ? 0
        : 1;
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    const depth = -(
      (x - ring[edge][0]) * f.outward[0] +
      (z - ring[edge][1]) * f.outward[1]
    );
    assert.ok(depth > s.windowRecess + 0.13 && depth < s.windowRecess + 0.3);
    assert.ok(s.rows.some((row) => y > row.sill + 0.5 && y < row.head - 0.07));
  }
});
