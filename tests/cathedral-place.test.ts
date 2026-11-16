import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import pc from "polygon-clipping";
import {
  createCathedralPlaceGeometry,
  cathedralPlace,
} from "../src/world/cathedral-place";
import {
  CATHEDRAL_PLACE as D,
  CATHEDRAL_PLACE_RING as ring,
  CATHEDRAL_PLACE_TIERS as tiers,
} from "../src/world/cathedral-place-data";
import source from "../src/world/cathedral-place-source.json";
import { KX, ORIGIN, type Building } from "../src/world/data";
import { Batcher } from "../src/world/geometry";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";

const candidate = createCathedralPlaceGeometry();
const raw = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8"));
const ox = (ORIGIN.lon - raw.meta.bbox[1]) * KX,
  oz = (raw.meta.bbox[2] - ORIGIN.lat) * 110540;
const building: Building = structuredClone(
  raw.buildings.find((b: Building) => b.id === source.buildingId),
);
building.pts = building.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
const open = (r: number[][]) =>
  r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r;
const distanceInside = (x: number, z: number) =>
  Math.min(
    ...ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      // Original OSM ring is clockwise.
      return -((x - a[0]) * -dz + (z - a[1]) * dx) / Math.hypot(dx, dz);
    }),
  );
const mat = new T.MeshBasicMaterial();
const meshes = Object.entries(candidate.parts).map(([role, g]) => {
  const m = new T.Mesh(g, mat);
  m.name = role;
  m.updateMatrixWorld();
  return m;
});
const ray = (p: T.Vector3, d: T.Vector3, targets = meshes) =>
  new T.Raycaster(p, d, 0, 200).intersectObjects(targets, false);

test("five bounded City records register nested shoulders to the exact current mapped footprint", () => {
  assert.ok(building.pts.every((v, i) => Math.abs(v - ring.flat()[i]) < 1e-9));
  assert.equal(source.cityId, 148343);
  assert.equal(source.parts.length, 5);
  const response = JSON.parse(
    fs.readFileSync("docs/sources/cathedral-place-city-response.json", "utf8"),
  );
  assert.equal(response.total_count, 5);
  assert.ok(
    response.results.every(
      (p: { bldgid: number; maxht_m: number }) =>
        p.bldgid === 148343 && p.maxht_m === 116.38,
    ),
  );
  assert.equal(D.apex, 116.4);
  assert.equal(
    D.crownSpring,
    99,
    "explicit photo-fit spring, not a claimed City floor",
  );
  for (let i = 0; i < tiers.length; i++) {
    assert.deepEqual(pc.difference(tiers[i].polygons, [ring]), []);
    if (i)
      assert.deepEqual(
        pc.difference(tiers[i].polygons, tiers[i - 1].polygons),
        [],
      );
  }
  const union = (ids: number[]) => {
    const polygons = source.parts
      .filter((p) => ids.includes(p.id))
      .map((p) => [p.ring as [number, number][]]);
    return pc.intersection([ring], pc.union(polygons[0], ...polygons.slice(1)));
  };
  assert.deepEqual(tiers[1].polygons, union([160599, 160600, 166248, 162094]));
  assert.deepEqual(tiers[2].polygons, union([160600, 166248, 162094]));
  assert.deepEqual(tiers[3].polygons, union([166248, 162094]));
  assert.deepEqual(tiers[4].polygons, union([162094]));
});

test("all physical vertices remain inside source footprint and unchanged grade/apex, with finite outward-facing crown", () => {
  assert.equal(candidate.stats.batches, 5);
  assert.ok(candidate.stats.triangles < 40000);
  assert.ok(candidate.stats.windows > 500);
  let max = -Infinity,
    min = Infinity;
  for (const [role, g] of Object.entries(candidate.parts)) {
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        distanceInside(p.getX(i), p.getZ(i)) > -0.00003,
        `${role} leaves retained footprint`,
      );
      min = Math.min(min, p.getY(i));
      max = Math.max(max, p.getY(i));
      assert.ok(Number.isFinite(n.getX(i) + n.getY(i) + n.getZ(i)));
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5,
      );
      if (role === "roof")
        assert.ok(
          p.getY(i) <=
            D.crownPanelSpring +
              (D.roofPeak - D.crownPanelSpring) * D.crownSolidFraction +
              0.01,
          "no opaque roof behind the upper lattice",
        );
    }
  }
  assert.equal(min, 0);
  assert.ok(Math.abs(max - 116.4) < 0.00001);
  // Public approach is outside the immutable footprint, with no facade/crown
  // projection below or over the adjacent Gallery-facing road corridor.
  for (const p of [
    [-31, -94],
    [-33, -104],
    [-38, -114],
  ])
    assert.equal(
      ray(new T.Vector3(p[0], 130, p[1]), new T.Vector3(0, -1, 0)).length,
      0,
    );
});

test("stepped roofs are closed once and every sampled pane has inward opaque backing", () => {
  let panes = 0,
    capSamples = 0;
  const glass = candidate.parts.glass,
    p = glass.getAttribute("position"),
    n = glass.getAttribute("normal");
  for (let i = 0; i < p.count; i += 6) {
    const centre = new T.Vector3()
      .fromBufferAttribute(p, i)
      .add(new T.Vector3().fromBufferAttribute(p, i + 1))
      .add(new T.Vector3().fromBufferAttribute(p, i + 2))
      .multiplyScalar(1 / 3);
    const outward = new T.Vector3().fromBufferAttribute(n, i);
    const hit = ray(
      centre.clone().addScaledVector(outward, -0.005),
      outward.clone().negate(),
      meshes.filter((m) => m.name === "backing"),
    );
    assert.ok(
      hit.length && hit[0].distance > 0.35 && hit[0].distance < 1.1,
      "real dark closed cavity behind every pane",
    );
    panes++;
  }
  for (let i = 0; i < tiers.length - 1; i++) {
    const exposed = pc.difference(tiers[i].polygons, tiers[i + 1].polygons);
    for (const poly of exposed) {
      const r = open(poly[0]);
      const tris = T.ShapeUtils.triangulateShape(
        r.map((p) => new T.Vector2(...p)),
        [],
      );
      for (const ix of tris) {
        const c = ix.reduce(
          (a, j) => [a[0] + r[j][0] / 3, a[1] + r[j][1] / 3],
          [0, 0],
        );
        // A point may lie within a hole discarded by this independent sampling;
        // keep only points whose first hit is this exposed roof.
        const hits = ray(
          new T.Vector3(c[0], tiers[i].top + 0.02, c[1]),
          new T.Vector3(0, -1, 0),
          meshes.filter((m) => m.name === "stone"),
        );
        if (!hits.length || Math.abs(hits[0].point.y - tiers[i].top) > 0.001)
          continue;
        assert.equal(
          hits.filter((h) => Math.abs(h.point.y - tiers[i].top) < 0.001).length,
          1,
          "no duplicate wall-strip cap at terrace",
        );
        capSamples++;
      }
    }
  }
  assert.equal(panes, candidate.stats.windows);
  assert.ok(capSamples > 10);
});

test("exact-ID wrapper emits five shared material batches, preserves data/offset, rejects unrelated or stale footprints", () => {
  const root = new T.Group(),
    batch = new Batcher(root, 270),
    refs: ReflectionProbeSpec[] = [];
  batch.offsetY = 3.25;
  const before = structuredClone(building),
    texture = new T.Texture();
  const library = { texture: () => texture } as unknown as Materials;
  assert.equal(
    cathedralPlace({ ...building, id: "w260069760" }, batch, library, refs),
    false,
  );
  assert.equal(
    cathedralPlace(
      { ...building, pts: building.pts.map((v) => v + 1) },
      batch,
      library,
      refs,
    ),
    false,
  );
  assert.equal(refs.length, 0);
  assert.equal(cathedralPlace(building, batch, library, refs), true);
  assert.deepEqual(building, before);
  assert.equal(batch.offsetY, 3.25);
  assert.equal(refs.length, 1);
  const chunks = batch.finish();
  assert.equal(chunks.length, 5);
  assert.ok(
    chunks.every((m) =>
      (m.material as T.Material).name.startsWith("Cathedral Place"),
    ),
  );
  assert.equal(
    texture.repeat.x,
    1,
    "licensed source samplers remain caller-owned",
  );
});
