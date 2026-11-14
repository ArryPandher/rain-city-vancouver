import test from "node:test";
import assert from "node:assert/strict";
import { hasStorefront } from "../src/world/building-use";

test("mapped homes and civic buildings do not become retail shops", () => {
  for (const kind of [
    "house",
    "detached",
    "garage",
    "school",
    "church",
    "hospital",
    "warehouse",
  ])
    assert.equal(hasStorefront(kind, "Robson Street"), false, kind);
});
test("apartments retain retail on commercial streets but not residential streets", () => {
  assert.equal(hasStorefront("apartments", "Robson Street"), true);
  assert.equal(hasStorefront("apartments", "Nelson Street"), false);
  assert.equal(hasStorefront("residential", "Haro Street"), false);
  assert.equal(hasStorefront("retail", "Haro Street"), true);
});
