import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import * as T from "three";
import { addGalleryFacade } from "../src/world/gallery-facade";
import { galleryWestBoxGeometry } from "../src/world/gallery-west-terrace";
import {
  galleryWestTerraceBoxes,
  galleryWestPoint,
} from "../src/world/gallery-west-terrace-data";
import { createGalleryWestConcreteMaterial } from "../src/world/gallery-west-concrete-material";
import { SharedTextureSources } from "../src/world/shared-texture-sources";
import provenance from "../public/textures/gallery-west-concrete/SOURCES.json";

function triangleKeys(g: T.BufferGeometry) {
  const p = g.getAttribute("position"),
    ix = g.index!;
  const result: string[] = [];
  for (let i = 0; i < ix.count; i += 3)
    result.push(
      [0, 1, 2]
        .map((j) => {
          const k = ix.getX(i + j);
          return [p.getX(k), p.getY(k), p.getZ(k)]
            .map((v) => v.toFixed(5))
            .join(",");
        })
        .join("|"),
    );
  return result.sort();
}
function library() {
  const loads: Array<{
    texture: T.Texture<HTMLImageElement>;
    done: (texture: T.Texture<HTMLImageElement>) => void;
  }> = [];
  const cache = new SharedTextureSources({
    load(_url, onLoad) {
      const texture = new T.Texture<HTMLImageElement>();
      loads.push({ texture, done: onLoad! });
      return texture;
    },
  });
  return { cache, loads, texture: (name: string) => cache.texture(name) };
}

test("final Gallery batching changes only exact west concrete boxes, preserving all geometry and metric UV scale", () => {
  const materials = new Map(
    ["stone", "foundation", "glass"].map((name) => [
      name,
      new T.MeshStandardMaterial({ name, color: 0x777a75 }),
    ]),
  );
  const old = addGalleryFacade(new T.Group(), materials);
  const next = addGalleryFacade(new T.Group(), materials, library());
  const concrete = next.filter(
    (m) => (m.material as T.Material).userData.galleryWestConcrete,
  );
  assert.equal(concrete.length, 1);
  const [u, v] = galleryWestPoint(0, 0);
  const expected = galleryWestTerraceBoxes()
    .filter((b) => b.role === "stone")
    .flatMap((b) => {
      const g = galleryWestBoxGeometry(b);
      g.rotateY(Math.PI / 2);
      g.translate(u, 0, v);
      return triangleKeys(g);
    })
    .sort();
  assert.deepEqual(triangleKeys(concrete[0].geometry), expected);
  assert.deepEqual(
    next.flatMap((m) => triangleKeys(m.geometry)).sort(),
    old.flatMap((m) => triangleKeys(m.geometry)).sort(),
  );
  const oldFoundation = old
    .filter((m) => m.material === materials.get("foundation"))
    .flatMap((m) => triangleKeys(m.geometry));
  const newFoundation = next
    .filter((m) => m.material === materials.get("foundation"))
    .flatMap((m) => triangleKeys(m.geometry));
  assert.deepEqual(
    [...newFoundation, ...expected].sort(),
    oldFoundation.sort(),
  );
  for (const m of old.filter(
    (m) => m.material !== materials.get("foundation"),
  )) {
    const name = (m.material as T.Material).name;
    assert.deepEqual(
      triangleKeys(
        next.find((q) => (q.material as T.Material).name === name)!.geometry,
      ),
      triangleKeys(m.geometry),
    );
  }
  assert.equal(next.length, old.length + 1);
  const g = concrete[0].geometry,
    p = g.getAttribute("position"),
    uv = g.getAttribute("uv"),
    ix = g.index!;
  const map = (concrete[0].material as T.MeshStandardMaterial).map!;
  for (let i = 0; i < ix.count; i += 3) {
    const a = ix.getX(i),
      b = ix.getX(i + 1);
    const distance = new T.Vector3()
      .fromBufferAttribute(p, a)
      .distanceTo(new T.Vector3().fromBufferAttribute(p, b));
    const textureDistance = new T.Vector2()
      .set(uv.getX(a), uv.getY(a))
      .applyMatrix3(map.matrix)
      .distanceTo(
        new T.Vector2().set(uv.getX(b), uv.getY(b)).applyMatrix3(map.matrix),
      );
    assert.ok(
      Math.abs(textureDistance * provenance.repeatMetres - distance) < 1e-5,
    );
  }
});

test("pending shared image sources become uploadable for both consumers; disposal owns samplers only and no ashlar shader survives", () => {
  const lib = library(),
    source = new T.MeshStandardMaterial({ color: 0x777a75 });
  source.onBeforeCompile = () => {
    throw Error("wall joints must not be inherited");
  };
  const a = createGalleryWestConcreteMaterial(source, lib),
    b = createGalleryWestConcreteMaterial(source, lib);
  assert.notEqual(a.onBeforeCompile, source.onBeforeCompile);
  assert.equal(lib.cache.stats.sourceLoads, 3);
  assert.equal(lib.cache.stats.pendingURLs.length, 3);
  let disposed = 0;
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    assert.notEqual(a[key], b[key]);
    assert.equal(a[key]!.source, b[key]!.source);
    assert.equal(a[key]!.version, 0);
    a[key]!.addEventListener("dispose", () => disposed++);
  }
  for (const l of lib.loads) {
    l.texture.image = { width: 400, height: 400 } as HTMLImageElement;
    l.done(l.texture);
  }
  assert.equal(lib.cache.stats.readyCount, 3);
  for (const key of ["map", "normalMap", "roughnessMap"] as const)
    assert.ok(a[key]!.version > 0 && b[key]!.version > 0);
  a.dispose();
  a.dispose();
  assert.equal(disposed, 3);
  assert.equal(lib.cache.stats.readyCount, 3);
});

test("committed joint-free crop retains source colour variation, mean diffuse response and licensed source hashes", async () => {
  const means: number[][] = [];
  for (const path of [
    "public/textures/landmarks/mineral-color.webp",
    "public/textures/gallery-west-concrete/color.webp",
  ]) {
    const { data, info } = await sharp(path)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    means.push(
      [0, 1, 2].map((c) => {
        let total = 0;
        for (let i = c; i < data.length; i += info.channels) {
          const v = data[i] / 255;
          total += v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        }
        return total / (info.width * info.height);
      }),
    );
    if (path.includes("gallery-west"))
      assert.ok(new Set(data).size > 75, "real tonal texture, not a flat fill");
  }
  for (let c = 0; c < 3; c++)
    assert.ok(
      Math.abs(means[1][c] * provenance.meanCompensation[c] - means[0][c]) <
        1e-10,
    );
  for (const file of provenance.files) {
    assert.equal(
      createHash("sha256").update(fs.readFileSync(file.file)).digest("hex"),
      file.sha256,
    );
    assert.equal(
      createHash("md5")
        .update(
          fs.readFileSync(`public/textures/cast-concrete/${file.kind}.jpg`),
        )
        .digest("hex"),
      file.source.md5,
    );
    const meta = await sharp(file.file).metadata();
    assert.equal(meta.width, 400);
    assert.equal(meta.height, 400);
  }
});
