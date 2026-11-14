import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import sharp from "sharp";
import {
  LandmarkSurfaces,
  landmarkSurfaceProfile,
  landmarkSurfaceUV,
} from "../src/world/landmark-surfaces";
import type { Materials } from "../src/world/materials";

test("rotated and pitched landmark faces retain metric texture density", () => {
  for (const pitch of [0, 0.45, Math.PI / 2])
    for (const yaw of [0, 0.4, 0.7854, 2.5]) {
      const g = new T.PlaneGeometry(1.4, 1.4);
      g.rotateX(pitch);
      g.rotateY(yaw);
      g.translate(134, -2, -53);
      const before = Array.from(g.getAttribute("position").array);
      landmarkSurfaceUV(g, [1.4, 1.4]);
      const uv = g.getAttribute("uv");
      const edge = (a: number, b: number) =>
        Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b));
      assert.ok(Math.abs(edge(0, 1) - 1) < 0.00003);
      assert.ok(Math.abs(edge(0, 2) - 1) < 0.00003);
      assert.deepEqual(Array.from(g.getAttribute("position").array), before);
      for (const v of uv.array) assert.ok(Number.isFinite(v));
      g.dispose();
    }
});

test("ornamental terracotta and aged copper do not inherit generic polished-metal settings", () => {
  const textures: T.Texture[] = [];
  const materials = {
    texture() {
      const t = new T.Texture();
      textures.push(t);
      return t;
    },
  } as unknown as Materials;
  const surfaces = new LandmarkSurfaces(materials);
  const source = new T.MeshStandardMaterial({
    name: "green",
    color: 0x86997e,
    metalness: 0.6,
  });
  const ceramic = surfaces.material(source, "marine-building");
  assert.equal(ceramic.metalness, 0);
  assert.ok(ceramic.roughness > 0.6);
  assert.equal(ceramic.userData.landmarkSurface, "mineral");
  assert.equal(source.metalness, 0.6, "cloning must preserve source materials");
  source.name = "copper";
  const copper = surfaces.material(source, "fairmont-hotel-vancouver");
  assert.equal(copper.metalness, 0.15);
  assert.ok(copper.roughness > 0.8);
  const library = landmarkSurfaceProfile("vancouver-public-library", "stone")!;
  const station = landmarkSurfaceProfile(
    "waterfront-station-vancouver",
    "stone",
  )!;
  assert.ok(library.roughness > station.roughness);
  source.name = "stone";
  const stone = surfaces.material(source, "vancouver-art-gallery");
  assert.equal(
    stone.map,
    ceramic.map,
    "reuse mineral maps without loading another copy per building",
  );
  assert.ok(
    stone.normalScale.x > 0 && stone.normalScale.y > 0,
    "new UVs and TextureLoader OpenGL maps use the normal tangent convention",
  );
  assert.equal(textures.length, 6);
  for (const t of textures) t.dispose();
  for (const m of [source, ceramic, copper, stone]) m.dispose();
});

test("landmark photography has intact normal maps and a repeatable mineral face without floor joints", async () => {
  for (const family of ["brick", "mineral", "patina"]) {
    const d = await sharp(`public/textures/landmarks/${family}-normal.webp`)
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(d.info.width, family === "brick" ? 2048 : 1024);
    assert.equal(d.info.channels, 3);
    let usable = 0;
    for (let i = 0; i < d.data.length; i += 3) {
      const length = Math.hypot(
        d.data[i] / 127.5 - 1,
        d.data[i + 1] / 127.5 - 1,
        d.data[i + 2] / 127.5 - 1,
      );
      if (length > 0.7 && length < 1.3) usable++;
    }
    assert.ok(usable / (d.info.width * d.info.height) > 0.995);
  }
  const { data, info } = await sharp(
    "public/textures/landmarks/mineral-color.webp",
  )
    .raw()
    .toBuffer({ resolveWithObject: true });
  let error = 0,
    count = 0;
  for (let i = 0; i < info.width; i++)
    for (let c = 0; c < 3; c++) {
      error += Math.abs(
        data[i * info.width * 3 + c] -
          data[(i * info.width + info.width - 1) * 3 + c],
      );
      error += Math.abs(
        data[i * 3 + c] - data[((info.height - 1) * info.width + i) * 3 + c],
      );
      count += 2;
    }
  assert.ok(
    error / count < 3,
    "mirrored color edges should join without a visible border",
  );
});
