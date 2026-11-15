import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SceneReflections } from "../src/rendering/reflection-probes";
import {
  CarStreetReflections,
  CAR_STREET_PROBES,
  CAR_STREET_REFLECTION_REGION,
  carStreetReflectionChunk,
} from "../src/rendering/car-street-reflections";
import {
  buildDetailedCarTemplate,
  cloneDetailedCar,
} from "../src/world/detailed-car";
import { attachCarLOD, updateCarLOD } from "../src/world/car-lod";
import type { VehicleModel } from "../src/world/vehicles";

async function raw(file: string) {
  const bytes = await readFile(`public/models/${file}.glb`),
    loader = new GLTFLoader();
  loader.register(() => ({
    name: "no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    )
  ).scene;
}
const assets = Promise.all([raw("car-concept"), raw("car-traffic")]).then(
  ([high, low]) => {
    const near = buildDetailedCarTemplate(high, () => new T.Texture());
    return {
      near,
      far: buildDetailedCarTemplate(low, () => new T.Texture(), near),
    };
  },
);
function fixture() {
  const scene = new T.Scene(),
    root = new T.Group(),
    sun = new T.DirectionalLight();
  scene.add(root, sun, sun.target);
  scene.environment = new T.Texture();
  scene.environmentRotation.set(0.1, 0.7, 0.2);
  scene.environmentIntensity = 0.8;
  const receivers = [
    new T.MeshPhysicalMaterial(),
    new T.MeshPhysicalMaterial(),
    new T.MeshPhysicalMaterial(),
  ];
  const reflections = new SceneReflections(scene, root, [], sun, [
    {
      name: CAR_STREET_PROBES[0],
      position: [478, 7, -466],
      materials: [receivers[0]],
      intensity: { day: 1, night: 0.9 },
    },
    {
      name: CAR_STREET_PROBES[1],
      position: [461, 3.5, -419],
      materials: [receivers[1]],
      intensity: { day: 1, night: 0.9 },
    },
    {
      name: "Forbidden tower capture",
      position: [478, 7, -466],
      materials: [receivers[2]],
    },
  ]);
  let target: T.WebGLRenderTarget | null = null,
    face = 0,
    mip = 0,
    cubeCalls = 0;
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: false },
    xr: { enabled: true },
    autoClear: true,
    getRenderTarget: () => target,
    getActiveCubeFace: () => face,
    getActiveMipmapLevel: () => mip,
    setRenderTarget: (t: T.WebGLRenderTarget | null, f = 0, m = 0) => {
      target = t;
      face = f;
      mip = m;
    },
  } as unknown as T.WebGLRenderer;
  for (const p of reflections.probes)
    p.camera.update = () => {
      cubeCalls++;
    };
  const capture = () => {
    for (let i = 0; i < 3; i++)
      reflections.update(renderer, new T.Vector3(478, 5, -450));
  };
  const outputs: T.WebGLRenderTarget[] = [],
    disposed: T.WebGLRenderTarget[] = [],
    sources: T.CubeTexture[] = [];
  const filter = (source: T.CubeTexture) => {
    sources.push(source);
    const target = new T.WebGLRenderTarget(384, 512, {
      type: T.HalfFloatType,
      depthBuffer: false,
    });
    target.texture.mapping = T.CubeUVReflectionMapping;
    target.addEventListener("dispose", () => disposed.push(target));
    outputs.push(target);
    return target;
  };
  return {
    scene,
    receivers,
    reflections,
    renderer,
    capture,
    outputs,
    disposed,
    sources,
    filter,
    cubeCalls: () => cubeCalls,
  };
}
function materials(model: VehicleModel) {
  const out = new Map<T.Mesh, T.Material | T.Material[]>();
  model.group.traverse((o) => {
    if (o instanceof T.Mesh) out.set(o, o.material);
  });
  return out;
}
function shaderFor(material: T.Material, renderer: T.WebGLRenderer) {
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.physical.vertexShader,
    fragmentShader: T.ShaderLib.physical.fragmentShader,
  } as Parameters<T.Material["onBeforeCompile"]>[0];
  material.onBeforeCompile(shader, renderer);
  return shader;
}

test("real car paint/glass and attached far body are isolated; no receivers, templates, geometry or captures change", async () => {
  const { near: template, far: farTemplate } = await assets,
    car = cloneDetailedCar(template),
    other = cloneDetailedCar(template);
  attachCarLOD(car, cloneDetailedCar(farTemplate), false);
  const before = materials(car),
    otherBefore = materials(other),
    templateBefore = new Map<T.Mesh, T.Material | T.Material[]>();
  template.traverse((o) => {
    if (o instanceof T.Mesh) templateBefore.set(o, o.material);
  });
  const geometry = new Map([...before].map(([mesh]) => [mesh, mesh.geometry]));
  const f = fixture();
  f.capture();
  const receiverMaps = f.receivers.map((m) => m.envMap),
    receiverIntensity = f.receivers.map((m) => m.envMapIntensity),
    specLists = f.reflections.probes.map((p) => p.spec.materials.slice());
  const sky = f.scene.environment,
    rotation = f.scene.environmentRotation.clone(),
    skyIntensity = f.scene.environmentIntensity;
  const helper = new CarStreetReflections(f.reflections, f.renderer, {
    filter: f.filter,
  });
  car.group.position.set(480, 5, -466);
  other.group.position.set(460, 3, -420);
  helper.update([car, other], 0.1);
  assert.equal(helper.snapshot(car), null, "candidate is opt-in");
  assert.equal(f.sources.length, 0);
  helper.setEnabled(true);
  const traverse = car.group.traverse.bind(car.group);
  let discoveries = 0;
  car.group.traverse = (callback) => {
    discoveries++;
    traverse(callback);
  };
  for (let i = 0; i < 120; i++) helper.update([car, other], 1 / 60);
  assert.ok(
    discoveries <= 5,
    `material discovery is bounded to 2Hz: ${discoveries}`,
  );
  let changed = 0,
    farChanged = 0;
  for (const [mesh, old] of before) {
    assert.equal(mesh.geometry, geometry.get(mesh));
    if (!(old instanceof T.MeshStandardMaterial)) continue;
    const current = mesh.material as T.MeshStandardMaterial;
    if (/^(Paint\s+[12]\b|Glass\b)/i.test(old.name)) {
      changed++;
      assert.notEqual(current, old);
      assert.equal(current.map, old.map);
      assert.equal(current.normalMap, old.normalMap);
      assert.deepEqual(current.color.toArray(), old.color.toArray());
      assert.equal(current.roughness, old.roughness);
      assert.equal(current.metalness, old.metalness);
      assert.equal(current.envMapIntensity, old.envMapIntensity);
      assert.equal(current.envMap, null);
      assert.deepEqual(current.envMapRotation.toArray(), [0, 0, 0, "XYZ"]);
      let p = mesh.parent;
      while (p) {
        if (p.name === "Distant source car") {
          farChanged++;
          break;
        }
        p = p.parent;
      }
    } else
      assert.equal(
        current,
        old,
        "tyres, wheels, lights and interior remain untouched",
      );
  }
  assert.equal(changed, 6);
  assert.equal(farChanged, 3);
  assert.equal(helper.snapshot(car)!.materialCount, 6);
  // Both cars bind independently; no clone is shared across vehicle records.
  const carMats = new Set([...materials(car).values()]);
  for (const [mesh, old] of otherBefore)
    if (mesh.material !== old) assert.ok(!carMats.has(mesh.material));
  for (const [mesh, material] of templateBefore)
    assert.equal(mesh.material, material);
  assert.deepEqual(
    f.reflections.probes.map((p) => p.spec.materials),
    specLists,
  );
  assert.deepEqual(
    f.receivers.map((m) => m.envMap),
    receiverMaps,
  );
  assert.deepEqual(
    f.receivers.map((m) => m.envMapIntensity),
    receiverIntensity,
  );
  assert.equal(f.scene.environment, sky);
  assert.deepEqual(f.scene.environmentRotation.toArray(), rotation.toArray());
  assert.equal(f.scene.environmentIntensity, skyIntensity);
  assert.equal(f.cubeCalls(), 3);
  assert.equal(f.reflections.captures, 3);
  assert.equal(helper.filterCount, 2);
  assert.deepEqual(
    new Set(f.sources),
    new Set(f.reflections.probes.slice(0, 2).map((p) => p.target.texture)),
  );
  updateCarLOD(car, 300, false);
  car.group.rotation.set(0.1, 2, 0.2);
  helper.update([car, other], 1 / 60);
  for (const [mesh, old] of before)
    if (mesh.material !== old)
      assert.deepEqual(
        (mesh.material as T.MeshStandardMaterial).envMapRotation.toArray(),
        [0, 0, 0, "XYZ"],
      );
  const paint = [...before].find(([mesh, old]) => mesh.material !== old)!;
  const shader = shaderFor(paint[0].material as T.Material, f.renderer);
  assert.ok(shader.uniforms.carStreetMapA.value === f.outputs[0].texture);
  assert.match(shader.fragmentShader, /carStreet_roughnessToMip/);
  assert.match(
    shader.fragmentShader,
    /envMapRotation \* reflectVec/,
    "native sky rotation is retained",
  );
  assert.doesNotMatch(
    shader.fragmentShader,
    /textureLod\( carStreet/,
    "local filtering uses PMREM rather than raw cube mips",
  );
  helper.dispose();
  for (const [mesh, old] of before) assert.equal(mesh.material, old);
  assert.equal(f.disposed.length, 2);
  f.reflections.dispose();
});

test("validity, failed recapture, low quality and disposal synchronously remove borrowed PMREMs and bindings", async () => {
  const { near } = await assets,
    car = cloneDetailedCar(near),
    before = materials(car),
    f = fixture();
  car.group.position.set(478, 5, -466);
  const helper = new CarStreetReflections(f.reflections, f.renderer, {
    enabled: true,
    filter: f.filter,
  });
  helper.update([car], 0.1);
  assert.equal(helper.snapshot(car), null);
  assert.equal(f.sources.length, 0);
  f.capture();
  for (let i = 0; i < 60; i++) helper.update([car], 1 / 60);
  const mesh = [...before.keys()].find((m) => m.material !== before.get(m))!;
  const shader = shaderFor(mesh.material as T.Material, f.renderer);
  assert.ok(shader.uniforms.carStreetMapA.value);
  assert.ok(
    helper.snapshot(car)!.weights[0] >
      0.8 * CAR_STREET_REFLECTION_REGION.maxLocalWeight,
  );
  f.reflections.invalidate();
  assert.equal(shader.uniforms.carStreetMapA.value, null);
  assert.deepEqual(
    (shader.uniforms.carStreetWeights.value as T.Vector2).toArray(),
    [0, 0],
  );
  assert.equal(f.disposed.length, 1);
  f.capture();
  helper.update([car], 0.1);
  assert.equal(helper.filterCount, 2);
  const probe = f.reflections.probes[0];
  probe.dirty = true;
  probe.camera.update = () => {
    throw new Error("driver failure");
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    f.reflections.update(f.renderer, new T.Vector3(478, 5, -466));
  } finally {
    console.warn = warn;
  }
  assert.equal(probe.dirty, false);
  assert.equal(probe.valid, false);
  assert.equal(f.reflections.currentTexture(CAR_STREET_PROBES[0]), null);
  assert.equal(shader.uniforms.carStreetMapA.value, null);
  assert.equal(f.disposed.length, 2);
  probe.camera.update = () => {};
  f.reflections.invalidate();
  f.capture();
  helper.update([car], 0.1);
  helper.setEnabled(false);
  assert.equal(f.disposed.length, 3);
  for (const [mesh, old] of before) assert.equal(mesh.material, old);
  helper.setEnabled(true);
  helper.update([car], 0.1);
  assert.equal(helper.filterCount, 4);
  f.reflections.dispose();
  assert.equal(f.disposed.length, 4);
  assert.deepEqual(helper.snapshot(car)!.weights, [0, 0]);
  const calls = f.cubeCalls();
  f.reflections.update(f.renderer, new T.Vector3());
  assert.equal(f.cubeCalls(), calls);
  helper.dispose();
  helper.dispose();
  assert.equal(f.disposed.length, 4);
});

test("driving transitions have bounded continuous weights, late LOD materials bind, and distant cars return to originals", async () => {
  const { near, far } = await assets,
    car = cloneDetailedCar(near),
    f = fixture();
  f.capture();
  const helper = new CarStreetReflections(f.reflections, f.renderer, {
    enabled: true,
    filter: f.filter,
  });
  car.group.position.set(478, 5, -466);
  for (let i = 0; i < 120; i++) helper.update([car], 1 / 60);
  attachCarLOD(car, cloneDetailedCar(far), false);
  for (let i = 0; i < 31; i++) helper.update([car], 1 / 60);
  assert.equal(helper.snapshot(car)!.materialCount, 6);
  let previous = helper.snapshot(car)!.weights,
    maxStep = 0;
  for (let i = 0; i <= 360; i++) {
    car.group.position.set(
      478 + ((461 - 478) * i) / 360,
      5 + ((3 - 5) * i) / 360,
      -466 + (47 * i) / 360,
    );
    helper.update([car], 1 / 60);
    const w = helper.snapshot(car)!.weights;
    assert.ok(
      w.every(
        (n) => n >= 0 && n <= CAR_STREET_REFLECTION_REGION.maxLocalWeight,
      ),
    );
    assert.ok(
      w[0] + w[1] <= CAR_STREET_REFLECTION_REGION.maxLocalWeight + 1e-12,
      "combined local fields always retain at least 60% native sky",
    );
    maxStep = Math.max(maxStep, ...w.map((v, j) => Math.abs(v - previous[j])));
    previous = w;
  }
  assert.ok(
    maxStep < 0.035 * CAR_STREET_REFLECTION_REGION.maxLocalWeight,
    `maximum one-frame transition ${maxStep}`,
  );
  assert.ok(previous[1] > 0.8 * CAR_STREET_REFLECTION_REGION.maxLocalWeight);
  car.group.position.set(0, 0, 0);
  helper.update([car], 1 / 60);
  assert.equal(helper.snapshot(car), null);
  assert.equal(f.cubeCalls(), 3);
  assert.equal(helper.filterCount, 2);
  helper.dispose();
  f.reflections.dispose();
});

test("PMREM failure keeps sky, restores renderer state and does not retry each frame", async () => {
  const { near } = await assets,
    car = cloneDetailedCar(near),
    f = fixture();
  f.capture();
  car.group.position.set(478, 5, -466);
  const saved = new T.WebGLRenderTarget(8, 8);
  f.renderer.setRenderTarget(saved, 3, 2);
  let calls = 0,
    disposed = 0;
  const helper = new CarStreetReflections(f.reflections, f.renderer, {
    enabled: true,
    filter: () => {
      calls++;
      const partial = new T.WebGLRenderTarget(384, 512);
      partial.addEventListener("dispose", () => disposed++);
      f.renderer.setRenderTarget(partial);
      f.renderer.xr.enabled = false;
      f.renderer.autoClear = false;
      throw new Error("filter failed");
    },
  });
  for (let i = 0; i < 5; i++) helper.update([car], 0.1);
  assert.equal(calls, 1);
  assert.equal(disposed, 1);
  assert.match(helper.lastFilterError!, /filter failed/);
  assert.equal(f.renderer.getRenderTarget(), saved);
  assert.equal(f.renderer.getActiveCubeFace(), 3);
  assert.equal(f.renderer.getActiveMipmapLevel(), 2);
  assert.equal(f.renderer.xr.enabled, true);
  assert.equal(f.renderer.autoClear, true);
  assert.deepEqual(helper.snapshot(car)!.weights, [0, 0]);
  assert.equal(helper.filterCount, 0);
  assert.equal(f.cubeCalls(), 3);
  helper.dispose();
  f.reflections.dispose();
  saved.dispose();
});

test("PMREM lookup uses independent atlas scale and keeps the original irradiance path", () => {
  const chunk = carStreetReflectionChunk();
  assert.match(chunk, /float carStreet_roughnessToMip\( float roughness \)/);
  assert.match(chunk, /\(1\.0 \/ 384\.0\)/);
  assert.match(chunk, /\(1\.0 \/ 512\.0\)/);
  assert.ok(chunk.includes("return PI * envMapColor.rgb * envMapIntensity;"));
  assert.ok(chunk.includes("getIBLAnisotropyRadiance"));
  assert.doesNotMatch(chunk, /samplerCube carStreet/);
});
