import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { galleryWestHedgeGeometry } from "../src/world/gallery-west-terrace";
import {
  galleryHedgeFoliageGeometry,
  createGalleryHedgeMaterial,
  GALLERY_HEDGE_LEAVES,
} from "../src/world/gallery-hedge-foliage";
import { addGalleryFacade } from "../src/world/gallery-facade";

test("actual retained hedge envelope contains all folded leaves without modifying source or terrace contact", () => {
  const original = galleryWestHedgeGeometry(),
    before = Array.from(original.attributes.position.array),
    a = galleryHedgeFoliageGeometry(original),
    b = galleryHedgeFoliageGeometry(original);
  assert.deepEqual(Array.from(original.attributes.position.array), before);
  assert.deepEqual(
    a.leaves.attributes.position.array,
    b.leaves.attributes.position.array,
  );
  assert.equal(a.leaves.index!.count / 3, 17180);
  assert.equal(a.backing.index!.count, original.index!.count);
  const box = a.bounds.clone().expandByScalar(0.000002);
  for (const g of [a.leaves, a.backing]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++)
      assert.ok(
        box.containsPoint(new T.Vector3(p.getX(i), p.getY(i), p.getZ(i))),
      );
    for (const attr of Object.values(g.attributes))
      assert.ok(Array.from(attr.array).every(Number.isFinite));
  }
  a.backing.computeBoundingBox();
  assert.ok(a.backing.boundingBox!.max.y < a.bounds.max.y - 0.04);
  assert.ok(a.backing.boundingBox!.max.z < a.bounds.max.z - 0.03);
  const p = a.leaves.attributes.position;
  let folded = 0;
  for (let i = 0; i < p.count; i += 6) {
    const v = (j: number) =>
      new T.Vector3(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
    assert.ok(
      v(0).distanceTo(v(3)) <= 0.0856,
      "edge leaf length stays below8.6cm",
    );
    const plane = new T.Plane().setFromCoplanarPoints(v(0), v(2), v(3));
    if (Math.abs(plane.distanceToPoint(v(4))) > 0.007) folded++;
  }
  assert.equal(
    folded,
    p.count / 6,
    "every leaf has actual folded depth, not a planar billboard",
  );
});
test("packed atlas preserves licensed resampled source pixels and real contour alpha", async () => {
  const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read("public/models/forest/shrub_04.glb"),
    m = doc.getRoot().listMaterials()[0];
  for (const [file, source] of [
    ["color", m.getBaseColorTexture()],
    ["normal", m.getNormalTexture()],
  ] as const) {
    const bytes = fs.readFileSync(`public/textures/gallery-hedge/${file}.webp`);
    const expected = await sharp(source!.getImage()!)
      .resize(512, 512)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const actual = await sharp(bytes)
      .extract({ left: 0, top: 0, width: 512, height: 512 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    for (let i = 0; i < actual.length; i += 4)
      if (expected[i + 3] > 0)
        assert.deepEqual(
          actual.subarray(i, i + 4),
          expected.subarray(i, i + 4),
        );
    const dense = await sharp(`public/textures/coastal/leaf-cover-${file}.webp`)
      .resize(512, 512)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const core = await sharp(bytes)
      .extract({ left: 512, top: 0, width: 512, height: 512 })
      .ensureAlpha()
      .raw()
      .toBuffer();
    assert.deepEqual(core, dense);
    const record = JSON.parse(
      fs.readFileSync("public/textures/gallery-hedge/SOURCES.json", "utf8"),
    ).find((r: { file: string }) => r.file.endsWith(`${file}.webp`));
    assert.equal(record.license, "CC0-1.0");
    assert.equal(
      record.sha256,
      crypto.createHash("sha256").update(bytes).digest("hex"),
    );
  }
  for (const [left, top, width, height] of GALLERY_HEDGE_LEAVES) {
    const { data, info } = await sharp(
      "public/textures/gallery-hedge/color.webp",
    )
      .extract({
        left: Math.floor(left / 2),
        top: Math.floor(top / 2),
        width: Math.floor(width / 2),
        height: Math.floor(height / 2),
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let clear = 0,
      solid = 0;
    for (let i = 3; i < data.length; i += info.channels) {
      if (data[i] < 20) clear++;
      if (data[i] > 200) solid++;
    }
    assert.ok(
      clear > info.width * info.height * 0.15 &&
        solid > info.width * info.height * 0.15,
    );
  }
});
test("loader-equivalent facade preserves leaf atlas UVs, one bounded batch, independent samplers and disposal", () => {
  const sources = new Map<string, T.Source<unknown>>(),
    requests: string[] = [];
  let disposed = 0;
  const library = {
    texture: (name: string) => {
      requests.push(name);
      let s = sources.get(name);
      if (!s) {
        s = new T.Source({ width: 1024, height: 1024 });
        sources.set(name, s);
      }
      const t = new T.Texture();
      t.source = s;
      t.addEventListener("dispose", () => disposed++);
      return t;
    },
  };
  const mat = createGalleryHedgeMaterial(library),
    other = createGalleryHedgeMaterial(library);
  assert.notEqual(mat.map, other.map);
  assert.equal(mat.map!.source, other.map!.source);
  assert.equal(mat.alphaToCoverage, true);
  assert.equal(mat.transparent, false);
  assert.equal(mat.map!.flipY, false);
  assert.equal(mat.map!.wrapS, T.ClampToEdgeWrapping);
  assert.equal(mat.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(mat.normalMap!.colorSpace, T.NoColorSpace);
  mat.map!.repeat.set(2, 2);
  assert.deepEqual(other.map!.repeat.toArray(), [1, 1]);
  mat.dispose();
  mat.dispose();
  assert.equal(disposed, 2);
  const parent = new T.Group(),
    mats = new Map(
      ["foundation", "stone", "glass"].map((name) => [
        name,
        new T.MeshStandardMaterial({ name }),
      ]),
    );
  const chunks = addGalleryFacade(parent, mats, library),
    selected = chunks.filter(
      (m) =>
        (m.material as T.Material).name === "Gallery west clipped hedge leaves",
    );
  assert.equal(selected.length, 1);
  const parts = galleryHedgeFoliageGeometry(galleryWestHedgeGeometry());
  const expectedUV = new Float32Array([
    ...parts.backing.attributes.uv.array,
    ...parts.leaves.attributes.uv.array,
  ]);
  assert.deepEqual(
    selected[0].geometry.attributes.uv.array,
    expectedUV,
    "landmark metric projection must not overwrite leaf atlas coordinates",
  );
  assert.equal(
    selected[0].geometry.index!.count,
    parts.leaves.index!.count + parts.backing.index!.count,
  );
  assert.equal(requests.filter((n) => n.includes("gallery-hedge/")).length, 6);
});
