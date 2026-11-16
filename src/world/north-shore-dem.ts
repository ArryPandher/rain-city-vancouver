import * as T from "three";
import { geo } from "./data";
import data from "./north-shore-dem-data.json";
import {
  northShoreImageryUv,
  loadNorthShoreImagery,
  applyNorthShoreImageryShader,
} from "./north-shore-imagery";

/** Visual-only DEM. Never use this derivative for live road/player support. */
export const NORTH_SHORE_DEM = data;
const [minX, minZ] = geo(data.bounds.north, data.bounds.west);
const [maxX, maxZ] = geo(data.bounds.south, data.bounds.east);
export const NORTH_SHORE_DEM_BOUNDS = { minX, maxX, minZ, maxZ };
export const NORTH_SHORE_DEM_PROFILE = {
  chunkCells: 64,
  // Experimental far-terrain haze, retaining the scene's weather fog uniforms.
  fogDepthScale: 0.35,
  // The bounded visual terrain meets existing flat ground beyond all loaded roads.
  // Interior measured heights and ridgelines are unchanged, without exaggeration.
  southTransition: 1200,
  otherEdgeTransition: 640,
};
const dx = (maxX - minX) / (data.width - 1);
const dz = (maxZ - minZ) / (data.height - 1);
function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
function measured(col: number, row: number) {
  return data.elevations[row * data.width + col] * data.metresPerUnit;
}
function edgeWeight(x: number, z: number) {
  return Math.min(
    smooth((maxZ - z) / NORTH_SHORE_DEM_PROFILE.southTransition),
    smooth((z - minZ) / NORTH_SHORE_DEM_PROFILE.otherEdgeTransition),
    smooth((x - minX) / NORTH_SHORE_DEM_PROFILE.otherEdgeTransition),
    smooth((maxX - x) / NORTH_SHORE_DEM_PROFILE.otherEdgeTransition),
  );
}
/** Bilinear source elevation for inspection only; null outside the bounded source. */
export function sampleNorthShoreElevation(x: number, z: number) {
  if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
  const u = (x - minX) / dx,
    v = (z - minZ) / dz;
  const col = Math.min(data.width - 2, Math.floor(u));
  const row = Math.min(data.height - 2, Math.floor(v));
  const a = u - col,
    b = v - row;
  return (
    (measured(col, row) * (1 - a) + measured(col + 1, row) * a) * (1 - b) +
    (measured(col, row + 1) * (1 - a) + measured(col + 1, row + 1) * a) * b
  );
}

export function createNorthShoreDemGeometry() {
  const heights = new Float32Array(data.width * data.height);
  const normals = new Float32Array(heights.length * 3);
  const colors = new Float32Array(heights.length * 3);
  const vegetation = new T.Color(0x435746),
    rock = new T.Color(0x777a73);
  for (let row = 0; row < data.height; row++)
    for (let col = 0; col < data.width; col++) {
      const i = row * data.width + col,
        x = minX + col * dx,
        z = minZ + row * dz;
      heights[i] = measured(col, row) * edgeWeight(x, z);
    }
  const at = (col: number, row: number) => heights[row * data.width + col];
  for (let row = 0; row < data.height; row++)
    for (let col = 0; col < data.width; col++) {
      const left = Math.max(0, col - 1),
        right = Math.min(data.width - 1, col + 1);
      const north = Math.max(0, row - 1),
        south = Math.min(data.height - 1, row + 1);
      const normal = new T.Vector3(
        -(at(right, row) - at(left, row)) / ((right - left) * dx),
        1,
        -(at(col, south) - at(col, north)) / ((south - north) * dz),
      ).normalize();
      const i = row * data.width + col;
      normals.set(normal.toArray(), i * 3);
      // Broad neutral land cover approximation; no invented elevation/noise or imagery.
      const bare = Math.max(
        smooth((1 - normal.y - 0.12) / 0.33),
        smooth((heights[i] - 1050) / 500) * 0.7,
      );
      colors.set(vegetation.clone().lerp(rock, bare).toArray(), i * 3);
    }
  const chunks: {
    geometry: T.BufferGeometry;
    origin: [number, number];
    cells: [number, number, number, number];
  }[] = [];
  const step = NORTH_SHORE_DEM_PROFILE.chunkCells;
  for (let row = 0; row < data.height - 1; row += step)
    for (let col = 0; col < data.width - 1; col += step) {
      const endCol = Math.min(col + step, data.width - 1),
        endRow = Math.min(row + step, data.height - 1);
      const width = endCol - col + 1;
      const origin: [number, number] = [
        minX + ((col + endCol) * dx) / 2,
        minZ + ((row + endRow) * dz) / 2,
      ];
      const positions: number[] = [],
        ns: number[] = [],
        cs: number[] = [],
        uvs: number[] = [],
        indices: number[] = [];
      for (let r = row; r <= endRow; r++)
        for (let c = col; c <= endCol; c++) {
          const i = r * data.width + c;
          positions.push(
            minX + c * dx - origin[0],
            heights[i],
            minZ + r * dz - origin[1],
          );
          ns.push(...normals.subarray(i * 3, i * 3 + 3));
          cs.push(...colors.subarray(i * 3, i * 3 + 3));
          uvs.push(...northShoreImageryUv(minX + c * dx, minZ + r * dz));
          if (r < endRow && c < endCol) {
            const a = (r - row) * width + c - col;
            indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1);
          }
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("normal", new T.Float32BufferAttribute(ns, 3));
      geometry.setAttribute("color", new T.Float32BufferAttribute(cs, 3));
      geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      chunks.push({ geometry, origin, cells: [col, row, endCol, endRow] });
    }
  return chunks;
}

/** Attach directly to scene for frustum culling; not the city's 2.9 km static culler. */
export function createNorthShoreDemGroup(options: { imagery?: boolean } = {}) {
  const group = new T.Group();
  group.name = "Measured North Shore visual terrain candidate";
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    fog: true,
  });
  material.onBeforeCompile = (shader) => {
    if (options.imagery) applyNorthShoreImageryShader(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      T.ShaderChunk.fog_fragment.replaceAll(
        "vFogDepth",
        `(vFogDepth * ${NORTH_SHORE_DEM_PROFILE.fogDepthScale})`,
      ),
    );
  };
  material.customProgramCacheKey = () =>
    `north-shore-dem-fog-depth-${NORTH_SHORE_DEM_PROFILE.fogDepthScale}-imagery-${!!options.imagery}-v2`;
  for (const chunk of createNorthShoreDemGeometry()) {
    const mesh = new T.Mesh(chunk.geometry, material);
    mesh.position.set(chunk.origin[0], 0, chunk.origin[1]);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `North Shore DEM ${chunk.cells[0]},${chunk.cells[1]}`;
    mesh.userData.visualTerrainOnly = true;
    group.add(mesh);
  }
  if (options.imagery) loadNorthShoreImagery(material, group);
  return group;
}
