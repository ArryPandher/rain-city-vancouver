import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createRobsonRoadMaterial,
  hasRobsonAsphalt,
  ROBSON_ASPHALT_ROADS,
  ROBSON_AGGREGATE_REPEAT_METRES,
} from "../src/world/robson-road-material";
import { createCordovaPavementMaterial } from "../src/world/cordova-pavement-material";
import { SharedTextureSources } from "../src/world/shared-texture-sources";

test("four actual source asphalt ways are selected; all other roads and protected surfaces stay unchanged", () => {
  const roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  assert.deepEqual(
    roads
      .filter(hasRobsonAsphalt)
      .map((r: any) => r.id)
      .sort(),
    [...ROBSON_ASPHALT_ROADS].sort(),
  );
  for (const id of ROBSON_ASPHALT_ROADS) {
    for (const kind of ["footway", "cycleway", "steps", "pedestrian"])
      assert.equal(hasRobsonAsphalt({ id, kind, surface: "asphalt" }), false);
    assert.equal(
      hasRobsonAsphalt({ id, kind: "secondary", surface: "paving_stones" }),
      false,
    );
  }
  assert.equal(ROBSON_AGGREGATE_REPEAT_METRES, 1.2);
});

test("Robson reuses three licensed Sources with independent metric samplers and unchanged asphalt response", () => {
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
    robson = createRobsonRoadMaterial(library);
  assert.notEqual(robson, asphalt);
  assert.equal(robson.color.getHex(), asphalt.color.getHex());
  assert.equal(robson.roughness, asphalt.roughness);
  assert.equal(robson.metalness, asphalt.metalness);
  assert.deepEqual(robson.normalScale, asphalt.normalScale);
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    const a = robson[key]!,
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
