import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createHoweStationPavingMaterials,
  HOWE_STATION_PAVING_COVERAGE_GLSL,
} from "../src/world/howe-station-paving-materials";

// Run the exported shader's actual scalar math, not a separately maintained
// implementation. JavaScript doubles do not prove GPU precision/render quality.
const scalarShader = HOWE_STATION_PAVING_COVERAGE_GLSL.replace(
  /float (\w+)\(/g,
  "function $1(",
)
  .replace(/float (\w+)=/g, "let $1=")
  .replace(/\bfloat /g, "");
const coverage = new Function(
  "floor",
  "min",
  "max",
  "clamp",
  `${scalarShader};return howeStripeCoverage;`,
)(Math.floor, Math.min, Math.max, (x: number, low: number, high: number) =>
  Math.max(low, Math.min(high, x)),
) as (
  position: number,
  period: number,
  width: number,
  footprint: number,
) => number;
const near = (a: number, b: number, epsilon = 1e-8) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} ≈ ${b}`);
const layout = { moduleMetres: 1.4, bandMetres: 0.18 };

test("actual stripe shader filters broad bands without phase drift or distant aliasing", () => {
  const { moduleMetres: period, bandMetres: width } = layout;
  near(coverage(0, period, width, 0.001), 1);
  near(coverage(period / 2, period, width, 0.001), 0);
  near(coverage(width / 2, period, width, 0.01), 0.5);
  for (const position of [-9.3, -2.91, -0.16, 0, 0.16, 5.8]) {
    for (const footprint of [0.00001, 0.02, 0.1, period, period * 4]) {
      const value = coverage(position, period, width, footprint);
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      near(
        value,
        coverage(position + period * 3, period, width, footprint),
        1e-7,
      );
    }
    near(coverage(position, period, width, period * 4), width / period);
  }
});

test("materials isolate existing metric mineral samplers and share only their own maps", () => {
  const original = new T.Texture<HTMLImageElement>();
  original.repeat.set(7, 9);
  const requests: [string, boolean | undefined][] = [];
  const m = createHoweStationPavingMaterials(
    {
      texture(path, color) {
        requests.push([path, color]);
        return original;
      },
    },
    layout,
  );
  assert.deepEqual(requests, [
    ["canada-place-paving/color.webp", true],
    ["canada-place-paving/normal.webp", false],
    ["canada-place-paving/roughness.webp", false],
  ]);
  assert.deepEqual(original.repeat.toArray(), [7, 9]);
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    const texture = m.field[key]!;
    assert.notEqual(texture, original);
    assert.equal(texture, m.border[key]);
    near(texture.repeat.x, 1 / 0.72);
    assert.equal(
      texture.colorSpace,
      key === "map" ? T.SRGBColorSpace : T.NoColorSpace,
    );
  }
  assert.equal(m.field.metalness, 0);
  assert.equal(m.field.emissive.getHex(), 0);
  assert.equal(m.field.transparent, false);
  assert.equal(m.border.onBeforeCompile, T.Material.prototype.onBeforeCompile);
  assert.throws(
    () =>
      createHoweStationPavingMaterials(
        { texture: () => original },
        { moduleMetres: 1, bandMetres: 0.6 },
      ),
    /positive module/,
  );
});

test("installed Three shader retains geometry and light paths with adjustable metric layout", () => {
  const { field } = createHoweStationPavingMaterials(
    { texture: () => new T.Texture() },
    layout,
  );
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  field.onBeforeCompile(shader as never, {} as T.WebGLRenderer);
  assert.equal(shader.uniforms.howePavingModule.value, layout.moduleMetres);
  assert.equal(shader.uniforms.howePavingBand.value, layout.bandMetres);
  const band = shader.uniforms.howePavingBandColor.value as T.Color,
    infill = shader.uniforms.howePavingInfillColor.value as T.Color;
  assert.ok(band.r > infill.r && band.g > infill.g && band.b > infill.b);
  assert.ok(
    infill.r > infill.g && infill.g > infill.b,
    "warm muted infill, not a grey checkerboard",
  );
  assert.equal(shader.vertexShader.includes("transformed +="), false);
  assert.equal(shader.vertexShader.includes("vHowePavingMetres=uv;"), true);
  for (const chunk of [
    "lights_physical_fragment",
    "lights_fragment_begin",
    "lights_fragment_end",
    "aomap_fragment",
  ])
    assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`));
  assert.ok(
    shader.fragmentShader.indexOf("vec3 howeFinish=") <
      shader.fragmentShader.indexOf("roughnessFactor=clamp"),
  );
  const broken = { ...shader, vertexShader: "void main() {}" };
  assert.throws(
    () => field.onBeforeCompile(broken as never, {} as T.WebGLRenderer),
    /shader anchor changed/,
  );
});
