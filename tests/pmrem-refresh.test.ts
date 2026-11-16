import assert from "node:assert/strict";
import test from "node:test";
import * as T from "three";
import { installPmremRefreshCompatibility } from "../src/rendering/pmrem-refresh";

type Draw = {
  target: T.WebGLRenderTarget;
  viewport: number[];
  defines: Record<string, unknown>;
  input: T.Texture;
  roughness?: number;
};

/** Actual installed generator/geometry/shaders; only GL submission is replaced.
 * The rectangle trace detects writes into the sharp base atlas, not pixel color.
 */
function fixture() {
  assert.equal(installPmremRefreshCompatibility(), true);
  const previous = new T.WebGLRenderTarget(8, 8);
  let target = previous,
    face = 3,
    mip = 2;
  const draws: Draw[] = [];
  let failAt = Infinity;
  const renderer = {
    xr: { enabled: true },
    autoClear: true,
    getRenderTarget: () => target,
    getActiveCubeFace: () => face,
    getActiveMipmapLevel: () => mip,
    setRenderTarget: (next: T.WebGLRenderTarget, nextFace = 0, nextMip = 0) => {
      target = next;
      face = nextFace;
      mip = nextMip;
    },
    render: (mesh: T.Mesh) => {
      const material = mesh.material as T.ShaderMaterial;
      draws.push({
        target,
        viewport: target.viewport.toArray(),
        defines: { ...material.defines },
        input: material.uniforms.envMap.value,
        roughness: material.uniforms.roughness?.value,
      });
      if (draws.length === failAt)
        throw new Error("injected PMREM draw failure");
    },
  };
  const generator = new T.PMREMGenerator(
    renderer as unknown as T.WebGLRenderer,
  );
  const outputs = new Set<T.WebGLRenderTarget>();
  const allocated: T.WebGLRenderTarget[] = [];
  const disposals = new Map<object, number>();
  const watch = (object: T.EventDispatcher<any>) => {
    if (disposals.has(object)) return;
    disposals.set(object, 0);
    object.addEventListener("dispose", () =>
      disposals.set(object, disposals.get(object)! + 1),
    );
  };
  const internals = generator as any;
  const allocate = internals._allocateTargets;
  internals._allocateTargets = function () {
    const output = allocate.call(this);
    allocated.push(output);
    watch(output);
    watch(this._pingPongRenderTarget);
    watch(this._ggxMaterial);
    watch(this._blurMaterial);
    for (const mesh of this._lodMeshes) watch(mesh.geometry);
    return output;
  };
  function checkRestored() {
    assert.equal(target, previous);
    assert.equal(face, 3);
    assert.equal(mip, 2);
    assert.equal(renderer.xr.enabled, true);
    assert.equal(renderer.autoClear, true);
  }
  return {
    generator,
    internals,
    renderer,
    draws,
    allocated,
    disposals,
    outputs,
    checkRestored,
    failOnDraw: (n: number) => {
      failAt = n;
    },
    reset: () => {
      draws.length = 0;
      failAt = Infinity;
    },
    dispose: () => {
      outputs.forEach((output) => output.dispose());
      generator.dispose();
      previous.dispose();
    },
  };
}

function assertAtlas(
  f: ReturnType<typeof fixture>,
  size: number,
  output: T.WebGLRenderTarget,
  source: T.Texture,
) {
  const width = 3 * Math.max(size, 112),
    height = size * 4;
  assert.deepEqual([output.width, output.height], [width, height]);
  assert.equal(output.texture.mapping, T.CubeUVReflectionMapping);
  assert.equal(f.internals._cubeSize, size);
  assert.equal(f.internals._sizeLods[0], size);
  assert.equal(f.internals._pingPongRenderTarget.width, width);
  assert.equal(f.internals._pingPongRenderTarget.height, height);
  assert.equal(f.draws[0].target, output);
  assert.equal(f.draws[0].input, source);
  assert.deepEqual(f.draws[0].viewport, [0, 0, size * 3, size * 2]);
  assert.ok(f.draws.length > 2);
  for (const draw of f.draws.slice(1)) {
    assert.equal(Number(draw.defines.CUBEUV_MAX_MIP), Math.log2(size));
    assert.equal(draw.defines.CUBEUV_TEXEL_WIDTH, 1 / width);
    assert.equal(draw.defines.CUBEUV_TEXEL_HEIGHT, 1 / height);
    const [x, y, w, h] = draw.viewport;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0);
    assert.ok(x + w <= width && y + h <= height);
    // The entire sharp base survives every subsequent copy/filter draw.
    if (draw.target === output) assert.ok(y >= size * 2);
  }
  assert.deepEqual(f.draws[1].viewport, [0, size * 2, size * 1.5, size]);
  assert.deepEqual(output.viewport.toArray(), [0, 0, width, height]);
  assert.deepEqual(output.scissor.toArray(), [0, 0, width, height]);
  assert.equal(output.scissorTest, false);
  f.checkRestored();
}

test("adapter guards the audited revision/shape and installs only once", () => {
  const prototype = T.PMREMGenerator.prototype as any;
  const original = prototype._fromTexture;
  assert.equal(
    installPmremRefreshCompatibility({ revision: "183", prototype }),
    false,
  );
  assert.equal(
    installPmremRefreshCompatibility({ revision: "182", prototype: {} }),
    false,
  );
  assert.equal(prototype._fromTexture, original);
  assert.equal(installPmremRefreshCompatibility(), true);
  const installed = prototype._fromTexture;
  assert.equal(installPmremRefreshCompatibility(), true);
  assert.equal(prototype._fromTexture, installed);
});

for (const order of [
  [128, 256],
  [256, 128],
])
  test(`actual generator preserves mixed-size refreshed atlases in order ${order}`, () => {
    const f = fixture();
    const cubes = new Map(
      [128, 256, 512].map((size) => [size, new T.WebGLCubeRenderTarget(size)]),
    );
    const sky = new T.DataTexture(new Uint16Array(0), 2048, 1024);
    sky.mapping = T.EquirectangularReflectionMapping;
    const outputs = new Map<number, T.WebGLRenderTarget>();
    try {
      for (const [size, cube] of cubes) {
        f.reset();
        const output = f.generator.fromCubemap(cube.texture);
        outputs.set(size, output);
        f.outputs.add(output);
        assertAtlas(f, size, output, cube.texture);
      }
      // A real equirectangular input takes the same renderer-owned generator to512.
      f.reset();
      const skyOutput = f.generator.fromEquirectangular(sky);
      f.outputs.add(skyOutput);
      assertAtlas(f, 512, skyOutput, sky);
      for (const size of [...order, 512, ...order, 512]) {
        const source = cubes.get(size)!.texture,
          output = outputs.get(size)!;
        f.reset();
        assert.equal(f.generator.fromCubemap(source, output), output);
        assertAtlas(f, size, output, source);
        assert.equal(
          f.disposals.get(output),
          0,
          "caller output remains owned and live",
        );
        const count = f.allocated.length,
          scratch = f.internals._pingPongRenderTarget;
        f.reset();
        assert.equal(f.generator.fromCubemap(source, output), output);
        assertAtlas(f, size, output, source);
        assert.equal(
          f.allocated.length,
          count,
          "same-size reuse allocates nothing",
        );
        assert.equal(f.internals._pingPongRenderTarget, scratch);
      }
      f.reset();
      assert.equal(f.generator.fromEquirectangular(sky, skyOutput), skyOutput);
      assertAtlas(f, 512, skyOutput, sky);
      // Refraction cubes use the same size contract without losing their mapping.
      const source = cubes.get(128)!.texture;
      source.mapping = T.CubeRefractionMapping;
      f.reset();
      assert.equal(
        f.generator.fromCubemap(source, outputs.get(128)),
        outputs.get(128),
      );
      assertAtlas(f, 128, outputs.get(128)!, source);
      const scratch = f.internals._pingPongRenderTarget;
      for (const [object, disposed] of f.disposals) {
        if (
          f.outputs.has(object as T.WebGLRenderTarget) ||
          object === scratch ||
          object === f.internals._ggxMaterial ||
          object === f.internals._blurMaterial ||
          f.internals._lodMeshes.some(
            (mesh: T.Mesh) => mesh.geometry === object,
          )
        )
          assert.equal(disposed, 0);
        else
          assert.equal(
            disposed,
            1,
            "replaced scratch and unused outputs are disposed once",
          );
      }
    } finally {
      f.dispose();
      cubes.forEach((cube) => cube.dispose());
      sky.dispose();
    }
    for (const disposed of f.disposals.values()) assert.equal(disposed, 1);
  });

test("render failures restore state, keep caller outputs, dispose new outputs, and allow recovery", () => {
  const f = fixture(),
    small = new T.WebGLCubeRenderTarget(128),
    large = new T.WebGLCubeRenderTarget(256);
  try {
    const output = f.generator.fromCubemap(small.texture);
    f.outputs.add(output);
    const other = f.generator.fromCubemap(large.texture);
    f.outputs.add(other);
    output.viewport.set(2, 3, 20, 30);
    output.scissor.set(4, 5, 10, 15);
    output.scissorTest = true;
    f.reset();
    f.failOnDraw(2); // First GGX draw after autoClear becomes false.
    assert.throws(
      () => f.generator.fromCubemap(small.texture, output),
      /injected/,
    );
    f.checkRestored();
    assert.equal(f.disposals.get(output), 0);
    assert.deepEqual(output.viewport.toArray(), [2, 3, 20, 30]);
    assert.deepEqual(output.scissor.toArray(), [4, 5, 10, 15]);
    assert.equal(output.scissorTest, true);
    f.reset();
    assert.equal(f.generator.fromCubemap(small.texture, output), output);
    assertAtlas(f, 128, output, small.texture);
    f.reset();
    f.failOnDraw(3);
    assert.throws(() => f.generator.fromCubemap(large.texture), /injected/);
    f.checkRestored();
    assert.equal(
      f.disposals.get(f.allocated.at(-1)!),
      1,
      "failed newly allocated output is not retained",
    );
    f.reset();
    assert.equal(f.generator.fromCubemap(large.texture, other), other);
    assertAtlas(f, 256, other, large.texture);
    f.reset();
    assert.throws(
      () => f.generator.fromCubemap(large.texture, output),
      /does not match/,
    );
    assert.equal(f.draws.length, 0);
    f.checkRestored();
    assert.equal(f.disposals.get(output), 0);
  } finally {
    f.dispose();
    small.dispose();
    large.dispose();
  }
  for (const disposed of f.disposals.values()) assert.equal(disposed, 1);
});
