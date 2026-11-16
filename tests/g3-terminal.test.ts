import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import {
  G3_TERMINAL,
  createG3TerminalGeometry,
  createG3TerminalAssembly,
  preflightG3Silos,
  isG3Silo,
} from "../src/world/g3-terminal";
import { Batcher } from "../src/world/geometry";
import { buildingHeight, footprintArea } from "../src/world/building-profile";
import { pointInPoly, type Building } from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
const bytes = fs.readFileSync(G3_TERMINAL.source),
  source = JSON.parse(bytes.toString()),
  silos = (source.buildings as Building[]).filter((b) => isG3Silo(b.id)),
  g = createG3TerminalGeometry();
function meshes() {
  return (["concrete", "steel", "housing"] as const).map((k) => {
    const m = new T.Mesh(g[k], new T.MeshBasicMaterial({ side: T.DoubleSide }));
    m.updateMatrixWorld(true);
    return m;
  });
}

test("actual 48 ODbL rings preflight atomically; exactly those generic buildings are replaced once", () => {
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    G3_TERMINAL.sha256,
  );
  assert.equal(silos.length, 48);
  assert.ok(silos.every((b) => buildingHeight(b) === 6.4));
  assert.equal(preflightG3Silos(source.buildings), true);
  const before = JSON.stringify(source),
    batch = new Batcher(new T.Group()),
    dispatch = createG3TerminalAssembly(source.buildings, () => 0);
  batch.offsetY = 19;
  let count = 0;
  for (const b of source.buildings) if (dispatch(b, batch)) count++;
  assert.equal(count, 48);
  assert.equal(batch.offsetY, 19);
  const chunks = batch.finish();
  assert.equal(chunks.length, 3);
  for (const chunk of chunks) {
    const [x, z] = chunk.userData.center;
    assert.ok(
      Math.hypot(x - 5466.15, z + 2337.05) < 300,
      "correct local culling registration",
    );
  }
  assert.equal(
    chunks.reduce((n, m) => n + m.geometry.index!.count / 3, 0),
    g.triangles,
  );
  assert.equal(JSON.stringify(source), before);
  for (const mutation of ["missing", "duplicate", "ring", "height", "kind"]) {
    const copy = structuredClone(silos);
    if (mutation === "missing") copy.pop();
    if (mutation === "duplicate") copy.push(copy[0]);
    if (mutation === "ring") copy[0].pts[0] += 0.01;
    if (mutation === "height") copy[0].height = 40;
    if (mutation === "kind") copy[0].kind = "warehouse";
    assert.equal(preflightG3Silos(copy), false);
    const fallback = createG3TerminalAssembly(copy, () => 0),
      empty = new Batcher(new T.Group());
    for (const b of copy) assert.equal(fallback(b, empty), false);
    assert.equal(empty.groups.size, 0);
  }
});

test("every source cylinder is closed, outward wound, grounded and 42.672m tall with no duplicate caps", () => {
  const p = g.concrete.attributes.position;
  // Neighbouring OSM rings share tangent vertices. Verify closure per cylinder,
  // not by welding separate solids together at those source contacts.
  let first = 0;
  for (const bin of g.bins) {
    const edges = new Map<string, number>();
    const last = first + bin.ring.length * 12;
    for (let i = first; i < last; i += 3) {
      const vertices = [0, 1, 2].map((j) =>
        [p.getX(i + j), p.getY(i + j), p.getZ(i + j)]
          .map((v) => v.toFixed(3))
          .join(","),
      );
      for (let j = 0; j < 3; j++) {
        const edge = [vertices[j], vertices[(j + 1) % 3]].sort().join("|");
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    assert.ok(
      [...edges.values()].every((n) => n === 2),
      `${bin.id} closed two-face incidence`,
    );
    first = last;
  }
  assert.equal(first, p.count);
  let volume = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(p, i),
      b = new T.Vector3().fromBufferAttribute(p, i + 1),
      c = new T.Vector3().fromBufferAttribute(p, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    assert.ok(normal.length() > 1e-8);
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  const expected = silos.reduce((s, b) => s + footprintArea(b.pts) * 42.672, 0);
  assert.ok(
    Math.abs(volume - expected) / expected < 1e-4,
    "outward enclosed volume",
  );
  const m = new T.Mesh(
    g.concrete,
    new T.MeshBasicMaterial({ side: T.FrontSide }),
  );
  m.updateMatrixWorld(true);
  for (const b of g.bins) {
    const top = new T.Raycaster(
      new T.Vector3(b.centre[0], 60, b.centre[1]),
      new T.Vector3(0, -1, 0),
      0,
      70,
    ).intersectObject(m);
    assert.ok(top.length >= 1);
    assert.ok(Math.abs(top[0].point.y - 42.672) < 2e-6);
    const bottom = new T.Raycaster(
      new T.Vector3(b.centre[0], -1, b.centre[1]),
      new T.Vector3(0, 1, 0),
      0,
      2,
    ).intersectObject(m);
    assert.ok(bottom.length > 0);
    assert.ok(Math.abs(bottom[0].point.y) < 1e-6);
  }
});

test("three finite conveyor galleries stay in the terminal footprint and every support lands on its named cap", () => {
  assert.equal(g.galleries.length, 3);
  assert.equal(g.supports.length, 24);
  const objects = meshes();
  for (const s of g.supports) {
    const b = g.bins.find((b) => b.id === s.silo)!;
    assert.ok(pointInPoly(s.point[0], s.point[1], b.ring.flat()));
    const hit = new T.Raycaster(
      new T.Vector3(s.point[0], s.bottom + 0.02, s.point[1]),
      new T.Vector3(0, -1, 0),
      0,
      0.04,
    ).intersectObject(objects[0])[0];
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y - s.bottom) < 2e-6);
    const steel = new T.Raycaster(
      new T.Vector3(s.point[0], s.bottom - 0.02, s.point[1]),
      new T.Vector3(0, 1, 0),
      0,
      0.04,
    ).intersectObject(objects[1])[0];
    assert.ok(steel);
    assert.ok(Math.abs(steel.point.y - s.bottom) < 2e-6);
  }
  for (const role of ["steel", "housing"] as const) {
    const p = g[role].attributes.position;
    for (let i = 0; i < p.count; i++) {
      assert.ok(p.getX(i) > 5417.69 && p.getX(i) < 5514.61);
      assert.ok(p.getZ(i) > -2431.41 && p.getZ(i) < -2242.69);
      assert.ok(p.getY(i) >= 42.6719 && p.getY(i) < 45);
    }
  }
  assert.ok(g.triangles < 8000);
});

test("visible source contact uses caller ground without double batching offsets; shore/roads/collision are unchanged", () => {
  const elevated = createG3TerminalGeometry(() => 2.3);
  for (const k of ["concrete", "steel", "housing"] as const) {
    const a = g[k].attributes.position,
      b = elevated[k].attributes.position;
    assert.equal(a.count, b.count);
    for (let i = 0; i < a.count; i++) {
      assert.equal(a.getX(i), b.getX(i));
      assert.equal(a.getZ(i), b.getZ(i));
      assert.ok(Math.abs(b.getY(i) - a.getY(i) - 2.3) < 1e-5);
    }
  }
  const base = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const data = { ...base, ...source, trees: [], ocean: source.ocean },
    c = new CollisionWorld(data),
    before = JSON.stringify({
      roads: data.roads,
      ocean: data.ocean,
      areas: data.areas,
    });
  const dispatch = createG3TerminalAssembly(data.buildings, () => 0),
    batch = new Batcher(new T.Group());
  for (const b of data.buildings) dispatch(b, batch);
  assert.equal(
    JSON.stringify({ roads: data.roads, ocean: data.ocean, areas: data.areas }),
    before,
  );
  for (const b of g.bins) assert.equal(c.blocked(...b.centre, 0.3, 30), true);
});
