import { LOOKOUT_CUTOUTS } from "../src/world/prospect-lookout-site";
import { PROSPECT_FORECOURT } from "../src/world/prospect-site";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Terrain } from "../src/world/terrain.ts";
import * as T from "three";
import { terrainMeshes } from "../src/world/terrain-mesh.ts";
import { geo, type CityData } from "../src/world/data.ts";
import {
  CollisionWorld,
  BRIDGES,
  bridgePoint,
} from "../src/world/collision.ts";
import { ribbon, subdividePath } from "../src/world/geometry.ts";
const meta = JSON.parse(
  readFileSync(
    new URL("../public/data/stanley-terrain.json", import.meta.url),
    "utf8",
  ),
);
const bytes = readFileSync(
  new URL("../public/data/stanley-height.u16", import.meta.url),
);
const terrain = new Terrain(
  meta,
  new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
);
const data: CityData = {
  meta: { bbox: [], latC: 0, pxPerMeter: 2, w: 1, h: 1, fetched: "" },
  roads: [],
  areas: [],
  buildings: [],
  trees: [],
  ocean: [],
  pois: [],
  terrain,
};

test("City terrain export is complete, attributed and stored without corruption", () => {
  assert.equal(meta.sourceYear, 2002);
  assert.match(meta.attribution, /Open Government Licence/);
  assert.ok(meta.statistics.sourceRecords > 300);
  assert.ok(meta.statistics.tinVertices > 200000);
  assert.equal(bytes.length, meta.rows * meta.columns * 2);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    meta.binarySha256,
  );
  assert.ok(meta.statistics.gradedCells > 10000);
});
test("Stanley topography separates the summit, lakes, viewpoints and existing city", () => {
  const h = (lat: number, lon: number) => terrain.height(...geo(lat, lon));
  assert.ok(h(49.3125, -123.142) > 48 && h(49.3125, -123.142) < 65);
  assert.ok(h(49.3002, -123.1579) > 10 && h(49.3002, -123.1579) < 25);
  assert.ok(terrain.height(-2024, -2880) > 74);
  assert.equal(
    meta.lakes.find((l: { name: string }) => l.name === "Lost Lagoon").height,
    2,
  );
  assert.equal(
    meta.lakes.find((l: { name: string }) => l.name === "Beaver Lake").height,
    10,
  );
  assert.ok(Math.abs(h(49.3044, -123.1394) - 9.55) < 0.01);
  assert.equal(h(49.2825, -123.1207), 0);
  for (let x = meta.minX; x <= terrain.maxX; x += 16) {
    assert.equal(terrain.height(x, meta.minZ), 0);
    assert.equal(terrain.height(x, terrain.maxZ), 0);
  }
});
test("Lions Gate south approach joins terrain and lower crossings remain underneath", () => {
  const c = new CollisionWorld(data),
    bridge = BRIDGES.find((b) => b.id === "lions")!;
  const south = bridgePoint(bridge, 0),
    deck = bridgePoint(bridge, 0.5);
  assert.ok(c.groundHeight(...south) > 45);
  assert.equal(c.height(...south), c.groundHeight(...south));
  assert.ok(c.height(...deck) > 60);
  const lower = bridgePoint(bridge, 0.09),
    ground = c.groundHeight(...lower),
    upper = c.height(...lower);
  assert.ok(upper - ground > 10);
  assert.equal(c.height(...lower, ground), ground);
  assert.equal(c.height(...lower, upper), upper);
  c.addForestTrunk(...lower, 1);
  assert.equal(c.blocked(...lower, 0.4, ground), true);
  assert.equal(c.blocked(...lower, 0.4, upper), false);
  assert.ok(
    Math.abs(c.bridgeHeight(bridge, 0.0001) - c.groundHeight(...south)) < 0.03,
  );
});
test("subdivided walking and driving surfaces follow the same hills as collision", () => {
  const c = new CollisionWorld(data),
    x = -2470,
    z = -2450;
  const chunks = terrainMeshes(
    terrain,
    [],
    new T.MeshStandardMaterial(),
    [],
    [PROSPECT_FORECOURT, ...LOOKOUT_CUTOUTS],
  );
  let checked = 0;
  for (const mesh of chunks) {
    const p = mesh.geometry.getAttribute("position"),
      idx = mesh.geometry.getIndex()!;
    for (
      let i = 0;
      i < idx.count;
      i += Math.max(3, Math.floor(idx.count / 90) * 3)
    ) {
      const a = idx.getX(i),
        b = idx.getX(i + 1),
        d = idx.getX(i + 2),
        xx = (p.getX(a) + p.getX(b) + p.getX(d)) / 3,
        zz = (p.getZ(a) + p.getZ(b) + p.getZ(d)) / 3,
        yy = (p.getY(a) + p.getY(b) + p.getY(d)) / 3;
      assert.ok(Math.abs(yy + 0.012 - c.groundHeight(xx, zz)) < 0.001);
      checked++;
    }
    mesh.geometry.dispose();
  }
  assert.ok(checked > 1000);
  const road = ribbon(
      subdividePath([x, z, x + 32, z + 32]),
      8,
      0.092,
      (x, z) => c.groundHeight(x, z),
      5,
      true,
    ),
    rp = road.getAttribute("position");
  assert.ok(rp.count > 32);
  for (let i = 0; i < rp.count; i++)
    assert.ok(
      Math.abs(rp.getY(i) - c.groundHeight(rp.getX(i), rp.getZ(i)) - 0.092) <
        0.002,
    );
  road.dispose();
});
