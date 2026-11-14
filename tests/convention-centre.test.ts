import { jackGroundHeight } from "../src/world/jack-poole-site";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  CONVENTION_ID,
  conventionSite,
  offsetOutline,
} from "../src/world/convention-site";
import { conventionCentre } from "../src/world/convention-centre";
import { CollisionWorld } from "../src/world/collision";
import { Batcher } from "../src/world/geometry";
import {
  KX,
  ORIGIN,
  pointInPoly,
  type Building,
  type CityData,
} from "../src/world/data";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
function building() {
  const d = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8"));
  const b = d.buildings.find((b: Building) => b.id === CONVENTION_ID);
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  b.pts = b.pts.map((v: number, i: number) => v / 2 - (i % 2 ? oz : ox));
  return b as Building;
}
function fixture() {
  const b = building(),
    site = conventionSite(b),
    root = new T.Group(),
    batch = new Batcher(root),
    m = {
      texture: () => new T.Texture(),
      grass: new T.MeshStandardMaterial(),
      neonMaterials: [],
    } as unknown as Materials;
  const reflections: ReflectionProbeSpec[] = [];
  assert.equal(conventionCentre(b, batch, m, reflections), true);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { b, site, root, meshes, reflections };
}
test("convention roof planes cover the mapped site with distinct heights and a bounded footprint", () => {
  const { site, meshes, reflections } = fixture();
  let triangles = 0,
    highest = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      normal = mesh.geometry.getAttribute("normal");
    triangles += mesh.geometry.getIndex()!.count / 3;
    for (let i = 0; i < p.count; i++) {
      const a = [
        p.getX(i),
        p.getY(i),
        p.getZ(i),
        normal.getX(i),
        normal.getY(i),
        normal.getZ(i),
      ];
      assert.ok(a.every(Number.isFinite));
      highest = Math.max(highest, a[1]);
    }
  }
  assert.ok(highest > 37 && highest < 40);
  assert.ok(triangles < 300000, `bounded authored detail: ${triangles}`);
  assert.equal(reflections.length, 3);
  assert.ok(
    reflections.every(
      (r) => !pointInPoly(r.position[0], r.position[2], site.footprint),
    ),
  );
  for (const roof of site.roofs)
    for (const [e, n] of roof.outline)
      assert.ok(
        roof.height(e, n) >= site.baseHeight(e, n),
        "raised roof must remain above lower shell",
      );
});
test("promenade is continuous, dry and outside glass collision, while the shore rail and hall stay solid", () => {
  const b = building(),
    site = conventionSite(b),
    data = {
      buildings: [b],
      roads: [],
      areas: [],
      ocean: [[-10000, -10000, 10000, -10000, 10000, 10000, -10000, 10000]],
    } as unknown as CityData,
    collision = new CollisionWorld(data);
  const route = offsetOutline(site.outline, 1.5);
  for (let i = 0; i < route.length; i++) {
    const a = route[i],
      b = route[(i + 1) % route.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d <= length; d++) {
      const p = site.world(
        a[0] + ((b[0] - a[0]) * d) / length,
        a[1] + ((b[1] - a[1]) * d) / length,
      );
      assert.equal(
        collision.blocked(...p, 0.4, jackGroundHeight(...p) ?? 6.04),
        false,
        `route blocked at ${p}`,
      );
      assert.equal(collision.water(...p, 6.04), false);
      assert.equal(
        collision.groundHeight(...p),
        jackGroundHeight(...p) ?? 6.04,
      );
    }
  }
  assert.equal(collision.blocked(...site.world(110, 60)), true);
  const rail = site.shoreSegments[2][0].map(
    (v, i) => (v + site.shoreSegments[2][1][i]) / 2,
  ) as [number, number];
  assert.equal(collision.blocked(...site.world(...rail), 0.4, 6.04), true);
  assert.equal(collision.water(...site.world(120, 150)), true);
});
test("visible paving and roof covers agree with collision and interior floors do not protrude through the roof", () => {
  const { site, meshes, root } = fixture(),
    ray = new T.Raycaster();
  const paving = meshes.filter(
    (m) => (m.material as T.Material).name === "Convention Centre — concrete",
  );
  for (const e of [65, 100, 150, 190]) {
    const p = site.world(e, 117);
    ray.set(new T.Vector3(p[0], 8, p[1]), new T.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(paving);
    assert.ok(hits.length);
    assert.ok(Math.abs(hits[0].point.y - 6.04) < 0.001);
  }
  const roofs = meshes.filter(
    (m) =>
      (m.material as T.Material).name === "Convention Centre — planted roof",
  );
  for (const mesh of meshes.filter(
    (m) =>
      (m.material as T.Material).name === "Convention Centre — foyer floors",
  )) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 5) continue;
      ray.set(new T.Vector3(p.getX(i), 80, p.getZ(i)), new T.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(roofs);
      assert.ok(hits.length, `floor has no roof at ${p.getX(i)},${p.getZ(i)}`);
      assert.ok(
        hits[0].point.y >= p.getY(i) + 0.9,
        `foyer floor ${p.getY(i)} at ${site.local(p.getX(i), p.getZ(i))} protrudes above roof ${hits[0].point.y}`,
      );
    }
  }
  assert.ok(root.children.length > 10);
});

test("mapped seaward walking and cycling centrelines remain clear of the new shore rail", () => {
  const b = building(),
    site = conventionSite(b),
    roads = JSON.parse(
      fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
    ).roads;
  const collision = new CollisionWorld({
    buildings: [b],
    roads,
    areas: [],
    ocean: [],
  } as unknown as CityData);
  let checked = 0;
  for (const road of roads.filter((r: { id: string }) =>
    ["w116527975", "w364263622", "w618425761"].includes(r.id),
  )) {
    for (let i = 0; i < road.pts.length - 2; i += 2) {
      const ax = road.pts[i],
        az = road.pts[i + 1],
        bx = road.pts[i + 2],
        bz = road.pts[i + 3],
        len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d <= len; d++) {
        const x = ax + ((bx - ax) * d) / len,
          z = az + ((bz - az) * d) / len,
          [e, n] = site.local(x, z);
        if (e < 55 || e > 212 || n < 116 || n > 132) continue;
        assert.equal(
          collision.blocked(x, z, 0.7, 6.04),
          false,
          `${road.id} obstruction at ${e},${n}`,
        );
        assert.equal(
          collision.groundHeight(x, z),
          6.04,
          `${road.id} outside paved deck at ${e},${n}`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 350);
});

test("raised promenade has a continuous dry southern cycleway approach and grounded piles", () => {
  const { b, site, meshes } = fixture(),
    data = {
      buildings: [b],
      roads: [],
      areas: [],
      ocean: [],
    } as unknown as CityData,
    collision = new CollisionWorld(data),
    ray = new T.Raycaster();
  let previous = 0;
  for (let n = -80; n <= -25; n += 0.25) {
    const [x, z] = site.world(180, n),
      y = collision.groundHeight(x, z);
    assert.ok(
      Math.abs(y - previous) < 0.04,
      `approach jump at ${n}: ${previous} to ${y}`,
    );
    assert.equal(collision.blocked(x, z, 0.4, y), false);
    assert.equal(collision.water(x, z, y), false);
    if (n >= -77 && n <= -30) {
      ray.set(new T.Vector3(x, 8, z), new T.Vector3(0, -1, 0));
      assert.ok(
        ray
          .intersectObjects(meshes)
          .some((h) => Math.abs(h.point.y - y) < 0.02),
        `approach paving ${n}`,
      );
    }
    previous = y;
  }
  assert.ok(
    meshes.some((m) => {
      const p = m.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -3) return true;
      return false;
    }),
    "pier piles extend below water",
  );
});
