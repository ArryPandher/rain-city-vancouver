import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Materials, bakeCurtainFacadeTint } from "../src/world/materials";
import { Batcher, walls } from "../src/world/geometry";
import { buildingHeight } from "../src/world/building-profile";
import {
  centroid,
  hash,
  seeded,
  ORIGIN,
  KX,
  type CityData,
} from "../src/world/data";

const palette = [0xc1d6d7, 0xc2ccc1, 0xbccbd6];
function materialFixture() {
  // Actual material factory; bypass browser-only canvas/image loading.
  const materials: Materials = Object.assign(
    Object.create(Materials.prototype) as Materials,
    {
      curtainMaps: Object.fromEntries(
        ["color", "normalgl", "roughness", "metalness", "emission"].map((k) => [
          k,
          new T.Texture(),
        ]),
      ),
      facades: [],
      practicalLights: [],
      neonMaterials: [],
    },
  );
  materials.facades = [
    materials.curtainFacade(),
    materials.curtainFacade(),
    materials.curtainFacade(),
  ];
  return materials;
}

test("shared curtain tint preserves linear albedo, existing vertex AO, geometry and weather", () => {
  const m = materialFixture();
  assert.equal(new Set(m.facades).size, 1);
  const shared = m.facades[0] as T.MeshPhysicalMaterial;
  assert.equal(shared.color.getHex(), 0xffffff);
  assert.equal(shared.roughness, 0.62);
  assert.equal(shared.metalness, 0.85);
  assert.equal(shared.clearcoat, 0.45);
  assert.equal(shared.clearcoatRoughness, 0.2);
  assert.equal(shared.normalScale.x, 0.3);
  assert.equal(shared.emissiveMap, m.curtainMaps!.emission);
  assert.equal(shared.vertexColors, true);
  for (let style = 0; style < 3; style++) {
    const g = walls([0, 0, 20, 0, 20, 12, 0, 12], 50);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i++)
      colors[i] = 0.25 + ((i * 17) % 67) / 100;
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    const oldColors = colors.slice();
    const unchanged = Object.fromEntries(
      Object.entries(g.attributes)
        .filter(([key]) => key !== "color")
        .map(([key, attr]) => [key, Array.from(attr.array)]),
    );
    const indices = Array.from(g.index!.array);
    bakeCurtainFacadeTint(g, style);
    const materialTint = new T.Color(palette[style]).toArray();
    for (let i = 0; i < colors.length; i++) {
      // Fragment albedo previously multiplied materialColor * vertexColor * texture.
      const textureSample = 0.37;
      const before = materialTint[i % 3] * oldColors[i] * textureSample;
      const after = colors[i] * textureSample;
      assert.ok(Math.abs(before - after) < 2e-8);
    }
    for (const [key, values] of Object.entries(unchanged))
      assert.deepEqual(Array.from(g.attributes[key].array), values);
    assert.deepEqual(Array.from(g.index!.array), indices);
  }
  for (const night of [0, 0.35, 1, 0]) {
    m.setNight(night);
    assert.equal(shared.emissiveIntensity, 0.02 + night * 0.8);
    assert.equal(shared.emissive.getHex(), 0xfff1d8);
  }
});

test("mapped Vancouver tower fixture reduces material batches without merging spatial cells", () => {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
  const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const buildings = data.buildings.map((b) => ({
    ...b,
    pts: b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox)),
  }));
  const m = materialFixture();
  const legacy = palette.map((color) => {
    const mat = m.facades[0].clone();
    mat.color.setHex(color);
    return mat;
  });
  const before = new Batcher(new T.Group(), 270),
    after = new Batcher(new T.Group(), 270);
  let selected = 0;
  for (const b of buildings) {
    const [x, z] = centroid(b.pts),
      height = buildingHeight(b);
    const style = Math.floor(seeded(hash(b.id))() * 8);
    // Representative mapped downtown towers, retaining source footprints/heights.
    // This fixture measures batching, not the complete native-visible city frame.
    if (
      height <= 35 ||
      style >= 3 ||
      Math.abs(x) > 1800 ||
      z < -900 ||
      z > 1400
    )
      continue;
    const geometry = walls(b.pts, height);
    geometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(
        Array(geometry.attributes.position.count * 3).fill(0.73),
        3,
      ),
    );
    before.add(geometry.clone(), legacy[style], x, z);
    after.add(bakeCurtainFacadeTint(geometry, style), m.facades[style], x, z);
    selected++;
  }
  const previous = before.finish(),
    current = after.finish();
  const triangles = (meshes: T.Mesh[]) =>
    meshes.reduce((n, mesh) => n + mesh.geometry.index!.count / 3, 0);
  const cells = (meshes: T.Mesh[]) =>
    [...new Set(meshes.map((mesh) => mesh.userData.center.join(",")))].sort();
  assert.ok(selected > 30);
  assert.ok(current.length < previous.length);
  assert.deepEqual(cells(current), cells(previous));
  assert.equal(triangles(current), triangles(previous));
  console.log(
    `Mapped fixture: ${selected} towers, ${previous.length} → ${current.length} batches, ${triangles(current)} triangles unchanged, ${cells(current).length} identical 270 m cells.`,
  );
});
