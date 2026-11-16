import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import {
  addGalleryBistro,
  addGalleryBistroPlatform,
} from "../src/world/gallery-bistro";
import { GALLERY_BISTRO as D } from "../src/world/gallery-bistro-data";
import {
  galleryStairWorld,
  galleryStairLocal,
} from "../src/world/gallery-stair-framing-data";
import {
  galleryStairFramingBlocked as blocked,
  galleryStairFramingHeight as height,
} from "../src/world/gallery-stair-framing-contact";
import {
  GALLERY_REAR_STEPS as S,
  galleryStairBackV,
} from "../src/world/gallery-entry-stairs-data";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
import { roadWidth, type CityData, type Road } from "../src/world/data";
function assembly(furniture = true) {
  const root = new T.Group(),
    batch = new Batcher(root, 512),
    m = new ArchitecturalMesh(batch, 0, 0),
    stone = new T.MeshStandardMaterial(),
    metal = new T.MeshStandardMaterial();
  addGalleryBistroPlatform(m, stone);
  if (furniture) addGalleryBistro(m, stone, metal);
  m.finish();
  const chunks = batch.finish();
  root.updateMatrixWorld(true);
  return { root, chunks };
}
const ray = (root: T.Object3D, p: number[], d: number[]) =>
  new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...d),
    0,
    20,
  ).intersectObject(root, true)[0];
test("full-size bistro has closed upward roof/platform surfaces and physically supported furniture", () => {
  const { root, chunks } = assembly();
  assert.equal(chunks.length, 4);
  let tris = 0;
  for (const mesh of chunks) {
    const g = mesh.geometry,
      p = g.getAttribute("position"),
      ix = g.index!;
    tris += ix.count / 3;
    const edges = new Map<string, number>();
    const key = (i: number) =>
      [p.getX(i), p.getY(i), p.getZ(i)]
        .map((x) => Math.round(x * 1e5))
        .join(",");
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = key(ix.getX(i + j)),
          b = key(ix.getX(i + ((j + 1) % 3)));
        if (a === b) continue;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(k, (edges.get(k) ?? 0) + (a < b ? 1 : -1));
      }
    assert.ok(
      [...edges.values()].every((n) => n === 0),
      "every solid has closed consistently oriented edges",
    );
  }
  assert.ok(tris < 7500, `${tris} triangles`);
  const floor = assembly(false).root;
  for (let u = D.minU + 0.1; u < D.maxU; u += 0.25)
    for (let v = galleryStairBackV(u) + 0.02; v < D.frontV; v += 0.25) {
      const top = ray(floor, [u, 5, v], [0, -1, 0])!;
      assert.ok(Math.abs(top.point.y - D.top) < 1e-5);
      assert.ok(top.face!.normal.y > 0.999);
      const [x, z] = galleryStairWorld(u, v);
      assert.ok(Math.abs(height(x, z, 3.28)! - 3.28) < 1e-9);
      assert.equal(blocked(x, z, 0.1, 0, false), true);
    }
  for (const { u, v } of D.parasols) {
    assert.ok(u - 1.5 > D.cheekMaxU && u + 1.5 < D.maxU);
    assert.ok(v - 1.5 > galleryStairBackV(u) && v + 1.5 < D.frontV);
    const hit = ray(root, [u + 0.5, 9, v], [0, -1, 0])!;
    assert.ok(hit.face!.normal.y > 0.8);
    const [x, z] = galleryStairWorld(u + 0.5, v);
    assert.equal(blocked(x, z, 0.03, hit.point.y + S.datum, true), true);
    assert.equal(blocked(x, z, 0.03, 8, true), false);
    assert.ok(
      Math.abs(ray(floor, [u, 5, v], [0, -1, 0])!.point.y - D.top) < 1e-5,
    );
  }
  for (const [p, d] of [
    [
      [19.5, 1, 25],
      [-1, 0, 0],
    ],
    [
      [12, 1, 29],
      [0, 0, -1],
    ],
    [
      [12, -1, 25],
      [0, 1, 0],
    ],
  ] as [number[], number[]][]) {
    assert.ok(ray(floor, p, d));
  }
  assert.equal(
    ray(floor, [12, 5, galleryStairBackV(12) - 0.01], [0, -1, 0]),
    undefined,
    "no retained cap overlay",
  );
});
test("actual full-city transverse path and steps retain ribbon clearance, source support and central ascent", async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (url) => {
    try {
      return new Response(
        fs.readFileSync(`public/${String(url).replace(/^\//, "")}`),
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  let data: CityData;
  try {
    data = await loadCity();
  } finally {
    globalThis.fetch = old;
  }
  const c = new CollisionWorld(data);
  let count = 0,
    minGap = Infinity;
  for (const id of ["w263530524", "w263530526"]) {
    const road: Road = data.roads.find((r) => r.id === id)!;
    assert.ok(road);
    const half = roadWidth(road) / 2;
    for (let i = 2; i < road.pts.length; i += 2) {
      const ax: number = road.pts[i - 2],
        az: number = road.pts[i - 1],
        dx = road.pts[i] - ax,
        dz = road.pts[i + 1] - az,
        len = Math.hypot(dx, dz);
      for (let s = 0; s <= len; s += 0.2) {
        for (const side of [-1, 0, 1]) {
          const x: number = ax + (dx * s) / len - (dz / len) * half * side,
            z: number = az + (dz * s) / len + (dx / len) * half * side,
            [u, v] = galleryStairLocal(x, z);
          if (u < 6.2 || u > 20 || v > 34) continue;
          const gap = v - D.frontV;
          minGap = Math.min(minGap, gap);
          assert.ok(gap > 0.75);
          assert.equal(blocked(x, z, 0.36, 0, false), false);
          const y = c.walkingHeight(x, z, 0);
          c.gallery = false;
          const baseline = c.walkingHeight(x, z, 0);
          c.gallery = true;
          assert.equal(y, baseline, "no path terrain feedback");
          count++;
        }
      }
    }
  }
  assert.ok(count > 200);
  assert.ok(minGap > 0.75);
  for (let u = 4.4; u < 17.8; u += 0.2) {
    const v = 24.05,
      [x, z] = galleryStairWorld(u, v);
    assert.ok(Math.abs(c.walkingHeight(x, z, 3.28) - 3.28) < 1e-9);
    assert.equal(
      c.blocked(x, z, 0.36, 3.28),
      false,
      `rear terrace aisle remains clear at u${u}`,
    );
    assert.equal(
      c.cameraBlocked(x, z, 0.25, 4.9),
      false,
      "ordinary camera aisle clear",
    );
  }
  for (let v = S.startV + 0.8; v < S.endV + 1; v += 0.1) {
    const [x, z] = galleryStairWorld(-1, v),
      y = c.walkingHeight(x, z, 0);
    assert.equal(blocked(x, z, 0.36, y, false), false);
  }
});

test("planting forms one continuous irregular mass per trough within unchanged contact bounds", async () => {
  const { galleryBistroHedgeGeometry } = await import(
    "../src/world/gallery-bistro"
  );
  for (const p of D.planters) {
    const geometry = galleryBistroHedgeGeometry(p),
      a = geometry.getAttribute("position"),
      ix = geometry.index!;
    const neighbors = Array.from({ length: a.count }, () => new Set<number>());
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const x = ix.getX(i + j),
          y = ix.getX(i + ((j + 1) % 3));
        neighbors[x].add(y);
        neighbors[y].add(x);
      }
    const seen = new Set([0]),
      queue = [0];
    while (queue.length) {
      for (const j of neighbors[queue.pop()!])
        if (!seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
    }
    assert.equal(
      seen.size,
      a.count,
      "one connected planting surface, no separate repeated beads",
    );
    for (let i = 0; i < a.count; i++) {
      assert.ok(a.getX(i) > p.minU && a.getX(i) < p.maxU);
      assert.ok(a.getZ(i) > p.minV && a.getZ(i) < p.maxV);
      assert.ok(
        a.getY(i) > D.top + D.planterHeight - 0.036 &&
          a.getY(i) < D.top + D.planterHeight + D.foliageHeight,
      );
    }
    const root = new T.Mesh(geometry, new T.MeshBasicMaterial());
    root.updateMatrixWorld();
    const alongU = p.maxU - p.minU > p.maxV - p.minV,
      start = (alongU ? p.minU : p.minV) + 0.05,
      end = (alongU ? p.maxU : p.maxV) - 0.05,
      heights: number[] = [];
    for (let s = start; s <= end; s += 0.05) {
      const u = alongU ? s : (p.minU + p.maxU) / 2,
        v = alongU ? (p.minV + p.maxV) / 2 : s;
      const hit = ray(root, [u, 6, v], [0, -1, 0]);
      assert.ok(hit, "continuous unbroken planted top");
      assert.ok(hit.face!.normal.y > 0.7);
      heights.push(hit.point.y);
      const [x, z] = galleryStairWorld(u, v);
      assert.equal(
        blocked(x, z, 0.01, hit.point.y + S.datum, true),
        true,
        "existing finite foliage contact encloses surface",
      );
    }
    const range = Math.max(...heights) - Math.min(...heights);
    assert.ok(
      range > 0.015 && range < 0.14,
      "restrained irregular top rather than row of domes",
    );
  }
});
