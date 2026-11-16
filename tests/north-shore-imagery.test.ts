import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import * as T from "three";
import { readNorthShoreDiagnostics } from "../src/world/north-shore-diagnostics";
import { geo } from "../src/world/data";
import {
  NORTH_SHORE_IMAGERY as d,
  northShoreImageryUv,
} from "../src/world/north-shore-imagery";
import {
  createNorthShoreDemGroup,
  createNorthShoreDemGeometry,
} from "../src/world/north-shore-dem";

test("licensed DNV derivative preserves bounded source provenance and masks exterior coverage", async () => {
  const bytes = fs.readFileSync(d.texture);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    d.textureSha256,
  );
  assert.equal(d.scene, "District of North Vancouver Orthoimagery 2013");
  assert.equal(d.year, 2013);
  assert.equal(d.sourceBytes, 741754);
  assert.equal(d.records.length, 24);
  assert.ok(
    d.records.every(
      (r) =>
        r.url.includes("Basemap_Ortho2013/MapServer/tile/1/") &&
        r.bytes < 1024 * 1024,
    ),
  );
  assert.ok(d.sourceBytes < 20 * 1024 * 1024);
  assert.ok(d.textureBytes < 800000);
  assert.equal(d.licence, "Open Government Licence - North Vancouver");
  const { data: p, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 2048);
  assert.equal(info.height, 504);
  for (let x = 0; x < info.width; x++) {
    assert.equal(p[x * 4 + 3], 0);
    assert.equal(p[((info.height - 1) * info.width + x) * 4 + 3], 0);
  }
  for (let y = 0; y < info.height; y++) {
    assert.equal(p[y * info.width * 4 + 3], 0);
    assert.equal(p[(y * info.width + info.width - 1) * 4 + 3], 0);
  }
  const alpha = (lat: number, lon: number) => {
    const [u, v] = northShoreImageryUv(...geo(lat, lon));
    return p[
      (Math.min(info.height - 1, Math.floor((1 - v) * info.height)) *
        info.width +
        Math.min(info.width - 1, Math.floor(u * info.width))) *
        4 +
        3
    ];
  };
  assert.equal(
    alpha(49.3796, -123.0817),
    255,
    "Grouse source-visible interior",
  );
  assert.equal(
    alpha(49.3802, -123.0575),
    255,
    "Fromme source-visible interior",
  );
  assert.equal(
    alpha(49.3933, -122.9445),
    255,
    "Seymour now has licensed source coverage",
  );
  assert.equal(
    alpha(49.379, -123.018),
    255,
    "Lynn Valley now has source coverage",
  );
  assert.ok(
    p.some((v, i) => i % 4 === 3 && v > 0 && v < 255),
    "finite confidence transition",
  );
});

test("actual terrain UVs use north-up geographic registration and match across all chunk seams", () => {
  assert.deepEqual(
    northShoreImageryUv(...geo(d.bounds.north, d.bounds.west)),
    [0, 1],
  );
  assert.deepEqual(
    northShoreImageryUv(...geo(d.bounds.south, d.bounds.east)),
    [1, 0],
  );
  const seen = new Map<string, number[]>();
  let repeats = 0;
  for (const c of createNorthShoreDemGeometry()) {
    const p = c.geometry.attributes.position,
      uv = c.geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + c.origin[0],
        z = p.getZ(i) + c.origin[1],
        expected = northShoreImageryUv(x, z);
      assert.ok(
        Math.abs(uv.getX(i) - expected[0]) <
          1e-7 * Math.max(1, Math.abs(expected[0])),
      );
      assert.ok(
        Math.abs(uv.getY(i) - expected[1]) <
          1e-7 * Math.max(1, Math.abs(expected[1])),
      );
      const key = `${x.toFixed(2)},${z.toFixed(2)}`,
        values = [uv.getX(i), uv.getY(i)];
      if (seen.has(key)) {
        assert.deepEqual(values, seen.get(key));
        repeats++;
      } else seen.set(key, values);
    }
  }
  assert.ok(repeats > 1000);
});

test("diagnostic imagery loads locally, blends coverage into opaque neutral material and fails back safely", () => {
  const original = T.TextureLoader.prototype.load;
  let loaded: Parameters<T.TextureLoader["load"]>[1],
    failed: ((event: unknown) => void) | undefined,
    url = "";
  T.TextureLoader.prototype.load = function (u, onLoad, _progress, onError) {
    url = u;
    loaded = onLoad;
    failed = onError;
    return new T.Texture();
  };
  try {
    const group = createNorthShoreDemGroup({ imagery: true }),
      material = (group.children[0] as T.Mesh)
        .material as T.MeshStandardMaterial;
    assert.ok(url.endsWith("textures/north-shore-dem/dnv-2013.webp"));
    assert.equal(group.userData.imageryStatus, "loading");
    assert.equal(readNorthShoreDiagnostics(group).imageryStatus, "loading");
    assert.equal(material.map, null);
    failed!({});
    assert.equal(group.userData.imageryStatus, "fallback");
    assert.equal(readNorthShoreDiagnostics(group).imageryStatus, "fallback");
    assert.equal(readNorthShoreDiagnostics(group).texture, null);
    assert.equal(material.map, null);
    const texture = new T.Texture<HTMLImageElement>();
    texture.image = { width: 2048, height: 504 } as HTMLImageElement;
    loaded!(texture);
    assert.equal(material.map, texture);
    assert.equal(texture.colorSpace, T.SRGBColorSpace);
    assert.equal(
      texture.flipY,
      true,
      "HTML image top row uploads at terrain north v1",
    );
    assert.equal(
      texture.premultiplyAlpha,
      false,
      "coverage alpha must not darken source RGB",
    );
    texture.updateMatrix();
    assert.deepEqual(
      texture.transformUv(new T.Vector2(0, 1)).toArray(),
      [0, 0],
    );
    assert.deepEqual(
      texture.transformUv(new T.Vector2(1, 0)).toArray(),
      [1, 1],
    );
    assert.equal(texture.wrapS, T.ClampToEdgeWrapping);
    assert.equal(material.vertexColors, true);
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.alphaTest, 0);
    assert.equal(group.userData.imageryStatus, "ready");
    const diagnostic = readNorthShoreDiagnostics(group);
    assert.equal(diagnostic.imageryStatus, "ready");
    assert.equal(diagnostic.meshCount, 28);
    assert.deepEqual(diagnostic.texture, {
      width: 2048,
      height: 504,
      colorSpace: T.SRGBColorSpace,
    });
    assert.equal(diagnostic.material?.name, material.name);
    assert.equal(diagnostic.material?.mapName, texture.name);
    assert.ok(texture.name.includes("2013"));
    const shader = {
      fragmentShader: T.ShaderLib.standard.fragmentShader,
      vertexShader: T.ShaderLib.standard.vertexShader,
      uniforms: {},
    };
    material.onBeforeCompile(
      shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
      {} as T.WebGLRenderer,
    );
    assert.ok(
      shader.fragmentShader.includes(
        "mix(vColor.rgb, sampledDiffuseColor.rgb, sampledDiffuseColor.a)",
      ),
    );
    assert.ok(
      !shader.fragmentShader.includes("diffuseColor *= sampledDiffuseColor;"),
      "no green double tint or terrain alpha multiplication",
    );
    assert.ok(shader.fragmentShader.includes("(vFogDepth * 0.35)"));
    assert.ok(
      shader.fragmentShader.includes("#include <lights_fragment_begin>"),
    );
  } finally {
    T.TextureLoader.prototype.load = original;
  }
});
