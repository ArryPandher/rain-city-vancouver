import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";
import { Terrain } from "../src/world/terrain";
import { ForestHabitat, PROSPECT_RIM } from "../src/world/forest-habitat";
import { CollisionWorld } from "../src/world/collision";
import { ORIGIN, KX, pointInPoly, type CityData } from "../src/world/data";
import { selectForestLods } from "../src/world/forest-lod";
function habitat() {
  const d = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  d.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  d.buildings.forEach((b) => (b.pts = convert(b.pts)));
  d.ocean = d.ocean.map(convert);
  d.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const collision = new CollisionWorld(d);
  return { collision, habitat: new ForestHabitat(d, collision) };
}
test("Stanley woodland excludes mapped lawns, holes, water and road corridors", () => {
  const { habitat: h } = habitat();
  assert.ok(h.woodland.length >= 8);
  assert.equal(
    h.contains(-2400, -2560),
    false,
    "mapped lawn should remain open",
  );
  assert.equal(
    h.contains(-1200, -1250),
    false,
    "park entrance is outside dense woodland",
  );
  assert.equal(
    h.clear(-2437, -2430, 2.4),
    false,
    "Stanley Park Drive centre must stay clear",
  );
  let found = 0;
  for (let x = -2500; x < -1800; x += 25)
    for (let z = -2700; z < -2100; z += 25) if (h.clear(x, z, 2.4)) found++;
  assert.ok(
    found > 150,
    "interior woodland should support substantial planting",
  );
});
test("forest planting keeps its height range, solid trunks and clearance from every mapped road/path", () => {
  const { habitat: h, collision } = habitat();
  const trees = h.trees([]);
  assert.ok(trees.length > 10000 && trees.length < 50000);
  for (const t of trees) {
    assert.ok(h.clear(t.x, t.z, 2.4));
    const rim = pointInPoly(t.x, t.z, PROSPECT_RIM);
    assert.ok(t.height >= (rim ? 14 : 22) && t.height <= (rim ? 27 : 42));
  }
  for (const t of trees.slice(0, 20))
    collision.addForestTrunk(t.x, t.z, t.diameter / 2);
  const first = trees[0];
  assert.equal(collision.blocked(first.x, first.z, 0.36), true);
  const hit = collision.move(first.x - 3, first.z, 6, 0, 0.36);
  assert.equal(hit.hit, true);
  assert.equal(
    collision.blocked(-2437, -2430, 0.36),
    false,
    "trunks must not block the road",
  );
});
test("conifer geometry preserves twigs and provides valid texture coordinates on the trunk", async () => {
  const d = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .read("public/models/forest/fir_tree_01.glb");
  let twigs = 0;
  for (const m of d.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const n = p.getAttribute("POSITION")!.getCount();
      for (const s of ["NORMAL", "TEXCOORD_0"])
        assert.equal(p.getAttribute(s)!.getCount(), n);
      if (p.getMaterial()!.getName().includes("twig")) {
        twigs += p.getIndices()!.getCount() / 3;
        assert.equal(p.getMaterial()!.getAlphaMode(), "MASK");
        const image = p.getMaterial()!.getBaseColorTexture()!.getImage()!;
        assert.equal((await sharp(image).metadata()).hasAlpha, true);
      }
    }
  assert.ok(
    twigs > 440000,
    "do not erase the small twig surfaces during wood simplification",
  );
});
test("conifer silhouettes retain transparent space rather than opaque rectangles", async () => {
  const image = sharp("public/textures/forest/conifer-atlas-pair.webp");
  const m = await image.metadata();
  assert.equal(m.width, 4096);
  assert.equal(m.height, 2048);
  assert.equal(m.hasAlpha, true);
  const stats = await image.stats();
  assert.ok(stats.channels[3].min === 0 && stats.channels[3].max === 255);
  assert.ok(stats.channels[3].mean > 5 && stats.channels[3].mean < 110);
});
test("forest detail selection respects budgets, keeps levels disjoint and releases them in Performance", () => {
  const trees = Array.from({ length: 240 }, (_, i) => ({
    x: Math.cos(i) * (4 + i / 2),
    z: Math.sin(i) * (4 + i / 2),
  }));
  const balanced = selectForestLods(trees, 0, 0, 8);
  assert.equal(balanced.near.length, 8);
  assert.equal(balanced.medium.length, 64);
  assert.equal(new Set([...balanced.near, ...balanced.medium]).size, 72);
  const high = selectForestLods(
    trees,
    0,
    0,
    24,
    balanced.near,
    balanced.medium,
  );
  assert.equal(high.near.length, 24);
  assert.equal(high.medium.length, 128);
  assert.deepEqual(selectForestLods(trees, 0, 0, 0, high.near, high.medium), {
    near: [],
    medium: [],
  });
  assert.deepEqual(selectForestLods(trees, 1000, 1000, 8), {
    near: [],
    medium: [],
  });
});
test("tree detail hysteresis prevents tiny movements from swapping neighbouring models", () => {
  const left = { x: -10, z: 0 },
    right = { x: 10, z: 0 };
  const smallStep = selectForestLods([left, right], -0.2, 0, 1, [right]);
  assert.equal(smallStep.near[0], right);
  const approach = selectForestLods([left, right], -5, 0, 1, [right]);
  assert.equal(approach.near[0], left);
});
test("both medium conifers retain textured branches with valid attributes and bounded reduction", async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  for (const variant of ["", "-b"]) {
    const d = await io.read(
      `public/models/forest/fir_tree_01${variant}-medium.glb`,
    );
    let triangles = 0,
      twigTriangles = 0;
    for (const p of d
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())) {
      const count = p.getAttribute("POSITION")!.getCount();
      triangles += p.getIndices()!.getCount() / 3;
      for (const attribute of ["NORMAL", "TEXCOORD_0"])
        assert.equal(p.getAttribute(attribute)!.getCount(), count);
      for (const i of p.getIndices()!.getArray()!) assert.ok(i < count);
      if (p.getMaterial()!.getName().includes("twig")) {
        twigTriangles += p.getIndices()!.getCount() / 3;
        assert.equal(p.getMaterial()!.getAlphaMode(), "MASK");
        assert.equal(
          (
            await sharp(
              p.getMaterial()!.getBaseColorTexture()!.getImage()!,
            ).metadata()
          ).hasAlpha,
          true,
        );
      }
    }
    assert.ok(triangles > 35000 && triangles < 90000);
    assert.ok(twigTriangles > 30000);
    const meta = d.getRoot().getExtras().rainCityLod as {
      bounds: { min: number[]; max: number[] };
      referenceBounds: { min: number[]; max: number[] };
      originalNeedles: number;
      retainedNeedles: number;
    };
    assert.ok(
      meta.retainedNeedles > 7000 &&
        meta.retainedNeedles < meta.originalNeedles / 5,
    );
    for (let k = 0; k < 3; k++) {
      assert.ok(
        Math.abs(meta.bounds.min[k] - meta.referenceBounds.min[k]) < 0.12,
      );
      assert.ok(
        Math.abs(meta.bounds.max[k] - meta.referenceBounds.max[k]) < 0.12,
      );
    }
  }
});

test("generated forest avoids steep exposed terrain while retaining gentle woodland", () => {
  const { habitat: h } = habitat();
  let site: [number, number] | undefined;
  for (let x = -2400; x < -2000 && !site; x += 25)
    for (let z = -2700; z < -2200 && !site; z += 25)
      if (h.clear(x, z, 2.4)) site = [x, z];
  assert.ok(site);
  const [x, z] = site;
  const meta = {
    version: 1,
    sourceYear: 2002,
    minX: x - 4,
    minZ: z - 4,
    step: 4,
    columns: 3,
    rows: 3,
    scale: 1,
    binary: "",
    lakes: [],
  };
  h.data.terrain = new Terrain(
    meta,
    new Uint16Array([10, 11, 12, 10, 11, 12, 10, 11, 12]),
  );
  assert.equal(h.clear(x, z, 2.4), true);
  h.data.terrain = new Terrain(
    meta,
    new Uint16Array([10, 16, 22, 10, 16, 22, 10, 16, 22]),
  );
  assert.equal(h.clear(x, z, 2.4), false);
});
