import * as T from "three";
import clipping, { type Polygon, type MultiPolygon } from "polygon-clipping";
import { Batcher, flatPolygon, ribbon, subdividePath } from "./geometry";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import {
  pointInPoly,
  centroid,
  seeded,
  type CityData,
  type Point,
} from "./data";
import type { Materials } from "./materials";
import type { CollisionWorld } from "./collision";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { SpatialInstances } from "./spatial-instances";
import { ringTriangles, partitionTriangle } from "./triangle-partition";
import { JACK_BOUNDARY, jackTriangleHeight } from "./jack-poole-site";
import map from "./harbour-green-map.json";
import {
  HARBOUR_BOUNDARY,
  HARBOUR_PARK,
  HARBOUR_APRON,
  HARBOUR_POOL,
  HARBOUR_POOL_LEVEL,
  HARBOUR_COAST,
  HARBOUR_TRIANGLES,
  HARBOUR_FLIGHTS,
  HARBOUR_LANDING,
  harbourWays,
  harbourContains,
  harbourClearGround,
  harbourBaseHeight,
  harbourGroundHeight,
  harbourFlightHeight,
  harbourPaths,
  pathDistance,
  fountainWorld,
} from "./harbour-green-site";
import type { CoastalPlantSite } from "./prospect-bank";
const polygon = (p: number[]): Polygon => [
  Array.from({ length: p.length / 2 }, (_, i) => [p[i * 2], p[i * 2 + 1]]),
];
const ENTRY = [
  -162.83, -702.21, -117.09, -679.94, -90.63, -757.19, -72.01, -789.85, -95.38,
  -795.69, -110.63, -768.43, -132.25, -753.46,
];
export const harbourLawns: MultiPolygon = clipping.union(
  clipping.difference(
    polygon(HARBOUR_PARK),
    polygon(ENTRY),
    polygon(HARBOUR_APRON),
  ),
  [harbourWays.w223936054.pts],
);
const inLawns = (x: number, z: number) =>
  harbourLawns.some(
    (p) =>
      pointInPoly(x, z, p[0].flat()) &&
      !p.slice(1).some((h) => pointInPoly(x, z, h.flat())),
  );
export const harbourGardens = ["w1086856961", "w1086856962"].map((id) =>
  harbourWays[id].pts.flat(),
);
export function harbourPlantSites(
  collision: CollisionWorld,
): CoastalPlantSite[] {
  if (!collision.harbour) return [];
  const out: CoastalPlantSite[] = [],
    r = seeded(223936055);
  for (const ring of harbourGardens) {
    const xs = ring.filter((_, i) => !(i % 2)),
      zs = ring.filter((_, i) => i % 2);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 0.9)
      for (let z = Math.min(...zs); z < Math.max(...zs); z += 0.9) {
        const xx = x + r() * 0.25,
          zz = z + r() * 0.25;
        if (pointInPoly(xx, zz, ring))
          out.push({
            x: xx,
            y: collision.groundHeight(xx, zz),
            z: zz,
            height: 0.5 + r() * 0.32,
            angle: r() * Math.PI * 2,
            normal: [0, 1, 0],
          });
      }
  }
  return out;
}
export function buildHarbourGreen(
  parent: T.Object3D,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
  refs: ReflectionProbeSpec[],
) {
  if (!collision.harbour) return [];
  const batch = new Batcher(parent, 64),
    mesh = new ArchitecturalMesh(batch, -108, -775),
    random = seeded(223936055);
  const material = (
    name: string,
    color: number,
    roughness = 0.8,
    metalness = 0,
  ) =>
    new T.MeshStandardMaterial({
      name: "Harbour Green — " + name,
      color,
      roughness,
      metalness,
      side: T.DoubleSide,
    });
  const lawn = material("maintained grass", 0xa9bd88, 0.98);
  lawn.map = m.texture("harbour-green/grass_ground-color.webp", true);
  lawn.normalMap = m.texture("harbour-green/grass_ground-normal.webp");
  lawn.normalScale.set(0.32, 0.32);
  lawn.roughnessMap = m.texture("harbour-green/grass_ground-roughness.webp");
  const paving = material("grey waterfront pavers", 0xadb2ac, 0.9);
  paving.map = m.texture("seawall/pavers-color.webp", true);
  paving.normalMap = m.texture("seawall/pavers-normal.webp");
  paving.normalScale.set(0.2, 0.2);
  const granite = material("granite fountain paving", 0xbdc4c0, 0.72);
  granite.map = m.texture("harbour-green/granite_tile-color.webp", true);
  granite.normalMap = m.texture("harbour-green/granite_tile-normal.webp");
  granite.roughnessMap = m.texture("harbour-green/granite_tile-roughness.webp");
  granite.normalScale.set(0.13, 0.13);
  const stone = material("pale cut stone", 0xb6bcb6, 0.88);
  stone.map = m.texture("cast-concrete/color.jpg", true);
  stone.normalMap = m.texture("cast-concrete/normal.jpg");
  stone.normalScale.set(0.07, 0.07);
  const masonry = material("shore retaining stone", 0x929d90, 0.95);
  masonry.map = m.texture("seawall/stone-color.webp", true);
  masonry.normalMap = m.texture("seawall/stone-normal.webp");
  masonry.normalScale.set(0.3, 0.3);
  const metal = material("park ironwork", 0x273130, 0.55, 0.55),
    wood = material("bench slats", 0x625449, 0.8);
  wood.map = m.texture("houses/painted-wood-color.webp", true);
  const soil = material("garden earth", 0x343b27, 0.98),
    asphalt = m.asphalt;
  const signFace = material("park entrance sign", 0xffffff, 0.8);
  signFace.map = m.texture("harbour-green/park-sign.webp", true);
  const land = ringTriangles(HARBOUR_BOUNDARY),
    lawnTriangles = harbourLawns.flatMap((p) => ringTriangles(p[0].flat())),
    cuts = [
      JACK_BOUNDARY,
      HARBOUR_POOL,
      HARBOUR_LANDING.pts,
      ...HARBOUR_FLIGHTS.map((f) => f.pts),
    ].flatMap(ringTriangles);
  // Each terrain piece uses the same triangle equation queried by collision.
  for (const t of HARBOUR_TRIANGLES) {
    const pieces = partitionTriangle(t.p, land, cuts);
    for (const p of pieces) {
      const grass = partitionTriangle(p, lawnTriangles, []),
        other = partitionTriangle(p, ringTriangles(p.flat()), lawnTriangles);
      for (const [regions, mat, scale] of [
        [grass, lawn, 2.51],
        [other, paving, 2.8],
      ] as const)
        for (const ring of regions) {
          const g = flatPolygon(ring.flat(), [], 0, scale),
            a = g.getAttribute("position"),
            n = g.getAttribute("normal");
          for (let i = 0; i < a.count; i++) {
            const x = a.getX(i),
              z = a.getZ(i);
            a.setY(i, jackTriangleHeight(t, x, z).height + 0.018);
            const h = 0.3,
              v = new T.Vector3(
                harbourBaseHeight(x - h, z) - harbourBaseHeight(x + h, z),
                h * 2,
                harbourBaseHeight(x, z - h) - harbourBaseHeight(x, z + h),
              ).normalize();
            n.setXYZ(i, v.x, v.y, v.z);
          }
          const [x, z] = centroid(ring.flat());
          batch.add(g, mat, x, z);
        }
    }
  }
  function surface(
    p: number[],
    mat: T.Material,
    height: (x: number, z: number) => number,
    scale = 2.3,
  ) {
    const g = flatPolygon(p, [], 0, scale),
      a = g.getAttribute("position");
    for (let i = 0; i < a.count; i++) a.setY(i, height(a.getX(i), a.getZ(i)));
    g.computeVertexNormals();
    const [x, z] = centroid(p);
    batch.add(g, mat, x, z);
  }
  const height = (x: number, z: number) =>
    harbourGroundHeight(x, z) ?? collision.groundHeight(x, z);
  // Joined ribbons keep bends continuous; exclude triangles beyond the site or on stairs.
  function route(
    points: Point[],
    width: number,
    mat: T.Material,
    raise = 0.05,
  ) {
    const p = subdividePath(points.flat(), 1),
      g = ribbon(p, width, raise, height, 2.3, true),
      a = g.getAttribute("position"),
      index = g.getIndex()!,
      visible: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)],
        x = ids.reduce((sum, j) => sum + a.getX(j), 0) / 3,
        z = ids.reduce((sum, j) => sum + a.getZ(j), 0) / 3;
      if (
        !harbourContains(x, z) ||
        HARBOUR_FLIGHTS.some((f) => pointInPoly(x, z, f.pts))
      )
        continue;
      visible.push(...ids);
    }
    g.setIndex(visible);
    const [x, z] = centroid(p);
    batch.add(g, mat, x, z);
  }
  for (const p of harbourPaths)
    route(
      p.pts,
      p.width,
      p.kind === "cycle" ? asphalt : p.kind === "dirt" ? soil : paving,
    );
  const promenade: Point[] = HARBOUR_COAST.map((p, i) => {
    const a = HARBOUR_COAST[Math.max(0, i - 1)],
      b = HARBOUR_COAST[Math.min(HARBOUR_COAST.length - 1, i + 1)],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [p[0] - ((b[1] - a[1]) * 3.7) / l, p[1] + ((b[0] - a[0]) * 3.7) / l];
  });
  route(promenade, 5.8, paving);
  for (const ring of harbourGardens)
    surface(ring, soil, (x, z) => height(x, z) + 0.06);
  // Short shore faces and periodic pale bands preserve the low open water edge.
  for (let i = 0; i < HARBOUR_COAST.length - 1; i++) {
    const a = HARBOUR_COAST[i],
      b = HARBOUR_COAST[i + 1],
      f = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = -(b[1] - a[1]) / f,
      nz = (b[0] - a[0]) / f;
    for (let j = 0; j < f; j += 2.5) {
      const t = j / f,
        tt = Math.min(1, (j + 2.5) / f),
        p: [number, number] = [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
        ],
        q: [number, number] = [
          a[0] + (b[0] - a[0]) * tt,
          a[1] + (b[1] - a[1]) * tt,
        ];
      if (!harbourContains(p[0] + nx * 0.2, p[1] + nz * 0.2)) continue;
      const y = harbourBaseHeight(...p),
        yy = harbourBaseHeight(...q);
      mesh.quad(
        masonry,
        [p[0], -0.5, p[1]],
        [p[0], y, p[1]],
        [q[0], yy, q[1]],
        [q[0], -0.5, q[1]],
        [0, 0, 0, y / 2, 1, yy / 2, 1, 0],
      );
      mesh.beam(
        [p[0], y + 0.06, p[1]],
        [q[0], yy + 0.06, q[1]],
        0.13,
        stone,
        4,
      );
    }
  }
  // The mapped central flight has 27 risers; six small seawall flights have three.
  for (const f of HARBOUR_FLIGHTS) {
    const dx = f.b[0] - f.a[0],
      dz = f.b[1] - f.a[1],
      len = Math.hypot(dx, dz),
      nx = dz / len,
      nz = -dx / len;
    for (let i = 0; i < f.steps; i++) {
      const at = (t: number): Point => [f.a[0] + dx * t, f.a[1] + dz * t],
        a = at(i / f.steps),
        b = at((i + 1) / f.steps),
        mid = at((i + 0.5) / f.steps),
        y = harbourFlightHeight(f, ...mid);
      surface(
        [
          a[0] + (nx * f.width) / 2,
          a[1] + (nz * f.width) / 2,
          b[0] + (nx * f.width) / 2,
          b[1] + (nz * f.width) / 2,
          b[0] - (nx * f.width) / 2,
          b[1] - (nz * f.width) / 2,
          a[0] - (nx * f.width) / 2,
          a[1] - (nz * f.width) / 2,
        ],
        stone,
        () => y + 0.018,
      );
      const edge = f.high > f.low ? b : a,
        upper = y + Math.abs(f.high - f.low) / f.steps;
      mesh.quad(
        stone,
        [edge[0] - (nx * f.width) / 2, y + 0.018, edge[1] - (nz * f.width) / 2],
        [
          edge[0] - (nx * f.width) / 2,
          upper + 0.018,
          edge[1] - (nz * f.width) / 2,
        ],
        [
          edge[0] + (nx * f.width) / 2,
          upper + 0.018,
          edge[1] + (nz * f.width) / 2,
        ],
        [edge[0] + (nx * f.width) / 2, y + 0.018, edge[1] + (nz * f.width) / 2],
      );
    }
    if (f.id.startsWith("w48271068"))
      for (const side of [-1, 1]) {
        const a: Vertex3 = [
            f.a[0] + (dx / len) * 0.9 + nx * (f.width / 2 + 0.16) * side,
            f.low + ((f.high - f.low) * 0.9) / len,
            f.a[1] + (dz / len) * 0.9 + nz * (f.width / 2 + 0.16) * side,
          ],
          b: Vertex3 = [
            f.b[0] - (dx / len) * 0.9 + nx * (f.width / 2 + 0.16) * side,
            f.high - ((f.high - f.low) * 0.9) / len,
            f.b[1] - (dz / len) * 0.9 + nz * (f.width / 2 + 0.16) * side,
          ];
        mesh.quad(
          stone,
          [a[0], a[1] - 0.2, a[2]],
          [a[0], a[1] + 0.54, a[2]],
          [b[0], b[1] + 0.54, b[2]],
          [b[0], b[1] - 0.2, b[2]],
        );
        mesh.beam(
          [a[0], a[1] + 0.95, a[2]],
          [b[0], b[1] + 0.95, b[2]],
          0.035,
          metal,
        );
        collision.addBarrier(
          a[0],
          a[2],
          b[0],
          b[2],
          0.13,
          Math.max(a[1], b[1]) + 0.54,
        );
        for (let t = 0; t <= 1; t += 0.25) {
          const p = a.map((v, i) => v + (b[i] - v) * t) as Vertex3;
          mesh.beam(
            [p[0], p[1] + 0.5, p[2]],
            [p[0], p[1] + 0.95, p[2]],
            0.025,
            metal,
          );
        }
      }
  }
  surface(HARBOUR_LANDING.pts, stone, () => HARBOUR_LANDING.height + 0.018);
  surface(HARBOUR_POOL, granite, () => HARBOUR_POOL_LEVEL + 0.023);
  const time = { value: 0 };
  m.animatedUniforms.push(time);
  const water = new T.MeshPhysicalMaterial({
    name: "Harbour Green — shallow spray-pool water",
    color: 0x93aaa3,
    roughness: 0.24,
    metalness: 0.05,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    clearcoat: 1,
    side: T.DoubleSide,
  });
  water.userData.castShadow = false;
  water.onBeforeCompile = (s) => {
    s.uniforms.hgTime = time;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 hgPoint;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nhgPoint=position.xz;",
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float hgTime;varying vec2 hgPoint;",
      )
      .replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(sin(hgPoint.x*8.+hgTime*2.)*.025,cos(hgPoint.y*9.-hgTime*1.4)*.025,0.));",
      );
  };
  water.customProgramCacheKey = () => "harbour-green-water-v1";
  surface(HARBOUR_POOL, water, () => HARBOUR_POOL_LEVEL + 0.038);
  const fw = (u: number, y: number, v: number): Vertex3 => {
      const [x, z] = fountainWorld(u, v);
      return [x, y, z];
    },
    angle = -Math.atan2(6.61, 12.06);
  const obstacle = (x: number, z: number, w: number, y: number) => {
    for (const [a, b] of [
      [
        [x - w, z - w],
        [x + w, z - w],
      ],
      [
        [x + w, z - w],
        [x + w, z + w],
      ],
      [
        [x + w, z + w],
        [x - w, z + w],
      ],
      [
        [x - w, z + w],
        [x - w, z - w],
      ],
    ] as Point[][])
      collision.addBarrier(...a, ...b, 0.04, y);
  };
  for (const u of [-0.85, 14.6])
    for (const v of [0, 7.2, 14.4, 21.7]) {
      const base = fw(u, HARBOUR_POOL_LEVEL + 0.58, v);
      mesh.box(base, 1.12, 1.16, 1.12, stone, angle);
      mesh.box([base[0], base[1] + 0.65, base[2]], 1.3, 0.2, 1.3, stone, angle);
      const cap = new T.ConeGeometry(0.93, 0.58, 4);
      cap.rotateY(Math.PI / 4 + angle);
      cap.translate(base[0], base[1] + 1.03, base[2]);
      mesh.add(cap, stone);
      obstacle(base[0], base[2], 0.55, base[1] + 1.32);
      collision.addForestTrunk(base[0], base[2], 0.62);
    }
  // Ballistic droplets follow real parabolic arcs; the shallow pool is walkable.
  const origins: number[] = [],
    velocities: number[] = [],
    phases: number[] = [],
    lifetimes: number[] = [];
  const nozzle = (
    u: number,
    v: number,
    du: number,
    dv: number,
    vy: number,
    life: number,
  ) => {
    const p = fw(u, HARBOUR_POOL_LEVEL + 0.1, v),
      q = fw(u + du, 0, v + dv);
    mesh.beam([p[0], p[1] - 0.1, p[2]], p, 0.045, metal, 8);
    for (let i = 0; i < 140; i++) {
      origins.push(
        p[0] + (random() - 0.5) * 0.035,
        p[1],
        p[2] + (random() - 0.5) * 0.035,
      );
      velocities.push(
        q[0] - p[0] + (random() - 0.5) * 0.09,
        vy + (random() - 0.5) * 0.16,
        q[2] - p[2] + (random() - 0.5) * 0.09,
      );
      phases.push(random());
      lifetimes.push(life);
    }
  };
  for (const u of [3.5, 10.2])
    for (const v of [4, 11, 18]) nozzle(u, v, 0, 0, 5.0, 0.99);
  for (const v of [6.5, 15.5]) {
    nozzle(-0.3, v, 5.2, 0, 6.5, 1.32);
    nozzle(14.1, v, -5.2, 0, 6.5, 1.32);
  }
  const droplets = new T.BufferGeometry();
  droplets.setAttribute("position", new T.Float32BufferAttribute(origins, 3));
  droplets.setAttribute(
    "velocity",
    new T.Float32BufferAttribute(velocities, 3),
  );
  droplets.setAttribute("phase", new T.Float32BufferAttribute(phases, 1));
  droplets.setAttribute("life", new T.Float32BufferAttribute(lifetimes, 1));
  const spray = new T.ShaderMaterial({
    name: "Harbour Green — fountain droplets",
    uniforms: { hgTime: time },
    transparent: true,
    depthWrite: false,
    vertexShader:
      "uniform float hgTime;attribute vec3 velocity;attribute float phase;attribute float life;varying float alpha;void main(){float t=fract(hgTime/life+phase)*life;vec3 p=position+velocity*t;p.y-=4.9*t*t;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(130./-mv.z,1.,5.);alpha=smoothstep(0.,.08,t)*(1.-smoothstep(life-.16,life,t));}",
    fragmentShader:
      "varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.82,.91,.94,(1.-smoothstep(.15,.5,d))*.67*alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  });
  const jets = new T.Points(droplets, spray);
  jets.name = "Harbour Green fountain jets";
  droplets.computeBoundingBox();
  droplets.boundingBox!.expandByScalar(10);
  droplets.boundingSphere = new T.Sphere();
  droplets.boundingBox!.getBoundingSphere(droplets.boundingSphere);
  parent.add(jets);
  refs.push({
    name: "Harbour Green fountain",
    position: [
      ...(() => {
        const p = fountainWorld(7, 10);
        return [p[0], HARBOUR_POOL_LEVEL + 0.6, p[1]];
      })(),
    ] as Vertex3,
    materials: [water],
    intensity: { day: 0.65, night: 0.22 },
  });
  // Mapped benches face the water, with timber slats and curved iron armrests.
  for (const poi of map.pois) {
    if (poi.tags.amenity !== "bench") continue;
    const [x, z] = poi.point;
    if (!harbourContains(x, z)) continue;
    const near = pathDistance(x, z, HARBOUR_COAST),
      a = HARBOUR_COAST[near.index],
      b = HARBOUR_COAST[near.index + 1],
      heading = -Math.atan2(b[1] - a[1], b[0] - a[0]),
      y = height(x, z);
    const at = (u: number, h: number, v: number): Vertex3 => [
      x + u * Math.cos(heading) + v * Math.sin(heading),
      y + h,
      z - u * Math.sin(heading) + v * Math.cos(heading),
    ];
    const ba = at(-0.88, 0, 0.12),
      bb = at(0.88, 0, 0.12);
    collision.addBarrier(ba[0], ba[2], bb[0], bb[2], 0.3, y + 1.15);
    for (let k = 0; k < 5; k++)
      mesh.box(at(0, 0.47, -0.29 + k * 0.13), 1.8, 0.06, 0.1, wood, heading);
    for (let k = 0; k < 5; k++)
      mesh.box(
        at(0, 0.65 + k * 0.095, 0.3 + k * 0.025),
        1.8,
        0.06,
        0.055,
        wood,
        heading,
      );
    for (const u of [-0.72, 0.72]) {
      mesh.beam(at(u, 0.06, -0.24), at(u, 0.47, -0.24), 0.045, metal);
      mesh.beam(at(u, 0.05, 0.28), at(u, 1.12, 0.4), 0.045, metal);
      const curve = new T.CatmullRomCurve3(
        [
          at(u, 0.5, -0.3),
          at(u, 0.76, -0.28),
          at(u, 0.77, 0.13),
          at(u, 0.87, 0.37),
        ].map((p) => new T.Vector3(...p)),
      );
      mesh.add(new T.TubeGeometry(curve, 12, 0.026, 6, false), metal);
    }
  }
  const lamp = material("warm lantern glass", 0xffedc8, 0.5);
  lamp.emissive.setHex(0xffd293);
  m.neonMaterials.push({ material: lamp, day: 0, night: 1.5 });
  for (let i = 1; i < promenade.length - 1; i++) {
    const p = promenade[i],
      q = HARBOUR_COAST[i],
      dx = p[0] - q[0],
      dz = p[1] - q[1],
      l = Math.hypot(dx, dz),
      x = p[0] + (dx / l) * 3.7,
      z = p[1] + (dz / l) * 3.7;
    if (!harbourContains(x, z)) continue;
    const y = height(x, z);
    collision.addForestTrunk(x, z, 0.23);
    mesh.box([x, y + 0.2, z], 0.45, 0.4, 0.45, stone);
    mesh.beam([x, y + 0.4, z], [x, y + 4.2, z], 0.075, metal, 10);
    mesh.box([x, y + 4.35, z], 0.3, 0.46, 0.3, lamp);
    mesh.box([x, y + 4.63, z], 0.44, 0.12, 0.44, metal);
    for (const ox of [-0.16, 0.16])
      for (const oz of [-0.16, 0.16])
        mesh.beam(
          [x + ox, y + 4.1, z + oz],
          [x + ox, y + 4.61, z + oz],
          0.025,
          metal,
          5,
        );
  }
  // Foundations close the small grade gaps under neighbouring city-block shells.
  {
    const [x, z] = fountainWorld(-12, -34),
      y = height(x, z),
      l = Math.hypot(12.06, 6.61),
      ux = 12.06 / l,
      uz = 6.61 / l;
    mesh.box([x, y + 1.5, z], 2.8, 1.4, 0.12, metal, angle);
    const front = (u: number, h: number): Vertex3 => [
      x + ux * u - uz * 0.065,
      y + h,
      z + uz * u + ux * 0.065,
    ];
    mesh.quad(
      signFace,
      front(-1.4, 0.8),
      front(1.4, 0.8),
      front(1.4, 2.2),
      front(-1.4, 2.2),
      [0, 0, 1, 0, 1, 1, 0, 1],
    );
    for (const u of [-1.1, 1.1])
      mesh.beam(front(u, 0), front(u, 2.22), 0.06, metal, 8);
    const a = front(-1.4, 0),
      b = front(1.4, 0);
    collision.addBarrier(a[0], a[2], b[0], b[2], 0.08, y + 2.2);
  }
  for (const b of data.buildings) {
    const [cx, cz] = centroid(b.pts);
    if (!harbourContains(cx, cz)) continue;
    const top = collision.groundHeight(cx, cz);
    for (let i = 0; i < b.pts.length; i += 2) {
      const j = (i + 2) % b.pts.length,
        a: [number, number] = [b.pts[i], b.pts[i + 1]],
        q: [number, number] = [b.pts[j], b.pts[j + 1]],
        lo = Math.min(height(...a), height(...q)) - 0.08;
      if (lo < top - 0.05)
        mesh.quad(
          stone,
          [a[0], lo, a[1]],
          [a[0], top + 0.04, a[1]],
          [q[0], top + 0.04, q[1]],
          [q[0], lo, q[1]],
        );
    }
  }
  mesh.finish();
  const chunks = batch.finish();
  // Low grass geometry is distributed in small spatial tiles, never one park-wide draw.
  const blades: number[] = [],
    bladeUV: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = random() * Math.PI * 2,
      x = (random() - 0.5) * 0.75,
      z = (random() - 0.5) * 0.75,
      w = 0.008 + random() * 0.006,
      h = 0.07 + random() * 0.09;
    blades.push(
      x - w * Math.cos(a),
      0,
      z - w * Math.sin(a),
      x + w * Math.cos(a),
      0,
      z + w * Math.sin(a),
      x + 0.04 * Math.sin(a),
      h,
      z + 0.04 * Math.cos(a),
    );
    bladeUV.push(0, 0, 1, 0, 0.5, 1);
  }
  const bladeGeometry = new T.BufferGeometry();
  bladeGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(blades, 3),
  );
  bladeGeometry.setAttribute("uv", new T.Float32BufferAttribute(bladeUV, 2));
  bladeGeometry.computeVertexNormals();
  const grass = material("short lawn blades", 0x668b39, 0.98);
  grass.userData.castShadow = false;
  const points: Vertex3[] = [];
  for (let x = -280; x < 80; x += 0.95)
    for (let z = -920; z < -680; z += 0.95) {
      const xx = x + random() * 0.6,
        zz = z + random() * 0.6;
      if (
        harbourContains(xx, zz) &&
        inLawns(xx, zz) &&
        !harbourClearGround(xx, zz)
      )
        points.push([xx, height(xx, zz), zz]);
    }
  const source = new T.InstancedMesh(bladeGeometry, grass, points.length);
  source.name = "Harbour Green short grass";
  source.receiveShadow = true;
  const dummy = new T.Object3D();
  points.forEach((p, i) => {
    dummy.position.set(...p);
    dummy.rotation.y = random() * Math.PI * 2;
    dummy.updateMatrix();
    source.setMatrixAt(i, dummy.matrix);
  });
  source.instanceMatrix.needsUpdate = true;
  const tiles = new SpatialInstances(source, parent, 24);
  tiles.update();
  for (const tile of tiles.tiles) {
    tile.userData.detail = true;
    tile.userData.allowShadow = false;
    tile.computeBoundingSphere();
    tile.userData.center = [
      tile.boundingSphere!.center.x,
      tile.boundingSphere!.center.z,
    ];
    chunks.push(tile);
  }
  return chunks;
}
