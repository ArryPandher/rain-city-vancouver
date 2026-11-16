import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { centroid, type Building } from "./data";
import { buildingHeight } from "./building-profile";
import source from "./north-shore-urban-source.json";

/** Culling comparison only: these silhouettes retain the live city's zero datum. */
export const NORTH_SHORE_URBAN = source;
export const NORTH_SHORE_URBAN_CELL_SIZE = 270;
export const NORTH_SHORE_URBAN_NEAR_DISTANCE = 2900;

export function preflightNorthShoreUrban(buildings: readonly Building[]) {
  const ids = new Set(source.buildings.map((b) => b.id));
  const selected = buildings.filter((b) => ids.has(b.id));
  return (
    selected.length === source.buildings.length &&
    source.buildings.every((s) => {
      const matches = selected.filter((b) => b.id === s.id);
      if (matches.length !== 1) return false;
      const b = matches[0];
      return (
        b.kind === s.kind &&
        b.levels === s.levels &&
        b.height === s.heightTag &&
        buildingHeight(b) === s.height &&
        b.pts.length === s.pts.length &&
        b.pts.every((v, i) => v === s.pts[i])
      );
    })
  );
}

/** Closed, untextured source-footprint extrusion; no facade or invented podium. */
export function createNorthShoreUrbanSilhouette(
  points: readonly number[],
  height: number,
) {
  const ring: T.Vector2[] = [];
  for (let i = 0; i < points.length; i += 2)
    ring.push(new T.Vector2(points[i], points[i + 1]));
  if (ring[0].equals(ring[ring.length - 1])) ring.pop();
  if (T.ShapeUtils.isClockWise(ring)) ring.reverse();
  const positions: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) =>
    positions.push(...a, ...b, ...c);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    tri([a.x, 0, a.y], [a.x, height, a.y], [b.x, 0, b.y]);
    tri([b.x, 0, b.y], [a.x, height, a.y], [b.x, height, b.y]);
  }
  for (const face of T.ShapeUtils.triangulateShape(ring, [])) {
    const [a, b, c] = face.map((i) => ring[i]);
    // Positive x/z area faces down in x/y/z coordinates.
    tri([a.x, 0, a.y], [b.x, 0, b.y], [c.x, 0, c.y]);
    tri([c.x, height, c.y], [b.x, height, b.y], [a.x, height, a.y]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Root attaches this only inside debug + terrain=dem. Never add it to city chunks. */
export function createNorthShoreUrbanHorizon(buildings: readonly Building[]) {
  if (!preflightNorthShoreUrban(buildings)) return undefined;
  const group = new T.Group();
  group.name = "North Shore urban culling comparison — current zero city datum";
  const material = new T.MeshStandardMaterial({
    color: 0xb3b6b4,
    roughness: 0.9,
    metalness: 0,
  });
  material.name = "North Shore distant untextured source silhouettes";
  const cells = new Map<
    string,
    { x: number; z: number; geometries: T.BufferGeometry[] }
  >();
  for (const b of source.buildings) {
    const [x, z] = centroid(b.pts);
    const cx =
      Math.floor(x / NORTH_SHORE_URBAN_CELL_SIZE) *
        NORTH_SHORE_URBAN_CELL_SIZE +
      NORTH_SHORE_URBAN_CELL_SIZE / 2;
    const cz =
      Math.floor(z / NORTH_SHORE_URBAN_CELL_SIZE) *
        NORTH_SHORE_URBAN_CELL_SIZE +
      NORTH_SHORE_URBAN_CELL_SIZE / 2;
    const key = `${cx},${cz}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { x: cx, z: cz, geometries: [] }));
    const geometry = createNorthShoreUrbanSilhouette(b.pts, b.height);
    geometry.translate(-cx, 0, -cz);
    cell.geometries.push(geometry);
  }
  let triangles = 0,
    geometryBytes = 0;
  for (const cell of cells.values()) {
    const geometry = mergeGeometries(cell.geometries)!;
    cell.geometries.forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = `North Shore distant source cell ${cell.x},${cell.z}`;
    mesh.position.set(cell.x, 0, cell.z);
    mesh.userData.center = [cell.x, cell.z];
    mesh.visible = false;
    mesh.castShadow = mesh.receiveShadow = false;
    group.add(mesh);
    triangles += geometry.getAttribute("position").count / 3;
    geometryBytes += Object.values(geometry.attributes).reduce(
      (n, a) => n + a.array.byteLength,
      0,
    );
  }
  const stats = {
    buildings: source.buildings.length,
    cells: cells.size,
    triangles,
    geometryBytes,
    datum: 0,
  };
  group.userData.comparison = "culling-only; not terrain-aligned";
  group.userData.stats = stats;
  return {
    group,
    stats,
    update(x: number, z: number) {
      for (const mesh of group.children) {
        const [cx, cz] = mesh.userData.center as [number, number];
        // Exact complement of the existing generic shell cell culler. No overlap
        // or fade gap at 2.9km; native comparison must assess the silhouette swap.
        mesh.visible =
          Number.isFinite(x) &&
          Number.isFinite(z) &&
          Math.hypot(cx - x, cz - z) >= NORTH_SHORE_URBAN_NEAR_DISTANCE;
      }
    },
  };
}
