import * as T from "three";
import type { Building, Point } from "./data";
import { seeded } from "./data";
import { Batcher } from "./geometry";
import { Materials, label } from "./materials";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import {
  ROGERS_ID,
  ROGERS_BASE,
  ROGERS_ROOFS,
  ROGERS_LIGHT,
  ROGERS_POOL,
  rogersSection,
  rogersRoof,
  rogersWorld,
  rogersLocal,
} from "./rogers-site";
import type { CollisionWorld } from "./collision";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";

/** Reference-guided exterior and scenery lobby. Source photographs and the
 * artist's original media are not shipped; dimensions between mapped edges
 * and the Light Art representation are authored interpretations. */
export function rogersTower(
  b: Building,
  batch: Batcher,
  m: Materials,
  collision: CollisionWorld,
  refs: ReflectionProbeSpec[],
) {
  if (b.id !== ROGERS_ID) return false;
  const previous = batch.offsetY;
  batch.offsetY = 0;
  const mesh = new ArchitecturalMesh(batch, 154, -598),
    random = seeded(361502265);
  const mat = (name: string, color: number, roughness = 0.7, metalness = 0) =>
    new T.MeshStandardMaterial({
      name: `Rogers Tower — ${name}`,
      color,
      roughness,
      metalness,
      side: T.DoubleSide,
    });
  const frame = mat("silver glazing mullions", 0xaeb6b5, 0.35, 0.67);
  const white = mat("slab edges and soffits", 0xc9ccca, 0.77);
  const dark = mat("glazing seals", 0x212b32, 0.7);
  const stone = mat("grey plaza stone", 0x8a908b, 0.85);
  stone.map = m.texture("cast-concrete/color.jpg", true);
  stone.normalMap = m.texture("cast-concrete/normal.jpg");
  stone.normalScale.set(0.09, 0.09);
  const spandrel = mat("brushed silver spandrels", 0xa0aeb1, 0.32, 0.5);
  const roof = mat("roof service surfaces", 0x647273, 0.94);
  const timber = mat("lobby timber blocks", 0xad7b4d, 0.81);
  timber.map = m.texture("houses/painted-wood-color.webp", true);
  const floor = mat("lobby stone floor", 0x515952, 0.4, 0.1);
  const leather = mat("lobby leather seating", 0x202726, 0.46);
  const leaf = mat("lobby planting", 0x34553d, 0.96);
  const glass = ["harbour", "east", "south"].map((direction) => {
    const g = new T.MeshPhysicalMaterial({
      name: `Rogers Tower — ${direction} silver-blue glass`,
      color: 0x829da9,
      roughness: 0.18,
      metalness: 0.25,
      clearcoat: 0.65,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: T.DoubleSide,
    });
    g.userData.castShadow = false;
    return g;
  });
  const lobbyGlass = new T.MeshPhysicalMaterial({
    name: "Rogers Tower — clear lobby glazing",
    color: 0x8babaa,
    roughness: 0.13,
    metalness: 0.02,
    clearcoat: 0.5,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: T.DoubleSide,
    envMapIntensity: 0.6,
  });
  lobbyGlass.userData.castShadow = false;
  const guard = glass[0].clone();
  guard.name = "Rogers Tower — balcony guard glass";
  guard.opacity = 0.32;
  const lamp = mat("warm interior lamps", 0xffe4b4, 0.4);
  lamp.emissive.setHex(0xffd59a);
  m.neonMaterials.push({ material: lamp, day: 0.15, night: 2.0 });
  const roomColors = [0x3a4b50, 0x515e5c, 0x6b6b5d, 0x34464f];
  const rooms = roomColors.map((c, i) => {
    const r = mat(`recessed room ${i}`, c, 0.83);
    r.emissive.setHex(0xffcf8e);
    m.neonMaterials.push({
      material: r,
      day: 0,
      night: [0.015, 0.06, 0.34, 0.02][i],
    });
    return r;
  });
  const blinds = [0x949e9f, 0x85999e, 0xa2a6a4].map((c, i) => {
    const r = mat(`window blinds ${i}`, c, 0.9);
    r.emissive.setHex(0xffd798);
    m.neonMaterials.push({ material: r, day: 0, night: [0.01, 0.035, 0.2][i] });
    r.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vBlind;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvBlind=uv;",
        );
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vBlind;")
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
      float phase=vBlind.y*74.;float fade=1.-smoothstep(.4,2.4,fwidth(phase));diffuseColor.rgb*=.91+.09*cos(phase)*fade;`,
        );
    };
    r.customProgramCacheKey = () => "rogers-filtered-blinds-v1";
    return r;
  });
  const world = (u: number, y: number, v: number): Vertex3 => {
    const [x, z] = rogersWorld(u, v);
    return [x, y, z];
  };
  const angle = -Math.atan2(0.693, 0.721);
  const box = (
    u: number,
    y: number,
    v: number,
    w: number,
    h: number,
    d: number,
    material: T.Material,
  ) => mesh.box(world(u, y, v), w, h, d, material, angle);
  function windows(
    a: Point,
    b: Point,
    low: number,
    high: number,
    row: number,
    office: boolean,
  ) {
    const f = facadeFrame(a, b);
    if (f.length < 0.2) return;
    const p0 = rogersLocal(...a),
      po = rogersLocal(a[0] + f.outward[0], a[1] + f.outward[1]),
      normal = [po[0] - p0[0], po[1] - p0[1]],
      face = normal[0] < -0.45 ? 0 : normal[0] > 0.3 ? 1 : 2,
      count = Math.max(1, Math.round(f.length / (office ? 2.15 : 2.35))),
      pitch = f.length / count;
    const panel = (
      material: T.Material,
      l: number,
      r: number,
      y0: number,
      y1: number,
      depth = 0,
      uv?: number[],
    ) =>
      mesh.quad(
        material,
        f.p(l, y0, depth),
        f.p(l, y1, depth),
        f.p(r, y1, depth),
        f.p(r, y0, depth),
        uv,
      );
    for (let k = 0; k < count; k++) {
      // Residential balconies occupy narrow vertical strips, leaving the broad
      // silver curtain wall continuous, as in the waterfront photographs.
      const balcony =
          !office &&
          f.length > 19 &&
          (k === 1 || k === 2 || k === count - 3 || k === count - 4),
        depth = balcony ? 1.4 : -0.06,
        left = k * pitch + 0.055,
        right = (k + 1) * pitch - 0.055,
        back = depth + 3.1,
        paneLow = low + (office ? 0.9 : 0.28),
        room = rooms[(row * 7 + k * 3 + face) % 4];
      panel(room, left, right, paneLow, high - 0.15, back);
      mesh.quad(
        room,
        f.p(left, paneLow, depth + 0.1),
        f.p(left, high - 0.15, depth + 0.1),
        f.p(left, high - 0.15, back),
        f.p(left, paneLow, back),
      );
      mesh.quad(
        room,
        f.p(right, paneLow, back),
        f.p(right, high - 0.15, back),
        f.p(right, high - 0.15, depth + 0.1),
        f.p(right, paneLow, depth + 0.1),
      );
      panel(glass[face], left, right, paneLow, high - 0.06, depth);
      panel(
        spandrel,
        left,
        right,
        low,
        paneLow - 0.015,
        balcony ? 0.05 : -0.08,
      );
      panel(
        frame,
        k * pitch - 0.065,
        k * pitch + 0.065,
        low,
        high,
        depth - 0.045,
      );
      panel(dark, left, right, paneLow - 0.025, paneLow + 0.025, depth - 0.04);
      panel(frame, left, right, high - 0.055, high - 0.01, depth - 0.05);
      // Lowered blinds and rear desks sit behind the reflecting surface.
      if (!balcony && (k + row * 3) % 5 < 3) {
        const y0 = office
          ? high - (high - paneLow) * (0.35 + random() * 0.6)
          : paneLow + (high - paneLow) * (0.15 + random() * 0.6);
        const r = office
          ? right
          : left + (right - left) * (0.2 + random() * 0.6);
        panel(blinds[(k + row) % 3], left, r, y0, high - 0.14, depth + 0.22, [
          0,
          0,
          0,
          high - y0,
          r - left,
          high - y0,
          r - left,
          0,
        ]);
      }
      if (office) {
        panel(
          timber,
          left + 0.15,
          right - 0.15,
          paneLow + 0.15,
          paneLow + 0.45,
          back - 0.6,
        );
        if (k % 3 === 0)
          panel(
            dark,
            left + 0.45,
            left + 0.85,
            paneLow + 0.45,
            paneLow + 0.82,
            back - 0.55,
          );
        if ((k + row) % 7 === 0)
          panel(
            lamp,
            left + 0.3,
            right - 0.3,
            high - 0.21,
            high - 0.16,
            back - 1,
          );
      }
      if (balcony) {
        panel(guard, left, right, low + 0.25, low + 1.22, -0.22);
        panel(white, left, right, low + 0.05, low + 0.18, -0.32);
        panel(frame, left, right, low + 1.21, low + 1.25, -0.24);
        mesh.quad(
          white,
          f.p(left, low + 0.17, 0),
          f.p(left, low + 0.17, 1.4),
          f.p(right, low + 0.17, 1.4),
          f.p(right, low + 0.17, 0),
        );
      }
    }
  }
  // Use source steps exactly at the larger transitions; intermediate floor
  // spacing is an interpretation of office and residential storey heights.
  const levels = [11.6];
  for (const [top, steps] of [
    [26.4, 4],
    [37.2, 3],
    [62.4, 7],
    [137, 24],
    [142, 2],
  ]) {
    const base = levels.at(-1)!;
    for (let i = 1; i <= steps; i++)
      levels.push(base + ((top - base) * i) / steps);
  }
  for (let row = 0; row < levels.length - 1; row++) {
    const lo = levels[row],
      hi = levels[row + 1];
    for (const poly of rogersSection(lo + 0.01)) {
      mesh.cap(poly, ROGERS_BASE + lo, white);
      mesh.skin(poly, ROGERS_BASE + lo, ROGERS_BASE + lo + 0.16, white);
      for (let i = 0; i < poly[0].length - 1; i++)
        windows(
          poly[0][i] as Point,
          poly[0][i + 1] as Point,
          ROGERS_BASE + lo,
          ROGERS_BASE + hi,
          row,
          lo < 62.4,
        );
    }
  }
  // Tall lobby glass exposes actual scenery depth: timber blocks, pale metal
  // columns and seating, rather than retail image decals on this office site.
  const groundPolys = rogersSection(0);
  for (const poly of groundPolys) {
    mesh.skin(poly, 2, ROGERS_BASE + 0.7, stone);
    mesh.cap(poly, ROGERS_BASE + 11.6, white);
    for (let i = 0; i < poly[0].length - 1; i++) {
      const a = poly[0][i] as Point,
        b = poly[0][i + 1] as Point,
        f = facadeFrame(a, b);
      if (f.length < 0.3) continue;
      const count = Math.max(1, Math.round(f.length / 2.6)),
        pitch = f.length / count;
      const baseA = collision.groundHeight(...a),
        baseB = collision.groundHeight(...b);
      const y = (s: number) => baseA + ((baseB - baseA) * s) / f.length + 0.035;
      for (let k = 0; k < count; k++) {
        const l = k * pitch,
          r = (k + 1) * pitch;
        mesh.quad(
          lobbyGlass,
          f.p(l, y(l), 0.38),
          f.p(l, 16.45, 0.38),
          f.p(r, 16.45, 0.38),
          f.p(r, y(r), 0.38),
        );
        mesh.beam(f.p(l, y(l), 0.34), f.p(l, 16.5, 0.34), 0.035, frame, 6);
        mesh.beam(f.p(l, 13.1, 0.34), f.p(r, 13.1, 0.34), 0.04, frame, 6);
        mesh.quad(
          floor,
          f.p(l, y(l), 0.4),
          f.p(l, y(l), 4.9),
          f.p(r, y(r), 4.9),
          f.p(r, y(r), 0.4),
          [0, 0, 0, 2.5, pitch / 2, 2.5, pitch / 2, 0],
        );
        mesh.quad(
          timber,
          f.p(l, y(l), 5),
          f.p(l, 16.4, 5),
          f.p(r, 16.4, 5),
          f.p(r, y(r), 5),
          [0, 0, 0, 2, pitch / 2, 2, pitch / 2, 0],
        );
        if (k % 3 === 1) {
          mesh.beam(
            f.p(l + 0.6, y(l + 0.6), 1.4),
            f.p(l + 0.6, 16.4, 1.4),
            0.32,
            frame,
            20,
          );
          mesh.quad(
            lamp,
            f.p(l + 0.3, 16.3, 1),
            f.p(l + 0.3, 16.3, 2),
            f.p(r - 0.3, 16.3, 2),
            f.p(r - 0.3, 16.3, 1),
          );
        }
        if (k % 4 === 2) {
          const mid = f.p((l + r) / 2, y((l + r) / 2) + 0.48, 3.3);
          mesh.box(
            mid,
            1.4,
            0.18,
            0.7,
            leather,
            -Math.atan2(b[1] - a[1], b[0] - a[0]),
          );
          const seat = f.p((l + r) / 2, mid[1] + 0.32, 3.6);
          mesh.box(
            seat,
            1.4,
            0.55,
            0.15,
            leather,
            -Math.atan2(b[1] - a[1], b[0] - a[0]),
          );
        }
      }
      // Exposed shade rails at the three-storey wing, suspended beyond glazing.
      if (f.length > 20 && rogersLocal(...a)[0] < 23)
        for (let yy = 13.1; yy < 16.5; yy += 0.58)
          mesh.beam(
            f.p(0, yy, -0.28),
            f.p(f.length, yy, -0.28),
            0.045,
            frame,
            6,
          );
    }
  }
  // Horizontal relief in the lobby timber wall and staggered ceiling returns.
  for (let y = 8; y < 16; y += 0.24) box(20, y, 6, 0.14, 0.1, 21, timber);
  for (const [u, v] of [
    [4, 9],
    [12, 20],
    [42, 16],
  ]) {
    const [x, z] = rogersWorld(u, v),
      ground = collision.groundHeight(x, z);
    box(u, ground + 0.38, v, 1.15, 0.75, 1.15, stone);
    mesh.beam(
      world(u, ground + 0.5, v),
      world(u + 0.1, ground + 3.5, v),
      0.07,
      timber,
      7,
    );
    for (let j = 0; j < 40; j++) {
      const theta = random() * Math.PI * 2,
        radius = 0.7 * Math.sqrt(random()),
        yy = ground + 2.8 + random();
      const g = new T.SphereGeometry(0.2, 5, 3);
      g.scale(1.9, 0.32, 1);
      g.rotateY(theta);
      g.translate(
        ...world(
          u + Math.cos(theta) * radius,
          yy,
          v + Math.sin(theta) * radius,
        ),
      );
      mesh.add(g, leaf);
    }
  }
  for (const h of ROGERS_ROOFS)
    for (const poly of rogersRoof(h)) {
      mesh.cap(poly, ROGERS_BASE + h, h < 100 ? stone : roof);
      mesh.skin(poly, ROGERS_BASE + h, ROGERS_BASE + h + 0.22, frame);
      if (h < 100) {
        const ring = poly[0];
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i],
            b = ring[i + 1],
            f = facadeFrame(a, b);
          if (f.length < 0.2) continue;
          mesh.quad(
            guard,
            f.p(0, ROGERS_BASE + h + 0.25),
            f.p(0, ROGERS_BASE + h + 1.05),
            f.p(f.length, ROGERS_BASE + h + 1.05),
            f.p(f.length, ROGERS_BASE + h + 0.25),
          );
        }
      }
    }
  // Sculpted glazed roof enclosure and the thin projecting upper canopy.
  for (const poly of rogersSection(143)) {
    const ring = poly[0];
    for (let i = 0; i < ring.length - 1; i++) {
      const f = facadeFrame(ring[i] as Point, ring[i + 1] as Point);
      if (f.length < 0.2) continue;
      mesh.quad(
        roof,
        f.p(0, 147, 0.6),
        f.p(0, 154, 0.6),
        f.p(f.length, 154, 0.6),
        f.p(f.length, 147, 0.6),
      );
      mesh.quad(
        glass[0],
        f.p(0, 147),
        f.p(0, 154),
        f.p(f.length, 154),
        f.p(f.length, 147),
      );
      for (let d = 0; d < f.length; d += 2.2)
        mesh.beam(f.p(d, 147), f.p(d, 154), 0.035, frame, 5);
      mesh.quad(
        dark,
        f.p(0, 147, -1.5),
        f.p(0, 147, 0.5),
        f.p(f.length, 147, 0.5),
        f.p(f.length, 147, -1.5),
      );
      mesh.beam(f.p(0, 147, -1.5), f.p(f.length, 147, -1.5), 0.1, frame, 6);
      for (let d = 0.8; d < f.length; d += 1.5) {
        mesh.beam(f.p(d, 146.5, 0.6), f.p(d, 147, -1.5), 0.06, frame, 6);
        mesh.beam(f.p(d, 153.9, -0.65), f.p(d, 153.9, 1.4), 0.055, frame, 6);
      }
    }
  }
  const sign = mat("roof identification", 0xffffff, 0.7);
  sign.map =
    typeof document === "undefined"
      ? null
      : label("ROGERS", 1024, 256, "#be2633", "#a5b5bc", 145);
  sign.emissive.setHex(0xffffff);
  sign.emissiveMap = sign.map;
  m.neonMaterials.push({ material: sign, day: 0, night: 0.12 });
  mesh.quad(
    sign,
    world(26.25, 149, 0),
    world(26.25, 152, 0),
    world(26.25, 152, 19),
    world(26.25, 149, 19),
    [1, 0, 1, 1, 0, 1, 0, 0],
  );

  // An original geometric interpretation of Diana Thater's Light Art (2005).
  // The lit strip meets a dark basin; the mist is a small animated local effect.
  const poolY =
    Math.max(...ROGERS_POOL.map((p) => collision.groundHeight(...p))) + 0.17;
  // Round the basin corners and model a real coping edge, rather than a black
  // slab with water painted over its full top. The outer collision is conservative.
  const rounded: Point[] = [];
  for (let i = 0; i < ROGERS_POOL.length; i++) {
    const p = ROGERS_POOL[i],
      a = ROGERS_POOL[(i + ROGERS_POOL.length - 1) % ROGERS_POOL.length],
      b = ROGERS_POOL[(i + 1) % ROGERS_POOL.length];
    const toward = (q: Point): Point => {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]),
        t = Math.min(0.32 / d, 0.25);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const start = toward(a),
      end = toward(b);
    for (let j = 0; j <= 5; j++) {
      const t = j / 5;
      rounded.push([
        (1 - t) ** 2 * start[0] + 2 * t * (1 - t) * p[0] + t * t * end[0],
        (1 - t) ** 2 * start[1] + 2 * t * (1 - t) * p[1] + t * t * end[1],
      ]);
    }
  }
  const centre: Point = [
    rounded.reduce((a, p) => a + p[0], 0) / rounded.length,
    rounded.reduce((a, p) => a + p[1], 0) / rounded.length,
  ];
  const inner = rounded.map(
    (p): Point => [
      centre[0] + (p[0] - centre[0]) * 0.9,
      centre[1] + (p[1] - centre[1]) * 0.87,
    ],
  );
  const poolRing = [...rounded, rounded[0]],
    innerRing = [...inner, inner[0]];
  const basalt = mat("honed basin coping", 0x343e40, 0.43, 0.1);
  basalt.map = stone.map;
  basalt.normalMap = stone.normalMap;
  basalt.normalScale.set(0.035, 0.035);
  mesh.skin([poolRing], poolY - 1, poolY + 0.13, basalt);
  mesh.cap([poolRing, [...innerRing].reverse()], poolY + 0.13, basalt);
  mesh.skin([innerRing], poolY - 0.1, poolY + 0.13, basalt);
  mesh.cap([innerRing], poolY - 0.08, dark);
  for (let i = 0; i < 9; i++) {
    const p = world(21.6 + i * 0.45, poolY + 0.075, -16.4);
    mesh.beam([p[0], p[1] - 0.1, p[2]], p, 0.035, frame, 8);
  }
  // A narrow stone apron and recessed drainage slots follow the existing grade.
  for (let u = 18.5; u < 28.5; u += 1.0) {
    for (let v = -20.3; v < -18.8; v += 0.5) {
      const corners = [
        [u + 0.012, v + 0.012],
        [u + 0.012, v + 0.488],
        [u + 0.988, v + 0.488],
        [u + 0.988, v + 0.012],
      ];
      const verts = corners.map(([uu, vv]): Vertex3 => {
        const [x, z] = rogersWorld(uu, vv);
        return [x, collision.groundHeight(x, z) + 0.065, z];
      });
      mesh.quad(stone, verts[0], verts[1], verts[2], verts[3], [
        u / 3,
        v / 3,
        u / 3,
        (v + 0.5) / 3,
        (u + 1) / 3,
        (v + 0.5) / 3,
        (u + 1) / 3,
        v / 3,
      ]);
    }
    const slots = [
      [u, -20.45],
      [u, -20.4],
      [u + 0.87, -20.4],
      [u + 0.87, -20.45],
    ].map(([uu, vv]): Vertex3 => {
      const [x, z] = rogersWorld(uu, vv);
      return [x, collision.groundHeight(x, z) + 0.035, z];
    });
    mesh.quad(dark, slots[0], slots[1], slots[2], slots[3]);
  }
  const water = new T.MeshPhysicalMaterial({
    name: "Rogers Tower — reflecting pool",
    color: 0x26454a,
    roughness: 0.12,
    metalness: 0.55,
    clearcoat: 1,
    side: T.DoubleSide,
    envMapIntensity: 0.65,
  });
  const time = { value: 0 };
  m.animatedUniforms.push(time);
  water.onBeforeCompile = (s) => {
    s.uniforms.rogersTime = time;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vPool;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPool=position.xz;",
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float rogersTime;varying vec2 vPool;",
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
  normal=normalize(normal+vec3(.018*sin(vPool.x*7.+rogersTime*1.8),.015*cos(vPool.y*9.-rogersTime*1.6),0.));`,
      );
  };
  water.customProgramCacheKey = () => "rogers-pool-ripples-v1";
  mesh.cap([innerRing], poolY + 0.045, water);
  for (let i = 0; i < ROGERS_POOL.length; i++) {
    const a = ROGERS_POOL[i],
      b = ROGERS_POOL[(i + 1) % ROGERS_POOL.length];
    collision.addBarrier(...a, ...b, 0.09, poolY + 0.13);
  }
  const [lx, lz] = ROGERS_LIGHT;
  for (let i = 0; i < 36; i++) {
    const low = poolY + ((147 - poolY) * i) / 36,
      high = poolY + ((147 - poolY) * (i + 1)) / 36;
    const color = new T.Color(0x00c85b).lerp(new T.Color(0x005bea), i / 35),
      light = mat(`Light Art colour ${i}`, color.getHex(), 0.3);
    light.emissive.copy(color);
    m.neonMaterials.push({ material: light, day: 0, night: 1.1 });
    mesh.box([lx, (low + high) / 2, lz], 0.18, high - low, 0.18, light, angle);
  }
  // Lower translucent coloured fins surround the light source at the pool.
  const green = glass[0].clone();
  green.name = "Rogers Tower — coloured glass fins";
  green.color.setHex(0x38a98e);
  green.opacity = 0.5;
  for (let i = 0; i < 5; i++)
    box(22.35 + i * 0.34, poolY + 3.8, -14.05, 0.055, 7.6, 0.62, green);
  const mist = mat("water-feature mist", 0xc1dbd9, 0.98);
  mist.transparent = true;
  mist.opacity = 0.14;
  mist.depthWrite = false;
  mist.userData.castShadow = false;
  mist.onBeforeCompile = (s) => {
    s.uniforms.rogersTime = time;
    s.vertexShader = s.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float rogersTime;varying vec2 vMist;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvMist=uv;transformed.x+=sin(rogersTime*.4+uv.y*5.)*.18;",
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float rogersTime;varying vec2 vMist;",
      )
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
  float soft=1.-smoothstep(.08,.5,length((vMist-.5)*vec2(.8,1.)));float cloud=.55+.25*sin(vMist.x*19.+sin(vMist.y*14.-rogersTime*.5)*3.);diffuseColor.a*=soft*cloud;`,
      );
  };
  mist.customProgramCacheKey = () => "rogers-local-mist-v1";
  for (let i = 0; i < 6; i++) {
    const g = new T.PlaneGeometry(3.5, 2.4, 4, 4);
    g.rotateY((i * Math.PI) / 3);
    const p = rogersWorld(22.3 + i * 0.45, -16.2);
    g.translate(p[0], poolY + 1, p[1]);
    mesh.add(g, mist);
  }
  mesh.finish();
  for (const [i, p] of [
    [12, -18],
    [82, 5],
    [42, 36],
  ].entries()) {
    const [x, z] = rogersWorld(...(p as Point));
    refs.push({
      name: `Rogers Tower ${["harbour", "east", "south"][i]}`,
      position: [x, 28, z],
      materials: [glass[i], ...(i === 0 ? [guard, lobbyGlass, green] : [])],
      intensity: { day: 0.9, night: 0.22 },
    });
  }
  refs.push({
    name: "Rogers Tower Light Art pool",
    position: [lx, poolY + 0.5, lz - 3],
    materials: [water],
    intensity: { day: 0.65, night: 0.24 },
  });
  batch.offsetY = previous;
  return true;
}
