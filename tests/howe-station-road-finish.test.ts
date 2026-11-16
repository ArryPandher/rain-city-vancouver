import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { VehicleRoadSurfaceBuilder } from "../src/world/vehicle-road-surface";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { Batcher, ribbon, subdividePath } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";

import { canadaPlaceApproachGeometry } from "../src/world/canada-place-approach";
import { splitHoweStationPaving } from "../src/world/howe-station-paving";
import { HOWE_STATION_PAVING } from "../src/world/howe-station-site";
const mesh = (geometry: T.BufferGeometry) => {
  const m = new T.Mesh(
    geometry,
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  m.updateMatrixWorld(true);
  return m;
};

function mappedFixture() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
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
  collision.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true),
  );
  const materials = Object.create(Materials.prototype) as Materials;
  materials.texture = () => new T.Texture();
  for (const name of ["concrete", "asphalt", "stone", "yellow"] as const)
    materials[name] = new T.MeshStandardMaterial({ name });
  const roads = data.roads.filter((r) =>
    r.pts.some(
      (x, i) =>
        i % 2 === 0 &&
        x >= 350 &&
        x <= 550 &&
        r.pts[i + 1] >= -600 &&
        r.pts[i + 1] <= -300,
    ),
  );
  const world = Object.assign(Object.create(World.prototype), {
    root: new T.Group(),
    chunks: [],
    data: { ...data, roads },
    materials,
    facadeMultiDraw: false,
    vehicleSurfaceSupport: true,
    collision,
    stats: { roads: 0 },
  }) as World;
  const surfaces: T.Mesh[] = [];
  let currentRoad: unknown;
  const oldRoadHeight = collision.roadHeight.bind(collision);
  collision.roadHeight = (r, x, z) => {
    currentRoad = r;
    return oldRoadHeight(r, x, z);
  };
  const add = Batcher.prototype.add;
  Batcher.prototype.add = function (g, m, x, z, key) {
    if (key === "road")
      surfaces.push(
        Object.assign(mesh(g.clone()), { userData: { road: currentRoad } }),
      );
    return add.call(this, g, m, x, z, key);
  };
  try {
    world.roads();
  } finally {
    Batcher.prototype.add = add;
  }
  return { world, surfaces };
}

import { clipCanadaPlacePaths } from "../src/world/canada-place-paths";
import { clipHoweCordovaPaths } from "../src/world/howe-cordova-junction";
import { createHoweStationRoadFinishClipper } from "../src/world/howe-station-road-finish";
import { roadWidth } from "../src/world/data";

const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
const floorAt = (objects: T.Object3D[], x: number, z: number) => {
  ray.ray.origin.set(x, 50, z);
  return ray.intersectObjects(objects)[0]?.point.y;
};
const triangles = (g: T.BufferGeometry) =>
  (g.index?.count ?? g.getAttribute("position").count) / 3;
const bytes = (g: T.BufferGeometry) =>
  Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0) +
  (g.index?.array.byteLength ?? 0);

test("mapped station footway cannot punch through the existing finished paving", () => {
  const { world, surfaces } = mappedFixture();
  const collision = world.collision,
    site = collision.canada!;
  const road = world.data.roads.find((r) => r.id === "w338228126")!;
  const height = (x: number, z: number) => collision.roadHeight(road, x, z);
  let original = clipCanadaPlacePaths(
    ribbon(subdividePath(road.pts), roadWidth(road), 0.15, height, 5, true),
    height,
    0.15,
  );
  if (collision.howeCordovaJunction)
    original = clipHoweCordovaPaths(original, collision.howeCordovaJunction);
  const before = mesh(original),
    after = surfaces.find((s) => s.userData.road.id === road.id)!;
  const parts = canadaPlaceApproachGeometry(
    world.data,
    site,
    collision.existingGroundHeight.bind(collision),
  );
  const split = splitHoweStationPaving(
    parts.pavement,
    (x, z) => site.supportHeight(x, z) + 0.15,
    HOWE_STATION_PAVING,
  );
  const field = mesh(split.field);
  // Concrete source-triangle evidence for the former dark wedge.
  const x = 483.59,
    z = -429.87;
  const beforeY = floorAt([before], x, z)!,
    pavingY = floorAt([field], x, z)!;
  assert.ok(beforeY - pavingY > 0.002 && beforeY - pavingY < 0.003);
  assert.equal(floorAt([after], x, z), undefined);
  assert.ok(Math.abs(pavingY - 8.081307026178507) < 0.00001);
  let overlap = 0,
    fieldSamples = 0,
    outside = 0,
    maxOutsideError = 0,
    maxWalkingError = 0;
  for (let x = 458.13; x < 523; x += 0.43)
    for (let z = -488.17; z < -402; z += 0.47) {
      const oldY = floorAt([before], x, z),
        newY = floorAt([after], x, z),
        fieldY = floorAt([field], x, z);
      if (fieldY !== undefined) {
        fieldSamples++;
        if (oldY !== undefined) overlap++;
        assert.equal(newY, undefined, `duplicate finish survives at ${x},${z}`);
        const roadY = floorAt(surfaces, x, z);
        assert.ok(
          roadY === undefined || roadY < fieldY - 0.04,
          `another road covers paving at ${x},${z}`,
        );
        maxWalkingError = Math.max(
          maxWalkingError,
          Math.abs(collision.walkingHeight(x, z) - fieldY),
        );
      } else if (oldY !== undefined) {
        assert.notEqual(newY, undefined, `lost outside support at ${x},${z}`);
        maxOutsideError = Math.max(maxOutsideError, Math.abs(newY! - oldY));
        assert.ok(
          Math.abs(newY! - oldY) < 0.000002,
          `resampled slope at ${x},${z}`,
        );
        outside++;
      }
    }
  assert.ok(
    fieldSamples > 1500 && overlap > 300 && outside > 300,
    JSON.stringify({ fieldSamples, overlap, outside }),
  );
  assert.ok(maxWalkingError < 0.032);
  // Support builder must index the clipped output, with no phantom footway.
  const contact = new VehicleRoadSurfaceBuilder();
  contact.add(after.geometry);
  assert.equal(contact.finish().height(x, z), undefined);
  // Non-walkway mapped paths remain buried and retain their original geometry.
  const clip = createHoweStationRoadFinishClipper(world.data, site);
  for (const id of ["w358462236", "w358462237", "w358462239"]) {
    const s = surfaces.find((s) => s.userData.road.id === id)!;
    assert.equal(clip(s.geometry, s.userData.road), s.geometry);
  }
  // Existing pavilion/stair hole remains empty on either side of this change.
  for (const [hx, hz] of [
    [479.4, -426.5],
    [476.9, -423.7],
  ]) {
    assert.equal(floorAt([before], hx, hz), undefined);
    assert.equal(floorAt([after], hx, hz), undefined);
  }
  const report = {
    road: road.id,
    beforeTriangles: triangles(original),
    afterTriangles: triangles(after.geometry),
    beforeBytes: bytes(original),
    afterBytes: bytes(after.geometry),
    fieldSamples,
    overlap,
    outside,
    maxOutsideError,
    maxWalkingError,
    example: { x, z, beforeY, pavingY },
    vehicleSurface: world.vehicleSurfaceStats,
  };
  console.log(JSON.stringify(report));
  parts.pavement.dispose();
  parts.retaining.dispose();
  parts.curbs.dispose();
  split.remainder.dispose();
  field.geometry.dispose();
  before.geometry.dispose();
  surfaces.forEach((s) => s.geometry.dispose());
});

test("station cut leaves independent elevations and road types intact", () => {
  const { world, surfaces } = mappedFixture();
  const clip = createHoweStationRoadFinishClipper(
    world.data,
    world.collision.canada!,
  );
  const site = world.collision.canada!;
  for (const kind of ["steps", "service", "primary"]) {
    const g = ribbon([483, -430, 488, -435], 2, 0.15, (x, z) =>
      site.supportHeight(x, z),
    );
    assert.equal(clip(g, { kind, walkway: true }), g);
    g.dispose();
  }
  for (const offset of [-2, 2]) {
    const g = ribbon([483, -430, 488, -435], 2, 0.15 + offset, (x, z) =>
      site.supportHeight(x, z),
    );
    assert.equal(clip(g, { kind: "footway", walkway: true }), g);
    g.dispose();
  }
  surfaces.forEach((s) => s.geometry.dispose());
});
