import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { World, type Weather } from "../src/world/world";

// Exercise the owning weather/update methods without browser texture loading.
function fixture() {
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xffffff);
  const sun = new T.DirectionalLight();
  sun.target.position.set(125, 17, -680);
  return {
    weather: "day",
    scene,
    sun,
    ambient: new T.HemisphereLight(),
    skyTextures: {},
    reflectionTextures: {},
    nightLights: [],
    materials: {
      setNight: () => {},
      asphalt: new T.MeshStandardMaterial(),
      animatedUniforms: [],
      beacons: [],
    },
    rain: {
      visible: false,
      position: new T.Vector3(),
      geometry: new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute([0, 2, 0], 3),
      ),
    },
    water: {
      uniforms: {
        deep: { value: new T.Color() },
        sky: { value: new T.Color() },
        sunDir: { value: new T.Vector3() },
        night: { value: 0 },
        time: { value: 0 },
      },
    },
    time: 0,
    chunks: [],
    casterVolume: { update: () => {} },
    collision: { groundHeight: () => 17 },
  } as unknown as World;
}
test("weather establishes gameplay sun direction before startup reflection capture", () => {
  const world = fixture();
  for (const weather of [
    "day",
    "golden",
    "night",
    "overcast",
  ] satisfies Weather[]) {
    const target = world.sun.target.position.clone();
    World.prototype.setWeather.call(world, weather);
    assert.deepEqual(world.sun.target.position.toArray(), target.toArray());
    const expected =
      weather === "day" ? [-278, 149.61315223935466, 0] : [-220, 110, 170];
    assert.ok(
      world.sun.position
        .clone()
        .sub(target)
        .distanceTo(new T.Vector3(...expected)) < 1e-10,
    );
    assert.ok(
      world.water.uniforms.sunDir.value.distanceTo(
        new T.Vector3(...expected).normalize(),
      ) < 1e-12,
    );
  }
});
test("initial daylight and first player-follow update agree on direction and intensity", () => {
  const world = fixture();
  World.prototype.setWeather.call(world, "day");
  const before = world.sun.position.clone().sub(world.sun.target.position);
  assert.equal(world.sun.intensity, 3.4);
  World.prototype.update.call(world, 0, -81, -798, 17);
  assert.deepEqual(
    world.sun.position.clone().sub(world.sun.target.position).toArray(),
    before.toArray(),
  );
  assert.deepEqual(world.sun.target.position.toArray(), [-80, 17, -798]);
  assert.equal(world.sun.intensity, 3.4);
});

test("daylight illuminates the source northwest facade from a plausible western afternoon sun", async () => {
  const { canadaPlaceCanopyPoint: at } = await import(
    "../src/world/canada-place-canopy"
  );
  const world = fixture();
  World.prototype.setWeather.call(world, "day");
  const direction = world.sun.position
    .clone()
    .sub(world.sun.target.position)
    .normalize();
  const azimuth =
    ((Math.atan2(direction.x, -direction.z) * 180) / Math.PI + 360) % 360;
  const elevation = (Math.asin(direction.y) * 180) / Math.PI;
  assert.ok(Math.abs(azimuth - 270) < 1e-8);
  assert.ok(Math.abs(elevation - 28.288107223038665) < 0.00001);
  const facadeNormal = at(0, 0, 1)
    .sub(at(0, 0, 0))
    .normalize();
  assert.ok(
    facadeNormal.dot(direction) > 0.4 && facadeNormal.dot(direction) < 0.42,
  );
  // Solar declination implied by this azimuth/elevation at Vancouver must lie
  // within Earth's obliquity; arbitrary west/high sun can be impossible here.
  const lat = (49.29 * Math.PI) / 180,
    alt = (elevation * Math.PI) / 180,
    az = (azimuth * Math.PI) / 180;
  const declination =
    (Math.asin(
      Math.sin(lat) * Math.sin(alt) +
        Math.cos(lat) * Math.cos(alt) * Math.cos(az),
    ) *
      180) /
    Math.PI;
  assert.ok(Math.abs(declination) < 23.44);
  assert.equal(world.sun.intensity, 3.4);
  assert.equal(world.ambient.intensity, 1.15);
  assert.equal(world.scene.environmentIntensity, 0.8);
});

test("weather transitions and multiple follow positions keep water aligned with the active sun", () => {
  const world = fixture();
  for (const weather of [
    "day",
    "golden",
    "day",
    "overcast",
    "night",
    "day",
  ] satisfies Weather[]) {
    World.prototype.setWeather.call(world, weather);
    const offset = world.sun.position.clone().sub(world.sun.target.position);
    for (const [x, z] of [
      [472.2, -586.8],
      [-81.3, -798.4],
      [1250.7, 963.2],
    ]) {
      World.prototype.update.call(world, 0, x, z, 17);
      const actual = world.sun.position.clone().sub(world.sun.target.position);
      assert.ok(actual.distanceTo(offset) < 1e-10);
      assert.ok(
        world.water.uniforms.sunDir.value.distanceTo(actual.normalize()) <
          1e-12,
      );
    }
    if (weather !== "day")
      assert.ok(offset.distanceTo(new T.Vector3(-220, 110, 170)) < 1e-10);
  }
});

test("day/night/day switches restore matching sky and environment vertical rotations", async () => {
  const { DAYLIGHT_SKY_ROTATION } = await import("../src/world/daylight");
  const world = fixture(),
    day = new T.Texture(),
    other = new T.Texture();
  world.skyTextures = { day, night: other, golden: other, overcast: other };
  world.reflectionTextures = {
    day,
    night: other,
    golden: other,
    overcast: other,
  };
  for (const w of [
    "day",
    "night",
    "day",
    "golden",
    "overcast",
    "day",
  ] satisfies Weather[]) {
    World.prototype.setWeather.call(world, w);
    const isDay = w === "day";
    assert.equal(world.scene.background, isDay ? day : other);
    assert.equal(world.scene.environment, isDay ? day : other);
    assert.deepEqual(world.scene.backgroundRotation.toArray(), [
      0,
      isDay ? DAYLIGHT_SKY_ROTATION : 2.3,
      0,
      "XYZ",
    ]);
    assert.deepEqual(world.scene.environmentRotation.toArray(), [
      0,
      isDay ? DAYLIGHT_SKY_ROTATION : 1.2,
      0,
      "XYZ",
    ]);
  }
});
