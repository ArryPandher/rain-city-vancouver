import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { PACIFIC_COAST_RING } from "../src/world/pacific-coast-site";
import {
  applyHoweMasonryWeathering,
  howeMasonryWeatheringMaskSource,
  type HoweMasonryWeatheringSpec,
} from "../src/world/howe-masonry-weathering";

const spec: HoweMasonryWeatheringSpec = {
  datumY: 10,
  facades: [
    {
      start: [0, 0],
      end: [12, 0],
      groundY: [10, 12],
      windowEdges: [2, 4, 7, 9],
    },
  ],
  sillY: [4, 7],
  ledgeY: [9],
};
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Execute the actual generated scalar GLSL mask, not a separate mirrored
 * sampler. This verifies source-localization/math but is not GPU compilation. */
function mask(input = spec) {
  const source = howeMasonryWeatheringMaskSource(input)
    .replace(
      /float (howe\w+)\(([^)]*)\)/g,
      (_, name, args) => `function ${name}(${args.replace(/float /g, "")})`,
    )
    .replace(/\bfloat /g, "let ");
  return new Function(
    "smoothstep",
    "step",
    "mix",
    "clamp",
    "max",
    "abs",
    "sin",
    "pow",
    `${source}\nreturn howeMasonryMask;`,
  )(
    smoothstep,
    (a: number, x: number) => (x < a ? 0 : 1),
    (a: number, b: number, t: number) => a + (b - a) * t,
    clamp,
    Math.max,
    Math.abs,
    Math.sin,
    Math.pow,
  ) as (x: number, y: number, z: number) => number;
}

test("weathering stays beside real sill edges and beneath actual ledges", () => {
  const sample = mask();
  assert.ok(sample(2, 13.8, 0) > 0.1, "runoff immediately beneath a sill edge");
  assert.equal(
    sample(3, 13.8, 0),
    0,
    "centre of the spandrel is not randomly stained",
  );
  assert.equal(
    sample(2, 14.3, 0),
    0,
    "no runoff painted above its source sill",
  );
  assert.equal(sample(2, 12.9, 0), 0, "sill runoff has finite reach");
  assert.ok(
    sample(5, 18.7, 0) > 0.1,
    "cap exposure lies beneath the known ledge",
  );
  assert.equal(sample(5, 19.3, 0), 0, "no exposure above that ledge");
  assert.equal(sample(2, 13.8, 1), 0, "no pattern on unrelated nearby planes");
  assert.equal(sample(15, 13.8, 0), 0, "no extension past the facade end");
});

test("base splash follows the sloped street and all exposure remains bounded", () => {
  const sample = mask();
  assert.ok(sample(6, 11.15, 0) > 0.1);
  assert.equal(sample(6, 10, 0), 0, "do not invent a horizontal ground datum");
  assert.equal(
    sample(6, 11.9, 0),
    0,
    "base exposure does not climb the full wall",
  );
  for (let x = -1; x < 13; x += 0.17)
    for (let y = 9; y < 21; y += 0.19) {
      const amount = sample(x, y, 0);
      assert.ok(Number.isFinite(amount) && amount >= 0 && amount <= 1);
    }
  const moved = mask({
    ...spec,
    datumY: 110,
    facades: [
      {
        ...spec.facades[0],
        start: [100, 200],
        end: [112, 200],
        groundY: [110, 112],
      },
    ],
  });
  assert.ok(
    Math.abs(sample(2, 13.8, 0) - moved(102, 113.8, 200)) < 1e-10,
    "world translation preserves architectural registration",
  );
});

test("mapped negative Howe coordinates generate executable weathering arithmetic", () => {
  const start = PACIFIC_COAST_RING[0],
    end = PACIFIC_COAST_RING[1];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const actual = { ...spec, facades: [{ ...spec.facades[0], start, end }] };
  const sample = mask(actual);
  const x = start[0] + (2 * (end[0] - start[0])) / length;
  const z = start[1] + (2 * (end[1] - start[1])) / length;
  assert.ok(
    sample(x, 13.8, z) > 0.1,
    "sill runoff evaluates on the real negative-Z facade",
  );
  assert.equal(sample(x, 14.3, z), 0);
  const negativeDatum = mask({
    ...actual,
    datumY: -10,
    facades: [{ ...actual.facades[0], groundY: [-10, -8] }],
  });
  assert.ok(Math.abs(negativeDatum(x, -6.2, z) - sample(x, 13.8, z)) < 1e-10);
});

test("hook retains base shader/maps/shadows and has material-specific cache identity", () => {
  const m = new T.MeshStandardMaterial({
      map: new T.Texture(),
      roughness: 0.8,
    }),
    originalMap = m.map;
  let previousCalled = false;
  m.onBeforeCompile = (shader) => {
    previousCalled = true;
    shader.fragmentShader += "\n// existing shader";
  };
  m.customProgramCacheKey = () => "previous-material";
  applyHoweMasonryWeathering(m, spec);
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  m.onBeforeCompile(
    shader as unknown as Parameters<T.Material["onBeforeCompile"]>[0],
    {} as T.WebGLRenderer,
  );
  assert.equal(previousCalled, true);
  assert.equal(m.map, originalMap);
  assert.ok(shader.fragmentShader.includes("// existing shader"));
  assert.ok(shader.fragmentShader.includes("#include <normal_fragment_maps>"));
  assert.ok(shader.fragmentShader.includes("#include <lights_fragment_begin>"));
  assert.ok(shader.vertexShader.includes("batchingMatrix*howeWeatherPosition"));
  assert.ok(shader.vertexShader.includes("instanceMatrix*howeWeatherPosition"));
  assert.ok(shader.vertexShader.includes("#include <shadowmap_vertex>"));
  assert.equal(m.transparent, false);
  assert.equal(m.emissive.getHex(), 0);
  assert.equal(
    m.userData.howeMasonryWeathering.staticChunkBatchEligible,
    false,
  );
  const other = applyHoweMasonryWeathering(new T.MeshStandardMaterial(), {
    ...spec,
    datumY: 11,
  });
  assert.notEqual(m.customProgramCacheKey(), other.customProgramCacheKey());
  assert.throws(() => applyHoweMasonryWeathering(m, spec), /already applied/);
  assert.throws(
    () =>
      applyHoweMasonryWeathering(new T.MeshStandardMaterial(), {
        ...spec,
        maxDarkening: 0.8,
      }),
    /restrained/,
  );
});
