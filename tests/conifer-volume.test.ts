import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import shapes from "../src/world/conifer-shapes.json";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import sharp from "sharp";
import {
  coniferVolumeGeometry,
  loadConiferVolumeMaterials,
} from "../src/world/conifer-volume";
import { selectForestLods } from "../src/world/forest-lod";
import foliageCuts from "../src/world/conifer-volume-cuts.json";

test("a failed foliage image releases every completed partial texture load", async () => {
  const original = T.TextureLoader.prototype.loadAsync,
    disposed: string[] = [];
  T.TextureLoader.prototype.loadAsync = async function (url) {
    if (url.includes("/c-color.webp"))
      throw new Error("deliberate foliage load failure");
    // Let the rejected request settle before the other downloads complete.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const texture = new T.Texture<HTMLImageElement>();
    texture.addEventListener("dispose", () => disposed.push(url));
    return texture;
  };
  try {
    await assert.rejects(
      loadConiferVolumeMaterials(),
      /deliberate foliage load failure/,
    );
    assert.equal(disposed.length, 3);
    assert.equal(new Set(disposed).size, 3);
  } finally {
    T.TextureLoader.prototype.loadAsync = original;
  }
});

test("cliff-top conifers do not take close-up slots from trees beside the seawall", () => {
  const cliff = { x: 3, z: 4, y: 54, height: 30 },
    beside = { x: 12, z: 0, y: 2, height: 30 };
  const sea = selectForestLods([cliff, beside], 0, 0, 8, [], [], 2);
  assert.deepEqual(sea.near, [beside]);
  assert.deepEqual(sea.medium, [cliff]);
  const raised = selectForestLods([cliff, beside], 0, 0, 8, [], [], 54);
  assert.equal(raised.near[0], cliff);
  assert.equal(raised.medium.length, 0);
  // At crown height, distance is to the tree's vertical extent, not its root.
  assert.deepEqual(selectForestLods([cliff], 0, 0, 8, [], [], 83).near, [
    cliff,
  ]);
  assert.deepEqual(selectForestLods([cliff], 0, 0, 8, [], [], 240), {
    near: [],
    medium: [],
  });
});

test("forest selection retains planar behavior when elevation is unavailable", () => {
  const flat = [
    { x: 12, z: 0 },
    { x: 60, z: 0 },
  ];
  assert.deepEqual(
    selectForestLods(flat, 0, 0, 8, [], [], 120),
    selectForestLods(flat, 0, 0, 8),
  );
});

test("layered crowns retain source scale and project into the matching unmirrored atlas views", async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  for (const suffix of ["", "-b"]) {
    const doc = await io.read(`public/models/forest/fir_tree_01${suffix}.glb`),
      source = getBounds(doc.getRoot().listScenes()[0]),
      bounds = new T.Box3(
        new T.Vector3(...source.min),
        new T.Vector3(...source.max),
      ),
      geometry = coniferVolumeGeometry(bounds, suffix ? 1 : 0),
      position = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv"),
      axes = geometry.getAttribute("sliceAxis"),
      height = bounds.max.y - bounds.min.y;
    const shape = shapes[suffix ? 1 : 0];
    assert.equal(
      createHash("sha256")
        .update(await readFile(`public/${shape.source}`))
        .digest("hex"),
      shape.sha256,
    );
    assert.ok(Math.abs(shape.height - height) < 1e-6);
    assert.ok(Math.abs(shape.atlasWidth - height / (2 * shape.width)) < 1e-6);
    assert.ok(
      geometry.index!.count / 3 <= 512,
      "keep the middle crown inexpensive",
    );
    assert.ok(geometry.boundingBox!.min.y >= 0);
    assert.ok(
      geometry.boundingBox!.max.y <= 1 && geometry.boundingBox!.max.y > 0.95,
    );
    for (let i = 0; i < position.count; i++) {
      const p = new T.Vector3().fromBufferAttribute(position, i),
        row = axes.getX(i),
        axis = row === 0 ? "z" : "x",
        camera = new T.OrthographicCamera(-0.25, 0.25, 0.5, -0.5, 0.1, 100);
      camera.position.set(row === 1 ? 35 : 0, 0.5, row === 0 ? 35 : 0);
      camera.lookAt(0, 0.5, 0);
      camera.updateMatrixWorld(true);
      const projected = p.clone().project(camera),
        tile = Math.round(
          ((p[axis] * height - bounds.min[axis]) /
            (bounds.max[axis] - bounds.min[axis])) *
            8 -
            0.5,
        );
      assert.ok(tile >= 0 && tile < 8);
      assert.ok(Math.abs(uv.getX(i) * 8 - tile - (projected.x + 1) / 2) < 1e-5);
      assert.ok(
        Math.abs(uv.getY(i) * 2 - (1 - row) - (projected.y + 1) / 2) < 1e-5,
      );
      for (const value of p.toArray()) assert.ok(Number.isFinite(value));
    }
    geometry.dispose();
  }
});

test("every foliage slice has transparent branch coverage and usable color/normal edges", async () => {
  for (const variant of ["c", "b"]) {
    const cuts = variant === "c" ? foliageCuts.c : foliageCuts.b;
    assert.ok(
      cuts.flat().reduce((area, [l, t, r, b]) => area + (r - l) * (b - t), 0) <
        4096 * 2048 * 0.3,
      "trim most transparent area without discarding photographed branches",
    );
    const color = await sharp(
        `public/textures/forest/volume/${variant}-color.webp`,
      )
        .raw()
        .toBuffer({ resolveWithObject: true }),
      normal = await sharp(
        `public/textures/forest/volume/${variant}-normal.webp`,
      )
        .raw()
        .toBuffer({ resolveWithObject: true });
    assert.deepEqual(
      [color.info.width, color.info.height, color.info.channels],
      [4096, 2048, 4],
    );
    assert.deepEqual(
      [normal.info.width, normal.info.height, normal.info.channels],
      [4096, 2048, 3],
    );
    let edgeGreen = 0,
      edges = 0,
      validNormals = 0,
      opaque = 0;
    const coverage = new Uint32Array(16);
    for (let p = 0; p < 4096 * 2048; p++) {
      const a = color.data[p * 4 + 3];
      if (a > 46) {
        const tile =
            Math.floor(p / (4096 * 1024)) * 8 + Math.floor((p % 4096) / 512),
          x = p % 512,
          y = Math.floor(p / 4096) % 1024;
        assert.ok(
          cuts[tile].some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b),
          "trimmed geometry must retain every visible branch pixel",
        );
        coverage[
          Math.floor(p / (4096 * 1024)) * 8 + Math.floor((p % 4096) / 512)
        ]++;
      }
      if (a > 40 && a < 100) {
        edgeGreen += color.data[p * 4 + 1];
        edges++;
      }
      if (a > 200) {
        opaque++;
        const length = Math.hypot(
          ...[0, 1, 2].map((c) => normal.data[p * 3 + c] / 127.5 - 1),
        );
        if (length > 0.15 && length < 1.25) validNormals++;
      }
    }
    for (const count of coverage)
      assert.ok(
        count > 100 && count < 512 * 1024 * 0.3,
        "each view needs both foliage and open sky",
      );
    assert.ok(
      edges > 1000 && edgeGreen / edges > 65,
      "premultiplied dark fringes must not return",
    );
    assert.ok(
      validNormals / opaque > 0.95,
      "visible foliage must have nonzero bounded lighting normals",
    );
  }
});
