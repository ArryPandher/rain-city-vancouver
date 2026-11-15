import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import concourse from "./canada-place-concourse-data.json";
/** Source-local roof17.65, guard1.08m above it. Rail/post sizes and terminal
 * returns are photographic estimates, not a surveyed accessible promenade. */
export const CANADA_PLACE_UPPER_GUARD_BASE = 17.65;
export const CANADA_PLACE_UPPER_GUARD_TOP = 18.73;
export type GuardPoint = [number, number];
export function canadaPlaceUpperGuardPath(): GuardPoint[] {
  const stations = concourse.stations,
    path: GuardPoint[] = [];
  const point = (i: number, out: number): GuardPoint => {
    const s = stations[i];
    return [s.x + s.nx * out * s.scale, s.z + s.nz * out * s.scale];
  };
  path.push(point(0, 0));
  for (let i = 1; i < stations.length; i++) {
    const middle = (stations[i - 1].s + stations[i].s) / 2;
    const fascia =
      middle < concourse.upperGlazing[0] || middle > concourse.upperGlazing[1];
    const out = concourse.profile[fascia ? 17 : 25][0];
    for (const p of [point(i - 1, out), point(i, out)])
      if (Math.hypot(p[0] - path.at(-1)![0], p[1] - path.at(-1)![1]) > 0.0001)
        path.push(p);
  }
  path.push(point(stations.length - 1, 0));
  return path;
}
/** One pale painted assembly: coping, attached posts/rails and closed end returns.
 * Append under the same +.08Y source group; no lower access/collider change. */
export function addCanadaPlaceUpperGuard(
  parent: T.Object3D,
  sourceMaterial?: T.MeshStandardMaterial,
) {
  const material =
    sourceMaterial?.clone() ??
    new T.MeshStandardMaterial({
      color: 0xcbd2c7,
      roughness: 0.56,
      metalness: 0.16,
    });
  material.name = "Canada Place upper promenade guard";
  const geometries: T.BufferGeometry[] = [],
    path = canadaPlaceUpperGuardPath();
  const beam = (
    a: GuardPoint,
    b: GuardPoint,
    y: number,
    width: number,
    height: number,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      g = new T.BoxGeometry(Math.hypot(dx, dz), height, width);
    g.rotateY(-Math.atan2(dz, dx));
    g.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
    geometries.push(g);
  };
  const posts: GuardPoint[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    beam(a, b, 17.72, 0.28, 0.14);
    for (const [y, w, h] of [
      [17.99, 0.07, 0.07],
      [18.34, 0.07, 0.07],
      [18.69, 0.11, 0.08],
    ])
      beam(a, b, y, w, h);
    const n = Math.ceil(length / 1.9);
    for (let j = 0; j < n; j++)
      posts.push([
        a[0] + ((b[0] - a[0]) * j) / n,
        a[1] + ((b[1] - a[1]) * j) / n,
      ]);
  }
  posts.push(path.at(-1)!);
  for (const p of posts) {
    const g = new T.BoxGeometry(0.14, 0.97, 0.14);
    g.translate(p[0], 18.245, p[1]);
    geometries.push(g);
  }
  const geometry = mergeGeometries(geometries, false)!;
  geometries.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = material.name;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
