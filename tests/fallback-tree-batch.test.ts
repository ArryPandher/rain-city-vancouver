import { ShadowCasterVolume } from "../src/rendering/shadow-caster-volume";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fallbackTreeBounds } from "../src/world/fallback-tree-batch";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  batchFallbackTrees,
  getFallbackTreeBatchController,
} from "../src/world/fallback-tree-batch";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { CollisionWorld } from "../src/world/collision";
import { ForestHabitat } from "../src/world/forest-habitat";
import { KX, ORIGIN, centroid, bounds } from "../src/world/data";
import {
  activeTreeBounds,
  installBroadleafVolumes,
  loadBroadleafVolumeMaterials,
  updateBroadleafDistance,
} from "../src/world/broadleaf-volume";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import shape from "../src/world/broadleaf-volume-data.json";
import { Terrain } from "../src/world/terrain";
import { sunOffset } from "../src/world/daylight";
import { ROBSON_MOUND_TREE_SITES } from "../src/world/robson-mound-trees";
async function fixture() {
  const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
  const d = read("public/data/vancouver.json");
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const b of d.buildings) b.pts = convert(b.pts);
  for (const a of d.areas) {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  }
  d.trees = convert(d.trees);
  d.ocean = d.ocean.map(convert);
  const e = read("public/data/vancouver-east.json"),
    ids = new Set(d.buildings.map((b: any) => b.id));
  const outside = (p: number[]) => {
    const [x, z] = centroid(p);
    return x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;
  };
  d.buildings.push(
    ...e.buildings.filter((b: any) => !ids.has(b.id) && outside(b.pts)),
  );
  d.areas.push(...e.areas.filter((a: any) => outside(a.pts)));
  d.ocean.push(...e.ocean);
  bounds.maxX = 8200;
  bounds.minZ = -5600;
  bounds.maxZ = 2200;
  d.roads = read("public/data/vancouver-roads.json").roads;
  d.publicTrees = read("public/data/vancouver-public-trees.json");
  const tags = read("public/data/vancouver-building-tags.json").buildings;
  for (const b of d.buildings)
    if (tags[b.id])
      Object.assign(b, tags[b.id], { levels: b.levels ?? tags[b.id].levels });
  const tb = fs.readFileSync("public/data/stanley-height.u16");
  d.terrain = new Terrain(
    read("public/data/stanley-terrain.json"),
    new Uint16Array(tb.buffer, tb.byteOffset, tb.byteLength / 2),
  );
  d.seawall = read("public/data/stanley-seawall.json");
  const collision = new CollisionWorld(d);
  collision.setCanadaPlaceCapabilities({
    loaded: true,
    concourse: true,
    entranceCanopy: true,
    groundStays: true,
    promenadeFixtures: true,
  });
  const materials = Object.create(Materials.prototype);
  materials.texture = () => new T.Texture();
  const w = Object.assign(Object.create(World.prototype), {
    root: new T.Group(),
    chunks: [],
    treeSamples: [],
    coniferSamples: [],
    data: d,
    materials,
    collision,
    forestHabitat: new ForestHabitat(d, collision),
    stats: {},
  });
  w.vegetation();
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  async function branches(path: string) {
    const doc = await io.read(path),
      parts: T.BufferGeometry[] = [],
      mats: T.Material[] = [],
      scene = new T.Group();
    for (const n of doc.getRoot().listNodes()) {
      const mesh = n.getMesh();
      if (!mesh) continue;
      for (const p of mesh.listPrimitives()) {
        const g = new T.BufferGeometry();
        for (const [key, name] of [
          ["POSITION", "position"],
          ["NORMAL", "normal"],
          ["TEXCOORD_0", "uv"],
        ]) {
          const a = p.getAttribute(key);
          if (a)
            g.setAttribute(
              name,
              new T.Float32BufferAttribute(a.getArray()!, a.getElementSize()),
            );
        }
        if (p.getIndices()) g.setIndex(Array.from(p.getIndices()!.getArray()!));
        g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
        scene.add(
          new T.Mesh(
            g.clone(),
            new T.MeshStandardMaterial({ name: p.getMaterial()?.getName() }),
          ),
        );
        g.translate(0, shape.rootOffset, 0);
        g.scale(1 / shape.height, 1 / shape.height, 1 / shape.height);
        parts.push(g);
        mats.push(
          new T.MeshStandardMaterial({ name: p.getMaterial()?.getName() }),
        );
      }
    }
    const geometry = mergeGeometries(parts, true)!;
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius += 0.08;
    return { geometry, mats, scene };
  }
  const high = await branches(
      "public/models/vancouver-street-tree-branches.glb",
    ),
    low = await branches(
      "public/models/vancouver-street-tree-branches-distant.glb",
    );
  // Keep production loader assembly and ALL shader callbacks. Only transport /
  // browser image decoding is stubbed; local branch GLBs above are real assets.
  const textureLoad = T.TextureLoader.prototype.loadAsync,
    modelLoad = GLTFLoader.prototype.loadAsync;
  T.TextureLoader.prototype.loadAsync = async () => new T.Texture();
  GLTFLoader.prototype.loadAsync = async (url) =>
    ({
      scene: String(url).includes("-distant") ? low.scene : high.scene,
    }) as any;
  try {
    const materials = await loadBroadleafVolumeMaterials();
    const originalShader = {
      uniforms: {},
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    };
    materials.material.onBeforeCompile(originalShader as any, {} as any);
    assert.match(
      originalShader.vertexShader,
      /treeWorld=modelMatrix\*instanceMatrix/,
    );
    assert.match(
      originalShader.vertexShader,
      /treeInstance=mat3\(instanceMatrix\)/,
    );
    installBroadleafVolumes(w.treeSamples, materials);
  } finally {
    T.TextureLoader.prototype.loadAsync = textureLoad;
    GLTFLoader.prototype.loadAsync = modelLoad;
  }

  return { w, collision };
}

test("actual mapped fallback trees preserve source payload and per-pass visibility with canonical restoration", async (t) => {
  const { w, collision } = await fixture();
  const profile = {
    camera: {
      position: [470.7373497939464, 9.57, -578.9551267171248],
      yaw: -0.652276602869884,
      pitch: -0.15,
    },
    player: [470.7373497939464, 7.88, -578.9551267171248],
  };
  const camera = new T.PerspectiveCamera(62, 723 / 670, 0.1, 10000);
  camera.position.fromArray(profile.camera.position);
  camera.lookAt(
    camera.position
      .clone()
      .add(
        new T.Vector3(
          Math.sin(profile.camera.yaw) * Math.cos(profile.camera.pitch),
          Math.sin(profile.camera.pitch),
          Math.cos(profile.camera.yaw) * Math.cos(profile.camera.pitch),
        ),
      ),
  );
  camera.updateMatrixWorld(true);
  const shadow = new T.OrthographicCamera(-80, 80, 80, -80, 1, 650),
    target = new T.Vector3(
      470,
      collision.groundHeight(profile.player[0], profile.player[2]),
      -578,
    );
  shadow.position.copy(target).add(sunOffset("day"));
  shadow.lookAt(target);
  shadow.updateMatrixWorld(true);
  w.root.updateMatrixWorld(true);
  const sources = [
    ...new Set(w.treeSamples.flatMap((t: any) => [t.crown, t.trunk])),
  ] as T.InstancedMesh[];
  const sf = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      shadow.projectionMatrix,
      shadow.matrixWorldInverse,
    ),
  );
  const sun = new T.DirectionalLight();
  sun.position.copy(shadow.position);
  sun.target.position.copy(target);
  const caster = new ShadowCasterVolume();
  sun.shadow.camera.copy(shadow);
  caster.update(sun);
  for (const s of sources) {
    const [x, z] = s.userData.center;
    const dist = Math.hypot(x - profile.player[0], z - profile.player[2]);
    s.visible = dist < 1400;
    updateBroadleafDistance(s, dist);
    s.castShadow = caster.includes(s);
  }
  const originalParents = sources.map((s) => s.parent),
    originalGeometry = sources.map((s) => s.geometry);
  assert.deepEqual(batchFallbackTrees(w.root, w.treeSamples, false), []);
  assert.equal(getFallbackTreeBatchController(w.root), undefined);
  sources.forEach((s, i) => {
    assert.equal(s.parent, originalParents[i]);
    assert.equal(s.geometry, originalGeometry[i]);
  });
  const bf = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const total = (frustum: T.Frustum, shadow = false) =>
    sources.reduce(
      (n, s) =>
        n +
        (s.visible && (!shadow || s.castShadow) && frustum.intersectsObject(s)
          ? (s.count * s.geometry.index!.count) / 3
          : 0),
      0,
    );
  // The eight mapped Robson trees now have dedicated physical meshes, not
  // fallback instances. Account for their former per-cell submission explicitly.
  const dedicated = w.root.getObjectByName(
    "Robson mapped mature broadleaf trees",
  );
  assert.ok(dedicated);
  assert.equal(ROBSON_MOUND_TREE_SITES.length, 8);
  assert.deepEqual(
    [...dedicated.userData.robsonMoundTrees.sourceIds].sort(),
    ROBSON_MOUND_TREE_SITES.map((s) => s.osmId).sort(),
  );
  assert.equal(dedicated.userData.robsonMoundTrees.count, 8);
  for (const site of ROBSON_MOUND_TREE_SITES) {
    assert.ok(
      !w.treeSamples.some(
        (t: any) => Math.hypot(t.x - site.x, t.z - site.z) < 0.35,
      ),
      `dedicated source ${site.osmId} must not remain in the fallback payload`,
    );
  }
  const replacedCell = w.treeSamples.find(
    (t: any) => Math.floor(t.x / 192) === -1 && Math.floor(t.z / 192) === 0,
  );
  assert.ok(
    replacedCell,
    "remaining peers establish the original Robson cell LOD",
  );
  const replacedSources = [
    replacedCell.crown,
    replacedCell.trunk,
  ] as T.InstancedMesh[];
  const removedPayload = (frustum: T.Frustum, shadow = false) =>
    ROBSON_MOUND_TREE_SITES.reduce((sum, site) => {
      assert.equal(Math.floor(site.x / 192), -1);
      assert.equal(Math.floor(site.z / 192), 0);
      return (
        sum +
        replacedSources.reduce(
          (n, source) =>
            n +
            (source.visible &&
            (!shadow || source.castShadow) &&
            frustum.intersectsObject(source)
              ? source.geometry.index!.count / 3
              : 0),
          0,
        )
      );
    }, 0);
  assert.equal(
    removedPayload(bf),
    2848,
    "eight former crown/wood instances at this cell's current LOD",
  );
  assert.equal(
    removedPayload(sf, true),
    0,
    "Robson replacements are outside the Canada Place shadow camera",
  );
  const removedBeauty = removedPayload(bf);
  const expectedOriginalBeauty = 1536532 - removedBeauty;
  for (const site of ROBSON_MOUND_TREE_SITES)
    assert.ok(
      bf.containsPoint(
        new T.Vector3(site.x, collision.groundHeight(site.x, site.z), site.z),
      ),
      "each removed Robson source was also inside per-instance beauty coverage",
    );
  assert.equal(total(bf), expectedOriginalBeauty);
  assert.equal(total(sf, true) + removedPayload(sf, true), 335528);
  // Fault after the first group's buffers exist must leave the original path intact.
  const addGeometry = T.BatchedMesh.prototype.addGeometry;
  let adds = 0;
  T.BatchedMesh.prototype.addGeometry = function (...args) {
    if (++adds === 3) throw new Error("injected allocation failure");
    return addGeometry.apply(this, args);
  };
  try {
    assert.throws(
      () => batchFallbackTrees(w.root, w.treeSamples, true),
      /injected allocation failure/,
    );
  } finally {
    T.BatchedMesh.prototype.addGeometry = addGeometry;
  }
  assert.equal(
    w.root.children.filter((o: any) => o instanceof T.BatchedMesh).length,
    0,
  );
  sources.forEach((s, i) => {
    assert.equal(s.parent, originalParents[i]);
    assert.equal(s.geometry, originalGeometry[i]);
  });
  const setupStart = performance.now();
  const batches = batchFallbackTrees(w.root, w.treeSamples, true);
  const setupMs = performance.now() - setupStart;
  assert.equal(batches.length, 3);
  sources.forEach((s, i) => {
    assert.equal(s.parent, null);
    assert.equal(s.geometry, originalGeometry[i]);
  });
  function draw(cam: T.Camera, shadowPass = false) {
    let triangles = 0;
    for (const b of batches) {
      if (shadowPass)
        b.onBeforeShadow(
          {} as any,
          w.root as any,
          camera,
          cam,
          b.geometry,
          b.customDepthMaterial!,
          null as any,
        );
      else
        b.onBeforeRender(
          {} as any,
          w.root as any,
          cam,
          b.geometry,
          b.material as T.Material,
          null as any,
        );
      triangles +=
        Array.from((b as any)._multiDrawCounts as Uint32Array)
          .slice(0, (b as any)._multiDrawCount)
          .reduce((a, b) => a + b, 0) / 3;
    }
    return triangles;
  }
  const entryStart = performance.now();
  const beauty = draw(camera);
  const firstEntryMs = performance.now() - entryStart;
  const beautyIds = batches.map(
    (b) =>
      new Set(
        Array.from((b as any)._indirectTexture.image.data).slice(
          0,
          (b as any)._multiDrawCount,
        ),
      ),
  );
  const shade = draw(shadow, true);
  assert.ok(
    batches.some((b, i) =>
      Array.from((b as any)._indirectTexture.image.data)
        .slice(0, (b as any)._multiDrawCount)
        .some((id) => !beautyIds[i].has(id)),
    ),
    "off-camera trees continue casting valid shadows",
  );
  assert.equal(beauty + removedBeauty, 1163284);
  assert.equal(shade, 63240);
  assert.equal(
    draw(camera),
    beauty,
    "shadow pass must not poison next beauty visibility",
  );
  // The material's uniform fetch uses the same actual indirect ID table as matrices/colors.
  const crown = batches[0],
    shader = {
      uniforms: {},
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    };
  (crown.material as T.Material).onBeforeCompile(shader as any, {} as any);
  assert.match(shader.vertexShader, /uniform highp sampler2D fallbackTreeStem/);
  assert.match(shader.vertexShader, /getIndirectIndex\(gl_DrawID\)/);
  assert.doesNotMatch(shader.vertexShader, /attribute float treeStemScale/);
  assert.doesNotMatch(shader.vertexShader, /\binstanceMatrix\b/);
  assert.match(shader.vertexShader, /treeWorld=modelMatrix\*batchingMatrix/);
  assert.match(shader.vertexShader, /treeInstance=mat3\(batchingMatrix\)/);
  assert.match(shader.vertexShader, /vSliceNormalX=normalMatrix\*treeInstance/);
  assert.match(shader.fragmentShader, /viewDither/);
  assert.ok(
    (shader.uniforms as any).broadleafVolumeNormal.value instanceof T.Texture,
  );

  const stems = (shader.uniforms as any).fallbackTreeStem
    .value as T.DataTexture;
  const depthShader = {
    uniforms: {},
    vertexShader: T.ShaderLib.depth.vertexShader,
    fragmentShader: T.ShaderLib.depth.fragmentShader,
  };
  crown.customDepthMaterial!.onBeforeCompile(depthShader as any, {} as any);
  assert.doesNotMatch(depthShader.vertexShader, /\binstanceMatrix\b/);
  assert.match(
    depthShader.vertexShader,
    /treeWorld=modelMatrix\*batchingMatrix/,
  );
  assert.match(depthShader.fragmentShader, /viewDither/);

  assert.equal((depthShader.uniforms as any).fallbackTreeStem.value, stems);
  const firstMaterial = w.treeSamples[0].crown.material;
  const crownSources = sources.filter((s) => s.material === firstMaterial);
  let id = 0;
  const matrix = new T.Matrix4(),
    expected = new T.Matrix4(),
    color = new T.Color(),
    expectedColor = new T.Color();
  const selected = new Set<number>(
    Array.from((crown as any)._indirectTexture.image.data).slice(
      0,
      (crown as any)._multiDrawCount,
    ) as number[],
  );
  let chosen:
    | { source: T.InstancedMesh; index: number; id: number }
    | undefined;
  for (const source of crownSources)
    for (let i = 0; i < source.count; i++, id++)
      if (selected.has(id)) {
        crown.getMatrixAt(id, matrix);
        source.getMatrixAt(i, expected);
        assert.deepEqual(matrix.elements, expected.elements);
        crown.getColorAt(id, color);
        source.getColorAt(i, expectedColor);
        assert.deepEqual(color, expectedColor);
        assert.equal(
          stems.image.data![id],
          source.geometry.getAttribute("treeStemScale").getX(i),
        );
        if (source.geometry === source.userData.branchNearGeometry)
          chosen ??= { source, index: i, id };
      }
  assert.ok(chosen);
  const c = chosen!;
  c.source.getMatrixAt(c.index, expected);
  const saved = expected.clone();
  c.source.setMatrixAt(c.index, new T.Matrix4().makeScale(0, 0, 0));
  c.source.instanceMatrix.needsUpdate = true;
  activeTreeBounds(c.source);
  draw(camera);
  assert.equal(
    crown.getVisibleAt(c.id),
    false,
    "near-detail takeover hides exact canonical index",
  );
  c.source.setMatrixAt(c.index, saved);
  c.source.instanceMatrix.needsUpdate = true;
  activeTreeBounds(c.source);
  assert.equal(
    draw(camera),
    beauty,
    "canonical restoration is same-frame, no stale uploaded instance buffer",
  );
  const old = c.source.geometry;
  c.source.geometry = c.source.userData.branchFarGeometry;
  const far = draw(camera);
  assert.ok(
    far < beauty,
    "an unchanged visible camera must submit the new lower-LOD index count",
  );
  const indirect = Array.from((crown as any)._indirectTexture.image.data).slice(
    0,
    (crown as any)._multiDrawCount,
  );
  const drawIndex = indirect.indexOf(c.id);
  assert.ok(drawIndex >= 0);
  const range = crown.getGeometryRangeAt(crown.getGeometryIdAt(c.id))!;
  assert.equal((crown as any)._multiDrawCounts[drawIndex], range.indexCount);
  assert.equal(
    (crown as any)._multiDrawStarts[drawIndex],
    range.indexStart * crown.geometry.index!.array.BYTES_PER_ELEMENT,
  );
  c.source.geometry = old;
  assert.equal(draw(camera), beauty);
  // Parent transformations change the tested frustum, not the preserved instance matrices.
  w.root.position.x = 100000;
  w.root.updateMatrixWorld(true);
  assert.equal(draw(camera), 0);
  w.root.position.x = 0;
  w.root.updateMatrixWorld(true);
  assert.equal(draw(camera), beauty);
  // Every copied attribute and selected material index is source-derived; no
  // duplicate geometry per instance and no UV/color/normal mutation.
  for (const b of batches) {
    const materialName = (b.material as T.Material).name;
    const original = sources.find((s) =>
      [s.material].flat().some((m) => m.name === materialName),
    )!;
    const slot = [original.material]
      .flat()
      .findIndex((m) => m.name === materialName);
    for (const [id, g] of [
      original.userData.branchNearGeometry,
      original.userData.branchFarGeometry,
    ].entries()) {
      const range = b.getGeometryRangeAt(id)!;
      for (const [name, a] of Object.entries(g.attributes) as [
        string,
        T.BufferAttribute,
      ][]) {
        if (name === "treeStemScale") continue;
        const packed = b.geometry.getAttribute(name);
        assert.deepEqual(
          Array.from(
            packed.array.slice(
              range.vertexStart * a.itemSize,
              (range.vertexStart + a.count) * a.itemSize,
            ),
          ),
          Array.from(a.array),
        );
      }
      const expected: number[] = [];
      for (const group of g.groups.length
        ? g.groups
        : [{ start: 0, count: g.index.count, materialIndex: slot }])
        if (group.materialIndex === slot)
          for (let j = group.start; j < group.start + group.count; j++)
            expected.push(g.index.getX(j));
      assert.deepEqual(
        Array.from(
          b.geometry.index!.array.slice(
            range.indexStart,
            range.indexStart + range.indexCount,
          ),
          (v) => v - range.vertexStart,
        ),
        expected,
      );
    }
  }
  const controller = getFallbackTreeBatchController(w.root)!;
  assert.equal(controller.enabled, true);
  const retained = sources.map((source) => ({
    geometry: source.geometry,
    material: source.material,
    visible: source.visible,
    shadow: source.castShadow,
    matrix: source.instanceMatrix,
  }));
  const passBefore = batches.map((batch) => ({
    ...batch.userData.fallbackTreePass,
  }));
  controller.setEnabled(false);
  controller.setEnabled(false);
  assert.equal(controller.enabled, false);
  for (const [i, source] of sources.entries()) {
    assert.equal(source.parent, w.root);
    assert.equal(source.geometry, retained[i].geometry);
    assert.equal(source.material, retained[i].material);
    assert.equal(source.visible, retained[i].visible);
    assert.equal(source.castShadow, retained[i].shadow);
    assert.equal(source.instanceMatrix, retained[i].matrix);
  }
  for (const [i, batch] of batches.entries()) {
    assert.equal(batch.parent, null);
    batch.onBeforeRender(
      {} as any,
      w.root as any,
      camera,
      batch.geometry,
      batch.material as T.Material,
      null as any,
    );
    batch.onBeforeShadow(
      {} as any,
      w.root as any,
      camera,
      shadow,
      batch.geometry,
      batch.customDepthMaterial!,
      null as any,
    );
    assert.deepEqual(
      batch.userData.fallbackTreePass,
      passBefore[i],
      "disabled hooks perform no culling or draw-list work",
    );
  }
  assert.equal(
    total(bf),
    expectedOriginalBeauty,
    "original draw path is restored without changing selected LOD or population",
  );
  // A real canonical update while off must reach batching immediately on re-enable.
  c.source.setMatrixAt(c.index, new T.Matrix4().makeScale(0, 0, 0));
  c.source.instanceMatrix.needsUpdate = true;
  controller.setEnabled(true);
  controller.setEnabled(true);
  for (const source of sources) assert.equal(source.parent, null);
  for (const batch of batches) assert.equal(batch.parent, w.root);
  draw(camera);
  assert.equal(crown.getVisibleAt(c.id), false);
  c.source.setMatrixAt(c.index, saved);
  c.source.instanceMatrix.needsUpdate = true;
  assert.equal(draw(camera), beauty);
  const warmStart = performance.now();
  for (let i = 0; i < 10; i++) {
    for (const b of batches) {
      b.onBeforeRender(
        {} as any,
        w.root as any,
        camera,
        b.geometry,
        b.material as T.Material,
        null as any,
      );
      b.onBeforeShadow(
        {} as any,
        w.root as any,
        camera,
        shadow,
        b.geometry,
        b.customDepthMaterial!,
        null as any,
      );
    }
  }
  const warmMeanMs = (performance.now() - warmStart) / 10;
  t.diagnostic(
    JSON.stringify({
      beauty,
      shade,
      warmMeanMs,
      setupMs,
      firstEntryMs,
      memory: batches[0].userData.fallbackTreeMemory,
    }),
  );
  for (const b of batches) b.dispose();
});

test("stem bounds contain shader-deformed vertices at both clamp extremes", () => {
  const g = new T.BufferGeometry().setAttribute(
    "position",
    new T.Float32BufferAttribute([-1, 0.1, 2, 2, 0.3, -1, 1, 0.6, 3], 3),
  );
  for (const stem of [0.08, 1, 3.5]) {
    const box = fallbackTreeBounds(g, stem);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i),
        t = Math.max(0, Math.min(1, (y - 0.15) / 0.35)),
        s = stem + (1 - stem) * t * t * (3 - 2 * t);
      assert.ok(
        box.containsPoint(new T.Vector3(p.getX(i) * s, y, p.getZ(i) * s)),
      );
    }
  }
});
