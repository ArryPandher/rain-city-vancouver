import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  PAN_PACIFIC_NEAR_PODIUM as D,
  type PanPacificNearPodiumTier,
} from "../src/world/pan-pacific-near-podium-data";
import {
  createPanPacificNearPodiumGeometry,
  panPacificNearPodiumPoint as point,
  type PanPacificNearPodiumPart,
} from "../src/world/pan-pacific-near-podium";
import { panPacificHowePodiumPoint as southeastPoint } from "../src/world/pan-pacific-howe-podium";
const parts = createPanPacificNearPodiumGeometry(),
  roles: PanPacificNearPodiumPart[] = [
    "concrete",
    "frame",
    "backing",
    "soffit",
    "glass",
  ];
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
function mesh(role: PanPacificNearPodiumPart) {
  const m = new T.Mesh(parts[role], material);
  m.updateMatrixWorld();
  return m;
}
function ray(
  edge: number,
  t: number,
  y: number,
  tier: PanPacificNearPodiumTier = "lower",
) {
  const start = point(edge, t, y, 3, tier),
    direction = point(edge, t, y, -3, tier).sub(start).normalize();
  return new T.Raycaster(start, direction, 0, 4.5);
}

test("near return preserves source tier vertices and the completed southeast junction", () => {
  for (const tier of ["lower", "middle", "upper"] as const) {
    const scale = D.tiers[tier].scale;
    for (let i = 0; i < 5; i++)
      for (const t of [0, 1]) {
        const q = D.sourceVertices[i + t],
          p = point(i, t, 0, 0, tier);
        assert.ok(Math.abs(p.x - (-132 + (q[0] + 132) * scale)) < 1e-8);
        assert.ok(Math.abs(p.z - (69 + (q[1] - 69) * scale)) < 1e-8);
      }
    assert.ok(
      point(4, 1, 16, 0, tier).distanceTo(southeastPoint(0, 16, 0, tier)) <
        1e-7,
    );
  }
});

test("recorded blank visible faces become physical glazed apertures with closed recesses", () => {
  for (const [edge, t, y, tier] of [
    [2, 0.38, 11.365, "lower"],
    [4, 0.37, 11.289, "lower"],
    [0, 0.42, 11.4, "lower"],
    [2, 0.38, 17.75, "middle"],
    [3, 0.38, 21.35, "upper"],
  ] as const) {
    const r = ray(edge, t, y, tier),
      glass = r.intersectObject(mesh("glass")),
      back = r.intersectObject(mesh("backing"));
    assert.ok(glass.length > 0, `real pane edge${edge}/${y}/${tier}`);
    assert.ok(back.length > 0, `closed backing edge${edge}/${y}/${tier}`);
    assert.ok(
      back[0].distance - glass[0].distance >= 0.49,
      "physical cavity behind glass",
    );
  }
  // Paired apertures preserve the photographed intervening pale field.
  assert.ok(ray(3, 0.38, 9.15).intersectObject(mesh("glass")).length > 0);
  assert.ok(ray(3, 0.38, 10.95).intersectObject(mesh("concrete")).length > 0);
  assert.equal(ray(3, 0.38, 10.95).intersectObject(mesh("glass")).length, 0);
});

test("small pale spine has actual curvature, bounded high opening and side closure", () => {
  const length = point(0, 0, 0).distanceTo(point(0, 1, 0));
  const hits = [0.08, 0.5, 0.92].map(
    (u) =>
      ray(0, (D.spineWidth * u) / length, 10).intersectObject(
        mesh("concrete"),
      )[0],
  );
  assert.ok(hits.every(Boolean));
  assert.ok(hits[0].distance - hits[1].distance > 0.25);
  assert.ok(hits[2].distance - hits[1].distance > 0.25);
  const window = ray(0, (D.spineWidth * 0.4) / length, 13.2);
  assert.ok(window.intersectObject(mesh("glass")).length > 0);
  assert.ok(window.intersectObject(mesh("backing")).length > 0);
});

test("new glazing respects the shared PIER floor and has no broad floor overlay", () => {
  for (const role of roles) {
    const g = parts[role],
      p = g.attributes.position,
      n = g.attributes.normal,
      ix = g.index!;
    assert.ok(g.boundingBox!.min.y >= D.floor - 0.0001);
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
      if (ids.every((id) => Math.abs(p.getY(id) - D.floor) < 0.0001))
        assert.ok(n.getY(ids[0]) < 0.9, "no duplicate PIER floor");
    }
  }
  for (const tier of ["lower", "middle", "upper"] as const) {
    const low = tier === "lower" ? D.floor : D.tiers[tier].bottom,
      top = D.tiers[tier].top;
    const p = parts.concrete.attributes.position;
    for (const y of [low, top]) {
      const target = new T.Vector3(
        D.retainedStart[tier][0],
        y,
        D.retainedStart[tier][1],
      );
      let found = false;
      for (let i = 0; i < p.count; i++)
        if (
          new T.Vector3().fromBufferAttribute(p, i).distanceTo(target) < 0.00002
        ) {
          found = true;
          break;
        }
      assert.ok(found, `exact decoded face30 seam endpoint ${tier}/${y}`);
    }
  }
});

test("near return has bounded shared batches and finite metre-UV geometry", () => {
  assert.equal(parts.stats.geometryBatches, 5);
  assert.ok(parts.stats.triangles < 10_000, JSON.stringify(parts.stats));
  assert.ok(parts.stats.panes > 200);
  for (const role of roles) {
    const g = parts[role];
    assert.equal(g.groups.length, 0);
    assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(g.attributes.normal.array).every(Number.isFinite));
    assert.equal(g.attributes.position.count, g.attributes.uv.count);
  }
});
