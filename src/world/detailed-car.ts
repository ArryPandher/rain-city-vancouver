import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { normalizeGeometry } from "./geometry";
import { VehicleModel } from "./vehicles";
import { BASE, label } from "./materials";
let template: T.Group | null = null,
  trafficTemplate: T.Group | null = null;
async function buildCarTemplate(path: string) {
  const gltf = await new GLTFLoader().loadAsync(`${BASE}models/${path}`);
  const raw = gltf.scene;
  // Source is Z-up with its nose facing -Y. Bake into this game's Y-up, +Z-forward convention.
  const sourceBox = new T.Box3().setFromObject(raw),
    size = sourceBox.getSize(new T.Vector3());
  if (size.z < size.y) raw.rotation.x = -Math.PI / 2;
  raw.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(raw),
    center = box.getCenter(new T.Vector3()),
    extent = box.getSize(new T.Vector3()),
    scale = 4.9 / extent.z;
  const transform = new T.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
    );
  const root = new T.Group(),
    body = new T.Group();
  body.name = "car-body";
  root.add(body);
  const materialMap = new Map<T.Material, T.Material>();
  const bodyGroups = new Map<T.Material, T.BufferGeometry[]>();
  const wheelGroups = new Map<string, { meshes: T.Mesh[]; bounds: T.Box3 }>();
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
        wheelGroups.set(which, (group = { meshes: [], bounds: new T.Box3() }));
      group.meshes.push(o);
      group.bounds.expandByObject(o);
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
            mat.map = label("RAIN CITY", 512, 128, "#263a40", "#e6e3d5", 60);
          }
        }
        materialMap.set(src, mat!);
      }
      // glTF submeshes have already been separated by the loader for multi-material primitives.
      const geo = o.geometry
        .clone()
        .applyMatrix4(transform.clone().multiply(o.matrixWorld));
      if (!geo.getAttribute("uv"))
        geo.setAttribute(
          "uv",
          new T.Float32BufferAttribute(
            new Float32Array(geo.getAttribute("position").count * 2),
            2,
          ),
        );
      geo.deleteAttribute("tangent");
      geo.deleteAttribute("uv1");
      geo.deleteAttribute("uv2");
      let arr = bodyGroups.get(mat!);
      if (!arr) bodyGroups.set(mat!, (arr = []));
      arr.push(normalizeGeometry(geo));
    }
  });
  for (const [mat, gs] of bodyGroups) {
    const g = mergeGeometries(gs);
    if (g) {
      const mesh = new T.Mesh(g, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      body.add(mesh);
    }
    gs.forEach((g) => g.dispose());
  }
  for (const [name, w] of wheelGroups) {
    const center = w.bounds.getCenter(new T.Vector3()).applyMatrix4(transform);
    const steer = new T.Group();
    steer.name = name;
    steer.position.copy(center);
    root.add(steer);
    const spin = new T.Group();
    spin.name = name + "Spin";
    steer.add(spin);
    for (const o of w.meshes) {
      const g = o.geometry
        .clone()
        .applyMatrix4(transform.clone().multiply(o.matrixWorld));
      g.translate(-center.x, -center.y, -center.z);
      const mat = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      const mesh = new T.Mesh(g, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      spin.add(mesh);
    }
  }
  return root;
}
export async function loadDetailedCar() {
  template = await buildCarTemplate("car-concept.glb");
  trafficTemplate = await buildCarTemplate("car-traffic.glb");
}
export function detailedCar(
  color = 0x3e656a,
  traffic = false,
): VehicleModel | null {
  const source = traffic ? trafficTemplate : template;
  if (!source) return null;
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
