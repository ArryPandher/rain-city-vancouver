import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { World } from "../src/world/world";
import {
  createNorthShoreDemGroup,
  NORTH_SHORE_DEM_PROFILE as profile,
} from "../src/world/north-shore-dem";

test("World.mountains keeps default photo and requires both debug and terrain=dem for direct-root terrain", () => {
  const originalLocation = Object.getOwnPropertyDescriptor(
    globalThis,
    "location",
  );
  const originalLoad = T.TextureLoader.prototype.load;
  const urls: string[] = [];
  T.TextureLoader.prototype.load = function (url) {
    urls.push(url);
    return new T.Texture();
  };
  try {
    for (const search of [
      "",
      "?terrain=dem",
      "?debug",
      "?debug&terrain=photo",
      "?debug&terrain=DEM",
      "?debug&terrain=dem",
    ]) {
      Object.defineProperty(globalThis, "location", {
        value: { search },
        configurable: true,
      });
      urls.length = 0;
      const scene = new T.Scene();
      scene.fog = new T.FogExp2(0xabcdef, 0.00015);
      const world = Object.assign(Object.create(World.prototype), {
        root: new T.Group(),
        chunks: [],
        scene,
      });
      const fog = scene.fog;
      world.mountains();
      assert.equal(world.root.children.length, 1);
      assert.equal(world.chunks.length, 0);
      assert.equal(scene.fog, fog);
      assert.equal(fog.density, 0.00015);
      const child = world.root.children[0];
      if (search === "?debug&terrain=dem") {
        assert.equal(
          urls.length,
          1,
          "one local satellite colour map, no overlapping photographic plane",
        );
        assert.ok(
          urls[0].endsWith("textures/north-shore-dem/dnv-2013.webp"),
        );
        assert.equal(world.northShore, undefined);
        const diagnostic = world.northShoreDiagnostics();
        assert.equal(diagnostic.mode, "dem");
        assert.equal(diagnostic.groupName, child.name);
        assert.equal(diagnostic.meshCount, 28);
        assert.equal(diagnostic.imageryStatus, "loading");
        assert.equal(diagnostic.material.type, "MeshStandardMaterial");
        assert.equal(diagnostic.texture, null);
        assert.equal(child.children.length, 28);
        assert.ok(
          child.children.every(
            (m: T.Mesh) => m.userData.visualTerrainOnly && m.frustumCulled,
          ),
        );
      } else {
        assert.equal(urls.length, 1);
        assert.ok(urls[0].endsWith("textures/vancouver/north-shore-ridge.webp?v=ridge-20261116"));
        assert.equal(child.name, "Photographic North Shore mountain horizon");
        assert.deepEqual(child.position.toArray(), [400, 480, -7000]);
        assert.equal(
          (child.geometry as T.PlaneGeometry).parameters.width,
          24000,
        );
        assert.equal(
          (child.geometry as T.PlaneGeometry).parameters.height,
          1977,
        );
        assert.equal(child.material, world.northShore);
        assert.equal(world.northShore.fog, false);
        const diagnostic = world.northShoreDiagnostics();
        assert.equal(diagnostic.mode, "photo");
        assert.equal(diagnostic.meshCount, 1);
        assert.equal(
          diagnostic.material.name,
          "North Shore photographic horizon",
        );
        assert.equal(
          diagnostic.material.mapName,
          "North Shore Selmo panorama — source-guided ridge mask",
        );
      }
    }
  } finally {
    T.TextureLoader.prototype.load = originalLoad;
    if (originalLocation)
      Object.defineProperty(globalThis, "location", originalLocation);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

test("DEM material scales only standard fog depth and keeps physical lighting and shared weather uniforms", () => {
  const originalChunk = T.ShaderChunk.fog_fragment;
  const group = createNorthShoreDemGroup();
  const materials = new Set(group.children.map((m) => (m as T.Mesh).material));
  assert.equal(materials.size, 1);
  const material = [...materials][0] as T.MeshStandardMaterial;
  assert.equal(material.fog, true);
  assert.equal(material.vertexColors, true);
  assert.equal(material.type, "MeshStandardMaterial");
  assert.equal(material.emissive.getHex(), 0);
  const uniforms = {
    fogDensity: { value: 0.00015 },
    fogColor: { value: new T.Color(0xabcdef) },
  };
  const shader = {
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    vertexShader: T.ShaderLib.standard.vertexShader,
    uniforms,
  };
  assert.ok(shader.fragmentShader.includes("#include <fog_fragment>"));
  const originalVertex = shader.vertexShader;
  material.onBeforeCompile(
    // This hook only reads shader sources; no renderer/program state is exercised.
    shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
    {} as T.WebGLRenderer,
  );
  assert.equal(shader.vertexShader, originalVertex);
  assert.equal(shader.uniforms, uniforms);
  assert.equal(uniforms.fogDensity.value, 0.00015);
  assert.equal(T.ShaderChunk.fog_fragment, originalChunk);
  const expected = originalChunk.replaceAll("vFogDepth", "(vFogDepth * 0.35)");
  assert.ok(shader.fragmentShader.includes(expected));
  assert.ok(!shader.fragmentShader.includes("#include <fog_fragment>"));
  assert.ok(shader.fragmentShader.includes("#include <lights_fragment_begin>"));
  assert.ok(material.customProgramCacheKey().includes("0.35"));
  // EXP2 depth scaling is equivalent to scaling the active scene density;
  // weather remains dynamic through Three's original fog uniforms.
  assert.equal(profile.fogDepthScale, 0.35);
  for (const density of [0.00015, 0.00023, 0.00055, 0.0006]) {
    const distance = 10000;
    const scaledDepth = density * density * (distance * 0.35) ** 2;
    const scaledDensity = (density * 0.35) ** 2 * distance * distance;
    assert.ok(Math.abs(scaledDepth - scaledDensity) < 1e-12);
  }
});
