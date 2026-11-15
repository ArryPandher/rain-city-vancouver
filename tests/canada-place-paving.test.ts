import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  canadaPlacePavingMaterial,
  extractCanadaPlacePaving,
  CANADA_PLACE_PAVING_SOURCE,
  canadaPlacePavingFingerprint,
} from "../src/world/canada-place-paving";
import {
  CANADA_PLACE_ORIGIN,
  CANADA_PLACE_DECK_ROUTE,
  supportedDeck,
} from "../src/world/canada-place-deck";
async function fixture() {
  const file = "public/models/vancouver/canada-place.glb";
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    "1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe",
  );
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(file);
  const parts: { name: string; g: T.BufferGeometry }[] = [];
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        p = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        p.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      parts.push({ name: pr.getMaterial()!.getName(), g });
    }
  return parts;
}
test("source-pinned paving extracts exactly31 tops and leaves all other source vertices/triangles intact", async () => {
  const parts = await fixture();
  for (const { g, name } of parts) {
    const positions = Array.from(g.getAttribute("position").array),
      indices = Array.from(g.getIndex()!.array),
      top = extractCanadaPlacePaving(g, name);
    assert.deepEqual(Array.from(g.getAttribute("position").array), positions);
    if (name !== "concrete") {
      assert.equal(top, null);
      assert.deepEqual(Array.from(g.getIndex()!.array), indices);
      continue;
    }
    assert.ok(top);
    assert.equal(top.getAttribute("position").count, 93);
    const selected = new Set<number>(CANADA_PLACE_PAVING_SOURCE.topOffsets);
    const remaining = indices.filter((_, i) => !selected.has(i - (i % 3)));
    assert.deepEqual(Array.from(g.getIndex()!.array), remaining);
    const expected = indices.flatMap((id, i) =>
      selected.has(i - (i % 3)) ? positions.slice(id * 3, id * 3 + 3) : [],
    );
    assert.deepEqual(Array.from(top.getAttribute("position").array), expected);
    assert.equal(
      g.getIndex()!.count + top.getAttribute("position").count,
      indices.length,
    );
    assert.equal(
      extractCanadaPlacePaving(g, name),
      null,
      "repeat extraction fails closed",
    );
  }
});
test("actual GLB route rays preserve exact original elevation and upward support", async (t) => {
  const parts = await fixture(),
    root = new T.Group();
  root.position.set(CANADA_PLACE_ORIGIN[0], 0.08, CANADA_PLACE_ORIGIN[1]);
  let paving: T.BufferGeometry | undefined;
  for (const { g, name } of parts) {
    const top = extractCanadaPlacePaving(g, name);
    root.add(new T.Mesh(g, new T.MeshBasicMaterial()));
    if (top) {
      paving = top;
      root.add(new T.Mesh(top, new T.MeshBasicMaterial({ name: "paving" })));
    }
  }
  assert.ok(paving);
  root.updateMatrixWorld(true);
  let count = 0;
  for (let i = 1; i < CANADA_PLACE_DECK_ROUTE.length; i++) {
    const a = CANADA_PLACE_DECK_ROUTE[i - 1],
      b = CANADA_PLACE_DECK_ROUTE[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let j = 0; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n;
      if (!supportedDeck(x, z, 0.4)) continue;
      const hits = new T.Raycaster(
        new T.Vector3(x, 9, z),
        new T.Vector3(0, -1, 0),
        0,
        2,
      ).intersectObject(root, true);
      assert.ok(hits.length);
      assert.equal(
        (hits[0].object as T.Mesh).material instanceof T.MeshBasicMaterial,
        true,
      );
      assert.equal(
        ((hits[0].object as T.Mesh).material as T.Material).name,
        "paving",
      );
      assert.ok(Math.abs(hits[0].point.y - 7.88) < 0.015);
      assert.ok(hits[0].face!.normal.y > 0.999);
      count++;
    }
  }
  assert.ok(count > 100);
  t.diagnostic(`${count} original-route support rays`);
});
test("changed concrete geometry fails closed without mutation", async () => {
  const { g } = (await fixture()).find((p) => p.name === "concrete")!;
  assert.equal(
    canadaPlacePavingFingerprint(g),
    CANADA_PLACE_PAVING_SOURCE.fingerprint,
  );
  g.getAttribute("position").setY(0, 9);
  const index = Array.from(g.getIndex()!.array);
  assert.equal(extractCanadaPlacePaving(g, "concrete"), null);
  assert.deepEqual(Array.from(g.getIndex()!.array), index);
});

test("paving uses dedicated licensed maps without modifying source material or vertex placement shader", () => {
  const original = new T.MeshStandardMaterial({
    color: 0xffffff,
    map: new T.Texture(),
    normalMap: new T.Texture(),
    roughnessMap: new T.Texture(),
  });
  const maps = {
    color: new T.Texture(),
    normal: new T.Texture(),
    roughness: new T.Texture(),
  };
  const material = canadaPlacePavingMaterial(original, maps);
  assert.equal(material.map, maps.color);
  assert.equal(material.normalMap, maps.normal);
  assert.equal(material.roughnessMap, maps.roughness);
  assert.equal(original.color.getHex(), 0xffffff);
  assert.equal(material.metalness, 0);
  assert.ok(material.roughness > 0.8);
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader as any, {} as T.WebGLRenderer);
  assert.ok(shader.vertexShader.includes("vPavingMetres="));
  assert.equal(shader.vertexShader.includes("transformed +="), false);
  assert.ok(shader.fragmentShader.includes("fwidth(metres)"));
  assert.ok(shader.fragmentShader.includes("pavingGradient"));
  assert.equal(
    (shader.fragmentShader.match(/vec3 paving=pavingDetail/g) ?? []).length,
    1,
  );
  assert.ok(
    !shader.fragmentShader.includes("landmarkBlock"),
    "vertical facade courses are not layered into floor material",
  );
});

test("dedicated compressed maps preserve mean reflectance while restoring measured mineral detail", async (t) => {
  const linear = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const channel = async (path: string) => {
    const { data, info } = await sharp(path)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return Array.from(
      { length: info.width * info.height },
      (_, i) => data[i * info.channels] / 255,
    );
  };
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const old = (
      await channel("public/textures/landmarks/mineral-color.webp")
    ).map(linear),
    next = (
      await channel("public/textures/canada-place-paving/color.webp")
    ).map(linear);
  const oldMean = mean(old),
    newMean = mean(next);
  // Compute deviations directly so the large arrays do not repeat mean per texel.
  const deviation = (a: number[], m: number) =>
    Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  assert.ok(
    Math.abs(newMean - oldMean) < 0.01,
    `mean reflectance ${oldMean} -> ${newMean}`,
  );
  assert.ok(deviation(next, newMean) > deviation(old, oldMean) * 4);
  const rough = await channel(
    "public/textures/canada-place-paving/roughness.webp",
  );
  assert.ok(mean(rough) > 0.78 && mean(rough) < 0.82);
  assert.ok(rough.every((v) => v > 0.72 && v < 0.88));
  const source = JSON.parse(
    fs.readFileSync("public/textures/canada-place-paving/SOURCES.json", "utf8"),
  );
  assert.equal(source.license, "CC0-1.0");
  assert.ok(
    source.sources.reduce(
      (s: number, x: { outputBytes: number }) => s + x.outputBytes,
      0,
    ) < 200000,
  );
  t.diagnostic(
    `linear mean ${oldMean.toFixed(4)} -> ${newMean.toFixed(4)}; grain std ${deviation(old, oldMean).toFixed(4)} -> ${deviation(next, newMean).toFixed(4)}; roughness mean ${mean(rough).toFixed(4)}`,
  );
});
