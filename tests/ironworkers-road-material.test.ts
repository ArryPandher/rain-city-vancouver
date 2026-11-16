import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createIronworkersRoadMaterial,
  hasIronworkersAsphalt,
  IRONWORKERS_ASPHALT_ROADS,
  IRONWORKERS_AGGREGATE_REPEAT_METRES,
} from "../src/world/ironworkers-road-material";
import { createCordovaPavementMaterial } from "../src/world/cordova-pavement-material";
import { SharedTextureSources } from "../src/world/shared-texture-sources";

test("four actual source asphalt ways are selected; all other roads and protected surfaces stay unchanged", () => {
  const roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  assert.deepEqual(
    roads
      .filter(hasIronworkersAsphalt)
      .map((r: any) => r.id)
      .sort(),
    [...IRONWORKERS_ASPHALT_ROADS].sort(),
  );
  for (const id of IRONWORKERS_ASPHALT_ROADS) {
    for (const kind of ["footway", "cycleway", "steps", "pedestrian"])
      assert.equal(
        hasIronworkersAsphalt({ id, kind, surface: "asphalt" }),
        false,
      );
    assert.equal(
      hasIronworkersAsphalt({ id, kind: "primary", surface: "paving_stones" }),
      false,
    );
  }
  assert.equal(IRONWORKERS_AGGREGATE_REPEAT_METRES, 1.2);
});

test("Ironworkers reuses three licensed Sources with independent metric samplers and unchanged asphalt response", () => {
  const cache = new SharedTextureSources({
      load: () => new T.Texture(),
    } as any),
    asphalt = new T.MeshStandardMaterial({
      color: 0x92999b,
      roughness: 0.48,
      metalness: 0.12,
      normalScale: new T.Vector2(0.42, 0.42),
    }),
    library = { asphalt, texture: (name: string) => cache.texture(name) },
    cordova = createCordovaPavementMaterial(library),
    ironworkers = createIronworkersRoadMaterial(library);
  assert.notEqual(ironworkers, asphalt);
  assert.equal(ironworkers.color.getHex(), asphalt.color.getHex());
  assert.equal(ironworkers.roughness, asphalt.roughness);
  assert.equal(ironworkers.metalness, asphalt.metalness);
  assert.deepEqual(ironworkers.normalScale, asphalt.normalScale);
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    const a = ironworkers[key]!,
      b = cordova[key]!;
    assert.notEqual(a, b);
    assert.equal(a.source, b.source);
    assert.equal(
      a.colorSpace,
      key === "map" ? T.SRGBColorSpace : T.NoColorSpace,
    );
    assert.equal(a.wrapS, T.RepeatWrapping);
    assert.equal(a.wrapT, T.RepeatWrapping);
    const origin = new T.Vector2(0, 0).applyMatrix3(a.matrix),
      x = new T.Vector2(1.2 / 5, 0).applyMatrix3(a.matrix),
      z = new T.Vector2(0, 1.2 / 5).applyMatrix3(a.matrix);
    assert.ok(Math.abs(origin.distanceTo(x) - 1) < 1e-12);
    assert.ok(Math.abs(origin.distanceTo(z) - 1) < 1e-12);
    const prior = b.repeat.clone();
    a.repeat.set(2, 3);
    a.dispose();
    assert.deepEqual(b.repeat, prior);
  }
  assert.deepEqual(cache.stats, {
    requests: 6,
    sourceLoads: 3,
    currentURLs: 3,
    // This loader deliberately never completes; all shared Sources stay pending.
    readyCount: 0,
    pendingURLs: [
      "cordova-pavement/color.webp",
      "cordova-pavement/normal.webp",
      "cordova-pavement/roughness.webp",
    ],
    failedURLs: [],
  });
  const source = JSON.parse(
    fs.readFileSync("public/textures/cordova-pavement/SOURCES.json", "utf8"),
  );
  assert.equal(source.license, "CC0-1.0");
  assert.deepEqual(source.runtimeRepeatMetres, [1.2, 1.2]);
  assert.ok(
    source.changes.includes("excludes the source's full-height cracks"),
  );
});

test("the shared deck/road finish follows actual day, rain and night restoration", async () => {
  const { World } = await import("../src/world/world");
  const asphalt = new T.MeshStandardMaterial(),
    bridge = createIronworkersRoadMaterial({
      asphalt,
      texture: () => new T.Texture(),
    }),
    scene = new T.Scene();
  scene.fog = new T.FogExp2(0xffffff);
  const world = Object.assign(Object.create(World.prototype), {
    scene,
    sun: new T.DirectionalLight(),
    ambient: new T.HemisphereLight(),
    skyTextures: {},
    reflectionTextures: {},
    nightLights: [],
    materials: { asphalt, setNight() {} },
    rain: {},
    ironworkersRoadMaterial: bridge,
    water: {
      uniforms: {
        deep: { value: new T.Color() },
        sky: { value: new T.Color() },
        sunDir: { value: new T.Vector3() },
        night: { value: 0 },
      },
    },
  });
  const map = bridge.map;
  for (const [weather, roughness] of [
    ["day", 1],
    ["overcast", 0.45],
    ["night", 0.65],
    ["golden", 1],
    ["day", 1],
  ] as const) {
    world.setWeather(weather);
    assert.equal(bridge.roughness, roughness);
    assert.equal(bridge.metalness, 0);
    assert.equal(bridge.map, map);
  }
});

test("actual landmarks changes only the Ironworkers deck material, preserving every emitted mesh and its metric UVs", async () => {
  const { buildLandmarks } = await import("../src/world/landmarks"),
    { Materials } = await import("../src/world/materials"),
    { createHash } = await import("node:crypto");
  const library = Object.create(Materials.prototype) as InstanceType<
    typeof Materials
  >;
  library.texture = () => new T.Texture();
  for (const key of [
    "asphalt",
    "chrome",
    "concrete",
    "dark",
    "white",
    "yellow",
  ] as const)
    library[key] = new T.MeshStandardMaterial({ name: key });
  const finish = createIronworkersRoadMaterial(library),
    baseline = new T.Group(),
    candidate = new T.Group();
  buildLandmarks(baseline, library);
  buildLandmarks(candidate, library, undefined, finish);
  const meshes = (group: T.Group) => {
    group.updateMatrixWorld(true);
    const result: T.Mesh[] = [];
    group.traverse((o) => {
      if (o instanceof T.Mesh) result.push(o);
    });
    return result;
  };
  const before = meshes(baseline),
    after = meshes(candidate);
  assert.equal(before.length, after.length);
  const digest = (mesh: T.Mesh) => {
    const hash = createHash("sha256"),
      g = mesh.geometry;
    for (const key of Object.keys(g.attributes).sort()) {
      hash.update(key);
      hash.update(Buffer.from(g.getAttribute(key).array.buffer));
    }
    if (g.index) hash.update(Buffer.from(g.index.array.buffer));
    hash.update(JSON.stringify(mesh.matrixWorld.toArray()));
    return hash.digest("hex");
  };
  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    assert.equal(digest(after[i]), digest(before[i]), `mesh ${i}`);
    assert.equal(after[i].castShadow, before[i].castShadow);
    assert.equal(after[i].receiveShadow, before[i].receiveShadow);
    if (after[i].material === finish) {
      changed++;
      assert.equal(before[i].material, library.asphalt);
      const g = after[i].geometry,
        p = g.getAttribute("position"),
        uv = g.getAttribute("uv");
      // Static origin registration moves local vertices; verify world position.
      const first = new T.Vector3()
        .fromBufferAttribute(p, 0)
        .applyMatrix4(after[i].matrixWorld);
      assert.ok(first.x > 6700 && first.x < 6900);
      assert.ok(first.z < -900 && first.z > -2400);
      assert.ok(
        Math.abs(
          Math.hypot(p.getX(1) - p.getX(0), p.getZ(1) - p.getZ(0)) -
            Math.abs(uv.getX(1) - uv.getX(0)) * 5,
        ) < 0.002,
      );
    } else if (before[i].material === library.asphalt) {
      assert.equal(
        after[i].material,
        library.asphalt,
        "other bridge decks unchanged",
      );
    }
  }
  assert.equal(changed, 1);
});
