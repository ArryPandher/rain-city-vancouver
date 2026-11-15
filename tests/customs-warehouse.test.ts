import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import { KX, ORIGIN, pointInPoly, segmentPoint } from "../src/world/data";
import { buildCustomsWarehouse } from "../src/world/customs-warehouse";
import {
  CUSTOMS_WAREHOUSE_ID as ID,
  CUSTOMS_WAREHOUSE_RING as ring,
  CUSTOMS_WAREHOUSE_CENTRE as centre,
  CUSTOMS_WAREHOUSE_SECTION as s,
  CUSTOMS_WAREHOUSE_INNER_ROOF as innerRoof,
  CUSTOMS_WAREHOUSE_FLAT_ROOF as flatRoof,
  warehouseBays,
} from "../src/world/customs-warehouse-site";

const materials = {
  brick: new T.MeshStandardMaterial(),
  stone: new T.MeshStandardMaterial(),
  trim: new T.MeshStandardMaterial(),
  glass: new T.MeshStandardMaterial(),
  frame: new T.MeshStandardMaterial(),
  roof: new T.MeshStandardMaterial(),
  cornice: new T.MeshStandardMaterial(),
  gravel: new T.MeshStandardMaterial(),
};
const root = new T.Group(),
  batch = new Batcher(root);
assert.equal(
  buildCustomsWarehouse(batch, { id: ID, pts: ring.flat() }, materials),
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
  assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test("warehouse dispatch is exact, and keeps the live mapped footprint", () => {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const b = data.buildings.find((b: { id: string }) => b.id === ID);
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const converted = b.pts.map(
    (v: number, i: number) => v / 2 - (i % 2 ? oz : ox),
  );
  converted.forEach((v: number, i: number) => near(v, ring.flat()[i], 1e-9));
  for (const id of ["w208599553", "w128409618", "warehouse"]) {
    const fresh = new Batcher(new T.Group());
    assert.equal(
      buildCustomsWarehouse(fresh, { id, pts: converted }, materials),
      false,
    );
    assert.equal(fresh.groups.size, 0);
  }
  assert.equal(warehouseBays(0).length, 5);
  assert.equal(warehouseBays(1).length, 5);
});

test("both source-facing elevations have open recesses with glass behind every paired and arched window", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const b of warehouseBays(edge)) {
      for (const row of [s.lower, s.middle])
        for (const direction of [-1, 1]) {
          const u = b.centre + (direction * (b.openingWidth + 0.5)) / 4;
          const y = row.sill + 0.24;
          const hits = ray(vec(f.p(u, y, -1)), vec(f.p(u, y, s.recess + 0.1)));
          assert.ok(hits.length, `edge${edge} window ${u}`);
          assert.equal(mat(hits[0]), materials.glass);
          near(hits[0].distance, 1 + s.recess - 0.014);
          assert.ok(
            hits[0].face!.normal.dot(
              new T.Vector3(...[f.outward[0], 0, f.outward[1]]),
            ) > 0.99,
          );
          assert.equal(
            ray(vec(f.p(u, y, 0.03)), vec(f.p(u, y, s.recess - 0.06))).length,
            0,
            "no opaque wall inside the reveal",
          );
        }
      // Above the spring, off the center mullion: one coherent curved aperture.
      const hits = ray(
        vec(f.p(b.centre + 0.22, s.upper.spring + 0.36, -1)),
        vec(f.p(b.centre + 0.22, s.upper.spring + 0.36, 0.6)),
      );
      assert.equal(mat(hits[0]), materials.glass);
      near(hits[0].distance, 1 + s.recess - 0.014);
      const mullion = ray(
        vec(f.p(b.centre, s.upper.spring + 0.3, -1)),
        vec(f.p(b.centre, s.upper.spring + 0.3, 0.6)),
      );
      assert.equal(
        mat(mullion[0]),
        materials.frame,
        "center mullion continues through the curved head",
      );
    }
  }
});

test("rectangular windows have real side, sill and head reveals; arches terminate under stone mouldings", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]),
      b = warehouseBays(edge)[1];
    const left = b.centre - b.openingWidth / 2,
      right = b.centre - 0.25,
      u = (left + right) / 2;
    const low = s.lower.sill,
      high = s.lower.head,
      d = s.recess / 2;
    const down = ray(vec(f.p(u, low + 0.2, d)), vec(f.p(u, low - 0.2, d)));
    const up = ray(vec(f.p(u, high - 0.2, d)), vec(f.p(u, high + 0.2, d)));
    const side = ray(
      vec(f.p(left + 0.2, low + 0.7, d)),
      vec(f.p(left - 0.2, low + 0.7, d)),
    );
    for (const hit of [down[0], up[0], side[0]])
      assert.equal(mat(hit), materials.brick);
    near(down[0].point.y, low);
    near(up[0].point.y, high);
    near(side[0].uv!.y, side[0].point.y, 0.0002);
    assert.ok(down[0].face!.normal.y > 0.99);
    assert.ok(up[0].face!.normal.y < -0.99);
    const crown = ray(
      vec(f.p(b.centre + 0.6, s.upper.crown + 0.12, -0.7)),
      vec(f.p(b.centre + 0.6, s.upper.crown + 0.12, 0.2)),
    );
    assert.equal(
      mat(crown[0]),
      materials.trim,
      "curved surround outside opening",
    );
  }
});

test("stone base has punched source-facing windows, staggered joints and shallow physical bevels", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]),
      b = warehouseBays(edge)[0];
    const u = b.centre - (b.openingWidth + 0.5) / 4;
    const hit = ray(vec(f.p(u, 4, -0.5)), vec(f.p(u, 4, 0.6)))[0];
    assert.equal(mat(hit), materials.glass);
    near(hit.distance, 0.5 + s.recess - 0.014);
    // Far from windows: stone front and small mortar setback alternate by course.
    const front = ray(vec(f.p(0.3, 0.17, -0.2)), vec(f.p(0.3, 0.17, 0.1)))[0];
    const joint = ray(vec(f.p(0.3, 0.399, -0.2)), vec(f.p(0.3, 0.399, 0.1)))[0];
    assert.equal(mat(front), materials.stone);
    assert.equal(mat(joint), materials.stone);
    assert.ok(joint.distance - front.distance > 0.01);
  }
});

test("cornice joins every corner and the aerial roof has sloped bands surrounding a broad flat center", () => {
  for (let edge = 0; edge < 4; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]);
    for (const u of [0.06, f.length / 2, f.length - 0.06]) {
      const top = ray(vec(f.p(u, 25, -0.45)), vec(f.p(u, 22, -0.45)));
      assert.equal(mat(top[0]), materials.cornice);
      near(top[0].point.y, s.corniceTop);
      assert.ok(top[0].face!.normal.y > 0.99);
    }
    const x = (ring[edge][0] + innerRoof[edge][0]) / 2,
      z = (ring[edge][1] + innerRoof[edge][1]) / 2;
    const roof = ray(new T.Vector3(x, 40, z), new T.Vector3(x, 22, z))[0];
    assert.equal(mat(roof), materials.roof);
    assert.ok(roof.point.y > s.corniceTop && roof.point.y < s.roofJunction);
    assert.ok(roof.face!.normal.y > 0);
  }
  const top = ray(
    new T.Vector3(centre[0], 40, centre[1]),
    new T.Vector3(centre[0], 22, centre[1]),
  )[0];
  assert.equal(mat(top), materials.gravel);
  near(top.point.y, s.flatRoof);
  assert.ok(
    s.historicalHighestElement - s.flatRoof > 2,
    "historical tallest element is not made into solid roof",
  );
  const a = facadeFrame(flatRoof[0], flatRoof[1]);
  for (const d of [4, 8, 12]) {
    const p = a.p(a.length * 0.55, 0, d);
    const sample = ray(
      new T.Vector3(p[0], 40, p[2]),
      new T.Vector3(p[0], 22, p[2]),
    )[0];
    assert.equal(mat(sample), materials.gravel);
    near(sample.point.y, s.flatRoof);
  }
});

test("the eight material batches have finite outward triangles, metric facade UVs and bounded cost", () => {
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
        assert.ok(d < 0.75, "cornice projection stays bounded");
        assert.ok(
          d < 0.002 || p.getY(i) > s.stoneTop - 0.01,
          "no uncollidable facade projection at walking height",
        );
      }
    }
    for (let i = 0; i < ix.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, ix.getX(i)),
        b = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 1)),
        c = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 2));
      const cross = b.sub(a).cross(c.sub(a));
      assert.ok(cross.length() > 1e-7, "nondegenerate triangle");
      assert.ok(
        cross.dot(new T.Vector3().fromBufferAttribute(n, ix.getX(i))) > 0,
        "consistent normal/winding",
      );
    }
  }
  assert.equal(meshes.length, 8);
  assert.ok(triangles < 55000, `${triangles} triangles`);
  const g = meshes.find((x) => x.material === materials.brick)!.geometry,
    p = g.getAttribute("position"),
    uv = g.getAttribute("uv");
  // Main wall planes are continuous u/height metre coordinates, including their punched arches.
  const n = g.getAttribute("normal");
  let checked = 0;
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]),
      a = f.p(0, 0),
      b = f.p(1, 0);
    for (let i = 0; i < p.count; i++) {
      const normalDot = n.getX(i) * f.outward[0] + n.getZ(i) * f.outward[1];
      const depth = -(
        (p.getX(i) - a[0]) * f.outward[0] +
        (p.getZ(i) - a[2]) * f.outward[1]
      );
      if (
        normalDot > 0.9999 &&
        (Math.abs(depth) < 0.0001 || Math.abs(depth + 0.14) < 0.0001)
      ) {
        const along =
          (p.getX(i) - a[0]) * (b[0] - a[0]) +
          (p.getZ(i) - a[2]) * (b[2] - a[2]);
        near(uv.getX(i), along);
        near(uv.getY(i), p.getY(i));
        checked++;
      }
    }
  }
  assert.ok(
    checked > 100,
    "metric front faces include the perforated walls and pilasters",
  );
});

test("all geometry follows one caller building datum without tilting horizontal courses", () => {
  const shifted = new Batcher(new T.Group());
  shifted.offsetY = 8.7003375067;
  buildCustomsWarehouse(shifted, { id: ID, pts: ring.flat() }, materials);
  const moved = shifted.finish();
  moved.forEach((mesh, i) => {
    const a = mesh.geometry.getAttribute("position"),
      b = meshes[i].geometry.getAttribute("position");
    assert.equal(a.count, b.count);
    for (let j = 0; j < a.count; j++) {
      near(a.getX(j), b.getX(j));
      near(a.getZ(j), b.getZ(j));
      near(a.getY(j), b.getY(j) + 8.7003375067, 0.00001);
    }
  });
});

test("curved parapet caps have closed backs and ashlar faces contain shallow irregular relief", () => {
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const i of [0, 2, 4]) {
      const bay = warehouseBays(edge)[i],
        y = s.corniceTop + 0.75;
      const front = ray(
        vec(f.p(bay.centre, y, -1)),
        vec(f.p(bay.centre, y, 1.1)),
      );
      const rear = ray(
        vec(f.p(bay.centre, y, 1.1)),
        vec(f.p(bay.centre, y, 0.4)),
      );
      assert.equal(mat(front[0]), materials.trim);
      assert.equal(mat(rear[0]), materials.trim);
      near(front[0].distance, 1.55);
      near(rear[0].distance, 0.29);
    }
    const depths = [];
    for (const u of [0.15, 0.3, 0.46, 0.6, 0.8, 1.0]) {
      const hit = ray(vec(f.p(u, 0.16, -0.2)), vec(f.p(u, 0.16, 0.06)))[0];
      assert.equal(mat(hit), materials.stone);
      depths.push(hit.distance - 0.2);
    }
    assert.ok(
      Math.max(...depths) - Math.min(...depths) > 0.004,
      "visible geometric relief, not only normal-map shading",
    );
    assert.ok(Math.min(...depths) >= 0 && Math.max(...depths) <= 0.035);
  }
});
