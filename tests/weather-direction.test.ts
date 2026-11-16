import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { World, type Weather } from "../src/world/world";
import { DEFAULT_DAYLIGHT_ORIENTATION, changeDebugDaylightOrientation } from "../src/world/daylight-orientation";
import { SceneReflections } from "../src/rendering/reflection-probes";

// Exercise the owning weather/update methods without browser texture loading.
function fixture() {
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xffffff);
  const sun = new T.DirectionalLight();
  sun.target.position.set(125, 17, -680);
  return {
    weather: "day",
    debugDaylightOrientation: "southeast",
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
      weather === "day"
        ? [278 / Math.SQRT2, 149.61315223935466, 278 / Math.SQRT2]
        : [-220, 110, 170];
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
  assert.ok(
    world.sun.position
      .clone()
      .sub(world.sun.target.position)
      .distanceTo(before) < 1e-10,
  );
  assert.deepEqual(world.sun.target.position.toArray(), [-80, 17, -798]);
  assert.equal(world.sun.intensity, 3.4);
});

test("southeast daylight separates Howe and Cordova while preserving a plausible sun and documenting the hotel tradeoff", async () => {
  const { canadaPlaceCanopyPoint: at } = await import(
    "../src/world/canada-place-canopy"
  );
  const { facadeFrame } = await import("../src/world/architectural-mesh");
  const { FAIRMONT_WATERFRONT_RING: ring } = await import(
    "../src/world/fairmont-waterfront-site"
  );
  const { PACIFIC_COAST_RING: pacific } = await import(
    "../src/world/pacific-coast-site"
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
  assert.ok(direction.toArray().every(Number.isFinite));
  assert.ok(Math.abs(direction.length() - 1) < 1e-12);
  assert.ok(Math.abs(azimuth - 135) < 1e-8);
  assert.ok(Math.abs(elevation - 28.288107223038665) < 0.00001);
  const incidence = (points: [number, number][], edge: number) => {
    const n = facadeFrame(points[edge], points[edge + 1]).outward;
    return new T.Vector3(n[0], 0, n[1]);
  };
  const cordova = incidence(pacific, 0).dot(direction),
    howe = incidence(pacific, 1).dot(direction);
  assert.ok(
    cordova > 0 && cordova < 0.03,
    "the source Cordova plane receives only grazing direct light before occlusion",
  );
  assert.ok(
    howe > 0.87 && howe < 0.89 && howe - cordova > 0.85,
    "the photographed upper Howe face has strong incidence, unlike the nearly equal east-sun faces",
  );
  const facadeNormal = at(0, 0, 1)
    .sub(at(0, 0, 0))
    .normalize();
  assert.ok(
    facadeNormal.dot(direction) < -0.83 && facadeNormal.dot(direction) > -0.85,
    "the west concourse remains back-facing to the same world sun; no facade-specific override",
  );
  const oldEast = new T.Vector3(278, 149.61315223935466, 0).normalize(),
    hotelIncidence = [
      0.3529513414277388, 0.6226610771992099, 0.7674882736887214,
    ];
  for (const edge of [0, 1, 2]) {
    const normal = incidence(ring, edge),
      value = normal.dot(direction);
    assert.ok(
      Math.abs(value - hotelIncidence[edge]) < 1e-8,
      `Fairmont edge ${edge} keeps its recorded southeast incidence`,
    );
    assert.ok(
      value > 0.3 && value < normal.dot(oldEast),
      "all three hotel planes retain positive direct incidence, with a real reduction versus the east sun",
    );
  }
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
  assert.ok(Number.isFinite(declination) && Math.abs(declination) < 23.44);
  assert.equal(world.sun.intensity, 3.4);
  assert.equal(world.sun.color.getHex(), 0xffefd9);
  assert.equal(world.ambient.intensity, 1.15);
  assert.equal(world.ambient.color.getHex(), 0xc7deef);
  assert.equal(world.scene.environmentIntensity, 0.8);
  assert.equal(world.scene.backgroundIntensity, 1);
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

test("debug southwest direction preserves daylight scalars, follows the player and survives weather restoration", () => {
  const world = Object.setPrototypeOf(fixture(), World.prototype) as World;
  world.setWeather("day");
  const values = () => [
    world.sun.intensity,
    world.sun.color.getHex(),
    world.ambient.intensity,
    world.ambient.color.getHex(),
    world.ambient.groundColor.getHex(),
    world.scene.backgroundIntensity,
    world.scene.environmentIntensity,
    (world.scene.fog as T.FogExp2).density,
    world.materials.asphalt.roughness,
    world.materials.asphalt.metalness,
  ];
  const baseline = values(),
    offset = world.sun.position.clone().sub(world.sun.target.position),
    background = world.scene.backgroundRotation.y;
  world.setDebugDaylightOrientation("southwest");
  assert.deepEqual(values(), baseline);
  assert.ok(
    Math.abs(
      world.sun.position.distanceTo(world.sun.target.position) -
        offset.length(),
    ) < 1e-10,
  );
  assert.equal(world.scene.backgroundRotation.y, background - Math.PI / 2);
  assert.equal(
    world.scene.environmentRotation.y,
    world.scene.backgroundRotation.y,
  );
  for (const weather of [
    "day",
    "night",
    "day",
    "overcast",
    "golden",
    "day",
  ] satisfies Weather[]) {
    world.setWeather(weather);
    for (const [x, z] of [
      [-130, 38],
      [540, -450],
      [6800, -1449],
    ]) {
      world.update(0, x, z, 17);
      const profile = world.daylightOrientationProfile(),
        direction = world.sun.position
          .clone()
          .sub(world.sun.target.position)
          .normalize();
      assert.equal(profile.selected, "southwest");
      assert.equal(
        profile.active,
        weather === "day" ? "southwest" : "weather-default",
      );
      assert.ok(
        world.water.uniforms.sunDir.value.distanceTo(direction) < 1e-12,
      );
      if (weather === "day") {
        assert.ok(Math.abs(profile.azimuthDegrees - 225) < 1e-10);
        assert.ok(
          Math.abs(profile.elevationDegrees - 28.288107223038665) < 1e-10,
        );
        assert.deepEqual(values(), baseline);
      } else {
        assert.equal(world.scene.backgroundRotation.y, 2.3);
        assert.equal(world.scene.environmentRotation.y, 1.2);
        assert.ok(
          direction.distanceTo(new T.Vector3(-220, 110, 170).normalize()) <
            1e-12,
        );
      }
    }
  }
  world.setDebugDaylightOrientation("southeast");
  assert.ok(
    world.sun.position
      .clone()
      .sub(world.sun.target.position)
      .distanceTo(offset) < 1e-10,
  );
  assert.equal(world.scene.backgroundRotation.y, background);
  assert.deepEqual(values(), baseline);
});

test("the visible debug action clears old local captures and requests shadows without changing exposure or probe budgets", () => {
  const world = Object.setPrototypeOf(fixture(), World.prototype) as World;
  world.setWeather("day");
  const glass = new T.MeshPhysicalMaterial({ envMapIntensity: 0.85 }),
    reflections = new SceneReflections(
      world.scene,
      new T.Group(),
      [],
      world.sun,
      [
        {
          name: "existing local",
          position: [0, 12, 0],
          materials: [glass],
          resolution: 256,
        },
      ],
    ),
    probe = reflections.probes[0],
    renderer = { shadowMap: { needsUpdate: false }, toneMappingExposure: 1.05 };
  probe.valid = true;
  probe.dirty = false;
  probe.capturedGeneration = 0;
  glass.envMap = probe.target.texture;
  assert.equal(
    reflections.currentTexture("existing local"),
    probe.target.texture,
  );
  changeDebugDaylightOrientation(
    world,
    "southwest",
    renderer.shadowMap,
    reflections,
  );
  assert.equal(world.debugDaylightOrientation, "southwest");
  assert.equal(renderer.shadowMap.needsUpdate, true);
  assert.equal(renderer.toneMappingExposure, 1.05);
  assert.equal(probe.valid, false);
  assert.equal(probe.dirty, true);
  assert.equal(glass.envMap, null);
  assert.equal(glass.envMapIntensity, 0.85);
  assert.equal(reflections.currentTexture("existing local"), null);
  assert.equal(reflections.probes.length, 1);
  assert.equal(probe.target.width, 256);
  reflections.dispose();
});

test("southwest comparison illuminates the registered Gallery face at the same physically plausible solar elevation", async () => {
  const { GALLERY_FACADE: face } = await import("../src/world/gallery-facade"),
    normal = new T.Vector3(face.nx, 0, face.nz).applyAxisAngle(
      new T.Vector3(0, 1, 0),
      -face.angle,
    ),
    world = Object.setPrototypeOf(fixture(), World.prototype) as World;
  world.setWeather("day");
  const direction = () =>
    world.sun.position.clone().sub(world.sun.target.position).normalize();
  assert.ok(Math.abs(normal.dot(direction()) - 0.027739526273003468) < 1e-10);
  world.setDebugDaylightOrientation("southwest");
  assert.ok(Math.abs(normal.dot(direction()) - 0.8801387122493308) < 1e-10);
  const profile = world.daylightOrientationProfile(),
    latitude = T.MathUtils.degToRad(49.29),
    elevation = T.MathUtils.degToRad(profile.elevationDegrees),
    azimuth = T.MathUtils.degToRad(profile.azimuthDegrees),
    declination = T.MathUtils.radToDeg(
      Math.asin(
        Math.sin(latitude) * Math.sin(elevation) +
          Math.cos(latitude) * Math.cos(elevation) * Math.cos(azimuth),
      ),
    );
  assert.ok(Math.abs(declination) < 23.44);
});


test("normal gameplay south daylight stays coherent across Gallery, harbour and bridge", () => {
  const world = fixture();
  world.debugDaylightOrientation = DEFAULT_DAYLIGHT_ORIENTATION;
  World.prototype.setWeather.call(world, "day");
  for (const [x, z] of [[-68.79, 51.52], [540, -450], [6800, -1449]]) {
    World.prototype.update.call(world, 0, x, z, 0);
    const profile = World.prototype.daylightOrientationProfile.call(world);
    assert.equal(profile.active, "south");
    assert.ok(Math.abs(profile.azimuthDegrees - 180) < 1e-10);
    assert.ok(Math.abs(profile.elevationDegrees - 28.288107223038665) < 1e-10);
    assert.equal(world.scene.environmentRotation.y, world.scene.backgroundRotation.y);
    assert.ok(new T.Vector3(...profile.direction).distanceTo(world.water.uniforms.sunDir.value) < 1e-12);
    assert.equal(world.sun.intensity, 3.4);
  }
  World.prototype.setWeather.call(world, "night");
  assert.equal(world.scene.backgroundRotation.y, 2.3);
  World.prototype.setWeather.call(world, "day");
  assert.ok(Math.abs(World.prototype.daylightOrientationProfile.call(world).azimuthDegrees - 180) < 1e-10);
});
