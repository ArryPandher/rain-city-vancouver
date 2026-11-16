import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { trafficCarExteriorSource } from "../src/world/traffic-car-lod";
import {
  buildDetailedCarTemplate,
  cloneDetailedCar,
  loadDetailedCar,
  detailedCar,
  attachDetailedCarLOD,
} from "../src/world/detailed-car";
import { attachCarLOD, updateCarLOD, syncCarLOD } from "../src/world/car-lod";
import { batchCarWheels } from "../src/world/wheel-batching";
import { Actors } from "../src/game/actors";
async function load(file: string) {
  const b = await readFile(`public/models/${file}.glb`),
    loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({
    name: "no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  return (
    await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      "",
    )
  ).scene;
}
const source = load("car-traffic");
function meshes(root: T.Object3D) {
  const out: T.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh) out.push(o);
  });
  return out;
}
function cost(root: T.Object3D) {
  let triangles = 0,
    draws = 0;
  root.traverseVisible((o) => {
    if (o instanceof T.Mesh) {
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      draws++;
    }
  });
  return { triangles, draws };
}
function templates(raw: T.Group) {
  const near = buildDetailedCarTemplate(raw.clone(true), () => new T.Texture());
  return {
    near,
    far: buildDetailedCarTemplate(
      trafficCarExteriorSource(raw),
      () => new T.Texture(),
      near,
    ),
  };
}

test("real traffic subset preserves exterior and wheel surfaces in the exact near frame without source mutation", async () => {
  const raw = await source,
    original = meshes(raw),
    subset = trafficCarExteriorSource(raw),
    kept = meshes(subset);
  assert.equal(meshes(raw).length, original.length);
  assert.ok(kept.length < original.length);
  for (const mesh of kept) {
    const old = original.find((o) => o.name === mesh.name)!;
    assert.ok(old);
    assert.equal(mesh.geometry, old.geometry);
    assert.equal(mesh.material, old.material);
  }
  const { near, far } = templates(raw);
  assert.deepEqual(
    new T.Box3().setFromObject(near),
    new T.Box3().setFromObject(far),
    "complete retained outer envelope is exact",
  );
  assert.deepEqual(
    far.userData.sourceNormalization,
    near.userData.sourceNormalization,
  );
  for (const name of [
    "WheelFrontL",
    "WheelFrontR",
    "WheelRearL",
    "WheelRearR",
  ]) {
    const a = near.getObjectByName(name)!,
      b = far.getObjectByName(name)!;
    assert.deepEqual(a.position, b.position);
    assert.deepEqual(
      a.userData.sourceWheelNeutral,
      b.userData.sourceWheelNeutral,
    );
    assert.equal(
      near.getObjectByName(name + "Spin")!.userData.rollingRadius,
      far.getObjectByName(name + "Spin")!.userData.rollingRadius,
    );
    const remaining = meshes(b);
    assert.equal(remaining.length, 4);
    assert.deepEqual(
      remaining.map((m) => (m.material as T.Material).name).sort(),
      ["Disc", "Rim2", "Tireside", "Tiretread"],
    );
    for (const m of remaining) {
      const old = meshes(a).find((o) => o.name === m.name)!;
      for (const key of Object.keys(m.geometry.attributes))
        assert.deepEqual(
          m.geometry.getAttribute(key).array,
          old.geometry.getAttribute(key).array,
        );
      assert.deepEqual(m.geometry.index!.array, old.geometry.index!.array);
    }
  }
  for (const key of [
    "Glass",
    "Paint 1 Carmine",
    "Paint 2 Carmine",
    "Mirror",
    "Headlight",
    "Brakelight",
  ]) {
    const a = meshes(near).find(
        (m) => (m.material as T.Material).name === key,
      )!,
      b = meshes(far).find((m) => (m.material as T.Material).name === key)!;
    assert.deepEqual(
      b.geometry.attributes.position.array,
      a.geometry.attributes.position.array,
    );
    assert.deepEqual(b.geometry.index!.array, a.geometry.index!.array);
  }
  const glass = meshes(near).find(
    (m) => (m.material as T.Material).name === "Glass",
  )!.material as T.MeshPhysicalMaterial;
  assert.equal(glass.transparent, false);
  assert.equal(glass.opacity, 1);
  assert.equal(
    glass.transmission,
    0,
    "enclosed cabin is behind opaque glazing",
  );
});

test("batched and fallback real clones retain wheel silhouettes, animation, full driven quality and hysteresis", async (t) => {
  const { near: high, far: low } = templates(await source);
  for (const multiDraw of [false, true]) {
    const near = cloneDetailedCar(high),
      far = cloneDetailedCar(low),
      other = cloneDetailedCar(high);
    const originals = meshes(near.group).map((m) => ({
      m,
      g: m.geometry,
      p: m.geometry.attributes.position.array.slice(),
    }));
    batchCarWheels(near.group, multiDraw);
    const before = cost(near.group);
    assert.equal(before.triangles, 47077);
    attachCarLOD(near, far, multiDraw);
    updateCarLOD(near, 240, false);
    assert.deepEqual(cost(near.group), before);
    updateCarLOD(near, 241, false);
    const distant = cost(near.group);
    assert.equal(distant.triangles, 18810);
    assert.equal(distant.draws, multiDraw ? 14 : 26);
    assert.equal(
      cost(other.group).triangles,
      47077,
      "unrelated clone unchanged",
    );
    near.wheels.forEach((w, i) => (w.rotation.x = 2 + i * 0.3));
    near.front.forEach((w) => (w.rotation.y = 0.4));
    near.body.position.y = 0.007;
    near.body.rotation.z = 0.05;
    near.brakes.emissiveIntensity = 2;
    near.headlights.emissiveIntensity = 3;
    syncCarLOD(near);
    far.wheels.forEach((w, i) =>
      assert.deepEqual(w.rotation.toArray(), near.wheels[i].rotation.toArray()),
    );
    far.front.forEach((w, i) =>
      assert.deepEqual(w.rotation.toArray(), near.front[i].rotation.toArray()),
    );
    assert.deepEqual(far.body.position, near.body.position);
    assert.deepEqual(
      far.body.quaternion.toArray(),
      near.body.quaternion.toArray(),
    );
    assert.equal(far.brakes.emissiveIntensity, 2);
    assert.equal(far.headlights.emissiveIntensity, 3);
    updateCarLOD(near, 220, false);
    assert.deepEqual(cost(near.group), distant);
    updateCarLOD(near, 200, false);
    assert.deepEqual(cost(near.group), before);
    updateCarLOD(near, 616, false);
    updateCarLOD(near, 616, true);
    assert.deepEqual(cost(near.group), before);
    for (const { m, g, p } of originals) {
      assert.equal(m.geometry, g);
      assert.deepEqual(g.attributes.position.array, p);
    }
    t.diagnostic(
      `${multiDraw ? "multi-draw" : "fallback"} near ${JSON.stringify(before)} → far ${JSON.stringify(distant)}`,
    );
  }
});

test("actual default E30 loader and concept fallback install LOD on AI traffic through Actors, never the hero", async (t) => {
  const [traffic, e30, concept] = await Promise.all([
    source,
    load("e30-coupe"),
    load("car-concept"),
  ]);
  const doc = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillRect() {}, fillText() {} }),
      }),
    },
  });
  let failHero = false;
  const mock = t.mock.method(
    GLTFLoader.prototype,
    "loadAsync",
    async function (url: string) {
      if (url.endsWith("e30-coupe.glb") && failHero)
        throw new Error("test hero unavailable");
      return {
        scene: (url.endsWith("e30-coupe.glb")
          ? e30
          : url.endsWith("car-concept.glb")
            ? concept
            : traffic
        ).clone(true),
      } as any;
    },
  );
  t.mock.method(console, "warn", () => {});
  try {
    for (const fallback of [false, true]) {
      failHero = fallback;
      await loadDetailedCar(true);
      const actors = Object.assign(Object.create(Actors.prototype), {
        world: { scene: new T.Scene() },
        vehicles: [],
        wheelMultiDraw: true,
        groundHeight: () => 0,
        addShadow: () => {},
      }) as Actors;
      const car = actors.addVehicle("car", 0, 0, 0, true);
      const original = cost(car.model.group);
      assert.equal(original.triangles, 47077);
      updateCarLOD(car.model, 300, false);
      assert.equal(cost(car.model.group).triangles, 18810);
      updateCarLOD(car.model, 0, true);
      assert.deepEqual(cost(car.model.group), original);
      const hero = detailedCar(0x375f68, false, true)!;
      batchCarWheels(hero.group, true);
      attachDetailedCarLOD(hero, true);
      const full = cost(hero.group);
      updateCarLOD(hero, 500, true);
      assert.deepEqual(cost(hero.group), full);
      if (!fallback) {
        assert.equal(hero.group.userData.vehicleAsset, "e30-coupe");
        updateCarLOD(hero, 500, false);
        assert.deepEqual(
          cost(hero.group),
          full,
          "E30 has no mismatched concept far level",
        );
      } else {
        assert.equal(full.triangles, 185379);
        updateCarLOD(hero, 500, false);
        assert.equal(
          cost(hero.group).triangles,
          47077,
          "existing concept fallback LOD stays compatible",
        );
      }
    }
  } finally {
    mock.mock.restore();
    if (doc) Object.defineProperty(globalThis, "document", doc);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
