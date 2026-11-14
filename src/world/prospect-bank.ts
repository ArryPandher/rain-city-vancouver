import { prospectLookoutHeight } from "./prospect-lookout-site";
import * as T from "three";
import {
  type CityData,
  pointInPoly,
  segmentPoint,
  roadWidth,
  seeded,
  hash,
} from "./data";
import { CollisionWorld } from "./collision";
import { Batcher, subdividePath, flatPolygon } from "./geometry";
import type { Materials } from "./materials";
import { seawallGround, seawallPavers } from "./seawall";
import { PROSPECT_FORECOURT, prospectForecourtHeight } from "./prospect-site";
import { PROSPECT_LIGHT_ID } from "./prospect-lighthouse";
import { coastalGrowth, coastalSlope } from "./prospect-geology";

// Interpreted from the photographed bank and anchored to mapped path/building points.
// These are scenic retaining edges, not surveyed engineering centre lines.
export const PROSPECT_RETAINING = [
  [
    -1545.7, -3405.4, -1547.2, -3411, -1548.6, -3416.5, -1550.2, -3420.5,
    -1553.45, -3424.13,
  ],
  [
    -1557.95, -3425.63, -1566, -3426, -1580, -3422, -1602, -3419, -1615,
    -3417.5,
  ],
];
export const PROSPECT_PLANTING = [
  -1700, -3394, -1658, -3420, -1590, -3430, -1548, -3424, -1517, -3384, -1461,
  -3330, -1460, -3270, -1555, -3260, -1680, -3300,
];
export interface CoastalPlantSite {
  x: number;
  y: number;
  z: number;
  height: number;
  angle: number;
  normal: [number, number, number];
}
export function coastalPlantSites(data: CityData, collision: CollisionWorld) {
  const out: CoastalPlantSite[] = [],
    terrain = data.terrain;
  if (!terrain) return out;
  // Uniform surface-area sampling avoids empty vertical bands on steep faces.
  const step = terrain.details.length ? 1 : 4;
  for (let x = -1700; x < -1460; x += step)
    for (let z = -3432; z < -3260; z += step) {
      const vertices = [
        [x, z],
        [x + step, z],
        [x, z + step],
        [x + step, z + step],
      ].map(([xx, zz]) => new T.Vector3(xx, terrain.height(xx, zz), zz));
      for (const [ti, ids] of [
        [0, [0, 2, 1]],
        [1, [1, 2, 3]],
      ] as const) {
        const a = vertices[ids[0]],
          b = vertices[ids[1]],
          c = vertices[ids[2]],
          cross = b.clone().sub(a).cross(c.clone().sub(a)),
          area = cross.length() / 2,
          r = seeded(hash(`prospect-bank:${x}:${z}:${ti}`)),
          count = Math.floor(area / 7 + r());
        for (let i = 0; i < count; i++) {
          const u = Math.sqrt(r()),
            v = r(),
            p = a
              .clone()
              .multiplyScalar(1 - u)
              .addScaledVector(b, u * (1 - v))
              .addScaledVector(c, u * v);
          if (
            !pointInPoly(p.x, p.z, PROSPECT_PLANTING) ||
            prospectForecourtHeight(p.x, p.z) !== undefined ||
            prospectLookoutHeight(p.x, p.z) !== undefined ||
            p.y < 1.9 ||
            collision.water(p.x, p.z, p.y)
          )
            continue;
          const growth = coastalGrowth(
            p.x,
            p.y,
            p.z,
            coastalSlope(terrain, p.x, p.z),
          );
          if (r() > growth) continue;
          const height = (p.y < 6 ? 1.15 : 0.8) + r() * 0.55,
            radius = height * 1.3 + 0.1;
          if (collision.blocked(p.x, p.z, radius, p.y)) continue;
          let clear = true;
          for (const road of collision.roads.query(p.x, p.z, 22 + radius)) {
            for (let j = 0; j < road.pts.length - 2; j += 2)
              if (
                segmentPoint(
                  p.x,
                  p.z,
                  road.pts[j],
                  road.pts[j + 1],
                  road.pts[j + 2],
                  road.pts[j + 3],
                ).d <
                roadWidth(road) / 2 + radius
              ) {
                clear = false;
                break;
              }
            if (!clear) break;
          }
          if (!clear) continue;
          const dx =
              (terrain.height(p.x + 0.4, p.z) -
                terrain.height(p.x - 0.4, p.z)) /
              0.8,
            dz =
              (terrain.height(p.x, p.z + 0.4) -
                terrain.height(p.x, p.z - 0.4)) /
              0.8,
            normal = new T.Vector3(-dx, 1, -dz).normalize();
          // Low spreading stems lean away from the bank while retaining upward growth.
          normal.lerp(new T.Vector3(0, 1, 0), 0.28).normalize();
          out.push({
            x: p.x,
            y: terrain.height(p.x, p.z) - 0.06,
            z: p.z,
            height,
            angle: r() * Math.PI * 2,
            normal: normal.toArray(),
          });
        }
      }
    }
  return out;
}
export function buildProspectBank(
  parent: T.Object3D,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
) {
  if (!data.terrain) return [];
  const batch = new Batcher(parent, 80),
    concrete = new T.MeshStandardMaterial({
      map: m.texture("theatres/plaster-color.webp", true),
      normalMap: m.texture("theatres/plaster-normal.webp"),
      normalScale: new T.Vector2(0.3, 0.3),
    }),
    pavers = seawallPavers(m);
  concrete.name = "Prospect Point — weathered retaining concrete";
  concrete.color.set(0xa5aa9b);
  concrete.roughness = 0.98;
  concrete.side = T.DoubleSide;
  const joint = new T.MeshStandardMaterial({
    color: 0x343d36,
    roughness: 1,
    side: T.DoubleSide,
  });
  const lighthouse = data.buildings.find((b) => b.id === PROSPECT_LIGHT_ID);
  batch.add(
    flatPolygon(PROSPECT_FORECOURT, lighthouse ? [lighthouse.pts] : [], 2.085),
    pavers,
    -1555,
    -3425,
    "Prospect continuous forecourt",
  );
  const quad = (pts: number[][], material: T.Material, key: string) => {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pts.flat(), 3));
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        key === "bank-paving"
          ? pts.flatMap(([x, , z]) => [x / 5, z / 5])
          : [0, 0, 1, 0, 1, 1, 0, 1],
        2,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    batch.add(g, material, pts[0][0], pts[0][2], key);
  };
  for (const line of PROSPECT_RETAINING) {
    const points = subdividePath(line, 1.1),
      rows = [];
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i],
        z = points[i + 1],
        p = seawallGround(collision, x, z),
        dx = p.inside[0] - x,
        dz = p.inside[1] - z,
        length = Math.hypot(dx, dz) || 1;
      rows.push({
        x,
        z,
        nx: dx / length,
        nz: dz / length,
        y: p.height + 0.07,
        path: p,
      });
    }
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i],
        profile = (p: typeof a) => [
          [p.x + p.nx * 0.28, p.y - 0.12, p.z + p.nz * 0.28],
          [p.x + p.nx * 0.12, p.y + 0.48, p.z + p.nz * 0.12],
          [p.x + p.nx * 0.07, p.y + 1.04, p.z + p.nz * 0.07],
          [p.x - p.nx * 0.18, p.y + 1.04, p.z - p.nz * 0.18],
          [p.x - p.nx * 0.22, p.y - 0.12, p.z - p.nz * 0.22],
        ],
        aa = profile(a),
        bb = profile(b);
      for (let j = 0; j < 4; j++)
        quad([aa[j], bb[j], bb[j + 1], aa[j + 1]], concrete, "retaining");
      collision.addBarrier(a.x, a.z, b.x, b.z, 0.3, Math.max(a.y, b.y) + 1.04);
      const p = [aa[0], bb[0], [...b.path.inside], [...a.path.inside]];
      const plane = p.map((v, j) => {
        const x = v[0],
          z = j < 2 ? v[2] : v[1];
        return [
          x,
          (j === 0 || j === 3 ? a.path.height : b.path.height) + 0.075,
          z,
        ];
      });
      const mat = a.path.road?.surface === "asphalt" ? m.asphalt : pavers;
      const cross =
        (plane[1][0] - plane[0][0]) * (plane[2][2] - plane[0][2]) -
        (plane[1][2] - plane[0][2]) * (plane[2][0] - plane[0][0]);
      if (cross > 0) plane.reverse();
      quad(plane, mat, "bank-paving");
      if (i % 3 === 0) {
        // Drain openings and vertical construction joints break up the long face.
        const g = new T.CircleGeometry(0.065, 12),
          n = new T.Vector3(a.nx, 0, a.nz);
        g.applyQuaternion(
          new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), n),
        );
        g.translate(a.x + a.nx * 0.185, a.y + 0.27, a.z + a.nz * 0.185);
        batch.add(g, joint, a.x, a.z, "drain");
        const v = profile(a);
        quad(
          [
            v[0],
            [v[0][0] + 0.012, v[0][1], v[0][2] + 0.012],
            [v[2][0] + 0.012, v[2][1], v[2][2] + 0.012],
            v[2],
          ],
          joint,
          "joint",
        );
      }
    }
  }
  return batch.finish();
}
