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
    rain: { visible: false, position: new T.Vector3() },
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
    assert.deepEqual(world.sun.position.clone().sub(target).toArray(), [
      -220,
      weather === "day" ? 330 : 110,
      170,
    ]);
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
