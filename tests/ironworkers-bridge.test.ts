import test from "node:test";
import {
  IRONWORKERS_PLAN_LENGTH,
  ironworkersPoint,
  ironworkersGradeT,
  ironworkersTAtDistance,
} from "../src/world/ironworkers-alignment";
import assert from "node:assert/strict";
import * as T from "three";
import {
  BRIDGES,
  bridgePoint,
  bridgeSample,
  bridgeY,
} from "../src/world/collision";
import {
  createIronworkersBridgeGeometry,
  ironworkersStations,
  ironworkersTrussDepth,
  IRONWORKERS_STRUCTURE as D,
} from "../src/world/ironworkers-bridge";
const bridge = BRIDGES.find((b) => b.id === "ironworkers")!;
const length = IRONWORKERS_PLAN_LENGTH;
const height = (t: number) => bridgeY(bridge, t);
const built = createIronworkersBridgeGeometry(bridge, height);
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const root = new T.Group();
root.add(
  new T.Mesh(built.steel, material),
  new T.Mesh(built.concrete, material),
);
root.updateMatrixWorld(true);
function at(t: number, side: number, y: number) {
  const [x, z] = ironworkersPoint(t, side);
  return new T.Vector3(x, y + height(ironworkersGradeT(x, z)) - height(t), z);
}
function cast(origin: T.Vector3, direction: T.Vector3, far: number) {
  return new T.Raycaster(origin, direction, 0, far).intersectObject(root, true);
}

test("documented main spans form a continuous below-deck cantilever with supported transitions", () => {
  const s = ironworkersStations(length);
  assert.equal(s.northPier - s.southPier, 335);
  assert.equal(s.southPier - s.start, 142);
  assert.equal(s.end - s.northPier, 142);
  assert.equal(ironworkersTrussDepth(s.southPier, length), D.anchorDepth);
  assert.equal(ironworkersTrussDepth(s.northPier, length), D.anchorDepth);
  assert.equal(ironworkersTrussDepth(s.centre, length), D.midspanDepth);
  assert.equal(
    ironworkersTrussDepth(s.end, length),
    D.approachDepth,
    "main/approach bearing must not have a floating depth discontinuity",
  );
  for (const bearing of [s.start, s.southPier, s.northPier, s.end])
    for (const side of [-D.trussSpacing / 2, D.trussSpacing / 2]) {
      const t = ironworkersTAtDistance(bearing),
        bottom = height(t) - ironworkersTrussDepth(bearing, length);
      const pier = new T.Raycaster(
        at(t, side, bottom + 0.1),
        new T.Vector3(0, -1, 0),
        0,
        2,
      ).intersectObject(root.children[1])[0];
      const chord = new T.Raycaster(
        at(t, side, bottom - 0.6),
        new T.Vector3(0, 1, 0),
        0,
        1.2,
      ).intersectObject(root.children[0])[0];
      assert.ok(
        pier && chord,
        `bearing surfaces missing at ${bearing}/${side}`,
      );
      assert.ok(
        Math.abs(chord.point.y - pier.point.y) < 0.085,
        `bearing/chord gap at ${bearing}/${side}: ${chord.point.y - pier.point.y}`,
      );
    }
});

test("driving sky stays open and structural steel cannot enter the retained roadway", () => {
  const positions = built.steel.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const p = new T.Vector3().fromBufferAttribute(positions, i),
      t = bridgeSample(bridge, p.x, p.z).t;
    assert.ok(
      p.y <= height(t) - 0.25,
      `steel vertex${i} crosses road at t${t}: ${p.y} vs ${height(t)}`,
    );
  }
  for (let i = 1; i < 100; i++)
    for (const side of [-13, -5, 0, 5, 13]) {
      const t = i / 100;
      assert.equal(
        cast(at(t, side, height(t) + 1.8), new T.Vector3(0, 1, 0), 80).length,
        0,
        `invented overhead structure at ${t}/${side}`,
      );
    }
});

test("deck underside follows the existing playable grade without creating a duplicate top or side gap", () => {
  for (let i = 1; i < 150; i++)
    for (const side of [-17.8, 0, 17.8]) {
      const t = i / 150,
        hit = cast(at(t, side, height(t) + 0.1), new T.Vector3(0, -1, 0), 1)[0];
      assert.ok(hit, `deck underside missing ${t}/${side}`);
      assert.ok(
        Math.abs(hit.point.y - at(t, side, height(t) - D.deckDepth).y) < 0.018,
        `deck thickness differs at ${t}: ${hit.point.y}`,
      );
    }
  assert.equal(built.stats.meshes, 2);
  assert.ok(
    built.stats.triangles < 45000,
    `unbounded structure cost ${built.stats.triangles}`,
  );
  assert.ok(built.stats.panels > 80 && built.stats.panels < 110);
  for (const g of [built.steel, built.concrete]) {
    assert.ok(g.index && g.getAttribute("normal") && g.getAttribute("uv"));
    assert.ok(
      Array.from(g.getAttribute("position").array).every(Number.isFinite),
    );
  }
});

test("structure is pure and honors the loader's actual graded deck callback", () => {
  const snapshot = JSON.stringify(bridge),
    elevated = (t: number) => height(t) + 7 + 3 * t;
  const raised = createIronworkersBridgeGeometry(bridge, elevated);
  const p = raised.steel.getAttribute("position");
  for (let i = 0; i < p.count; i += 19) {
    const t = bridgeSample(bridge, p.getX(i), p.getZ(i)).t;
    assert.ok(p.getY(i) < elevated(t) - 0.25);
  }
  assert.equal(
    JSON.stringify(bridge),
    snapshot,
    "bridge alignment/support data mutated",
  );
  raised.steel.dispose();
  raised.concrete.dispose();
});
