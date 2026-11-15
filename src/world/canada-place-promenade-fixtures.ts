import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface CanadaPlaceFixturePlacement {
  x: number;
  z: number;
  yaw: number;
  y?: number;
  groundY?: number;
}
export const CANADA_PLACE_FIXTURE_DIMENSIONS = {
  baseRadius: 0.16,
  lowCollisionRadius: 0.18,
  height: 4.62,
  bannerBottom: 2.15,
  bannerWidth: 0.85,
} as const;

/** Original antialiased artwork; reference banners are not copied. */
export function canadaPlaceWaterfrontBanner(): T.Texture {
  if (typeof document === "undefined") {
    const fallback = new T.DataTexture(
      new Uint8Array([181, 91, 69, 255]),
      1,
      1,
      T.RGBAFormat,
    );
    fallback.colorSpace = T.SRGBColorSpace;
    fallback.needsUpdate = true;
    return fallback;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new T.DataTexture(
      new Uint8Array([181, 91, 69, 255]),
      1,
      1,
      T.RGBAFormat,
    );
    fallback.colorSpace = T.SRGBColorSpace;
    fallback.needsUpdate = true;
    return fallback;
  }
  ctx.fillStyle = "#b55b45";
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = "#e8d8b5";
  ctx.fillRect(0, 608, 512, 416);
  ctx.fillStyle = "#243e49";
  ctx.fillRect(0, 680, 512, 344);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4ead4";
  ctx.font = "500 65px Arial, Helvetica, sans-serif";
  ctx.fillText("CANADA", 256, 200);
  ctx.fillText("PLACE", 256, 281);
  ctx.font = "500 39px Arial, Helvetica, sans-serif";
  ctx.fillText("WATERFRONT", 256, 821);
  // Original abstract shoreline motif, not local Indigenous or event artwork.
  ctx.strokeStyle = "#ead9b7";
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(56, 450 + i * 29);
    ctx.bezierCurveTo(168, 401 + i * 29, 316, 504 + i * 29, 456, 445 + i * 29);
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.anisotropy = 4;
  return texture;
}

/** Shared original model. Heights above source deck; no light or emission. */
export function createCanadaPlaceFixtureParts(
  bannerFactory: () => T.Texture = canadaPlaceWaterfrontBanner,
) {
  const lists: T.BufferGeometry[][] = [[], [], [], [], []];
  const add = (g: T.BufferGeometry, part: number, x = 0, y = 0, z = 0) => {
    g.translate(x, y, z);
    lists[part].push(g);
  };
  const cylinder = (
    r1: number,
    r2: number,
    h: number,
    x: number,
    y: number,
    z: number,
    part = 0,
  ) => add(new T.CylinderGeometry(r1, r2, h, 20), part, x, y, z);
  const beam = (a: number[], b: number[], radius: number, part = 0) => {
    const p = new T.Vector3(...a),
      q = new T.Vector3(...b),
      d = q.clone().sub(p);
    const g = new T.CylinderGeometry(radius, radius, d.length(), 16);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    p.add(q).multiplyScalar(0.5);
    add(g, part, p.x, p.y, p.z);
  };
  cylinder(0.15, 0.16, 0.08, 0, 0.04, 0);
  cylinder(0.095, 0.13, 0.23, 0, 0.195, 0);
  cylinder(0.07, 0.08, 2.84, 0, 1.73, 0);
  cylinder(0.088, 0.088, 0.065, 0, 0.36, 0);
  cylinder(0.081, 0.081, 0.08, 0, 3.1, 0);
  beam([0, 3.12, 0], [0.2, 3.48, 0], 0.06);
  cylinder(0.057, 0.06, 0.72, 0.2, 3.82, 0);
  // Joined socket and stepped metal collar support the glass from below.
  cylinder(0.115, 0.078, 0.1, 0.2, 4.17, 0, 1);
  cylinder(0.1, 0.115, 0.045, 0.2, 4.225, 0);
  add(new T.SphereGeometry(0.27, 28, 20), 2, 0.2, 4.35, 0);
  cylinder(0.065, 0.09, 0.11, 0.2, 4.29, 0, 1);
  cylinder(0.041, 0.047, 0.2, 0.2, 4.385, 0, 4);
  add(new T.SphereGeometry(0.045, 16, 10), 4, 0.2, 4.49, 0);
  // Small central reflector within the globe, not a luminous blob.
  cylinder(0.1, 0.04, 0.07, 0.2, 4.48, 0, 1);
  for (const y of [2.15, 3.8]) {
    const poleX = y > 3.5 ? 0.2 : 0;
    cylinder(0.083, 0.083, 0.065, poleX, y, 0, 1);
    beam([poleX, y, 0], [0.1, y, 0], 0.025);
    beam([0.1, y, 0], [0.1, y, -0.98], 0.018);
  }
  const cloth = new T.PlaneGeometry(0.85, 1.65, 8, 12),
    p = cloth.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + 0.425) / 0.85,
      v = (p.getY(i) + 0.825) / 1.65;
    p.setZ(i, 0.018 * Math.sin(u * Math.PI * 3) * Math.sin(v * Math.PI));
  }
  // Two printed faces share one texture/material. The reverse side mirrors U,
  // not the lettering, and sits 2mm behind the front to avoid coplanarity.
  const reverse = cloth.clone(),
    indices = reverse.index!,
    uv = reverse.getAttribute("uv");
  for (let i = 0; i < indices.count; i += 3) {
    const b = indices.getX(i + 1);
    indices.setX(i + 1, indices.getX(i + 2));
    indices.setX(i + 2, b);
  }
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  for (const [face, offset] of [
    [cloth, 0.001],
    [reverse, -0.001],
  ] as const) {
    face.computeVertexNormals();
    face.rotateY(Math.PI / 2);
    add(face, 3, 0.1 + offset, 2.975, -0.525);
  }
  const materials: T.Material[] = [
    new T.MeshStandardMaterial({
      name: "Canada Place pale promenade fixture",
      color: 0xcbd0c4,
      roughness: 0.5,
      metalness: 0.12,
    }),
    new T.MeshStandardMaterial({
      name: "Canada Place fixture socket and collars",
      color: 0x737f7c,
      roughness: 0.38,
      metalness: 0.65,
    }),
    new T.MeshPhysicalMaterial({
      name: "Canada Place clear globe",
      color: 0xe2eeeb,
      roughness: 0.13,
      metalness: 0,
      ior: 1.5,
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    }),
    new T.MeshStandardMaterial({
      name: "Original waterfront cloth",
      map: bannerFactory(),
      roughness: 0.93,
      metalness: 0,
      side: T.FrontSide,
    }),
    new T.MeshStandardMaterial({
      name: "Canada Place unlit lamp element",
      color: 0xe1ded0,
      roughness: 0.4,
      metalness: 0,
    }),
  ];
  materials[2].userData.castShadow = false;
  return lists.map((geometries, i) => {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach((g) => g.dispose());
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, material: materials[i] };
  });
}

/** Placement origin is the pole foot. +X is row direction, +Z is inland. */
export function addCanadaPlacePromenadeFixtures(
  parent: T.Object3D,
  placements: readonly CanadaPlaceFixturePlacement[],
) {
  const group = new T.Group();
  group.name = "Canada Place promenade fixtures";
  if (!placements.length) {
    parent.add(group);
    return group;
  }
  for (const { geometry, material } of createCanadaPlaceFixtureParts()) {
    const mesh = new T.InstancedMesh(geometry, material, placements.length);
    mesh.name = material.name;
    placements.forEach((p, i) =>
      mesh.setMatrixAt(
        i,
        new T.Matrix4().compose(
          new T.Vector3(p.x, p.groundY ?? p.y ?? 7.8, p.z),
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), p.yaw),
          new T.Vector3(1, 1, 1),
        ),
      ),
    );
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = material.userData.castShadow !== false;
    mesh.receiveShadow = true;
    mesh.userData.allowShadow = mesh.castShadow;
    group.add(mesh);
  }
  parent.add(group);
  return group;
}
