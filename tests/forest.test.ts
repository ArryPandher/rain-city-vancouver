import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";
import { ForestHabitat } from "../src/world/forest-habitat";
import { CollisionWorld } from "../src/world/collision";
import { ORIGIN, KX, type CityData } from "../src/world/data";
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
    assert.ok(t.height >= 22 && t.height <= 42);
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
  const image = sharp("public/textures/forest/conifer-atlas.webp");
  const m = await image.metadata();
  assert.equal(m.width, 2048);
  assert.equal(m.height, 2048);
  assert.equal(m.hasAlpha, true);
  const stats = await image.stats();
  assert.ok(stats.channels[3].min === 0 && stats.channels[3].max === 255);
  assert.ok(stats.channels[3].mean > 5 && stats.channels[3].mean < 110);
});
