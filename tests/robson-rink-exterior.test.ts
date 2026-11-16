import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { createRobsonRinkExteriorGeometry } from "../src/world/robson-rink-exterior";
import {
  ROBSON_RINK_EXTERIOR as D,
  ROBSON_RINK_OPENINGS,
  ROBSON_RINK_GUARDS,
  robsonDomeXZ,
  robsonRinkOpeningAt,
  robsonRinkLowerSupport,
} from "../src/world/robson-rink-exterior-data";
import { roadWidth, segmentPoint, type Road } from "../src/world/data";

test("closed retaining shells have visible floors matching bounded lower support", () => {
  const parts = createRobsonRinkExteriorGeometry(),
    pos = parts.concrete.getAttribute("position");
  const edges = new Map<string, number>();
  const pointKey = (i: number) =>
    [pos.getX(i), pos.getY(i), pos.getZ(i)].join(",");
  for (let i = 0; i < pos.count; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = pointKey(i + k),
        b = pointKey(i + ((k + 1) % 3)),
        key = [a, b].sort().join("|");
      assert.notEqual(a, b);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  assert.ok(
    [...edges.values()].every((n) => n === 2),
    "every concrete edge must close exactly twice",
  );
  const mesh = new T.Mesh(parts.concrete, new T.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  for (const dome of D.domes)
    for (const a of [-0.65, 0, 0.65])
      for (const b of [-0.45, 0, 0.45]) {
        const [x, z] = robsonDomeXZ(dome, a * dome.radii[0], b * dome.radii[1]);
        const ray = new T.Raycaster(
          new T.Vector3(x, -0.2, z),
          new T.Vector3(0, -1, 0),
        );
        const hit = ray.intersectObject(mesh)[0];
        assert.ok(hit, "exposed floor is front-facing and closed");
        assert.ok(Math.abs(hit.point.y - D.rinkY) < 1e-5);
        assert.equal(robsonRinkLowerSupport(x, z, -1), D.rinkY);
        assert.equal(
          robsonRinkLowerSupport(x, z, D.streetY),
          undefined,
          "never snap an upper actor down",
        );
      }
  assert.equal(robsonRinkLowerSupport(0, 0, -5), undefined);
  assert.equal(ROBSON_RINK_GUARDS.length, 128);
  for (let i = 0; i < ROBSON_RINK_GUARDS.length; i++) {
    const next = Math.floor(i / 64) * 64 + ((i + 1) % 64);
    assert.deepEqual(ROBSON_RINK_GUARDS[i].b, ROBSON_RINK_GUARDS[next].a);
  }
  for (const k of ["concrete", "steel", "glass"] as const) parts[k].dispose();
  mesh.material.dispose();
});

test("roof stays inside its opening, follows the operator envelope, and has bounded batches", () => {
  const parts = createRobsonRinkExteriorGeometry(),
    pos = parts.glass.getAttribute("position");
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    assert.ok(Number.isFinite(x + y + z));
    assert.ok(
      robsonRinkOpeningAt(x, z),
      "low glass must not cross uncut street ground",
    );
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  assert.ok(Math.abs(min - D.roofLow) < 1e-5);
  assert.ok(Math.abs(max - D.roofHigh) < 1e-5);
  assert.equal(parts.stats.batches, 3);
  assert.ok(parts.stats.triangles < 24000);
  assert.ok(
    parts.stats.glassTriangles > 200 && parts.stats.glassTriangles < 600,
  );
  for (const key of ["concrete", "steel", "glass"] as const) {
    assert.equal(parts[key].groups.length, 0);
    parts[key].dispose();
  }
});

test("real mapped routes and Robson Street crossing remain outside guarded wells", () => {
  const roads = JSON.parse(
    fs.readFileSync(
      new URL("../public/data/vancouver-roads.json", import.meta.url),
      "utf8",
    ),
  ).roads as Road[];
  const conflicts: string[] = [];
  let checked = 0,
    streetSamples = 0;
  for (const road of roads) {
    if (
      !road.pts.some(
        (x, i) =>
          i % 2 === 0 &&
          x > -125 &&
          x < -40 &&
          road.pts[i + 1] > 40 &&
          road.pts[i + 1] < 130,
      )
    )
      continue;
    const width = roadWidth(road);
    for (let i = 2; i < road.pts.length; i += 2) {
      const [ax, az, bx, bz] = [
        road.pts[i - 2],
        road.pts[i - 1],
        road.pts[i],
        road.pts[i + 1],
      ];
      const length = Math.hypot(bx - ax, bz - az);
      if (!length) continue;
      const steps = Math.ceil(length / 0.25);
      for (let j = 0; j <= steps; j++)
        for (const side of [-0.5, 0, 0.5]) {
          const x =
            ax + ((bx - ax) * j) / steps - ((bz - az) / length) * width * side;
          const z =
            az + ((bz - az) * j) / steps + ((bx - ax) / length) * width * side;
          checked++;
          if (road.id === "w50098016") streetSamples++;
          if (
            robsonRinkOpeningAt(x, z) ||
            ROBSON_RINK_GUARDS.some(
              (g) => segmentPoint(x, z, ...g.a, ...g.b).d < 0.38,
            )
          )
            conflicts.push(road.id ?? "unknown");
        }
    }
  }
  assert.ok(checked > 5000 && streetSamples > 300);
  assert.deepEqual(
    [...new Set(conflicts)],
    [],
    "opening/guard must clear current entire route ribbons plus body margin",
  );
  assert.equal(ROBSON_RINK_OPENINGS.length, 2);
});
