import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { BASE, Materials } from "./materials";
import { Building, centroid, geo, pointInPoly } from "./data";
import { bakeGeometry } from "./geometry";

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
  const brick = materials.texture("brick_wall_001-color.jpg", true);
  for (const asset of assets) {
    const gltf = await loader.loadAsync(`${BASE}${asset.file}`);
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
      const positions = geometry.getAttribute("position"),
        normals = geometry.getAttribute("normal");
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i),
          py = positions.getY(i),
          pz = positions.getZ(i);
        if (py < 15 && py > -2) points.push([px + x, pz + z]);
        const nx = Math.abs(normals.getX(i)),
          ny = Math.abs(normals.getY(i)),
          nz = Math.abs(normals.getZ(i));
        uv[i * 2] = (ny > nx && ny > nz ? px : nx > nz ? pz : px) / 4;
        uv[i * 2 + 1] = (ny > nx && ny > nz ? pz : py) / 4;
      }
      geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
      const original = object.material as T.MeshStandardMaterial;
      let mat = cache.get(original);
      if (!mat) {
        mat = original.clone();
        const name = mat.name.toLowerCase();
        if (/glass/.test(name)) {
          mat.metalness = 0.58;
          mat.roughness = 0.18;
          mat.envMapIntensity = 1.25;
        } else if (/steel|bronze|copper|green|metal/.test(name)) {
          mat.metalness = 0.55;
          mat.roughness = 0.36;
        } else if (/brick/.test(name)) {
          mat.map = brick;
          mat.color.setHex(0xbdb2a8);
          mat.roughness = 0.9;
        } else if (/stone|concrete|foundation|trim/.test(name)) {
          mat.map = materials.concrete.map;
          mat.normalMap = materials.concrete.normalMap;
          mat.normalScale.set(0.2, 0.2);
          mat.roughness = 0.85;
        } else if (/fabric/.test(name)) {
          mat.roughness = 0.78;
          mat.side = T.DoubleSide;
        }
        if (/glow/.test(name)) {
          mat.emissive.copy(mat.color);
          mat.emissiveIntensity = 0.18;
        }
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
    parent.add(group);
  }
  return assets.length;
}
