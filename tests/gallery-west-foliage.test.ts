import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import sharp from "sharp";
import {
  GALLERY_TWIG_CUTS,
  galleryWestSprayGeometry,
  createGalleryWestFoliageMaterial,
} from "../src/world/gallery-west-foliage";
import {
  GALLERY_WEST_TERRACE as D,
  galleryWestCrownProfile,
  galleryWestPoint,
} from "../src/world/gallery-west-terrace-data";
import { addGalleryFacade } from "../src/world/gallery-facade";
import { galleryStairFramingBlocked } from "../src/world/gallery-stair-framing-contact";
import { galleryStairWorld } from "../src/world/gallery-stair-framing-data";
const rgba = sharp("public/textures/gallery-conifers/color.webp")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

test("licensed unchanged source atlas has real needle alpha and upright selected sprigs without trunk strip", async () => {
  const manifest = JSON.parse(
    fs.readFileSync("public/textures/gallery-conifers/SOURCES.json", "utf8"),
  );
  assert.equal(manifest.license, "CC0-1.0");
  assert.equal(
    manifest.images.reduce((n: number, f: { bytes: number }) => n + f.bytes, 0),
    246498,
  );
  for (const i of manifest.images) {
    const bytes = fs.readFileSync(`public/${i.file}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), i.sha256);
  }
  const { data, info } = await rgba;
  assert.equal(info.width, 1024);
  assert.equal(info.height, 1024);
  for (const [l, t, r, b] of GALLERY_TWIG_CUTS) {
    let covered = 0,
      total = 0;
    for (let y = t; y < b; y++)
      for (let x = l; x < r; x++) {
        total++;
        if (data[(y * 1024 + x) * 4 + 3] > 31) covered++;
      }
    assert.ok(
      covered / total > 0.14 && covered / total < 0.3,
      `true sprig coverage ${covered / total}`,
    );
    assert.ok(l >= 187 && b <= 856, "exclude opaque trunk strips");
  }
});

test("folded branch sprays keep metre-scale narrow envelopes and upward source texture orientation", () => {
  for (let k = 0; k < 5; k++) {
    const t = D.trees[k],
      g = galleryWestSprayGeometry(k),
      p = g.getAttribute("position"),
      uv = g.getAttribute("uv"),
      n = g.getAttribute("normal"),
      base = D.capY + D.planterHeight - 0.18;
    for (let i = 0; i < p.count; i++) {
      const f = (p.getY(i) - base) / t.height;
      assert.ok(f >= 0 && f <= 1);
      assert.ok(
        Math.hypot(p.getX(i) - t.u, p.getZ(i) - t.v) <=
          (t.width / 2) * galleryWestCrownProfile(f) * 1.16 + 3e-6,
      );
      assert.ok(Number.isFinite(n.getX(i) + n.getY(i) + n.getZ(i)));
    }
    for (let i = 0; i < p.count; i += 6) {
      assert.ok(p.getY(i + 3) > p.getY(i));
      assert.ok(
        uv.getY(i + 3) < uv.getY(i),
        "upright sprig top samples smaller image row with flipY=false",
      );
      assert.ok(p.getY(i + 3) - p.getY(i) <= 0.76 + 1e-6);
    }
  }
});

test("asynchronous normal and color textures use source orientation, matching white albedo and safe fallback", () => {
  const pending: Parameters<T.TextureLoader["load"]>[] = [];
  class Loader extends T.TextureLoader {
    override load(...args: Parameters<T.TextureLoader["load"]>) {
      pending.push(args);
      return new T.Texture<HTMLImageElement>();
    }
  }
  const m = createGalleryWestFoliageMaterial(new Loader());
  assert.equal(m.visible, false);
  assert.equal(m.alphaTest, 0.12);
  assert.equal(m.transparent, false);
  assert.equal(m.side, T.DoubleSide);
  assert.equal(m.color.getHex(), 0xffffff);
  assert.deepEqual(m.normalScale.toArray(), [0.75, -0.75]);
  const c = new T.Texture<HTMLImageElement>(),
    n = new T.Texture<HTMLImageElement>();
  pending[0][1]!(c);
  assert.equal(m.visible, false);
  pending[1][1]!(n);
  assert.equal(m.visible, true);
  assert.equal(m.userData.galleryFoliageStatus, "ready");
  assert.equal(m.map, c);
  assert.equal(m.normalMap, n);
  assert.equal(c.flipY, false);
  assert.equal(n.flipY, false);
  assert.equal(c.colorSpace, T.SRGBColorSpace);
  assert.equal(n.colorSpace, T.NoColorSpace);
  let disposedCount = 0;
  c.addEventListener("dispose", () => disposedCount++);
  n.addEventListener("dispose", () => disposedCount++);
  m.dispose();
  assert.equal(disposedCount, 2, "material owns its extracted samplers");
  pending.length = 0;
  const failed = createGalleryWestFoliageMaterial(new Loader());
  pending[0][3]!(new Error("fixture"));
  const late = new T.Texture<HTMLImageElement>();
  let disposed = false;
  late.addEventListener("dispose", () => (disposed = true));
  pending[1][1]!(late);
  assert.equal(disposed, true);
  assert.equal(failed.visible, false);
  assert.equal(failed.userData.galleryFoliageStatus, "fallback");
});

test("actual Gallery facade batching preserves atlas UVs and delegates physical west contacts", () => {
  const materials = new Map(
    ["stone", "foundation", "glass"].map((name) => [
      name,
      new T.MeshStandardMaterial({ name }),
    ]),
  );
  const chunks = addGalleryFacade(new T.Group(), materials),
    sprays = chunks.filter(
      (m) => (m.material as T.Material).userData.galleryFoliageAtlas,
    );
  assert.equal(sprays.length, 1);
  const uv = sprays[0].geometry.getAttribute("uv"),
    expected = D.trees.flatMap((_, i) =>
      Array.from(galleryWestSprayGeometry(i).getAttribute("uv").array),
    );
  assert.deepEqual(
    Array.from(uv.array),
    expected,
    "metric stone UVs must never replace actual twig atlas UVs",
  );
  for (const u of D.piers) {
    const [x, z] = galleryStairWorld(...galleryWestPoint(u, 27.8));
    assert.equal(galleryStairFramingBlocked(x, z, 0.36, 0, false), true);
    assert.equal(galleryStairFramingBlocked(x, z, 0.25, 20, true), false);
  }
  const [x, z] = galleryStairWorld(0, 40);
  assert.equal(galleryStairFramingBlocked(x, z, 0.36, 0, false), false);
});

test("actual atlas-filtered front rays resolve individual needle holes beyond the compact backing", async () => {
  const { data } = await rgba,
    t = D.trees[2],
    g = galleryWestSprayGeometry(2),
    mesh = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide }));
  mesh.updateMatrixWorld(true);
  let foliage = 0,
    holes = 0,
    edgeFoliage = 0;
  const base = D.capY + D.planterHeight - 0.18;
  for (let iy = 0; iy < 45; iy++)
    for (let ix = 0; ix < 15; ix++) {
      const f = 0.06 + (iy / 45) * 0.88,
        r = (t.width / 2) * galleryWestCrownProfile(f),
        x = t.u + ((ix / 14) * 2 - 1) * r,
        y = base + f * t.height,
        hits = new T.Raycaster(
          new T.Vector3(x, y, t.v + 2),
          new T.Vector3(0, 0, -1),
          0,
          4,
        ).intersectObject(mesh),
        solid = hits.some((h) => {
          const u = h.uv!;
          return (
            data[
              (Math.min(1023, Math.floor(u.y * 1024)) * 1024 +
                Math.min(1023, Math.floor(u.x * 1024))) *
                4 +
                3
            ] /
              255 >=
            0.12
          );
        });
      if (solid) {
        foliage++;
        if (Math.abs(x - t.u) > r * 0.8) edgeFoliage++;
      } else holes++;
    }
  assert.ok(foliage > 200, `${foliage} actual needle hits`);
  assert.ok(holes > 30, `${holes} real gaps`);
  assert.ok(edgeFoliage > 10, `${edgeFoliage} outer needle silhouette hits`);
});
