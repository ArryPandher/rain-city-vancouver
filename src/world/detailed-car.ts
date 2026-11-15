import { attachCarLOD } from "./car-lod";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { carBodyGeometry, carGeometryLayout } from "./car-body-geometry";
import { VehicleModel } from "./vehicles";
import { BASE, label } from "./materials";
import {
  canonicalWheelGeometry,
  wheelFrame,
  tyreRadius,
} from "./vehicle-wheels";
let template: T.Group | null = null,
  trafficTemplate: T.Group | null = null,
  distantTemplate: T.Group | null = null;
async function buildCarTemplate(path: string, reference?: T.Group) {
  const gltf = await new GLTFLoader().loadAsync(`${BASE}models/${path}`);
  return buildDetailedCarTemplate(gltf.scene, undefined, reference);
}
export function buildDetailedCarTemplate(
  raw: T.Group,
  plateTexture: () => T.Texture = () =>
    label("RAIN CITY", 512, 128, "#263a40", "#e6e3d5", 60),
  reference?: T.Group,
) {
  // Normalize Z-up source exports if necessary; committed car assets are already Y-up.
  const sourceBox = new T.Box3().setFromObject(raw, true),
    size = sourceBox.getSize(new T.Vector3());
  if (size.z < size.y) raw.rotation.x = -Math.PI / 2;
  raw.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(raw, true),
    center = box.getCenter(new T.Vector3()),
    extent = box.getSize(new T.Vector3()),
    scale = 4.9 / extent.z;
  const transform = new T.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
    );
  if (reference) transform.fromArray(reference.userData.sourceNormalization);
  const root = new T.Group(),
    body = new T.Group();
  root.userData.sourceNormalization = transform.toArray();
  body.name = "car-body";
  root.add(body);
  const materialMap = new Map<T.Material, T.Material>();
  const bodyGroups = new Map<T.Material, Map<string, T.BufferGeometry[]>>();
  const wheelGroups = new Map<
    string,
    { meshes: T.Mesh[]; source: T.Object3D }
  >();
  raw.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    let parent: T.Object3D | null = o,
      which = "";
    while (parent) {
      if (/^Wheel(Front|Rear)[LR]$/.test(parent.name)) {
        which = parent.name;
        break;
      }
      parent = parent.parent;
    }
    if (which) {
      let group = wheelGroups.get(which);
      if (!group)
        wheelGroups.set(which, (group = { meshes: [], source: parent! }));
      group.meshes.push(o);
      return;
    }
    if (/Emblem|Wipers|Pedal|Floormat|Engine|InteriorRearHatch/.test(o.name))
      return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i++) {
      const src = mats[i];
      let mat = materialMap.get(src);
      if (!mat) {
        mat = src.clone();
        if (mat instanceof T.MeshPhysicalMaterial) {
          mat.transmission = 0;
          mat.iridescence = 0;
          if (/glass/i.test(mat.name)) {
            mat.color.set(0x172d34);
            mat.metalness = 0.42;
            mat.roughness = 0.13;
            mat.transparent = false;
            mat.opacity = 1;
          }
          if (/Paint 1/.test(mat.name)) {
            mat.color.set(0x3e656a);
            mat.metalness = 0.72;
            mat.roughness = 0.23;
            mat.clearcoat = 1;
          }
          if (/Paint 2/.test(mat.name)) {
            mat.color.set(0x202b30);
            mat.roughness = 0.28;
          }
        }
        if (mat instanceof T.MeshStandardMaterial) {
          if (/BrakeLight/i.test(mat.name)) {
            mat.emissive.set(0xff2315);
            mat.emissiveIntensity = 0.6;
          }
          if (/Headlight/i.test(mat.name)) {
            mat.emissive.set(0xe4f2ff);
            mat.emissiveIntensity = 2;
          }
          if (mat.name === "License") {
            mat.map = plateTexture();
          }
        }
        materialMap.set(src, mat!);
      }
      // glTF submeshes have already been separated by the loader for multi-material primitives.
      const geo = carBodyGeometry(
        o.geometry,
        transform.clone().multiply(o.matrixWorld),
      );
      let layouts = bodyGroups.get(mat!);
      if (!layouts) bodyGroups.set(mat!, (layouts = new Map()));
      const layout = carGeometryLayout(geo);
      let arr = layouts.get(layout);
      if (!arr) layouts.set(layout, (arr = []));
      arr.push(geo);
    }
  });
  for (const [mat, layouts] of bodyGroups) {
    for (const gs of layouts.values()) {
      const merged = mergeGeometries(gs);
      for (const g of merged ? [merged] : gs) {
        const mesh = new T.Mesh(g, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        body.add(mesh);
      }
      if (merged) gs.forEach((g) => g.dispose());
    }
  }
  const wheelMaterials = new Map<T.Material, T.Material>();
  const wheelMaterial = (source: T.Material) => {
    let material = wheelMaterials.get(source);
    if (!material) {
      material = source.clone();
      // The source pairs an almost-black main rim with a white metallic star
      // insert. Match their satin coated-alloy finish, retaining separate
      // material instances so each wheel batch still has exactly four parts.
      if (
        material instanceof T.MeshStandardMaterial &&
        /^(Rim1|Rim2)$/.test(material.name)
      ) {
        material.emissive.set(0x000000);
        material.emissiveIntensity = 0;
        material.emissiveMap = null;
        material.color.set(0x8b9299);
        material.metalness = 0;
        material.roughness = 0.42;
      }
      wheelMaterials.set(source, material);
    }
    return material;
  };
  for (const [name, w] of wheelGroups) {
    const frame = wheelFrame(w.source, transform);
    const referenceWheel = reference?.getObjectByName(name);
    if (referenceWheel) {
      frame.center.copy(referenceWheel.position);
      frame.neutral.fromArray(referenceWheel.userData.sourceWheelNeutral);
    }
    const center = frame.center;
    const steer = new T.Group();
    steer.name = name;
    steer.position.copy(center);
    steer.userData.sourceWheelNeutral = frame.neutral.toArray();
    root.add(steer);
    const spin = new T.Group();
    spin.name = name + "Spin";
    steer.add(spin);
    let radius = 0;
    for (const o of w.meshes) {
      const g = canonicalWheelGeometry(o, transform, frame);
      const mat = Array.isArray(o.material)
        ? o.material.map(wheelMaterial)
        : wheelMaterial(o.material);
      const mats = Array.isArray(mat) ? mat : [mat];
      if (mats.some((m) => /Tire/i.test(m.name)))
        radius = Math.max(radius, tyreRadius(g));
      const mesh = new T.Mesh(g, mat);
      mesh.name = o.name || mats.map((m) => m.name).join(" / ");
      mesh.castShadow = mesh.receiveShadow = true;
      // Calipers turn with the knuckle but do not rotate around the axle.
      // Disc/rotor, tyre and rim remain on the rolling hub.
      (/BrakePad|Caliper/i.test(o.name) ? steer : spin).add(mesh);
    }
    spin.userData.rollingRadius =
      reference?.getObjectByName(name + "Spin")?.userData.rollingRadius ??
      radius;
  }
  // Precise source vertices put the tyre bottom at zero. Road meshes sit a few
  // centimetres above collision ground; retain that small visual clearance.
  root.userData.roadClearance = 0.04;
  return root;
}
export async function loadDetailedCar() {
  template = await buildCarTemplate("car-concept.glb");
  const traffic = await new GLTFLoader().loadAsync(
    `${BASE}models/car-traffic.glb`,
  );
  trafficTemplate = buildDetailedCarTemplate(traffic.scene.clone(true));
  distantTemplate = buildDetailedCarTemplate(
    traffic.scene.clone(true),
    undefined,
    template,
  );
}
export function detailedCar(
  color = 0x3e656a,
  traffic = false,
): VehicleModel | null {
  const source = traffic ? trafficTemplate : template;
  if (!source) return null;
  return cloneDetailedCar(source, color);
}

export function cloneDetailedCar(
  source: T.Group,
  color = 0x3e656a,
): VehicleModel {
  const group = source.clone(true);
  let brakes = new T.MeshStandardMaterial(),
    headlights = new T.MeshStandardMaterial();
  const cache = new Map<T.Material, T.Material>();
  group.traverse((o) => {
    if (o instanceof T.Mesh && !Array.isArray(o.material)) {
      const old = o.material;
      let mat = cache.get(old);
      if (!mat) {
        mat = old.clone();
        cache.set(old, mat!);
      }
      o.material = mat;
      if (mat instanceof T.MeshStandardMaterial) {
        if (/Paint 1/.test(mat.name)) mat.color.set(color);
        if (/Brakelight/i.test(mat.name)) brakes = mat;
        if (/Headlight/i.test(mat.name)) headlights = mat;
      }
    }
  });
  const wheels = ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"].map(
      (n) => group.getObjectByName(n + "Spin") as T.Group,
    ),
    front = ["WheelFrontL", "WheelFrontR"].map(
      (n) => group.getObjectByName(n) as T.Group,
    );
  return {
    group,
    wheels: wheels.filter(Boolean),
    front: front.filter(Boolean),
    body: group.getObjectByName("car-body")!,
    brakes,
    headlights,
    kind: "car",
    color,
  };
}

/** Called after near wheel batching; only the render level changes at distance. */
export function attachDetailedCarLOD(model: VehicleModel, multiDraw: boolean) {
  if (distantTemplate && model.group.userData.sourceNormalization)
    attachCarLOD(
      model,
      cloneDetailedCar(distantTemplate, model.color),
      multiDraw,
    );
}
