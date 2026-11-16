import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import polygonClipping, {
  type MultiPolygon,
  type Pair,
} from "polygon-clipping";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  panPacificTowerCompatible,
  replacePanPacificTowerSource,
} from "../src/world/pan-pacific-tower-source";
import { replacePanPacificHowePodiumFaces } from "../src/world/pan-pacific-howe-podium-source";
import { replaceCanadaPlaceHotelFaces } from "../src/world/canada-place-hotel-source";
import { replaceCanadaPlaceCanopyFaces } from "../src/world/canada-place-canopy";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import { pointInPoly, segmentPoint } from "../src/world/data";
import {
  PAN_PACIFIC_TOWER as D,
  towerPlan,
} from "../src/world/pan-pacific-tower-data";
import { createPanPacificTowerGeometry } from "../src/world/pan-pacific-tower";

const roles = ["concrete", "frame", "backing", "roof", "glass"] as const;
const sourceHeight = 25.495826721191406;
function area(polygons: MultiPolygon) {
  return polygons.reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce((s, ring, hole) => {
        let a = 0;
        for (let i = 0; i < ring.length; i++) {
          const b = ring[(i + 1) % ring.length];
          a += ring[i][0] * b[1] - b[0] * ring[i][1];
        }
        return s + ((hole ? -1 : 1) * Math.abs(a)) / 2;
      }, 0),
    0,
  );
}
async function fixture() {
  await MeshoptDecoder.ready;
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb");
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  assert.equal(panPacificTowerCompatible(scene), true);
  const entries: { material: string; geometry: T.BufferGeometry }[] = [];
  scene.traverse((object) => {
    if (object instanceof T.Mesh)
      entries.push({
        material: object.material.name,
        geometry: bakeGeometry(object.geometry, object.matrixWorld),
      });
  });
  const concrete = entries.find((e) => e.material === "concrete")!.geometry;
  const before = Array.from(concrete.index!.array);
  const exactCap = before.slice(1786 * 3, 1828 * 3);
  assert.deepEqual(
    exactCap,
    Array.from({ length: 126 }, (_, i) => 4206 + i),
  );
  for (const e of entries) {
    extractCanadaPlacePaving(e.geometry, e.material)?.dispose();
    replacePanPacificHowePodiumFaces(e.geometry, e.material);
    replaceCanadaPlaceHotelFaces(e.geometry, e.material);
    replaceCanadaPlaceCanopyFaces(e.geometry, e.material);
    replaceCanadaPlaceWestFaces(e.geometry, e.material);
  }
  assert.equal(replacePanPacificTowerSource(entries), 3140);
  assert.deepEqual(
    Array.from(concrete.index!.array).filter((id) => id >= 4206 && id <= 4331),
    exactCap,
  );
  const position = concrete.getAttribute("position");
  const triangles: Pair[][] = [];
  for (let i = 0; i < exactCap.length; i += 3) {
    const triangle: Pair[] = [];
    for (let j = 0; j < 3; j++) {
      const id = exactCap[i + j];
      assert.equal(position.getY(id), sourceHeight);
      triangle.push([position.getX(id), position.getZ(id)]);
    }
    triangles.push(triangle);
  }
  const cap = polygonClipping.union(
    ...(triangles.map((t) => [t]) as [Pair[][], ...Pair[][][]]),
  );
  assert.equal(cap.length, 1);
  assert.equal(cap[0].length, 1, "retained cap has no holes");
  assert.ok(Math.abs(area(cap) - 4284.00270420681) < 0.0001);
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const sourceMesh = new T.Mesh(concrete, material);
  const tower = createPanPacificTowerGeometry();
  const integrated = new T.Group();
  integrated.add(sourceMesh);
  for (const role of roles) integrated.add(new T.Mesh(tower[role], material));
  integrated.updateMatrixWorld(true);
  return { cap, triangles, sourceMesh, tower, integrated };
}
const ready = fixture();
function capMargin(p: Pair, cap: Pair[]) {
  let d = Infinity;
  for (let i = 0; i < cap.length; i++) {
    const b = cap[(i + 1) % cap.length];
    d = Math.min(d, segmentPoint(...p, ...cap[i], ...b).d);
  }
  return d;
}
function supported(sourceMesh: T.Mesh, p: Pair) {
  const hit = new T.Raycaster(
    new T.Vector3(p[0], sourceHeight + 0.1, p[1]),
    new T.Vector3(0, -1, 0),
    0,
    0.2,
  ).intersectObject(sourceMesh)[0];
  assert.ok(hit, `base support missing at local ${p}`);
  assert.ok(
    Math.abs(hit.point.y - sourceHeight) < 0.00001,
    `wrong base support at ${p}: ${hit.point.y}`,
  );
  assert.ok(hit.face!.normal.y > 0.99);
}

test("complete rounded lowest tower footprint is inside the actual retained concave cap", async (t) => {
  const { cap, sourceMesh } = await ready;
  const level = D.levels[0];
  const plan = towerPlan(level.noseDepth, level.noseWidth).map(
    (v) => v.point as Pair,
  );
  assert.equal(
    area(polygonClipping.difference([plan], cap)),
    0,
    "unsupported base polygon area",
  );
  let margin = Infinity,
    rays = 0;
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25),
    );
    for (let j = 0; j <= count; j++) {
      const p: Pair = [
        a[0] + ((b[0] - a[0]) * j) / count,
        a[1] + ((b[1] - a[1]) * j) / count,
      ];
      supported(sourceMesh, p);
      rays++;
      margin = Math.min(margin, capMargin(p, cap[0][0]));
    }
  }
  assert.ok(margin > 0.1, `base lacks contact margin: ${margin}`);
  t.diagnostic(
    `${rays} full-perimeter source rays, minimum sampled margin ${margin.toFixed(6)}m`,
  );
});

test("actual base skin and frame edges meet source cap without air gaps or unsupported projections", async (t) => {
  const { cap, sourceMesh, tower } = await ready;
  let minimumY = Infinity,
    minimumMargin = Infinity,
    rays = 0;
  const seen = new Set<string>();
  for (const role of roles) {
    const geometry = tower[role],
      p = geometry.getAttribute("position"),
      ix = geometry.getIndex()!;
    for (let i = 0; i < p.count; i++) minimumY = Math.min(minimumY, p.getY(i));
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = ix.getX(i + j),
          b = ix.getX(i + ((j + 1) % 3));
        if (
          Math.abs(p.getY(a) - sourceHeight) > 0.0001 ||
          Math.abs(p.getY(b) - sourceHeight) > 0.0001
        )
          continue;
        const start: Pair = [p.getX(a), p.getZ(a)],
          end: Pair = [p.getX(b), p.getZ(b)];
        const key = [start.join(","), end.join(",")].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const count = Math.max(1, Math.ceil(length / 0.25));
        for (let k = 0; k <= count; k++) {
          const point: Pair = [
            start[0] + ((end[0] - start[0]) * k) / count,
            start[1] + ((end[1] - start[1]) * k) / count,
          ];
          assert.equal(
            pointInPoly(...point, cap[0][0].flat()),
            true,
            `${role} projects beyond cap at ${point}`,
          );
          supported(sourceMesh, point);
          rays++;
          minimumMargin = Math.min(minimumMargin, capMargin(point, cap[0][0]));
        }
      }
  }
  assert.ok(
    Math.abs(minimumY - sourceHeight) < 0.0001,
    `base gap/penetration: ${minimumY - sourceHeight}`,
  );
  assert.ok(rays > 100, "actual base edge geometry must be exercised");
  assert.ok(
    minimumMargin > 0.1,
    `skin/frame reaches unsupported edge: ${minimumMargin}`,
  );
  t.diagnostic(
    `${rays} actual base-edge rays; minimum margin ${minimumMargin.toFixed(6)}m`,
  );
});

test("source cap stays exposed outside the replacement and remains unchanged under it", async (t) => {
  const { triangles, sourceMesh, integrated } = await ready;
  const level = D.levels[0],
    plan = towerPlan(level.noseDepth, level.noseWidth).map(
      (v) => v.point as Pair,
    );
  let exposed = 0;
  for (const triangle of triangles) {
    const p: Pair = [
      triangle.reduce((s, v) => s + v[0], 0) / 3,
      triangle.reduce((s, v) => s + v[1], 0) / 3,
    ];
    supported(sourceMesh, p);
    if (pointInPoly(...p, plan.flat()) || capMargin(p, plan) < 0.2) continue;
    const hit = new T.Raycaster(
      new T.Vector3(p[0], sourceHeight + 0.1, p[1]),
      new T.Vector3(0, -1, 0),
      0,
      0.2,
    ).intersectObject(integrated, true)[0];
    assert.ok(hit, `exposed cap missing at ${p}`);
    assert.equal(
      hit.object,
      sourceMesh,
      `new geometry covers exposed podium at ${p}`,
    );
    exposed++;
  }
  assert.ok(exposed > 5);
  t.diagnostic(`${exposed} exposed original cap triangle centroids preserved`);
});
