import * as T from "three";
import { carBodyGeometry } from "./car-body-geometry";
import { tyreRadius, wheelFrame } from "./vehicle-wheels";

export const E30_MAX_STEERING = 0.53;
export const E30_WHEELS = [
  "WheelFrontL",
  "WheelFrontR",
  "WheelRearL",
  "WheelRearR",
] as const;
type WheelName = (typeof E30_WHEELS)[number];
type Hub = { name: WheelName; frame: ReturnType<typeof wheelFrame> };

/** Quantized glTF positions are normalized Int16 values. Baking metre-space
 * transforms back into those integers would wrap coordinates outside [-1,1].
 * Expand the transformed attributes first; preserve all source UVs and indices. */
function bake(source: T.BufferGeometry, matrix: T.Matrix4) {
  const expanded = source.clone();
  for (const name of ["position", "normal", "tangent"]) {
    const attribute = source.getAttribute(name);
    if (!attribute) continue;
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++)
      for (let c = 0; c < attribute.itemSize; c++)
        values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
    expanded.setAttribute(
      name,
      new T.Float32BufferAttribute(values, attribute.itemSize),
    );
  }
  const result = carBodyGeometry(expanded, matrix);
  expanded.dispose();
  return result;
}

function wheelBranch(mesh: T.Object3D) {
  for (let node: T.Object3D | null = mesh.parent; node; node = node.parent)
    if (/^(BMW_E30_M3_(RIM|TIRE)|Brake_disc|Brembo_Calipers)/.test(node.name))
      return node;
  return null;
}

/** Maximum a*cos(t)+b*sin(t), where b>=0 and 0<=t<=limit. */
function maximum(a: number, b: number, limit: number) {
  const turningPoint = Math.atan2(b, a);
  return Math.max(
    a,
    a * Math.cos(limit) + b * Math.sin(limit),
    turningPoint > 0 && turningPoint < limit ? Math.hypot(a, b) : -Infinity,
  );
}

/** Exact vertex support over arbitrary wheel roll and bounded steering.
 * The body stays fixed; calipers/logos have steering only, never axle roll. */
function contactEnvelope(root: T.Group, body: T.Group) {
  const bounds = new T.Box3().setFromObject(body, true);
  for (const name of E30_WHEELS) {
    const steer = root.getObjectByName(name)!;
    const spin = root.getObjectByName(name + "Spin")!;
    const angle = name.includes("Front") ? E30_MAX_STEERING : 0;
    steer.traverse((node) => {
      if (!(node instanceof T.Mesh)) return;
      const rolling = node.parent === spin;
      const p = node.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        // With free roll, z spans [-r,r]. For stationary parts the union of
        // positive and negative steer uses abs(z) for each directional support.
        const r = rolling ? Math.hypot(y, z) : Math.abs(z);
        bounds.min.x = Math.min(
          bounds.min.x,
          steer.position.x - maximum(-x, r, angle),
        );
        bounds.max.x = Math.max(
          bounds.max.x,
          steer.position.x + maximum(x, r, angle),
        );
        bounds.min.z = Math.min(
          bounds.min.z,
          steer.position.z - maximum(rolling ? r : -z, Math.abs(x), angle),
        );
        bounds.max.z = Math.max(
          bounds.max.z,
          steer.position.z + maximum(rolling ? r : z, Math.abs(x), angle),
        );
        bounds.max.y = Math.max(
          bounds.max.y,
          steer.position.y + (rolling ? r : y),
        );
      }
    });
  }
  return {
    halfWidth: Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
    halfLength: Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
    height: bounds.max.y,
  };
}

/** Adapter for the audited Martin Trafas E30 meshopt derivative. The caller
 * decodes the GLB and owns material calibration; source material names survive.
 * All transforms are baked without changing metric scale or the +Z front. */
export function buildE30CarTemplate(
  raw: T.Group,
  mapMaterial: (source: T.Material) => T.Material = (source) => source.clone(),
) {
  raw.updateMatrixWorld(true);
  const sourceMeshes: T.Mesh[] = [];
  raw.traverse((node) => {
    if (node instanceof T.Mesh) sourceMeshes.push(node);
  });
  if (sourceMeshes.some((mesh) => Array.isArray(mesh.material)))
    throw new Error(
      "E30 adapter expects decoded single-material glTF primitives",
    );

  const hubs = new Map<WheelName, Hub>();
  const identity = new T.Matrix4();
  for (const mesh of sourceMeshes) {
    if ((mesh.material as T.Material).name !== "BMW_E30_M3_TIRE") continue;
    const branch = wheelBranch(mesh);
    if (!branch) throw new Error("E30 tyre has no source axle carrier");
    const frame = wheelFrame(branch, identity);
    const name: WheelName = `Wheel${frame.center.z > 0 ? "Front" : "Rear"}${frame.center.x > 0 ? "L" : "R"}`;
    if (hubs.has(name)) throw new Error(`E30 has duplicate ${name} tyres`);
    hubs.set(name, { name, frame });
  }
  if (hubs.size !== 4)
    throw new Error("E30 adapter requires all four audited tyre carriers");

  const root = new T.Group(),
    body = new T.Group();
  root.name = "BMW M3 E30";
  body.name = "car-body";
  root.add(body);
  for (const { name, frame } of hubs.values()) {
    const steer = new T.Group(),
      spin = new T.Group();
    steer.name = name;
    steer.position.copy(frame.center);
    steer.userData.sourceWheelNeutral = frame.neutral.toArray();
    spin.name = name + "Spin";
    steer.add(spin);
    root.add(steer);
  }
  const materials = new Map<T.Material, T.Material>();
  for (const source of sourceMeshes) {
    const branch = wheelBranch(source);
    let parent: T.Object3D = body;
    let matrix = source.matrixWorld.clone();
    if (branch) {
      const centre = branch.getWorldPosition(new T.Vector3());
      const hub = [...hubs.values()].find(
        ({ frame }) => frame.center.distanceTo(centre) < 1e-5,
      );
      if (!hub)
        throw new Error(
          `E30 wheel branch has no matching axle: ${branch.name}`,
        );
      matrix.premultiply(
        new T.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
      matrix.premultiply(
        new T.Matrix4().makeRotationFromQuaternion(hub.frame.neutral),
      );
      // Logo_Plane descendants stay with their caliper, preserving every nested
      // source transform. Do not independently neutralize their local rotation.
      const stationary = branch.name.startsWith("Brembo_Calipers");
      parent = root.getObjectByName(hub.name + (stationary ? "" : "Spin"))!;
    }
    const sourceMaterial = source.material as T.Material;
    if (!materials.has(sourceMaterial))
      materials.set(sourceMaterial, mapMaterial(sourceMaterial));
    const mesh = new T.Mesh(
      bake(source.geometry, matrix),
      materials.get(sourceMaterial),
    );
    mesh.name = source.name;
    mesh.userData.e30SourceBranch = branch?.name ?? "body";
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    if (sourceMaterial.name === "BMW_E30_M3_TIRE")
      parent.userData.rollingRadius = tyreRadius(mesh.geometry);
  }

  root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root, true);
  const centre = bounds.getCenter(new T.Vector3());
  const translation = new T.Vector3(-centre.x, -bounds.min.y, -centre.z);
  // Actors.sync animates car-body's transform, so persistent centring belongs
  // in body vertices and axle positions, not that animated transform.
  body.traverse((node) => {
    if (node instanceof T.Mesh)
      node.geometry.translate(...translation.toArray());
  });
  for (const name of E30_WHEELS)
    root.getObjectByName(name)!.position.add(translation);
  root.updateMatrixWorld(true);
  root.userData.vehicleAsset = "e30-coupe";
  root.userData.e30SourceTranslation = translation.toArray();
  // Deliberately omit sourceNormalization: that flag attaches the unrelated
  // concept-car distant template in the existing detailed-car loader.
  root.userData.roadClearance = 0;
  root.userData.contactFootprint = contactEnvelope(root, body);
  const front = root.getObjectByName("WheelFrontL")!.position,
    rear = root.getObjectByName("WheelRearL")!.position;
  root.userData.wheelbase = front.z - rear.z;
  root.userData.groundSamples = {
    front: front.z,
    rear: rear.z,
    halfTrack: Math.max(
      ...E30_WHEELS.map((name) =>
        Math.abs(root.getObjectByName(name)!.position.x),
      ),
    ),
  };
  return root;
}
