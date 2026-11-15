import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { createCanadaWalkingSurface } from "../src/world/canada-walking-surface";
import { canadaPlaceApproachGeometry } from "../src/world/canada-place-approach";
import { ribbon, subdividePath } from "../src/world/geometry";
import {
  isStreet,
  roadWidth,
  KX,
  ORIGIN,
  type CityData,
} from "../src/world/data";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { CANADA_PLACE_DECK_Y } from "../src/world/canada-place-deck";

const data = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
) as CityData;
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
data.buildings.forEach((b) => (b.pts = convert(b.pts)));
data.areas.forEach((a) => {
  a.pts = convert(a.pts);
  a.holes = a.holes?.map(convert);
});
data.ocean = data.ocean.map(convert);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const collision = new CollisionWorld(data);
collision.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, true, true));
const site = collision.canada!;
const start = performance.now();
const surface = createCanadaWalkingSurface(data, site, (r, x, z) =>
  collision.roadHeight(r, x, z),
);
const buildMs = performance.now() - start;
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const parts = canadaPlaceApproachGeometry(
  data,
  site,
  collision.existingGroundHeight.bind(collision),
);
const meshes = [new T.Mesh(parts.pavement, material)];
for (const road of data.roads) {
  if (
    !(isStreet(road) || road.kind === "service") ||
    !site.intersects(road.pts)
  )
    continue;
  meshes.push(
    new T.Mesh(
      ribbon(
        subdividePath(road.pts),
        roadWidth(road),
        isStreet(road) ? 0.092 : road.walkway ? 0.15 : 0.07,
        (x, z) => collision.roadHeight(road, x, z),
        5,
        true,
      ),
      material,
    ),
  );
}
meshes.forEach((m) => m.updateMatrixWorld(true));
const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
function visibleFloor(x: number, z: number) {
  ray.ray.origin.set(x, 50, z);
  return ray.intersectObjects(meshes, false)[0]?.point.y;
}

test("native arrival court feet meet finished paving above the shared construction datum", () => {
  const [x, z] = [492.2032484809166, -473.6827770690959];
  const base = collision.height(x, z);
  assert.ok(base > 7.7 && base < 8.4, "source-guided arrival neighborhood");
  assert.equal(base, collision.howeTerrain!.height(x, z));
  const finish = collision.walkingHeight(x, z);
  assert.ok(Math.abs(finish - base - 0.15) < 1e-6);
  assert.ok(Math.abs(finish - visibleFloor(x, z)!) < 0.03);
  assert.equal(collision.height(x, z), base);
});

test("ordinary Howe route contacts match actual rendered road and sidewalk triangles", () => {
  let checked = 0,
    worst = 0;
  for (let x = 458.23; x <= 496; x += 2.1)
    for (let z = -492.37; z <= -436; z += 2.1) {
      const y = surface.height(x, z);
      if (y === undefined) continue;
      const rendered = visibleFloor(x, z);
      assert.notEqual(rendered, undefined, `missing render floor at ${x},${z}`);
      worst = Math.max(worst, Math.abs(y - rendered!));
      assert.ok(
        Math.abs(y - rendered!) < 0.032,
        `contact error ${y - rendered!} at ${x},${z}`,
      );
      checked++;
    }
  assert.ok(checked > 100, `only ${checked} samples`);
  const [x, z] = [486.65, -453.35];
  assert.ok(
    Math.abs(surface.height(x, z)! - visibleFloor(x, z)!) < 0.0001,
    "asphalt uses its actual triangulated finish, not a blanket sidewalk offset",
  );
  console.log(
    JSON.stringify({
      walkingSamples: checked,
      worstContactError: worst,
      buildMs,
      roadTriangles: surface.triangleCount,
      bytes: surface.triangleBytes,
      cells: surface.cellCount,
    }),
  );
});

test("walk contact does not double-raise the existing pier or affect outside terrain", () => {
  assert.equal(collision.walkingHeight(430, -541.04), CANADA_PLACE_DECK_Y);
  assert.equal(collision.walkingHeight(0, 0), collision.height(0, 0));
  assert.equal(surface.height(0, 0), undefined);
  assert.ok(surface.triangleBytes < 1_000_000, "bounded CPU contact data");
  assert.ok(surface.cellCount < 2000, "bounded lookup index");
});
