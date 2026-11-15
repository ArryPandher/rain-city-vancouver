import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createCanadaPlaceConcourseGlass } from "../src/world/canada-place-concourse-glass";

test("upper glazing uses dielectric Fresnel rather than the old metallic reflection floor", () => {
  const material = createCanadaPlaceConcourseGlass();
  const f0 =
    ((material.ior - 1) / (material.ior + 1)) ** 2 * material.specularIntensity;
  assert.ok(
    f0 >= 0.035 && f0 <= 0.045,
    "ordinary glass reflects about four percent at normal incidence",
  );
  assert.equal(material.metalness, 0);
  assert.equal(
    material.specularColor.getHex(),
    0xffffff,
    "dielectric reflection is untinted; body colour supplies blue-green proxy",
  );
  const previousColour = new T.Color(0x91aaa2);
  const previousGreenF0 = 0.04 * (1 - 0.58) + previousColour.g * 0.58;
  assert.ok(
    previousGreenF0 > f0 * 5,
    "material removes the prior high-reflectance metal floor",
  );
  const grazing = f0 + (1 - f0) * (1 - 0.05) ** 5;
  assert.ok(
    grazing > 0.75,
    "normal Fresnel still retains harbour reflection at grazing views",
  );
  assert.ok(material.roughness > 0.14 && material.roughness < 0.3);
  material.dispose();
});

test("upper proxy needs no transmission pass and accepts the existing shared probe", () => {
  const a = createCanadaPlaceConcourseGlass(),
    b = createCanadaPlaceConcourseGlass();
  const sharedProbe = new T.CubeTexture();
  a.envMap = sharedProbe;
  a.needsUpdate = true;
  assert.equal(a.name, "canada-west-glass");
  assert.equal(a.envMap, sharedProbe);
  assert.equal(b.envMap, null, "each scene owns its own material");
  assert.equal(a.transmission, 0);
  assert.equal(a.clearcoat, 0, "no second coat doubles the highlight");
  assert.equal(a.transparent, false);
  assert.equal(a.depthWrite, true);
  assert.equal(a.map, null);
  assert.equal(a.normalMap, null);
  assert.equal(a.emissive.getHex(), 0);
  assert.equal(
    a.envMapIntensity,
    0.8,
    "matches current loader probe intensity",
  );
  a.dispose();
  b.dispose();
  sharedProbe.dispose();
});
