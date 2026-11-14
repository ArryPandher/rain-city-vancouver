import * as T from "three";
import { pointInPoly, type Area } from "./data";
import { SpatialHash } from "./collision";
import { Terrain } from "./terrain";
import { ShorelineClip } from "./shoreline-clip";

export interface TerrainArea {
  area: Area;
  material: T.Material;
  priority: number;
}
/** One grid prevents independently triangulated land-use overlays intersecting on slopes. */
export function terrainMeshes(
  terrain: Terrain,
  areas: TerrainArea[],
  fallback: T.Material,
  oceans: number[][] = [],
  pavedCutouts: number[][] = [],
  normalSurface: Terrain = terrain,
) {
  const index = new SpatialHash<TerrainArea>(64),
    m = terrain.meta;
  const shore = new ShorelineClip([...oceans, ...pavedCutouts], {
    minX: m.minX,
    minZ: m.minZ,
    maxX: terrain.maxX,
    maxZ: terrain.maxZ,
  });
  for (const item of areas) {
    const p = item.area.pts,
      x = p.filter((_, i) => i % 2 === 0),
      z = p.filter((_, i) => i % 2 === 1);
    index.add(
      item,
      Math.min(...x),
      Math.min(...z),
      Math.max(...x),
      Math.max(...z),
    );
  }
  const chunks: T.Mesh[] = [];
  const chunkCells = Math.max(1, Math.round(160 / m.step));
  for (let tz = 0; tz < m.rows - 1; tz += chunkCells)
    for (let tx = 0; tx < m.columns - 1; tx += chunkCells) {
      const groups = new Map<
        T.Material,
        {
          pos: number[];
          uv: number[];
          normal: number[];
          idx: number[];
          vertices: Map<number, number>;
        }
      >();
      for (let iz = tz; iz < Math.min(tz + chunkCells, m.rows - 1); iz++)
        for (let ix = tx; ix < Math.min(tx + chunkCells, m.columns - 1); ix++) {
          const ids = [
            iz * m.columns + ix,
            iz * m.columns + ix + 1,
            (iz + 1) * m.columns + ix,
            (iz + 1) * m.columns + ix + 1,
          ];
          if (ids.every((i) => terrain.values[i] === 0)) continue;
          const x = m.minX + (ix + 0.5) * m.step,
            z = m.minZ + (iz + 0.5) * m.step;
          if (terrain.details.some((grid) => grid.contains(x, z))) continue;
          const coast = shore.cell(x, z, m.step / 2);
          if (coast === "water") continue;
          let material = fallback,
            priority = -Infinity;
          for (const item of index.query(x, z))
            if (
              item.priority >= priority &&
              pointInPoly(x, z, item.area.pts) &&
              !item.area.holes?.some((h) => pointInPoly(x, z, h))
            ) {
              material = item.material;
              priority = item.priority;
            }
          let group = groups.get(material);
          if (!group) {
            group = {
              pos: [],
              uv: [],
              normal: [],
              idx: [],
              vertices: new Map(),
            };
            groups.set(material, group);
          }
          const local = ids.map((id) => {
            let vertex = group!.vertices.get(id);
            if (vertex !== undefined) return vertex;
            vertex = group!.pos.length / 3;
            group!.vertices.set(id, vertex);
            const xx = m.minX + (id % m.columns) * m.step,
              zz = m.minZ + Math.floor(id / m.columns) * m.step,
              yy = terrain.values[id] * m.scale;
            group!.pos.push(xx, yy - 0.012, zz);
            const scale =
              material.name === "Stanley forest soil and leaf litter"
                ? 2.11
                : 5;
            group!.uv.push(xx / scale, zz / scale);
            const dx =
                normalSurface.height(xx + 0.5, zz) -
                normalSurface.height(xx - 0.5, zz),
              dz =
                normalSurface.height(xx, zz + 0.5) -
                normalSurface.height(xx, zz - 0.5),
              n = Math.hypot(dx, 1, dz);
            group!.normal.push(-dx / n, 1 / n, -dz / n);
            return vertex;
          });
          for (const tri of [
            [local[0], local[2], local[1]],
            [local[1], local[2], local[3]],
          ]) {
            if (coast === "land") {
              group.idx.push(...tri);
              continue;
            }
            const p = tri.map(
              (i) =>
                [group!.pos[i * 3], group!.pos[i * 3 + 2]] as [number, number],
            );
            const [a, b, c] = p;
            const determinant =
              (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
            for (const clipped of shore.triangle(p)) {
              const output: number[] = [];
              for (const [xx, zz] of clipped) {
                const wa =
                    ((b[1] - c[1]) * (xx - c[0]) +
                      (c[0] - b[0]) * (zz - c[1])) /
                    determinant,
                  wb =
                    ((c[1] - a[1]) * (xx - c[0]) +
                      (a[0] - c[0]) * (zz - c[1])) /
                    determinant,
                  weights = [wa, wb, 1 - wa - wb];
                const interpolate = (
                  array: number[],
                  stride: number,
                  axis: number,
                ) =>
                  weights.reduce(
                    (n, w, i) => n + w * array[tri[i] * stride + axis],
                    0,
                  );
                output.push(group.pos.length / 3);
                group.pos.push(xx, interpolate(group.pos, 3, 1), zz);
                group.uv.push(
                  interpolate(group.uv, 2, 0),
                  interpolate(group.uv, 2, 1),
                );
                group.normal.push(
                  ...[0, 1, 2].map((axis) =>
                    interpolate(group!.normal, 3, axis),
                  ),
                );
              }
              // ShapeUtils uses XZ coordinates; upward terrain needs clockwise XZ winding.
              const [u, v, w] = clipped;
              const signed =
                (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
              if (signed > 0) output.reverse();
              group.idx.push(...output);
            }
          }
        }
      for (const [material, g] of groups) {
        if (!g.idx.length) continue;
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(g.pos, 3),
        );
        geometry.setAttribute("uv", new T.Float32BufferAttribute(g.uv, 2));
        geometry.setAttribute(
          "normal",
          new T.Float32BufferAttribute(g.normal, 3),
        );
        geometry.setIndex(g.idx);
        geometry.computeBoundingSphere();
        const mesh = new T.Mesh(geometry, material);
        mesh.name = "Stanley terrain";
        mesh.receiveShadow = true;
        mesh.userData.center = [
          m.minX + (tx + chunkCells / 2) * m.step,
          m.minZ + (tz + chunkCells / 2) * m.step,
        ];
        chunks.push(mesh);
      }
    }
  for (const detail of terrain.details)
    chunks.push(
      ...terrainMeshes(
        detail,
        areas,
        fallback,
        oceans,
        pavedCutouts,
        normalSurface,
      ),
    );
  return chunks;
}

/** Close the exposed earth where a level forecourt cuts into sloping terrain. */
export function terrainCutWall(
  terrain: Terrain,
  polygon: number[],
  floor: number,
  material: T.Material,
) {
  const positions: number[] = [],
    uv: number[] = [];
  for (let i = 0; i < polygon.length; i += 2) {
    const j = (i + 2) % polygon.length,
      ax = polygon[i],
      az = polygon[i + 1],
      bx = polygon[j],
      bz = polygon[j + 1],
      step =
        terrain.details.find((t) => t.contains((ax + bx) / 2, (az + bz) / 2))
          ?.meta.step ?? terrain.meta.step,
      cuts = new Set([0, 1]);
    // Grid lines and triangle diagonals are all interpolation breakpoints.
    for (const [a, b, origin] of [
      [ax, bx, terrain.meta.minX],
      [az, bz, terrain.meta.minZ],
      [ax + az, bx + bz, terrain.meta.minX + terrain.meta.minZ],
    ]) {
      if (Math.abs(b - a) < 1e-8) continue;
      for (
        let line = Math.ceil((Math.min(a, b) - origin) / step) * step + origin;
        line < Math.max(a, b);
        line += step
      ) {
        const t = (line - a) / (b - a);
        if (t > 0 && t < 1) cuts.add(t);
      }
    }
    const points = [...cuts]
      .sort((a, b) => a - b)
      .map((t) => {
        const x = ax + (bx - ax) * t,
          z = az + (bz - az) * t;
        return [x, Math.max(floor, terrain.height(x, z) - 0.012), z];
      });
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1],
        b = points[k];
      if (Math.max(a[1], b[1]) <= floor + 0.001) continue;
      for (const p of [
        a,
        [a[0], floor, a[2]],
        b,
        b,
        [a[0], floor, a[2]],
        [b[0], floor, b[2]],
      ]) {
        positions.push(...p);
        uv.push(p[0] / 5, p[1] / 5);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const wallMaterial = material.clone();
  wallMaterial.onBeforeCompile = material.onBeforeCompile;
  wallMaterial.customProgramCacheKey = material.customProgramCacheKey;
  wallMaterial.side = T.DoubleSide;
  const mesh = new T.Mesh(geometry, wallMaterial);
  mesh.name = "Prospect forecourt rock cut";
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.center = [
    geometry.boundingSphere!.center.x,
    geometry.boundingSphere!.center.z,
  ];
  return mesh;
}
