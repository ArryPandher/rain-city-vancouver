import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  buildE30CarTemplate,
  E30_MAX_STEERING,
  E30_WHEELS,
} from "../src/world/e30-car";
import { cloneDetailedCar } from "../src/world/detailed-car";
import { e30CarMaterial } from "../src/world/e30-car-materials";
import {
  batchCarWheels,
  syncCarWheelBatches,
} from "../src/world/wheel-batching";

const near = (a: number, b: number, tolerance = 2e-6) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const vectorNear = (a: T.Vector3, b: T.Vector3, tolerance = 2e-6) =>
  a.toArray().forEach((v, i) => near(v, b.toArray()[i], tolerance));
const loaded = (async () => {
  const data = await readFile("public/models/e30-coupe.glb");
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({
    name: "no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  const gltf = await loader.parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
})();
const meshes = (root: T.Object3D) => {
  const result: T.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof T.Mesh) result.push(node);
  });
  return result;
};
const sourceHubs: Record<string, number[]> = {
  WheelFrontL: [0.6972881555557251, 0.3106899559497833, 1.350250482559204],
  WheelFrontR: [-0.6972881555557251, 0.3106899559497833, 1.350250482559204],
  WheelRearL: [0.7094489336013794, 0.3106899559497833, -1.240863561630249],
  WheelRearR: [-0.7094489336013794, 0.3106899559497833, -1.240863561630249],
};

test("decoded E30 keeps every actual vertex/UV/index while neutralizing only the axle pose", async () => {
  const raw = await loaded,
    before = meshes(raw);
  const sourceCopies = before.map((m) => ({
    mesh: m,
    position: m.geometry.getAttribute("position").array.slice(),
    matrix: m.matrixWorld.clone(),
  }));
  assert.ok(
    before.some((m) => m.geometry.getAttribute("position").normalized),
    "exercise the real quantized source",
  );
  const root = buildE30CarTemplate(raw),
    output = meshes(root);
  assert.equal(before.length, 30);
  assert.equal(output.length, before.length);
  assert.equal(
    output.reduce((n, m) => n + m.geometry.index!.count / 3, 0),
    52728,
  );
  assert.equal(new Set(output.map((m) => m.material)).size, 15);
  const translation = new T.Vector3().fromArray(
    root.userData.e30SourceTranslation,
  );
  const p = new T.Vector3(),
    expected = new T.Vector3();
  for (const original of before) {
    const adapted = output.find((m) => m.name === original.name)!;
    assert.ok(adapted);
    assert.equal(
      (adapted.material as T.Material).name,
      (original.material as T.Material).name,
    );
    assert.notEqual(adapted.geometry, original.geometry);
    const attribute = original.geometry.getAttribute("position");
    const actual = adapted.geometry.getAttribute("position");
    assert.equal(actual.array.constructor, Float32Array);
    assert.equal(actual.normalized, false);
    assert.deepEqual(
      Array.from(adapted.geometry.index!.array),
      Array.from(original.geometry.index!.array),
    );
    const wheel = E30_WHEELS.find((name) =>
      adapted.parent?.name.startsWith(name),
    );
    const hub = wheel ? new T.Vector3().fromArray(sourceHubs[wheel]) : null;
    // Independently decode the audited quaternion's steering angle. Preserve
    // each primitive's full matrixWorld, including the nested logo rotations.
    const undoSteer = wheel?.includes("Front")
      ? -2 * Math.atan2(-0.24780961371772112, 0.9688087506567402)
      : 0;
    for (let i = 0; i < attribute.count; i++) {
      expected
        .fromBufferAttribute(attribute, i)
        .applyMatrix4(original.matrixWorld);
      if (hub)
        expected
          .sub(hub)
          .applyAxisAngle(new T.Vector3(0, 1, 0), undoSteer)
          .add(hub);
      expected.add(translation);
      p.fromBufferAttribute(actual, i).applyMatrix4(adapted.matrixWorld);
      vectorNear(p, expected);
    }
    for (const name of Object.keys(original.geometry.attributes).filter(
      (n) => !["position", "normal", "tangent"].includes(n),
    )) {
      const a = original.geometry.getAttribute(name),
        b = adapted.geometry.getAttribute(name);
      assert.equal(a.itemSize, b.itemSize);
      for (let i = 0; i < a.count; i++)
        for (let c = 0; c < a.itemSize; c++)
          near(a.getComponent(i, c), b.getComponent(i, c), 1e-8);
    }
    const normals = adapted.geometry.getAttribute("normal");
    for (let i = 0; i < normals.count; i++)
      near(
        Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)),
        1,
        2e-6,
      );
  }
  sourceCopies.forEach(({ mesh, position, matrix }) => {
    assert.deepEqual(mesh.geometry.getAttribute("position").array, position);
    assert.deepEqual(mesh.matrixWorld.elements, matrix.elements);
  });
});

test("metric body, +Z headlights and true hubs retain tyre contact through full revolutions", async () => {
  const root = buildE30CarTemplate(await loaded),
    bounds = new T.Box3().setFromObject(root, true);
  near(bounds.getSize(new T.Vector3()).z, 4.3620288372039795);
  near(bounds.getSize(new T.Vector3()).x, 1.7440394236948558);
  near(bounds.max.y, 1.3514500786286723);
  near(bounds.min.y, 0);
  assert.equal(root.userData.roadClearance, 0);
  assert.equal(
    root.userData.sourceNormalization,
    undefined,
    "must not opt into concept-car LOD",
  );
  assert.deepEqual(
    root.getObjectByName("car-body")!.position.toArray(),
    [0, 0, 0],
  );
  const lamps = meshes(root).find(
    (m) => (m.material as T.Material).name === "BMW_E30_M3_HEADLIGHT_REFLECTOR",
  )!;
  assert.ok(new T.Box3().setFromObject(lamps, true).min.z > 1.9);
  const offset = new T.Vector3().fromArray(root.userData.e30SourceTranslation);
  for (const name of E30_WHEELS) {
    const steer = root.getObjectByName(name)!,
      spin = root.getObjectByName(name + "Spin")!;
    vectorNear(
      steer.position,
      new T.Vector3().fromArray(sourceHubs[name]).add(offset),
    );
    assert.equal(spin.parent, steer);
    assert.equal(meshes(spin).length, 3, "rim, tyre and disc roll");
    assert.equal(
      steer.children.filter((c) => c instanceof T.Mesh).length,
      2,
      "caliper and its logo stay stationary",
    );
    const tyre = meshes(spin).find(
      (m) => (m.material as T.Material).name === "BMW_E30_M3_TIRE",
    )!;
    near(spin.userData.rollingRadius, 0.3116312712694932, 2e-6);
    const width = new T.Box3()
      .setFromBufferAttribute(
        tyre.geometry.getAttribute("position") as T.BufferAttribute,
      )
      .getSize(new T.Vector3()).x;
    near(
      width,
      name.includes("Front") ? 0.2500092387199402 : 0.2543456423405228,
    );
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2]) {
      spin.rotation.x = angle;
      root.updateMatrixWorld(true);
      near(new T.Box3().setFromObject(tyre, true).min.y, 0, 0.00005);
    }
  }
});

test("caliper and nested logo steer without spinning, while actual tyre/disc vertices roll", async () => {
  const root = buildE30CarTemplate(await loaded),
    steer = root.getObjectByName("WheelFrontL")!,
    spin = root.getObjectByName("WheelFrontLSpin")!;
  const stationary = steer.children.filter(
    (n): n is T.Mesh => n instanceof T.Mesh,
  );
  const points = stationary.map((m) =>
    new T.Vector3()
      .fromBufferAttribute(m.geometry.getAttribute("position"), 0)
      .applyMatrix4(m.matrixWorld),
  );
  const rolling = meshes(spin).map((m) => {
    const p = m.geometry.getAttribute("position");
    let index = 0;
    for (let i = 1; i < p.count; i++)
      if (
        Math.hypot(p.getY(i), p.getZ(i)) >
        Math.hypot(p.getY(index), p.getZ(index))
      )
        index = i;
    return {
      mesh: m,
      index,
      point: new T.Vector3()
        .fromBufferAttribute(p, index)
        .applyMatrix4(m.matrixWorld),
    };
  });
  spin.rotation.x = 1.2;
  root.updateMatrixWorld(true);
  stationary.forEach((m, i) =>
    vectorNear(
      new T.Vector3()
        .fromBufferAttribute(m.geometry.getAttribute("position"), 0)
        .applyMatrix4(m.matrixWorld),
      points[i],
    ),
  );
  rolling.forEach(({ mesh, index, point }) =>
    assert.ok(
      new T.Vector3()
        .fromBufferAttribute(mesh.geometry.getAttribute("position"), index)
        .applyMatrix4(mesh.matrixWorld)
        .distanceTo(point) > 0.03,
    ),
  );
  steer.rotation.y = E30_MAX_STEERING;
  root.updateMatrixWorld(true);
  stationary.forEach((m, i) =>
    assert.ok(
      new T.Vector3()
        .fromBufferAttribute(m.geometry.getAttribute("position"), 0)
        .applyMatrix4(m.matrixWorld)
        .distanceTo(points[i]) > 0.02,
    ),
  );
});

test("contact metadata encloses decoded geometry over steering and spin, with actual axle ground samples", async () => {
  const root = buildE30CarTemplate(await loaded),
    f = root.userData.contactFootprint;
  assert.ok(
    f.halfWidth > 0.93 && f.halfWidth < 0.95,
    "neutral-only width would miss steering tyres",
  );
  near(f.halfLength, 4.3620288372039795 / 2);
  near(root.userData.wheelbase, 2.591114044189453);
  near(root.userData.groundSamples.front, 1.4091252088546753);
  near(root.userData.groundSamples.rear, -1.1819888353347778);
  near(root.userData.groundSamples.halfTrack, 0.7095277011394501);
  for (const steerAngle of [-E30_MAX_STEERING, -0.2, 0, 0.3, E30_MAX_STEERING])
    for (const roll of [0, 0.61, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      for (const name of E30_WHEELS) {
        root.getObjectByName(name)!.rotation.y = name.includes("Front")
          ? steerAngle
          : 0;
        root.getObjectByName(name + "Spin")!.rotation.x = roll;
      }
      root.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(root, true);
      assert.ok(
        b.min.x >= -f.halfWidth - 2e-6 && b.max.x <= f.halfWidth + 2e-6,
      );
      assert.ok(
        b.min.z >= -f.halfLength - 2e-6 && b.max.z <= f.halfLength + 2e-6,
      );
      assert.ok(b.max.y <= f.height + 2e-6 && b.min.y > -0.00005);
    }
});

test("material callback is cached per source and standard clones retain the wheel batching contract", async () => {
  const calls: string[] = [];
  const template = buildE30CarTemplate(await loaded, (source) => {
    calls.push(source.name);
    return source.clone();
  });
  assert.equal(calls.length, 15);
  assert.equal(new Set(calls).size, 15);
  const a = cloneDetailedCar(template),
    b = cloneDetailedCar(template);
  assert.equal(a.wheels.length, 4);
  assert.equal(a.front.length, 2);
  assert.equal(a.body.name, "car-body");
  a.wheels[0].rotation.x = 0.75;
  a.front[0].rotation.y = 0.3;
  near(b.wheels[0].rotation.x, 0);
  near(b.front[0].rotation.y, 0);
  assert.equal(batchCarWheels(a.group, false).length, 0);
  const original = meshes(a.group).reduce(
    (n, m) => n + m.geometry.index!.count / 3,
    0,
  );
  const batches = batchCarWheels(a.group, true);
  assert.equal(
    batches.length,
    4,
    "opaque rim, tyre, disc and caliper each share one four-wheel batch",
  );
  const logos = meshes(a.group).filter(
    (m) => (m.material as T.Material).name === "Logo_Plane",
  );
  assert.equal(
    logos.length,
    4,
    "source transparent logos retain their separate draws and stationary carriers",
  );
  logos.forEach((m) =>
    assert.ok(
      E30_WHEELS.includes(m.parent!.name as (typeof E30_WHEELS)[number]),
    ),
  );
  a.wheels.forEach((w) => {
    w.rotation.x += 0.2;
  });
  syncCarWheelBatches(a.group);
  const remaining = meshes(a.group)
    .filter((m) => !(m instanceof T.BatchedMesh))
    .reduce((n, m) => n + m.geometry.index!.count / 3, 0);
  assert.equal(
    remaining + batches.reduce((n, m) => n + m.geometry.index!.count / 3, 0),
    original,
  );
  assert.deepEqual(
    template.userData.contactFootprint,
    a.group.userData.contactFootprint,
  );
});

test("wrong source scenes fail without creating a partial vehicle", () => {
  assert.throws(() => buildE30CarTemplate(new T.Group()), /four audited tyre/);
});

test("actual E30 material adaptation retains PBR maps and gives each clone independent paint and lamp controls", async () => {
  const raw = await loaded;
  const byName = (root: T.Object3D) =>
    new Map(
      meshes(root).map((m) => {
        assert.ok(m.material instanceof T.MeshStandardMaterial);
        return [m.material.name, m.material] as const;
      }),
    );
  const source = byName(raw);
  const sourceStates = new Map(
    [...source].map(([name, m]) => [
      name,
      {
        color: m.color.toArray(),
        emission: m.emissive.toArray(),
        intensity: m.emissiveIntensity,
        transmission:
          m instanceof T.MeshPhysicalMaterial ? m.transmission : undefined,
      },
    ]),
  );
  const sourceLens = source.get("BMW_E30_M3_LENS")!;
  assert.ok(
    sourceLens instanceof T.MeshPhysicalMaterial && sourceLens.transmission > 0,
    "actual source must exercise transmission removal",
  );
  const template = buildE30CarTemplate(raw, e30CarMaterial),
    adapted = byName(template);
  const a = cloneDetailedCar(template, 0x8c273c),
    b = cloneDetailedCar(template, 0x245478);
  const first = byName(a.group),
    second = byName(b.group);
  assert.equal(adapted.size, 15);
  for (const [name, original] of source) {
    const material = adapted.get(name)!,
      am = first.get(name)!,
      bm = second.get(name)!;
    assert.notEqual(material, original);
    assert.notEqual(am, material);
    assert.notEqual(bm, material);
    assert.notEqual(am, bm);
    for (const slot of [
      "map",
      "normalMap",
      "roughnessMap",
      "metalnessMap",
      "aoMap",
      "emissiveMap",
    ] as const) {
      assert.equal(
        material[slot],
        original[slot],
        `${name}: retain source ${slot}`,
      );
      assert.equal(am[slot], original[slot]);
      assert.equal(bm[slot], original[slot]);
    }
    assert.deepEqual(
      material.normalScale.toArray(),
      original.normalScale.toArray(),
    );
    for (const candidate of [material, am, bm])
      if (candidate instanceof T.MeshPhysicalMaterial)
        assert.equal(
          candidate.transmission,
          0,
          `${name} must not enter Three's city transmission pass`,
        );
    const saved = sourceStates.get(name)!;
    assert.deepEqual(original.color.toArray(), saved.color);
    assert.deepEqual(original.emissive.toArray(), saved.emission);
    assert.equal(original.emissiveIntensity, saved.intensity);
    if (original instanceof T.MeshPhysicalMaterial)
      assert.equal(original.transmission, saved.transmission);
  }
  for (const name of [
    "BMW_E30_M3_RIM",
    "BMW_E30_M3_TIRE",
    "Brake_Disc",
    "Brembo_Calipers",
  ]) {
    const material = source.get(name)!;
    assert.ok(
      material.map &&
        material.normalMap &&
        material.roughnessMap &&
        material.metalnessMap,
      `${name} has actual authored wheel PBR maps, not a vacuous null comparison`,
    );
  }
  const paint = first.get("BMW_E30_M3_PAINT")!;
  assert.equal(paint.userData.vehicleRole, "paint");
  assert.equal(paint.color.getHex(), 0x8c273c);
  assert.equal(second.get(paint.name)!.color.getHex(), 0x245478);
  assert.equal(a.brakes, first.get("BMW_E30_M3_TAILLIGHT_REFLECTOR"));
  assert.equal(a.headlights, first.get("BMW_E30_M3_HEADLIGHT_REFLECTOR"));
  assert.equal(a.brakes.userData.vehicleRole, "brakes");
  assert.equal(a.headlights.userData.vehicleRole, "headlights");
  assert.ok(
    a.brakes.emissiveMap,
    "source coloured rear emission remains available",
  );
  a.brakes.emissiveIntensity = 4;
  a.headlights.emissiveIntensity = 3;
  assert.equal(first.get(a.brakes.name)!.emissiveIntensity, 4);
  assert.equal(first.get(a.headlights.name)!.emissiveIntensity, 3);
  assert.equal(b.brakes.emissiveIntensity, 0.35);
  assert.equal(b.headlights.emissiveIntensity, 0.2);
  assert.equal(adapted.get(a.brakes.name)!.emissiveIntensity, 0.35);
  assert.equal(adapted.get(a.headlights.name)!.emissiveIntensity, 0.2);
  const windows = first.get("BMW_E30_M3_WINDOWS")!,
    lens = first.get("BMW_E30_M3_LENS")!;
  assert.equal(windows.userData.vehicleRole, "glass");
  assert.equal(windows.transparent, true);
  assert.equal(lens.transparent, true);
  assert.equal(windows.depthWrite, false);
  assert.equal(lens.depthWrite, false);
});
