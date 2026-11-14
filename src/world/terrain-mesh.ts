import * as T from "three";
import { pointInPoly, type Area } from "./data";
import { SpatialHash } from "./collision";
import { Terrain } from "./terrain";

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
) {
  const index = new SpatialHash<TerrainArea>(64),
    m = terrain.meta;
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
  for (let tz = 0; tz < m.rows - 1; tz += 40)
    for (let tx = 0; tx < m.columns - 1; tx += 40) {
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
      for (let iz = tz; iz < Math.min(tz + 40, m.rows - 1); iz++)
        for (let ix = tx; ix < Math.min(tx + 40, m.columns - 1); ix++) {
          const ids = [
            iz * m.columns + ix,
            iz * m.columns + ix + 1,
            (iz + 1) * m.columns + ix,
            (iz + 1) * m.columns + ix + 1,
          ];
          if (ids.every((i) => terrain.values[i] === 0)) continue;
          const x = m.minX + (ix + 0.5) * m.step,
            z = m.minZ + (iz + 0.5) * m.step;
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
                terrain.height(xx + 0.5, zz) - terrain.height(xx - 0.5, zz),
              dz = terrain.height(xx, zz + 0.5) - terrain.height(xx, zz - 0.5),
              n = Math.hypot(dx, 1, dz);
            group!.normal.push(-dx / n, 1 / n, -dz / n);
            return vertex;
          });
          group.idx.push(
            local[0],
            local[2],
            local[1],
            local[1],
            local[2],
            local[3],
          );
        }
      for (const [material, g] of groups) {
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
          m.minX + (tx + 20) * m.step,
          m.minZ + (tz + 20) * m.step,
        ];
        chunks.push(mesh);
      }
    }
  return chunks;
}
