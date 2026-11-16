import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as T from "three";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makeDetailedCharacterFromTemplate } from "../src/game/detailed-character";

async function asset(name: string) {
  const path = `public/models/${name}.glb`;
  const bytes = await fs.readFile(path);
  const loader = new GLTFLoader();
  // Browser image decoding is substituted; real glTF material assignment and
  // its derivative-tangent convention are exercised, as are the original rigs.
  loader.register(() => ({
    name: "test-image-decoding",
    loadTexture: () => {
      const texture = new T.Texture();
      texture.flipY = false; // Same image orientation as GLTFLoader.
      return Promise.resolve(texture);
    },
  }));
  const template = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const document = await new NodeIO().read(path);
  const skin = document
    .getRoot()
    .listMaterials()
    .find((m) => m.getName() === "Skin")!;
  const image = await sharp(skin.getNormalTexture()!.getImage()!)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { template, image };
}
function body(root: T.Object3D) {
  return root.getObjectByName("Body") as T.SkinnedMesh<
    T.BufferGeometry,
    T.MeshStandardMaterial
  >;
}

// CPU evaluation of Three's derivative tangent frame and normal_fragment_maps.
// Triangle edges are affine screen derivatives; no invented tangent attribute.
function shaderFrame(g: T.BufferGeometry, triangle: number) {
  const ids = [0, 1, 2].map((i) => g.index!.getX(triangle * 3 + i));
  const p = ids.map((i) =>
    new T.Vector3().fromBufferAttribute(g.getAttribute("position"), i),
  );
  const uv = ids.map(
    (i) =>
      new T.Vector2(g.getAttribute("uv").getX(i), g.getAttribute("uv").getY(i)),
  );
  const n = ids
    .reduce(
      (sum, i) =>
        sum.add(
          new T.Vector3().fromBufferAttribute(g.getAttribute("normal"), i),
        ),
      new T.Vector3(),
    )
    .normalize();
  const q0 = p[1].clone().sub(p[0]),
    q1 = p[2].clone().sub(p[0]);
  const st0 = uv[1].clone().sub(uv[0]),
    st1 = uv[2].clone().sub(uv[0]);
  const q1perp = q1.clone().cross(n),
    q0perp = n.clone().cross(q0);
  const tangent = q1perp
    .clone()
    .multiplyScalar(st0.x)
    .addScaledVector(q0perp, st1.x);
  const bitangent = q1perp
    .clone()
    .multiplyScalar(st0.y)
    .addScaledVector(q0perp, st1.y);
  const det = Math.max(tangent.lengthSq(), bitangent.lengthSq());
  if (det < 1e-16) return;
  tangent.multiplyScalar(1 / Math.sqrt(det));
  bitangent.multiplyScalar(1 / Math.sqrt(det));
  return {
    n,
    tangent,
    bitangent,
    uv: uv
      .reduce((sum, u) => sum.add(u), new T.Vector2())
      .multiplyScalar(1 / 3),
  };
}
function mapped(
  frame: NonNullable<ReturnType<typeof shaderFrame>>,
  normal: T.Vector3,
  scale: T.Vector2,
) {
  return frame.tangent
    .clone()
    .multiplyScalar(normal.x * scale.x)
    .addScaledVector(frame.bitangent, normal.y * scale.y)
    .addScaledVector(frame.n, normal.z)
    .normalize();
}

for (const [name, variant] of [
  ["rain-city-protagonist", 0],
  ["rain-city-protagonist", 1],
  ["rain-city-pedestrian", 3],
] as const) {
  test(`${name}/${variant}: real skin normal-map relief keeps the loader's shader orientation`, async () => {
    const { template, image } = await asset(name);
    const original = body(template.scene),
      source = original.material;
    assert.equal(original.geometry.hasAttribute("tangent"), false);
    assert.equal(source.normalMapType, T.TangentSpaceNormalMap);
    assert.deepEqual(source.normalScale.toArray(), [0.6, -0.6]);
    const sourceScale = source.normalScale.clone();
    const actor = makeDetailedCharacterFromTemplate(template, variant);
    const skinMesh = body(actor.group),
      skin = skinMesh.material;
    assert.equal(skinMesh.geometry, original.geometry);
    assert.equal(skin.normalMap, source.normalMap);
    assert.equal(skin.map, source.map);
    assert.equal(skin.roughness, 0.66);
    assert.equal(skin.metalness, source.metalness);
    assert.equal(skin.envMapIntensity, 0.5);
    assert.equal(skin.opacity, source.opacity);
    if (variant === 0)
      assert.deepEqual(skin.color.toArray(), source.color.toArray());
    else
      assert.equal(
        skin.color.getHex(),
        [0xb88769, 0x9d6f51, 0xcdac90, 0x80523c, 0xd7b59b, 0xb68a68][
          variant % 6
        ],
      );
    assert.notEqual(skin, source);
    assert.deepEqual(
      source.normalScale.toArray(),
      sourceScale.toArray(),
      "shared source remains unchanged",
    );
    const expectedScale = sourceScale.clone().multiplyScalar(0.55 / 0.6);
    let samples = 0,
      reversedRelief = 0;
    for (
      let triangle = 0;
      triangle < original.geometry.index!.count / 3;
      triangle += 7
    ) {
      const frame = shaderFrame(original.geometry, triangle);
      if (!frame || frame.bitangent.length() < 0.2) continue;
      // glTF UV origin is image top-left, matching GLTFLoader's flipY=false.
      const x = Math.floor((((frame.uv.x % 1) + 1) % 1) * image.info.width);
      const y = Math.floor((((frame.uv.y % 1) + 1) % 1) * image.info.height);
      const offset = (y * image.info.width + x) * image.info.channels;
      const normal = new T.Vector3(
        ...[0, 1, 2].map((c) => (image.data[offset + c] / 255) * 2 - 1),
      );
      if (Math.abs(normal.y) < 0.015) continue;
      const expected = mapped(frame, normal, expectedScale),
        actual = mapped(frame, normal, skin.normalScale);
      assert.ok(
        actual.distanceTo(expected) < 1e-10,
        `source relief direction changed at body triangle ${triangle}`,
      );
      const oldWrong = mapped(frame, normal, new T.Vector2(0.55, 0.55));
      if (oldWrong.distanceTo(expected) > 0.01) reversedRelief++;
      samples++;
    }
    assert.ok(samples > 50, `actual non-flat normal samples: ${samples}`);
    assert.ok(
      reversedRelief > 50,
      "regression distinguishes the old reversed green-channel relief",
    );
  });
}
