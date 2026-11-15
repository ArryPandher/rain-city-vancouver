import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createCanadaPlaceHotelGlazingPair,
  createCanadaPlaceHotelGlazingMesh,
  CANADA_PLACE_HOTEL_OPTICS,
} from "../src/world/canada-place-hotel-glass";
import { createCanadaPlaceCanopyGlazingPair } from "../src/world/canada-place-canopy-glass";
test("hotel optics retain paired source geometry and independent nonemissive calibration", () => {
  const pair = createCanadaPlaceHotelGlazingPair(),
    other = createCanadaPlaceCanopyGlazingPair();
  assert.deepEqual(pair.attenuation.uniforms.sheetThroughput.value.toArray(), [
    ...CANADA_PLACE_HOTEL_OPTICS.linearThroughput,
  ]);
  assert.equal(pair.reflection.metalness, 0);
  assert.equal(pair.reflection.emissive.getHex(), 0);
  assert.equal(pair.reflection.roughness, 0.12);
  assert.equal(pair.reflection.name, "canada-hotel-glass");
  const before = other.attenuation.uniforms.sheetThroughput.value.clone();
  pair.attenuation.uniforms.sheetThroughput.value.set(0.1, 0.2, 0.3);
  assert.ok(other.attenuation.uniforms.sheetThroughput.value.equals(before));
  const g = new T.PlaneGeometry(2, 3),
    positions = Array.from(g.attributes.position.array),
    indices = Array.from(g.index!.array);
  const mesh = createCanadaPlaceHotelGlazingMesh(g, pair);
  assert.deepEqual(
    Array.from(mesh.geometry.attributes.position.array),
    positions,
  );
  assert.deepEqual(Array.from(mesh.geometry.index!.array), indices);
  assert.equal(mesh.geometry.groups.length, 2);
  assert.equal(g.groups.length, 0);
  assert.equal(mesh.castShadow, false);
  for (const material of mesh.material) {
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
  }
});
