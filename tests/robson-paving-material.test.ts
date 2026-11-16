import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import * as T from "three";
import {
  createRobsonPavingMaterial,
  robsonPavingCoordinates,
  ROBSON_PAVING,
} from "../src/world/robson-paving-material";
import { robsonSquare } from "../src/world/robson-square";
import { ROBSON_GARDEN_ID, gridUV } from "../src/world/robson-site";
import { Batcher } from "../src/world/geometry";
import { ORIGIN, KX, type CityData } from "../src/world/data";
import type { Materials } from "../src/world/materials";

test("Robson paving metre coordinates survive actual garden triangulation and batching", () => {
  const data: CityData = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const garden = data.buildings.find((b) => b.id === ROBSON_GARDEN_ID)!;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
  const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  garden.pts = garden.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  const oldGround = new T.MeshStandardMaterial();
  const batch = new Batcher(new T.Group());
  robsonSquare(garden, batch, {
    concrete: oldGround,
    texture: () => new T.Texture(),
  } as unknown as Materials);
  const meshes = batch.finish();
  const ground = meshes.find(
    (m) =>
      m.material === oldGround ||
      (m.material as T.Material).name === "Robson Square — mineral paving",
  )!;
  assert.ok(ground, "main garden substrate must remain identifiable");
  const p = ground.geometry.getAttribute("position"),
    uv = ground.geometry.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    const actual = robsonPavingCoordinates(uv.getX(i), uv.getY(i));
    const expected = gridUV(p.getX(i), p.getZ(i));
    assert.ok(
      Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.0001,
    );
  }
  meshes.forEach((m) => m.geometry.dispose());
});

test("local paving samplers and disposal cannot change city or Canada Place textures", () => {
  const source = new T.Texture<HTMLImageElement>();
  source.repeat.set(9, 7);
  let sourceDisposals = 0,
    ownDisposals = 0;
  source.addEventListener("dispose", () => sourceDisposals++);
  const requests: string[] = [];
  const m = createRobsonPavingMaterial({
    texture: (name) => {
      requests.push(name);
      return source;
    },
  });
  assert.deepEqual(requests, [
    "canada-place-paving/color.webp",
    "canada-place-paving/normal.webp",
    "canada-place-paving/roughness.webp",
  ]);
  for (const t of [m.map!, m.normalMap!, m.roughnessMap!]) {
    assert.notEqual(t, source);
    assert.equal(t.source, source.source);
    assert.deepEqual(t.repeat.toArray(), [2, 2]);
    assert.deepEqual(t.matrix.elements, m.map!.matrix.elements);
    t.addEventListener("dispose", () => ownDisposals++);
  }
  assert.equal(m.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(m.normalMap!.colorSpace, T.NoColorSpace);
  assert.equal(m.roughnessMap!.colorSpace, T.NoColorSpace);
  assert.equal(m.transparent, false);
  assert.equal(m.emissive.getHex(), 0);
  assert.equal(m.metalness, 0);
  m.map!.repeat.setScalar(8);
  m.dispose();
  m.dispose();
  assert.equal(ownDisposals, 3);
  assert.equal(sourceDisposals, 0);
  assert.deepEqual(source.repeat.toArray(), [9, 7]);
  assert.equal(source.colorSpace, T.NoColorSpace);
});

test("licensed replacement grain keeps the old substrate mean brightness without its strong brown tint", async () => {
  async function mean(path: string) {
    const { data, info } = await sharp(path)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sums = [0, 0, 0];
    for (let i = 0; i < data.length; i += info.channels)
      for (let c = 0; c < 3; c++) {
        const value = data[i + c] / 255;
        sums[c] +=
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }
    return sums.map((v) => v / (info.width * info.height));
  }
  const old = await mean("public/textures/concrete_pavement-color.jpg");
  const next = await mean("public/textures/canada-place-paving/color.webp");
  const oldTint = new T.Color(0xb4b0a7).toArray(),
    tint = new T.Color(ROBSON_PAVING.color).toArray();
  const before = old.map((v, i) => v * oldTint[i]);
  const after = next.map((v, i) => v * tint[i]);
  const luminance = (rgb: number[]) =>
    rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  assert.ok(
    Math.abs(luminance(after) / luminance(before) - 1) < 0.06,
    "avoid a hidden exposure jump from the bright normalized mineral map",
  );
  assert.ok(after[0] / after[2] < before[0] / before[2]);
});
