import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { panPacificHowePodiumCameraClearance as clear } from "../src/world/pan-pacific-howe-podium-camera";
import {
  PAN_PACIFIC_HOWE_PODIUM as D,
  PAN_PACIFIC_HOWE_LENGTH as LENGTH,
} from "../src/world/pan-pacific-howe-podium-data";
import {
  createPanPacificHowePodiumGeometry,
  panPacificHowePodiumPoint as at,
} from "../src/world/pan-pacific-howe-podium";

function allowed(u: number, y: number, out: number, r = 0.25) {
  const p = at(u, y, out);
  return clear(p.x, p.z, r, y);
}
test("bounded arcade mouth admits camera void while retaining every architectural closure", () => {
  for (const u of [0.1, 0.31, 0.51, 0.71, 0.99]) {
    assert.equal(allowed(u, 9.6, -1.8), true, `lower void ${u}`);
    assert.equal(allowed(u, 12.5, -1.8), true, `upper void ${u}`);
    for (const y of [
      D.floor,
      D.floor + 0.2,
      D.lowerBeamBottom,
      D.tiers.lower.top,
      25,
      40,
    ])
      assert.equal(allowed(u, y, -1.8), false, `floor/beam/above ${u}/${y}`);
    assert.equal(allowed(u, 10.7, -1.8), false, "gallery slab");
    assert.equal(allowed(u, 11.5, -1.11), false, "gallery rail");
    assert.equal(allowed(u, 8.5, -0.14), false, "lower rail");
    assert.equal(allowed(u, 9.6, -2.7), false, "back wall/frame");
    assert.equal(allowed(u, 9.6, 1), false, "outside bounded mouth");
  }
  for (const u of [0, 0.001, 0.004, 0.996, 0.999, 1])
    assert.equal(allowed(u, 9.6, -1.8), false, "end returns");
  for (const support of D.supports)
    for (const y of [8.3, 10, 13.7, 14])
      assert.equal(
        allowed(support.u, y, -D.columnInset),
        false,
        "column/capital",
      );
  // Actual phantom front-margin clearance for a close tilted third-person boom.
  for (const out of [0.7, 0.4, 0, -0.2])
    assert.equal(allowed(0.31, 9.8, out), true);
  assert.equal(clear(NaN, 0, 0.25, 10), false);
  assert.equal(clear(0, 0, -0.1, 10), false);
  assert.equal(clear(Infinity, 0, 0.25, 10), false);
  assert.equal(clear(0, 0, 0.25, NaN), false);
});

test("every sampled allowed sphere clears actual authored triangles, including bends and end angles", () => {
  const geometry = createPanPacificHowePodiumGeometry();
  const triangles: { triangle: T.Triangle; bounds: T.Box3 }[] = [];
  for (const role of [
    "concrete",
    "frame",
    "glass",
    "backing",
    "soffit",
  ] as const) {
    const g = geometry[role],
      p = g.getAttribute("position"),
      ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i += 3) {
      const points = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(p, ix.getX(i + j)),
      );
      triangles.push({
        triangle: new T.Triangle(
          ...(points as [T.Vector3, T.Vector3, T.Vector3]),
        ),
        bounds: new T.Box3().setFromPoints(points),
      });
    }
  }
  const stations = [
    0, 0.0035, 0.01, 0.03, 0.1, 0.17912, 0.31, 0.41008, 0.51, 0.71, 0.745,
    0.85358, 0.95, 0.99, 0.9965, 1,
  ];
  for (const support of D.supports)
    stations.push(support.u, support.u - 1 / LENGTH, support.u + 1 / LENGTH);
  const closest = new T.Vector3();
  let admitted = 0;
  for (const u of stations)
    for (const y of [
      8.1, 8.8, 9.2, 9.8, 10.3, 10.6, 10.9, 11.5, 12.3, 13.3, 13.7, 13.9,
    ])
      for (const out of [0.7, 0.3, 0, -0.35, -0.69, -1.11, -1.5, -2, -2.45]) {
        const center = at(u, y, out),
          radius = 0.25;
        if (!clear(center.x, center.z, radius, y)) continue;
        admitted++;
        for (const { triangle, bounds } of triangles) {
          if (bounds.distanceToPoint(center) > radius + 0.01) continue;
          triangle.closestPointToPoint(center, closest);
          assert.ok(
            center.distanceTo(closest) > radius + 0.01,
            `allowed sphere intersects mesh at ${u}/${y}/${out}: ${center.distanceTo(closest)}`,
          );
        }
      }
  assert.ok(admitted > 500, `meaningful open-space samples: ${admitted}`);
  for (const role of [
    "concrete",
    "frame",
    "glass",
    "backing",
    "soffit",
  ] as const)
    geometry[role].dispose();
});

test("camera clearance follows the shared thicker gallery fascia", () => {
  const underside = D.galleryY - D.galleryThickness;
  for (const u of [0.1, 0.31, 0.51, 0.71]) {
    assert.equal(
      allowed(u, underside + 0.15, -1.8, 0.1),
      false,
      "new fascia extension is solid",
    );
    assert.equal(
      allowed(u, underside - 0.2, -1.8, 0.1),
      true,
      "clear below fascia remains open",
    );
    assert.equal(
      allowed(u, underside + 0.15, -0.3, 0.1),
      true,
      "outside fascia remains open",
    );
  }
});
