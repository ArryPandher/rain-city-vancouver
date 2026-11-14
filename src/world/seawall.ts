import * as T from "three";
import {
  type CityData,
  type Road,
  segmentPoint,
  roadWidth,
  pointInPoly,
} from "./data";
import { CollisionWorld } from "./collision";
import { Batcher, subdividePath } from "./geometry";
import { type Materials } from "./materials";

const pavingMaterials = new WeakMap<Materials, T.MeshStandardMaterial>();
export function seawallPavers(m: Materials) {
  let material = pavingMaterials.get(m);
  if (material) return material;
  material = new T.MeshStandardMaterial({
    name: "Stanley seawall — herringbone paving",
    map: m.texture("seawall/pavers-color.webp", true),
    normalMap: m.texture("seawall/pavers-normal.webp"),
    roughnessMap: m.texture("seawall/pavers-roughness.webp"),
    roughness: 0.94,
    color: 0xc3c1b7,
    normalScale: new T.Vector2(0.45, 0.45),
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
vec2 pavingUv=(modelMatrix*vec4(position,1.0)).xz/2.0;
vMapUv=pavingUv;
vNormalMapUv=pavingUv;
vRoughnessMapUv=pavingUv;`,
    );
  };
  material.customProgramCacheKey = () => "seawall-herringbone-world-uv-v1";
  pavingMaterials.set(m, material);
  return material;
}

export function seawallGround(collision: CollisionWorld, x: number, z: number) {
  let best: { x: number; z: number; d: number; road: Road } | undefined;
  for (const road of collision.roads.query(x, z, 30)) {
    if (!/^Stanley Park Seawall/.test(road.name ?? "")) continue;
    for (let i = 0; i < road.pts.length - 2; i += 2) {
      const p = segmentPoint(
        x,
        z,
        road.pts[i],
        road.pts[i + 1],
        road.pts[i + 2],
        road.pts[i + 3],
      );
      if (p.d < 30 && (!best || p.d < best.d)) best = { ...p, road };
    }
  }
  return {
    height: best
      ? collision.groundHeight(best.x, best.z)
      : collision.groundHeight(x, z),
    inside: best ? [best.x, best.z] : [-1750, -2450],
    clearance: best ? roadWidth(best.road) / 2 + 0.35 : 0,
    road: best?.road,
  };
}
export function buildSeawall(
  parent: T.Object3D,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
) {
  const batch = new Batcher(parent, 160),
    layer = data.seawall;
  if (!layer) return [];
  const stone = new T.MeshStandardMaterial({
    name: "Stanley seawall — granite masonry",
    map: m.texture("seawall/stone-color.webp", true),
    normalMap: m.texture("seawall/stone-normal.webp"),
    roughnessMap: m.texture("seawall/stone-roughness.webp"),
    color: 0x8d948b,
    roughness: 0.96,
    normalScale: new T.Vector2(0.6, 0.6),
    side: T.DoubleSide,
  });
  stone.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vSeawallPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSeawallPosition=(modelMatrix*vec4(position,1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vSeawallPosition;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float tideShade=mix(.35,1.0,smoothstep(-.1,1.35,vSeawallPosition.y));
diffuseColor.rgb*=tideShade;
diffuseColor.rgb*=.89+.11*sin(vSeawallPosition.x*.32+sin(vSeawallPosition.z*.27));`,
      );
  };
  stone.customProgramCacheKey = () => "stanley-seawall-damp-v1";
  const coping = m.concrete.clone();
  coping.name = "Stanley seawall — stone coping";
  coping.color.set(0x899087);
  coping.side = T.DoubleSide;
  const pavers = seawallPavers(m);
  const metal = new T.MeshStandardMaterial({
    name: "Stanley seawall — railing",
    color: 0x404c49,
    metalness: 0.6,
    roughness: 0.58,
  });
  // Walking and cycling are separately mapped centrelines of one paved route.
  // Fill only the narrow, parallel gap between those lines, leaving other trails alone.
  for (const road of data.roads) {
    if (road.name !== "Stanley Park Seawall" || road.surface !== "asphalt")
      continue;
    const points = subdividePath(road.pts, 2);
    for (let i = 2; i < points.length; i += 2) {
      const a = [points[i - 2], points[i - 1]],
        b = [points[i], points[i + 1]],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      const closest = (p: number[]) => {
        let best: { x: number; z: number; d: number } | undefined;
        for (const bike of collision.roads.query(p[0], p[1], 6)) {
          if (bike.name !== "Stanley Park Seawall Bike Path") continue;
          for (let j = 0; j < bike.pts.length - 2; j += 2) {
            const ux = bike.pts[j + 2] - bike.pts[j],
              uz = bike.pts[j + 3] - bike.pts[j + 1],
              aligned =
                Math.abs(dx * ux + dz * uz) / (length * Math.hypot(ux, uz));
            if (aligned < 0.85) continue;
            const near = segmentPoint(
              p[0],
              p[1],
              bike.pts[j],
              bike.pts[j + 1],
              bike.pts[j + 2],
              bike.pts[j + 3],
            );
            if (near.d < 6 && (!best || near.d < best.d)) best = near;
          }
        }
        return best;
      };
      const aa = closest(a),
        bb = closest(b);
      if (!aa || !bb || Math.max(aa.d, bb.d) < 0.2) continue;
      const pts = [a, b, [bb.x, bb.z], [aa.x, aa.z]],
        pos = pts.flatMap(([x, z]) => [
          x,
          collision.groundHeight(x, z) + 0.068,
          z,
        ]),
        g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          pts.flatMap(([x, z]) => [x / 5, z / 5]),
          2,
        ),
      );
      const signed = dx * (bb.z - a[1]) - dz * (bb.x - a[0]);
      g.setIndex(signed < 0 ? [0, 1, 2, 0, 2, 3] : [2, 1, 0, 3, 2, 0]);
      g.computeVertexNormals();
      batch.add(g, m.asphalt, a[0], a[1], "seawall-paving");
    }
  }
  for (const line of layer.walls) {
    const points = subdividePath(line.pts, 1.6),
      rows: {
        x: number;
        z: number;
        nx: number;
        nz: number;
        h: number;
        s: number;
        profile: ReturnType<typeof seawallGround>;
      }[] = [];
    let distance = 0;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i],
        z = points[i + 1],
        before = Math.max(0, i - 2),
        after = Math.min(points.length - 2, i + 2),
        dx = points[after] - points[before],
        dz = points[after + 1] - points[before + 1],
        len = Math.hypot(dx, dz),
        profile = seawallGround(collision, x, z);
      let nx = -dz / len,
        nz = dx / len;
      const plusWater = data.ocean.some((p) =>
          pointInPoly(x + nx * 8, z + nz * 8, p),
        ),
        minusWater = data.ocean.some((p) =>
          pointInPoly(x - nx * 8, z - nz * 8, p),
        ),
        previous = rows.at(-1);
      const reverse =
        plusWater !== minusWater
          ? minusWater
          : previous
            ? nx * previous.nx + nz * previous.nz < 0
            : nx * (x + 1750) + nz * (z + 2450) < 0;
      if (reverse) {
        nx = -nx;
        nz = -nz;
      }
      if (i) distance += Math.hypot(x - points[i - 2], z - points[i - 1]);
      const signedClearance =
        nx * (x - profile.inside[0]) + nz * (z - profile.inside[1]);
      const offset = Math.min(
        3,
        Math.max(0, profile.clearance - signedClearance),
      );
      rows.push({
        x: x + nx * offset,
        z: z + nz * offset,
        nx,
        nz,
        h: Math.max(0.4, profile.height + 0.13),
        s: distance,
        profile,
      });
    }
    const shape = (p: (typeof rows)[number]) => {
      const cap = 0.19 - (p.s % 5 > 4.65 ? 0.11 : 0);
      return [
        [-0.23, -0.7],
        [-0.23, p.h],
        [-0.28, p.h + cap],
        [0.35, p.h + cap],
        [0.34, p.h - 0.06],
        [0.62, -0.7],
      ].map(([offset, y]) => [p.x + p.nx * offset, y, p.z + p.nz * offset]);
    };
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i],
        aa = shape(a),
        bb = shape(b),
        cx = (a.x + b.x) / 2,
        cz = (a.z + b.z) / 2;
      for (let j = 0; j < 5; j++) {
        const pos = [...aa[j], ...bb[j], ...bb[j + 1], ...aa[j + 1]],
          uv = [
            a.s / 1.9,
            aa[j][1] / 1.9,
            b.s / 1.9,
            bb[j][1] / 1.9,
            b.s / 1.9,
            bb[j + 1][1] / 1.9,
            a.s / 1.9,
            aa[j + 1][1] / 1.9,
          ];
        if (j === 2) {
          uv[1] = 0;
          uv[3] = 0;
          uv[5] = 0.35;
          uv[7] = 0.35;
        }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.computeVertexNormals();
        batch.add(g, j >= 1 && j <= 3 ? coping : stone, cx, cz);
      }
      // The wall and path are independently mapped. Join the paved lane to
      // the inner wall toe instead of exposing a strip of grass between them.
      const pa = a.profile,
        pb = b.profile;
      if (
        pa.road &&
        pb.road &&
        Math.max(
          Math.hypot(a.x - pa.inside[0], a.z - pa.inside[1]),
          Math.hypot(b.x - pb.inside[0], b.z - pb.inside[1]),
        ) < 6
      ) {
        const pts = [
          [a.x - a.nx * 0.24, a.z - a.nz * 0.24],
          [b.x - b.nx * 0.24, b.z - b.nz * 0.24],
          pb.inside,
          pa.inside,
        ];
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.Float32BufferAttribute(
            pts.flatMap(([x, z]) => [
              x,
              collision.groundHeight(x, z) + 0.066,
              z,
            ]),
            3,
          ),
        );
        g.setAttribute(
          "uv",
          new T.Float32BufferAttribute(
            pts.flatMap(([x, z]) => [x / 5, z / 5]),
            2,
          ),
        );
        const cross =
          (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) -
          (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
        g.setIndex(cross < 0 ? [0, 1, 2, 0, 2, 3] : [2, 1, 0, 3, 2, 0]);
        g.computeVertexNormals();
        batch.add(
          g,
          pa.road.surface === "paving_stones" ? pavers : m.asphalt,
          cx,
          cz,
          "seawall-paving",
        );
      }
      collision.addBarrier(a.x, a.z, b.x, b.z, 0.22, Math.max(a.h, b.h) + 0.2);
    }
  }
  const stairs = data.roads.find((road) => road.id === "w731791394");
  if (stairs) {
    const [ax, az, bx, bz] = stairs.pts,
      length = Math.hypot(bx - ax, bz - az),
      top = collision.groundHeight(ax, az) + 0.07,
      count = Math.ceil((top + 0.25) / 0.18),
      run = length / count;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        height = top - ((top + 0.25) * i) / count,
        x = ax + (bx - ax) * t,
        z = az + (bz - az) * t;
      const g = new T.BoxGeometry(run + 0.005, height + 0.7, 1.25);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate(x, (height - 0.7) / 2, z);
      batch.add(g, coping, x, z, "shore-stairs");
    }
  }
  for (const line of layer.railings) {
    const points = subdividePath(line.pts, 1.3);
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i],
        z = points[i + 1],
        y = seawallGround(collision, x, z).height + 0.14;
      batch.add(
        new T.CylinderGeometry(0.035, 0.04, 1.05, 8).translate(x, y + 0.525, z),
        metal,
        x,
        z,
      );
      if (i) {
        const ax = points[i - 2],
          az = points[i - 1],
          ay = seawallGround(collision, ax, az).height + 0.14;
        for (const h of [0.48, 1.0]) {
          const start = new T.Vector3(ax, ay + h, az),
            end = new T.Vector3(x, y + h, z),
            delta = end.clone().sub(start),
            g = new T.CylinderGeometry(0.028, 0.028, delta.length(), 8);
          g.applyQuaternion(
            new T.Quaternion().setFromUnitVectors(
              new T.Vector3(0, 1, 0),
              delta.normalize(),
            ),
          );
          g.translate(...start.add(end).multiplyScalar(0.5).toArray());
          batch.add(g, metal, x, z);
        }
        collision.addBarrier(ax, az, x, z, 0.05, Math.max(ay, y) + 1.05);
      }
    }
  }
  return batch.finish();
}
