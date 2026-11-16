import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createCathedralPlaceCrown,
  cathedralCrownPoint,
} from "../src/world/cathedral-place-crown";
import { CATHEDRAL_PLACE as D } from "../src/world/cathedral-place-data";

const crown = createCathedralPlaceCrown(),
  reg = crown.registration;
const material = new T.MeshBasicMaterial();
const roof = new T.Mesh(crown.roof, material),
  frame = new T.Mesh(crown.frame, material);
roof.updateMatrixWorld();
frame.updateMatrixWorld();
const localRay = (p: T.Vector3, n: T.Vector3, targets = [roof, frame]) =>
  new T.Raycaster(
    p.clone().addScaledVector(n, 0.16),
    n.clone().negate(),
    0,
    0.32,
  ).intersectObjects(targets, false);

test("owner's two ridge-end finials use a short hip ridge and retain total height", () => {
  assert.ok(Math.abs(reg.width - 15.6747) < 0.001);
  assert.ok(Math.abs(reg.length - 25.9923) < 0.001);
  assert.ok(Math.abs(reg.ridgeLength - 10.3176) < 0.001);
  assert.ok(
    Math.abs(reg.pitchDegrees - 57.07) < 0.1,
    "explicit fitted roof pitch, not City median42 degrees",
  );
  assert.equal(
    reg.facets.filter((f) => f.c.distanceTo(f.d) < 0.00001).length,
    2,
    "two triangular hip ends",
  );
  assert.equal(
    reg.facets.filter((f) => f.c.distanceTo(f.d) > 10).length,
    2,
    "two long trapezoidal planes meet a ridge, not one apex",
  );
  const p = crown.frame.getAttribute("position"),
    counts = [0, 0];
  let max = -Infinity;
  for (let i = 0; i < p.count; i++) {
    max = Math.max(max, p.getY(i));
    if (p.getY(i) <= D.roofPeak + 0.1) continue;
    const distances = reg.ridge.map((r) =>
      Math.hypot(r.x - p.getX(i), r.z - p.getZ(i)),
    );
    const closest = distances[0] < distances[1] ? 0 : 1;
    assert.ok(
      distances[closest] < 0.1,
      "only two slender finials occupy the upper envelope",
    );
    counts[closest]++;
  }
  assert.ok(counts.every((n) => n > 0));
  assert.ok(Math.abs(max - D.apex) < 1e-5);
  for (const r of reg.ridge) {
    const hit = new T.Raycaster(
      new T.Vector3(r.x, D.apex + 1, r.z),
      new T.Vector3(0, -1, 0),
      0,
      2,
    ).intersectObject(frame);
    assert.ok(hit.length && Math.abs(hit[0].point.y - D.apex) < 1e-4);
  }
});

test("solid lower panels are physically closed while upper lattice and lower perimeter contain actual air gaps", () => {
  let upper = 0,
    upperGaps = 0,
    solid = 0;
  for (const f of reg.facets) {
    for (let i = 0; i < 23; i++)
      for (let j = 0; j < 5; j++) {
        const s = (i + 0.37) / 23,
          t =
            D.crownSolidFraction +
            ((1 - D.crownSolidFraction) * (j + 0.35)) / 5;
        const p = cathedralCrownPoint(f, s, t);
        assert.equal(
          localRay(p, f.normal, [roof]).length,
          0,
          "no hidden metal/glass/backing sheet in lattice",
        );
        upper++;
        if (localRay(p, f.normal).length === 0) upperGaps++;
      }
    for (let i = 0; i < 13; i++)
      for (let j = 0; j < 3; j++) {
        const p = cathedralCrownPoint(
          f,
          (i + 0.4) / 13,
          ((j + 0.4) / 3) * (D.crownSolidFraction - 0.03),
        );
        assert.ok(
          localRay(p, f.normal, [roof]).length > 0,
          "every sampled lower panel closes the roof",
        );
        solid++;
      }
  }
  assert.ok(
    upperGaps / upper > 0.45,
    `${upperGaps}/${upper} lattice samples are genuinely open`,
  );
  assert.equal(solid, 156);
  let perimeter = 0,
    gaps = 0;
  for (let e = 0; e < 4; e++) {
    const a = reg.eave[e],
      b = reg.eave[(e + 1) % 4],
      n = new T.Vector3(b.z - a.z, 0, a.x - b.x).normalize();
    for (let i = 0; i < 19; i++) {
      const p = a
        .clone()
        .lerp(b, (i + 0.37) / 19)
        .setY((D.crownSpring + D.crownPanelSpring) / 2);
      perimeter++;
      if (localRay(p, n).length === 0) gaps++;
    }
  }
  assert.ok(
    gaps / perimeter > 0.75,
    "ventilated lower perimeter is not an opaque skirt",
  );
  assert.equal(
    crown.roof.index!.count / 3,
    48,
    "four thin closed panel solids, twelve triangles each",
  );
  const pos = crown.roof.getAttribute("position");
  for (let part = 0; part < 4; part++) {
    const edges = new Map<string, number>();
    for (let t = 0; t < 12; t++) {
      const vertices = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(pos, (part * 12 + t) * 3 + j),
      );
      for (let e = 0; e < 3; e++) {
        const key = [vertices[e], vertices[(e + 1) % 3]]
          .map((p) =>
            p
              .toArray()
              .map((v) => v.toFixed(5))
              .join(","),
          )
          .sort()
          .join("/");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(
      [...edges.values()].every((n) => n === 2),
      "all panel thickness edges close, including hip ends",
    );
  }
});
