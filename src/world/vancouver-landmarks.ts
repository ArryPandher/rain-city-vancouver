import { repairGalleryRearEntry } from "./gallery-rear-entry";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { BASE, Materials } from "./materials";
import { Building, centroid, geo, pointInPoly } from "./data";
import { bakeGeometry } from "./geometry";
import {
  addCanadaPlaceRigging,
  removeCanadaPlaceThinMasts,
} from "./canada-place-rigging";
import {
  LandmarkSurfaces,
  landmarkSurfaceProfile,
  landmarkSurfaceUV,
} from "./landmark-surfaces";

interface LandmarkAsset {
  id: string;
  name: string;
  origin: [number, number];
  file: string;
}
const footprints: { polygon: number[]; box: T.Box2 }[] = [];
export function specialBuilding(building: Building) {
  const [x, z] = centroid(building.pts);
  return footprints.some(
    ({ polygon, box }) =>
      x >= box.min.x &&
      x <= box.max.x &&
      z >= box.min.y &&
      z <= box.max.y &&
      pointInPoly(x, z, polygon),
  );
}
function convexHull(points: [number, number][]) {
  const unique = [
    ...new Map(
      points.map((p) => [p.map((n) => n.toFixed(1)).join(","), p]),
    ).values(),
  ];
  unique.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [],
    upper: [number, number][] = [];
  for (const p of unique) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of unique.reverse()) {
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Local metre-scale models with east/up/south axes. No inferred global scaling. */
export async function loadVancouverLandmarks(
  parent: T.Group,
  materials: Materials,
) {
  const response = await fetch(`${BASE}data/vancouver-landmarks.json`);
  if (!response.ok) throw new Error("Vancouver landmark catalog unavailable");
  const assets: LandmarkAsset[] = await response.json();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  footprints.length = 0;
  const surfaces = new LandmarkSurfaces(materials);
  const models = await Promise.all(
    assets.map((asset) => loader.loadAsync(`${BASE}${asset.file}`)),
  );
  for (const [index, asset] of assets.entries()) {
    const gltf = models[index];
    const [x, z] = geo(asset.origin[1], asset.origin[0]);
    const group = new T.Group();
    group.name = asset.name;
    group.position.set(x, 0.08, z);
    gltf.scene.updateMatrixWorld(true);
    const points: [number, number][] = [];
    const cache = new Map<T.Material, T.MeshStandardMaterial>();
    gltf.scene.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      const geometry = bakeGeometry(object.geometry, object.matrixWorld);
      const original = object.material as T.MeshStandardMaterial;
      if (asset.id === "vancouver-art-gallery")
        repairGalleryRearEntry(geometry, original.name);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const py = positions.getY(i);
        if (py < 15 && py > -2)
          points.push([positions.getX(i) + x, positions.getZ(i) + z]);
      }
      if (asset.id === "canada-place" && original.name === "steel")
        removeCanadaPlaceThinMasts(geometry);
      const profile = landmarkSurfaceProfile(asset.id, original.name);
      landmarkSurfaceUV(geometry, profile?.metres ?? [4, 4]);
      let mat = cache.get(original);
      if (!mat) {
        mat = surfaces.material(original, asset.id);
        cache.set(original, mat);
      }
      const mesh = new T.Mesh(geometry, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    });
    const hull = convexHull(points);
    if (hull.length > 2 && asset.id !== "gastown-steam-clock")
      footprints.push({
        polygon: hull.flat(),
        box: new T.Box2().setFromPoints(hull.map((p) => new T.Vector2(...p))),
      });
    if (asset.id === "canada-place") addCanadaPlaceRigging(group);
    parent.add(group);
  }
  return assets.length;
}
