import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  PAN_PACIFIC_TOWER as D,
  PAN_PACIFIC_TOWER_WINDOW_CENTRES as WINDOWS,
  towerPlan,
} from "../src/world/pan-pacific-tower-data";
import {
  createPanPacificTowerGeometry,
  type PanPacificTowerPart,
} from "../src/world/pan-pacific-tower";
const parts = createPanPacificTowerGeometry();
const roles: PanPacificTowerPart[] = [
  "concrete",
  "frame",
  "backing",
  "roof",
  "glass",
];
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
function mesh(role: PanPacificTowerPart) {
  const m = new T.Mesh(parts[role], material);
  m.updateMatrixWorld();
  return m;
}
function sample(face: string, u: number, y: number, offset = 4) {
  const level = D.levels.find((l) => y >= l.bottom && y <= l.top)!;
  const ring = towerPlan(level.noseDepth, level.noseWidth),
    i = ring.findIndex((v) => v.face === face);
  const a = ring[i].point,
    b = ring[(i + 1) % ring.length].point;
  const along = new T.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize(),
    normal = new T.Vector3(along.z, 0, -along.x);
  const target = new T.Vector3(
    T.MathUtils.lerp(a[0], b[0], u),
    y,
    T.MathUtils.lerp(a[1], b[1], u),
  );
  return new T.Raycaster(
    target.addScaledVector(normal, offset),
    normal.negate(),
    0,
    offset + 2,
  );
}

test("registered asymmetric plan retains shared head and distinct supported nose steps", () => {
  const upper = towerPlan(),
    middle = towerPlan(1.5, 0.5),
    lower = towerPlan(3, 1);
  assert.equal(upper.length, 37);
  assert.deepEqual(lower[0].point, upper[0].point);
  assert.deepEqual(lower[1].point, upper[1].point);
  assert.equal(upper.filter((v) => v.face === "nose").length, 20);
  const i = upper.findIndex((v) => v.face === "nose");
  assert.ok(
    Math.abs(
      new T.Vector2(...lower[i].point).distanceTo(
        new T.Vector2(...upper[i].point),
      ) - 3,
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(
      new T.Vector2(...middle[i].point).distanceTo(
        new T.Vector2(...upper[i].point),
      ) - 1.5,
    ) < 1e-8,
  );
  assert.equal(D.base, 25.495826721191406);
  assert.ok(
    D.longAxis[0] > 0.85 && D.longAxis[1] < -0.45,
    "long roof follows registered NE alignment",
  );
  assert.equal(
    WINDOWS.length,
    11,
    "eleven photo rows are distinct from an asserted storey count",
  );
});

test("broad near face and its faceted return remain closed continuous glass without pale belts", () => {
  for (const face of ["near", "return"])
    for (const y of [29.1, 42.2, 61.1, 72.1]) {
      const r = sample(face, 0.37, y),
        glass = r.intersectObject(mesh("glass")),
        back = r.intersectObject(mesh("backing"));
      assert.ok(glass.length > 0, `${face} glass at${y}`);
      assert.ok(back.length > 0, `${face} closed backing at${y}`);
      assert.ok(back[0].distance - glass[0].distance > 0.44);
    }
  const first = sample("near", 0.37, 42.2).intersectObject(mesh("concrete"));
  assert.equal(
    first.length,
    0,
    "no broad source-style opaque encircling strip",
  );
});

test("stepped southeast field differs from near glass and rounded punched nose", () => {
  // Ring runs NE→SW on this side: t.8 is the near lower glazed part.
  const near = sample("southeast", 0.8135, 40),
    far = sample("southeast", 0.2135, 40);
  assert.ok(near.intersectObject(mesh("glass")).length > 0);
  assert.equal(near.intersectObject(mesh("concrete")).length, 0);
  assert.ok(far.intersectObject(mesh("concrete")).length > 0);
  assert.equal(far.intersectObject(mesh("glass")).length, 0);
  const noseRow = sample("nose", 0.38, WINDOWS[9]);
  assert.ok(
    noseRow.intersectObject(mesh("glass")).length > 0,
    "rounded nose aperture is real glazing",
  );
  assert.ok(
    noseRow.intersectObject(mesh("backing")).length > 0,
    "nose aperture has closed cavity",
  );
  const noseSpandrel = sample("nose", 0.5, WINDOWS[9] + 1.4);
  assert.ok(noseSpandrel.intersectObject(mesh("concrete")).length > 0);
});

test("terraces have real ledges while roof closes full mass and source cap is not duplicated", () => {
  for (let k = 0; k < 2; k++) {
    const outer = towerPlan(D.levels[k].noseDepth, D.levels[k].noseWidth),
      inner = towerPlan(D.levels[k + 1].noseDepth, D.levels[k + 1].noseWidth);
    const i = outer.findIndex((v) => v.face === "nose") + 10;
    const p = new T.Vector3(
      (outer[i].point[0] + inner[i].point[0]) / 2,
      D.levels[k].top + 0.5,
      (outer[i].point[1] + inner[i].point[1]) / 2,
    );
    const hits = new T.Raycaster(
      p,
      new T.Vector3(0, -1, 0),
      0,
      1,
    ).intersectObject(mesh("concrete"));
    assert.ok(
      hits.some((h) => Math.abs(h.point.y - D.levels[k].top) < 0.001),
      `terrace${k}`,
    );
  }
  for (const p of [
    [-149, 76],
    [-126, 69],
    [-103, 57],
  ]) {
    const hits = new T.Raycaster(
      new T.Vector3(p[0], 85, p[1]),
      new T.Vector3(0, -1, 0),
      0,
      10,
    ).intersectObject(mesh("roof"));
    assert.ok(hits.length > 0, "closed roof at registered interior point");
  }
  for (const role of roles) {
    const g = parts[role],
      pos = g.attributes.position,
      normal = g.attributes.normal,
      ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
      if (ids.every((id) => Math.abs(pos.getY(id) - D.base) < 0.0001))
        assert.ok(
          normal.getY(ids[0]) < 0.9,
          "no upward duplicate source podium cap",
        );
    }
    assert.ok(
      g.boundingBox!.min.y >= D.base - 0.0001,
      "all geometry on or above exact retained cap",
    );
  }
});

test("full tower has bounded merged batches, finite data and a restrained closed crown", () => {
  assert.equal(parts.stats.geometryBatches, 5);
  assert.ok(parts.stats.triangles < 85_000, JSON.stringify(parts.stats));
  assert.ok(parts.stats.punchedOpenings > 400);
  assert.ok(Math.abs(parts.roof.boundingBox!.max.y - D.crownTop) < 0.001);
  for (const role of roles) {
    const g = parts[role];
    assert.equal(g.groups.length, 0);
    assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(g.attributes.normal.array).every(Number.isFinite));
    assert.equal(g.attributes.position.count, g.attributes.uv.count);
  }
});
