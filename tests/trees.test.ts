import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  reconcileTrees,
  treeProfile,
  type PublicTreeLayer,
} from "../src/world/tree-profile";
import { geo } from "../src/world/data";
const layer = JSON.parse(
  fs.readFileSync("public/data/vancouver-public-trees.json", "utf8"),
) as PublicTreeLayer;

test("City tree extract has valid coordinates, unique assets and no planting-site species", () => {
  assert.ok(layer.trees.length > 40000);
  const ids = new Set<number>();
  for (const [id, x, z, h, d, si] of layer.trees) {
    assert.ok(Number.isFinite(x) && Number.isFinite(z));
    assert.ok(
      x >= geo(49.264, -123.164)[0] - 0.01 &&
        x <= geo(49.334, -123.01)[0] + 0.01,
    );
    assert.ok(
      z >= geo(49.334, -123.164)[1] - 0.01 &&
        z <= geo(49.264, -123.01)[1] + 0.01,
    );
    assert.ok(!ids.has(id));
    ids.add(id);
    assert.ok(h === null || (h > 0 && h <= 75));
    assert.ok(d === null || (d > 0 && d <= 5));
    assert.ok(layer.species[si]);
    assert.ok(
      !/PLANTING SITE|STUMP|REMOVED|VACANT/.test(layer.species[si].name),
    );
  }
});
test("public records suppress duplicate OSM trees across bucket boundaries and empty planting sites", () => {
  const fixture: PublicTreeLayer = {
    species: [],
    trees: [[1, 5.9, 5.9, 4.6, 0.076, 0]],
    plantingSites: [30, 30],
  };
  const trees = reconcileTrees([7, 7, 31, 31, 45, 45], fixture);
  assert.equal(trees.length, 2);
  assert.deepEqual(
    trees.map((t) => [t.x, t.z]),
    [
      [5.9, 5.9],
      [45, 45],
    ],
  );
  assert.equal(trees[0].height, 4.6);
  assert.equal(trees[0].diameter, 0.076);
  assert.equal(reconcileTrees([7, 7, 31, 31]).length, 2);
});
test("recorded heights are preserved and species influence bounded crown forms", () => {
  const species = (name: string, genus: string, cultivar = "") => ({
    name,
    genus,
    cultivar,
    species: "",
  });
  const beech = treeProfile(
    0,
    0,
    4.6,
    0.076,
    species("EUROPEAN BEECH", "FAGUS"),
    1,
  );
  const hornbeam = treeProfile(
    0,
    0,
    4.6,
    0.076,
    species("PYRAMIDAL EUROPEAN HORNBEAM", "CARPINUS", "FASTIGIATA"),
    1,
  );
  const fir = treeProfile(
    0,
    0,
    32,
    0.6,
    species("DOUGLAS FIR", "PSEUDOTSUGA"),
    2,
  );
  assert.equal(beech.height, 4.6);
  assert.ok(beech.width > 2.8 && beech.width < 3.5);
  assert.ok(hornbeam.width < beech.width * 0.6);
  assert.equal(hornbeam.form, "columnar");
  assert.equal(fir.form, "conifer");
  assert.equal(fir.height, 32);
  for (const t of [beech, hornbeam, fir, treeProfile(0, 0, NaN, -1)])
    assert.ok(
      [t.width, t.diameter, t.height, t.rotation].every(Number.isFinite),
    );
});
test("Granville trees use the documented City heights rather than random mature-tree sizes", () => {
  const centre = geo(49.281, -123.12);
  const near = layer.trees.filter(
    (t) => Math.hypot(t[1] - centre[0], t[2] - centre[1]) < 180,
  );
  const smallBeeches = near.filter(
    (t) => layer.species[t[5]].genus === "FAGUS" && t[3] === 4.6,
  );
  assert.ok(smallBeeches.length >= 10);
  for (const [id, x, z, h, d, si] of smallBeeches) {
    const p = treeProfile(x, z, h, d, layer.species[si], id);
    assert.equal(p.height, 4.6);
    assert.ok(p.width < 3.5);
  }
});
