import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Terrain } from "../src/world/terrain";
import { CollisionWorld } from "../src/world/collision";
import { type CityData, pointInPoly } from "../src/world/data";
import { type Materials } from "../src/world/materials";
import {
  buildProspectLookout,
  lookoutSurfaces,
} from "../src/world/prospect-lookout";
import {
  LOOKOUT_FLIGHTS,
  prospectLookoutHeight,
} from "../src/world/prospect-lookout-site";
import map from "../src/world/prospect-lookout-map.json";
function fixture() {
  const bytes = fs.readFileSync("public/data/stanley-height.u16");
  const terrain = new Terrain(
    JSON.parse(fs.readFileSync("public/data/stanley-terrain.json", "utf8")),
    new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  );
  const data = {
    terrain,
    roads: [],
    buildings: [],
    areas: [],
    ocean: [],
  } as unknown as CityData;
  const collision = new CollisionWorld(data);
  const materials = {
    pbr: () => new T.MeshStandardMaterial(),
    texture: () => new T.Texture(),
    grass: new T.MeshStandardMaterial(),
    asphalt: new T.MeshStandardMaterial(),
  } as unknown as Materials;
  const root = new T.Group(),
    meshes = buildProspectLookout(root, data, materials, collision);
  root.updateMatrixWorld(true);
  return { data, collision, root, meshes };
}
test("lookout surfaces partition the terraces and steps without overlapping floors", () => {
  const surfaces = lookoutSurfaces();
  let sampled = 0;
  for (let x = -1648.17; x < -1592; x += 0.41)
    for (let z = -3409.23; z < -3354; z += 0.43) {
      const y = prospectLookoutHeight(x, z);
      const matches = surfaces.filter(
        (s) =>
          pointInPoly(x, z, s.pts) &&
          !s.holes.some((h) => pointInPoly(x, z, h)),
      );
      assert.equal(
        matches.length,
        y === undefined ? 0 : 1,
        `overlap/gap at ${x},${z}`,
      );
      if (y !== undefined) {
        assert.ok(Math.abs(matches[0].height - y) < 1e-8);
        sampled++;
      }
    }
  assert.ok(sampled > 1000);
});
test("every stair tread agrees with actor height and allows an unobstructed centreline", () => {
  const { collision, meshes } = fixture();
  for (const f of LOOKOUT_FLIGHTS) {
    assert.ok((f.top - f.bottom) / f.steps <= 0.17);
    for (let i = 0; i < f.steps; i++) {
      const t = (i + 0.5) / f.steps,
        x = f.a[0] + (f.b[0] - f.a[0]) * t,
        z = f.a[1] + (f.b[1] - f.a[1]) * t;
      const y = collision.groundHeight(x, z),
        expected = f.top - ((f.top - f.bottom) * (i + 1)) / f.steps;
      assert.ok(Math.abs(y - expected) < 1e-8);
      assert.equal(
        collision.blocked(x, z, 0.4, y),
        false,
        `blocked stair ${x},${z}`,
      );
      const hit = new T.Raycaster(
        new T.Vector3(x, y + 0.1, z),
        new T.Vector3(0, -1, 0),
        0,
        0.2,
      ).intersectObjects(meshes)[0];
      assert.ok(hit, `missing visible tread ${x},${z}`);
      assert.ok(Math.abs(hit.point.y - y - 0.008) < 0.0001);
    }
  }
});
test("mapped lower loop and connecting paths keep clear player-width access", () => {
  const { collision } = fixture();
  for (const id of ["w190392418", "w190392419", "w361266151"] as const) {
    const p = map.ways[id].pts;
    for (let i = 0; i < p.length - 2; i += 2)
      for (let j = 1; j < 20; j++) {
        const t = j / 20,
          x = p[i] + (p[i + 2] - p[i]) * t,
          z = p[i + 1] + (p[i + 3] - p[i + 1]) * t;
        assert.notEqual(
          prospectLookoutHeight(x, z),
          undefined,
          `uncovered route ${id}:${x},${z}`,
        );
        assert.equal(
          collision.blocked(x, z, 0.4, collision.groundHeight(x, z)),
          false,
          `blocked route ${id}:${x},${z}`,
        );
      }
  }
});
test("lookout geometry stays finite and retains local spatial bounds", () => {
  const { meshes } = fixture();
  let triangles = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
        ].every(Number.isFinite),
      );
      assert.ok(
        p.getX(i) > -1652 &&
          p.getX(i) < -1590 &&
          p.getZ(i) > -3412 &&
          p.getZ(i) < -3352,
      );
    }
    triangles += (mesh.geometry.index?.count ?? p.count) / 3;
  }
  assert.ok(triangles > 5000 && triangles < 40000, `triangles ${triangles}`);
});

test("path corners and the raised planting have explicit construction heights", () => {
  for (const [x, z] of [
    [-1613.26, -3402.55],
    [-1600.54, -3390.26],
  ])
    assert.equal(prospectLookoutHeight(x, z), 58.4, `turning dip at ${x},${z}`);
  assert.equal(prospectLookoutHeight(-1601.5, -3401), 56.55);
  const { collision, meshes } = fixture();
  const hit = new T.Raycaster(
    new T.Vector3(-1601.5, 57, -3401),
    new T.Vector3(0, -1, 0),
    0,
    1,
  ).intersectObjects(meshes)[0];
  assert.ok(hit);
  assert.ok(
    Math.abs(hit.point.y - collision.groundHeight(-1601.5, -3401) - 0.008) <
      0.0001,
  );
});
