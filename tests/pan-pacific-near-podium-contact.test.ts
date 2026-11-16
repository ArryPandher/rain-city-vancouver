import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  panPacificNearPodiumCompatible,
  replacePanPacificNearPodiumSource,
} from "../src/world/pan-pacific-near-podium-source";
import { replacePanPacificTowerSource } from "../src/world/pan-pacific-tower-source";
import { replacePanPacificHowePodiumFaces } from "../src/world/pan-pacific-howe-podium-source";
import { replaceCanadaPlaceHotelFaces } from "../src/world/canada-place-hotel-source";
import { replaceCanadaPlaceCanopyFaces } from "../src/world/canada-place-canopy";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import { PAN_PACIFIC_NEAR_PODIUM as D } from "../src/world/pan-pacific-near-podium-data";
import {
  createPanPacificNearPodiumGeometry,
  panPacificNearPodiumPoint as point,
} from "../src/world/pan-pacific-near-podium";
import {
  createPanPacificHowePodiumGeometry,
  panPacificHowePodiumPoint,
} from "../src/world/pan-pacific-howe-podium";

const roles = ["concrete", "frame", "backing", "soffit", "glass"] as const;
const tiers = ["lower", "middle", "upper"] as const;
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
function mesh(g: T.BufferGeometry) {
  return new T.Mesh(g, material);
}
function ray(
  group: T.Object3D,
  origin: T.Vector3,
  direction: T.Vector3,
  far: number,
) {
  return new T.Raycaster(origin, direction, 0, far).intersectObject(
    group,
    true,
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
  assert.equal(panPacificNearPodiumCompatible(scene), true);
  const entries: { material: string; geometry: T.BufferGeometry }[] = [];
  scene.traverse((o) => {
    if (o instanceof T.Mesh)
      entries.push({
        material: o.material.name,
        geometry: bakeGeometry(o.geometry, o.matrixWorld),
      });
  });
  const concrete = entries.find((e) => e.material === "concrete")!.geometry;
  // Original ordered triples, before paving or any facade edits shift indices.
  const original = Array.from(concrete.index!.array);
  const caps = [
    [174, 216],
    [1614, 1656],
    [1786, 1828],
  ].map(([a, b]) => original.slice(a * 3, b * 3));
  const triangleKey = (g: T.BufferGeometry, offset: number) => {
    const p = g.getAttribute("position");
    return [0, 1, 2]
      .flatMap((j) => {
        const id = g.index ? g.index.getX(offset + j) : offset + j;
        return [p.getX(id), p.getY(id), p.getZ(id)];
      })
      .join(",");
  };
  const pierTriangles = Array.from({ length: 32 }, (_, i) =>
    triangleKey(concrete, (32 + i) * 3),
  );
  const source = new T.Group();
  for (const e of entries) {
    const paving = extractCanadaPlacePaving(e.geometry, e.material);
    if (paving) source.add(mesh(paving));
    replacePanPacificHowePodiumFaces(e.geometry, e.material);
    replaceCanadaPlaceHotelFaces(e.geometry, e.material);
    replaceCanadaPlaceCanopyFaces(e.geometry, e.material);
    replaceCanadaPlaceWestFaces(e.geometry, e.material);
  }
  assert.equal(replacePanPacificTowerSource(entries), 3140);
  assert.equal(replacePanPacificNearPodiumSource(entries), 70);
  for (const e of entries) source.add(mesh(e.geometry));
  // Paving extracts most PIER top triangles to a new primitive. Prove their
  // exact position triples survive across that split as well as the cuts.
  const survivingPositions = new Set<string>();
  source.traverse((o) => {
    if (o instanceof T.Mesh)
      for (
        let i = 0;
        i <
        (o.geometry.index?.count ?? o.geometry.getAttribute("position").count);
        i += 3
      )
        survivingPositions.add(triangleKey(o.geometry, i));
  });
  for (const key of pierTriangles)
    assert.ok(
      survivingPositions.has(key),
      "lost original PIER surface triangle",
    );
  const retained = new Set<string>();
  for (let i = 0; i < concrete.index!.count; i += 3)
    retained.add([0, 1, 2].map((j) => concrete.index!.getX(i + j)).join(","));
  for (const ids of caps)
    for (let i = 0; i < ids.length; i += 3)
      assert.ok(
        retained.has(ids.slice(i, i + 3).join(",")),
        `lost PIER/cap triangle ${ids.slice(i, i + 3)}`,
      );
  const near = createPanPacificNearPodiumGeometry(),
    nearGroup = new T.Group(),
    integrated = new T.Group();
  for (const role of roles) nearGroup.add(mesh(near[role]));
  integrated.add(source, nearGroup);
  const howe = createPanPacificHowePodiumGeometry();
  for (const role of roles) integrated.add(mesh(howe[role]));
  integrated.updateMatrixWorld(true);
  return { source, near, nearGroup, integrated };
}
const ready = fixture();

test("near return retains all three source caps and PIER, with continuous source support under its base", async (t) => {
  const { source, near } = await ready;
  let samples = 0;
  // Sample the entire wall run, including the curved spine and cranked corners.
  for (let edge = 0; edge < 5; edge++) {
    const length = point(edge, 0, 0).distanceTo(point(edge, 1, 0));
    for (let i = 0; i <= Math.ceil(length / 0.2); i++)
      for (const out of [-0.92, -0.45, 0, 0.035]) {
        const p = point(edge, i / Math.ceil(length / 0.2), D.floor + 0.02, out);
        const hit = ray(source, p, new T.Vector3(0, -1, 0), 0.04)[0];
        assert.ok(
          hit && Math.abs(hit.point.y - D.floor) < 1e-5,
          `PIER floor missing at ${p.toArray()}`,
        );
        samples++;
      }
  }
  // Every actual bottom edge, including all outward lip vertices, is supported.
  for (const role of roles) {
    const g = near[role],
      p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        p.getY(i) >= D.floor - 1e-5,
        `${role} extends below retained floor`,
      );
      if (Math.abs(p.getY(i) - D.floor) > 1e-5) continue;
      const pos = new T.Vector3()
        .fromBufferAttribute(p, i)
        .add(new T.Vector3(0, 0.02, 0));
      assert.ok(
        ray(source, pos, new T.Vector3(0, -1, 0), 0.04).some(
          (h) => Math.abs(h.point.y - D.floor) < 1e-5,
        ),
        `${role} unsupported base vertex ${i}: ${pos.toArray()}`,
      );
      samples++;
    }
  }
  t.diagnostic(`${samples} source-floor contact samples`);
});

test("replacement introduces no upward floor or cap overlay on retained source surfaces", async (t) => {
  const { near, source } = await ready;
  let checked = 0;
  for (const role of roles) {
    const g = near[role],
      p = g.getAttribute("position"),
      ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const v = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(p, ix.getX(i + j)),
      );
      const normal = v[1]
        .clone()
        .sub(v[0])
        .cross(v[2].clone().sub(v[0]))
        .normalize();
      if (normal.y < 0.99) continue;
      const c = v[0].clone().add(v[1]).add(v[2]).divideScalar(3);
      if (
        ![D.floor, ...tiers.map((k) => D.tiers[k].top)].some(
          (y) => Math.abs(c.y - y) < 1e-5,
        )
      )
        continue;
      for (const weights of [
        [1 / 3, 1 / 3, 1 / 3],
        [0.8, 0.1, 0.1],
        [0.1, 0.8, 0.1],
        [0.1, 0.1, 0.8],
      ]) {
        const q = new T.Vector3();
        v.forEach((value, j) => q.addScaledVector(value, weights[j]));
        const hits = ray(
          source,
          q.clone().add(new T.Vector3(0, 0.01, 0)),
          new T.Vector3(0, -1, 0),
          0.02,
        );
        assert.ok(
          !hits.some(
            (h) =>
              Math.abs(h.point.y - q.y) < 1e-5 &&
              Math.abs(h.face!.normal.y) > 0.99,
          ),
          `${role} triangle ${i / 3} duplicates retained cap/floor at ${q.toArray()}`,
        );
        checked++;
      }
    }
  }
  t.diagnostic(
    `${checked} new upward lip samples checked against actual retained caps`,
  );
});

test("all tier terminals meet retained face30 and completed face36 without a daylight hole", async (t) => {
  const { integrated, source } = await ready;
  let samples = 0;
  for (const tier of tiers) {
    assert.ok(
      point(4, 1, 0, 0, tier).distanceTo(
        panPacificHowePodiumPoint(0, 0, 0, tier),
      ) < 1e-8,
      `${tier} face36 station differs`,
    );
    // The original cap remains above the inboard edge of each replacement tier.
    for (let edge = 0; edge < 5; edge++)
      for (let s = 0.01; s < 1; s += 0.025) {
        const p = point(edge, s, D.tiers[tier].top + 0.02, -0.04, tier);
        const hits = ray(source, p, new T.Vector3(0, -1, 0), 0.04);
        assert.ok(
          hits.some((h) => Math.abs(h.point.y - D.tiers[tier].top) < 1e-5),
          `${tier} retained cap contact missing at ${p.toArray()}`,
        );
        samples++;
      }
    for (const [edge, s] of [
      [0, 0],
      [4, 1],
    ]) {
      const normal = point(edge, s, 0, 1, tier)
        .sub(point(edge, s, 0, 0, tier))
        .normalize();
      const tangent = point(edge, 1, 0, 0, tier)
        .sub(point(edge, 0, 0, 0, tier))
        .normalize();
      const low = tier === "lower" ? D.floor : D.tiers[tier].bottom;
      for (let y = low + 0.02; y < D.tiers[tier].top; y += 0.08)
        for (const lateral of [-0.015, 0, 0.015]) {
          const origin = point(edge, s, y, 2, tier).addScaledVector(
            tangent,
            lateral,
          );
          assert.ok(
            ray(integrated, origin, normal.clone().negate(), 3).length,
            `${tier} terminal ${edge}/${s} hole at ${origin.toArray()}`,
          );
          samples++;
        }
    }
  }
  t.diagnostic(`${samples} retained-cap and terminal closure rays`);
});
