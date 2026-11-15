import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createExteriorLobbyGlass } from "../src/world/exterior-lobby-glass";

function compiled(throughput = 0.82) {
  const material = createExteriorLobbyGlass("test exterior glass", throughput),
    shader = {
      uniforms: T.UniformsUtils.clone(T.ShaderLib.physical.uniforms),
      vertexShader: T.ShaderLib.physical.vertexShader,
      fragmentShader: T.ShaderLib.physical.fragmentShader,
    };
  material.onBeforeCompile(
    shader as unknown as Parameters<T.Material["onBeforeCompile"]>[0],
    {} as T.WebGLRenderer,
  );
  return { material, shader };
}
function expandChunks(source: string): string {
  return source.replace(
    /#include <([\w\d_]+)>/g,
    (_, name: keyof typeof T.ShaderChunk) => {
      assert.equal(
        typeof T.ShaderChunk[name],
        "string",
        `Three shader chunk ${name} must resolve`,
      );
      return expandChunks(T.ShaderChunk[name]);
    },
  );
}
/** Execute the actual injected arithmetic, leaving Three's BRDF result as an
 * input. This is a CPU blend/energy regression test, not a GPU compile claim. */
function fragment(throughput: number, facing: number, specular: number[]) {
  const { material, shader } = compiled(throughput),
    patch = shader.fragmentShader.match(
      /float lobbyFacing[\s\S]*?(?=#include <opaque_fragment>)/,
    )?.[0];
  assert.ok(
    patch,
    "the override must run immediately before Three writes fragment output",
  );
  const evaluate = new Function(
    "normal",
    "vViewPosition",
    "ior",
    "lobbyThroughput",
    "totalSpecular",
    "normalize",
    "dot",
    "clamp",
    "pow",
    `let outgoingLight = [99, 98, 97], diffuseColor = {a: 1};\n${patch.replace(/\bfloat\s+/g, "const ")}\nreturn {rgb: outgoingLight, alpha: diffuseColor.a};`,
  );
  const normalize = (v: number[]) => {
      const n = Math.hypot(...v);
      return v.map((x) => x / n);
    },
    result = evaluate(
      [0, 0, 1],
      [Math.sqrt(Math.max(0, 1 - facing * facing)), 0, facing],
      material.ior,
      shader.uniforms.lobbyThroughput.value,
      specular,
      normalize,
      (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0),
      (x: number, a: number, b: number) => Math.max(a, Math.min(b, x)),
      Math.pow,
    ) as { rgb: number[]; alpha: number };
  return { material, ...result };
}
function composite(
  rgb: number[],
  alpha: number,
  behind: number[],
  material: T.MeshPhysicalMaterial,
) {
  assert.equal(material.blending, T.CustomBlending);
  assert.equal(material.blendEquation, T.AddEquation);
  assert.equal(material.blendSrc, T.OneFactor);
  assert.equal(material.blendDst, T.OneMinusSrcAlphaFactor);
  assert.equal(
    material.premultipliedAlpha,
    false,
    "Three must not multiply an already physical reflection by extinction alpha",
  );
  return rgb.map((x, i) => x + behind[i] * (1 - alpha));
}
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("lobby shader retains Three's dielectric BRDF and replaces diffuse paint only at output", () => {
  const { material, shader } = compiled(),
    expanded = expandChunks(shader.fragmentShader);
  assert.equal(material.metalness, 0);
  assert.equal(material.ior, 1.5);
  assert.equal(material.specularIntensity, 1);
  assert.equal(material.clearcoat, 0);
  assert.match(
    expanded,
    /material\.specularColor\s*=\s*min\(\s*pow2\(\s*\(\s*material\.ior - 1\.0/,
  );
  assert.match(
    expanded,
    /totalSpecular\s*=\s*reflectedLight\.directSpecular\s*\+\s*reflectedLight\.indirectSpecular/,
  );
  assert.match(
    expanded,
    /reflectedLight\.indirectSpecular\s*\+=\s*indirectSpecular/,
  );
  assert.equal(
    (expanded.match(/outgoingLight\s*=\s*totalSpecular\s*;/g) ?? []).length,
    1,
  );
  assert.ok(
    expanded.search(/outgoingLight\s*=\s*totalSpecular\s*;/) <
      expanded.indexOf("gl_FragColor = vec4( outgoingLight, diffuseColor.a )"),
  );
  const sample = fragment(0.82, 1, [0.02, 0.06, 0.12]);
  assert.deepEqual(
    sample.rgb,
    [0.02, 0.06, 0.12],
    "the white diffuse material and sentinel painted lighting cannot leak into the output",
  );
  assert.equal(
    material.fog,
    false,
    "fogging both the sheet and already-fogged backing would add a milky second layer",
  );
});

test("normal-incidence glass preserves reflected radiance once and reveals the closed backing", () => {
  const reflection = [0.04, 0.08, 0.16],
    backing = [0.12, 0.24, 0.36],
    sample = fragment(0.82, 1, reflection),
    out = composite(sample.rgb, sample.alpha, backing, sample.material),
    transmitted = 0.82 * (1 - 0.04);
  near(sample.alpha, 1 - transmitted);
  out.forEach((x, i) => near(x, reflection[i] + backing[i] * transmitted));
  const black = composite(sample.rgb, sample.alpha, [0, 0, 0], sample.material);
  assert.deepEqual(
    black,
    reflection,
    "reflection is not multiplied by alpha a second time",
  );
  assert.ok(
    transmitted > 0.75,
    "ordinary-facing glass must reveal most of the actual closed backing",
  );
});

test("angular extinction keeps unit-radiance reflected plus transmitted energy bounded", () => {
  for (const throughput of [0, 0.82, 0.86, 1]) {
    let previousAlpha = -1;
    for (const facing of [1, 0.75, 0.5, 0.2, 0.05, 0]) {
      const reflectance = 0.04 + 0.96 * (1 - facing) ** 5,
        sample = fragment(throughput, facing, [
          reflectance,
          reflectance,
          reflectance,
        ]),
        out = composite(sample.rgb, sample.alpha, [1, 1, 1], sample.material);
      near(sample.alpha, 1 - throughput * (1 - reflectance));
      assert.ok(sample.alpha >= previousAlpha - 1e-12 && sample.alpha <= 1);
      previousAlpha = sample.alpha;
      out.forEach((x) => assert.ok(x >= 0 && x <= 1 + 1e-12));
      if (throughput === 1) out.forEach((x) => near(x, 1));
      if (facing === 0) near(sample.alpha, 1);
    }
  }
});

test("throughput changes absorption without dimming the BRDF or adding refraction passes", () => {
  const specular = [0.3, 0.2, 0.1],
    low = fragment(0.2, 0.5, specular),
    high = fragment(0.95, 0.5, specular);
  assert.deepEqual(low.rgb, high.rgb);
  assert.ok(low.alpha > high.alpha);
  for (const material of [low.material, high.material]) {
    assert.equal(material.transmission, 0);
    assert.equal(material.transparent, true);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, false);
    assert.equal(material.depthTest, true);
    assert.equal(material.side, T.FrontSide);
    assert.equal(material.userData.castShadow, false);
    assert.equal(material.blendEquationAlpha, T.AddEquation);
    assert.equal(material.blendSrcAlpha, T.ZeroFactor);
    assert.equal(material.blendDstAlpha, T.OneFactor);
  }
  // Three's actual output chunk keeps custom alpha when OPAQUE and
  // USE_TRANSMISSION are both absent for these material settings.
  assert.match(
    T.ShaderChunk.opaque_fragment,
    /#ifdef OPAQUE\s+diffuseColor\.a = 1\.0;/,
  );
  assert.match(
    T.ShaderChunk.opaque_fragment,
    /#ifdef USE_TRANSMISSION\s+diffuseColor\.a \*= material\.transmissionAlpha;/,
  );
  assert.match(
    T.ShaderChunk.premultiplied_alpha_fragment,
    /#ifdef PREMULTIPLIED_ALPHA/,
  );
});
