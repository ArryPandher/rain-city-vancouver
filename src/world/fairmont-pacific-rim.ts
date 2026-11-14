import * as T from "three";
import { Batcher, flatPolygon, walls } from "./geometry";
import { Materials, label } from "./materials";
import { type Building, type Point, seeded } from "./data";
import {
  FAIRMONT_ID,
  fairmontParts,
  fairmontLocal,
  fairmontWorld,
  fairmontTowerSection,
  fairmontRoof,
  FAIRMONT_ROOFS,
} from "./fairmont-site";
import type { CollisionWorld } from "./collision";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
type V3 = [number, number, number];

/** Original reconstruction from mapped masses and published architectural
 * photographs. Balcony depths, glazing bays and interior layouts are estimates. */
export function fairmontPacificRim(
  b: Building,
  batch: Batcher,
  m: Materials,
  collision: CollisionWorld,
  reflections: ReflectionProbeSpec[],
) {
  if (b.id !== FAIRMONT_ID) return false;
  const previousOffset = batch.offsetY;
  batch.offsetY = 0;
  const rand = seeded(360607254);
  const material = (
    name: string,
    color: number,
    roughness = 0.8,
    metalness = 0,
  ) =>
    new T.MeshStandardMaterial({
      name: `Fairmont Pacific Rim — ${name}`,
      color,
      roughness,
      metalness,
      side: T.DoubleSide,
    });
  const stone = material("pale limestone", 0xc5c3b7);
  stone.map = m.texture("cast-concrete/color.jpg", true);
  stone.normalMap = m.texture("cast-concrete/normal.jpg");
  stone.normalScale.set(0.09, 0.09);
  const slab = material("projecting balcony slabs", 0xd3d4cd, 0.73);
  const metal = material("anodized mullions", 0x646f70, 0.36, 0.65);
  const zinc = material("zinc suite cladding", 0x3d474a, 0.53, 0.5);
  const gravel = material("roof gravel", 0x7c827b, 0.98);
  gravel.map = m.texture("cast-concrete/color.jpg", true);
  const dark = material("window gaskets", 0x171d20, 0.76);
  const wood = material("lobby timber", 0x756047, 0.82);
  const foliage = material("terrace palm fronds", 0x42533c, 0.96);
  const trunk = material("palm trunks", 0x77735a, 0.95);
  const lamp = material("recessed warm lights", 0xf9dfb1, 0.5);
  lamp.emissive.setHex(0xffd493);
  m.neonMaterials.push({ material: lamp, day: 0.1, night: 2.3 });
  const glass = ["harbour", "east", "west"].map((direction) => {
    const mat = new T.MeshPhysicalMaterial({
      name: `Fairmont Pacific Rim — ${direction} blue glazing`,
      color: 0x7899ad,
      roughness: 0.13,
      metalness: 0.24,
      clearcoat: 0.6,
      clearcoatRoughness: 0.13,
      envMapIntensity: 1.05,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: T.DoubleSide,
    });
    mat.userData.castShadow = false;
    return mat;
  });
  const spandrel = material("blue curtain wall spandrels", 0x567988, 0.22, 0.3);
  const railing = new T.MeshPhysicalMaterial({
    name: "Fairmont Pacific Rim — balcony guard glass",
    color: 0xa9c7c9,
    roughness: 0.19,
    metalness: 0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: T.DoubleSide,
    envMapIntensity: 1.05,
  });
  railing.userData.castShadow = false;
  const rooms = [0x4b514f, 0x69685f, 0x867d69, 0x4b5a5e].map((c, i) => {
    const mat = material("recessed rooms " + i, c);
    mat.emissive.setHex(0xe7b46d);
    m.neonMaterials.push({
      material: mat,
      day: 0,
      night: [0.035, 0.13, 0.34, 0.02][i],
    });
    return mat;
  });
  const curtains = [0xb1aca0, 0x8a9796, 0xc4b8a0].map((c, i) => {
    const mat = material("pleated curtains " + i, c, 0.94);
    mat.emissive.setHex(0xe6b273);
    m.neonMaterials.push({
      material: mat,
      day: 0,
      night: [0.08, 0.015, 0.18][i],
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         float fold=.82+.18*cos(vFairmontUV.x*46.0);
         diffuseColor.rgb*=fold;`,
      );
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vFairmontUV;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvFairmontUV=uv;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vFairmontUV;",
      );
    };
    mat.customProgramCacheKey = () => "fairmont-curtain-fold-v1";
    return mat;
  });
  const forest = material(
    "interpreted forest perforated steel",
    0x9eaba8,
    0.59,
    0.62,
  );
  forest.map = m.texture("fairmont/forest-pattern.webp", true);
  forest.map.repeat.set(1 / 48, 1 / 15);
  forest.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vForest;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvForest=uv;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
       varying vec2 vForest;
       float forestHash(float p){return fract(sin(p*127.1)*43758.5453);}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
       vec2 p=vForest;
       // Analytically filtered holes fade to their mean beyond pixel scale.
       vec2 grid=p*28.0;
       float hole=1.0-smoothstep(.23,.34,length(fract(grid)-.5));
       float fade=1.0-smoothstep(.25,1.1,max(fwidth(grid.x),fwidth(grid.y)));
       float perforation=mix(.83,1.0-.60*hole,fade);
       diffuseColor.rgb*=perforation;
       float joint=min(fract(p.x/1.2),1.0-fract(p.x/1.2));
       diffuseColor.rgb*=mix(.42,1.0,smoothstep(0.0,.012,joint));`,
      );
  };
  forest.customProgramCacheKey = () => "fairmont-original-forest-steel-v2";

  const buffers = new Map<
    T.Material,
    { p: number[]; uv: number[]; ix: number[] }
  >();
  function quad(mat: T.Material, a: V3, b: V3, c: V3, d: V3, uv?: number[]) {
    let q = buffers.get(mat);
    if (!q) buffers.set(mat, (q = { p: [], uv: [], ix: [] }));
    const n = q.p.length / 3;
    q.p.push(...a, ...b, ...c, ...d);
    q.uv.push(...(uv ?? [0, 0, 0, 1, 1, 1, 1, 0]));
    q.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const add = (g: T.BufferGeometry, mat: T.Material) =>
    batch.add(g, mat, 245, -568);
  function box(
    u: number,
    y: number,
    v: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
  ) {
    const [x, z] = fairmontWorld(u, v),
      [xx, zz] = fairmontWorld(u + 1, v);
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(-Math.atan2(zz - z, xx - x));
    g.translate(x, y, z);
    add(g, mat);
  }
  function beam(a: V3, b: V3, r: number, mat: T.Material, sides = 6) {
    const p = new T.Vector3(...a),
      q = new T.Vector3(...b),
      d = q.clone().sub(p);
    const g = new T.CylinderGeometry(r, r, d.length(), sides);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    g.translate(...p.add(q).multiplyScalar(0.5).toArray());
    add(g, mat);
  }
  const w = (u: number, y: number, v: number): V3 => {
    const [x, z] = fairmontWorld(u, v);
    return [x, y, z];
  };
  function cap(poly: Point[][], y: number, mat: T.Material) {
    add(
      flatPolygon(
        poly[0].flat(),
        poly.slice(1).map((p) => p.flat()),
        y,
        2,
      ),
      mat,
    );
  }
  function skin(poly: Point[][], low: number, high: number, mat: T.Material) {
    for (const ring of poly) {
      const g = walls(ring.slice(0, -1).flat(), high - low);
      g.translate(0, low, 0);
      add(g, mat);
    }
  }
  function edgeFrame(a: Point, b: Point) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      inward: Point = [-dz / length, dx / length],
      localOut = fairmontLocal(a[0] + dz / length, a[1] - dx / length),
      localA = fairmontLocal(...a);
    return {
      length,
      outward: [localOut[0] - localA[0], localOut[1] - localA[1]],
      p: (along: number, y: number, recess = 0): V3 => [
        a[0] + (dx * along) / length + inward[0] * recess,
        y,
        a[1] + (dz * along) / length + inward[1] * recess,
      ],
    };
  }
  // Each pane has a room volume, ceiling and side returns behind it. Some
  // curtains are drawn and others open; stable variation remains when moving.
  function windows(
    a: Point,
    b: Point,
    low: number,
    high: number,
    balcony: boolean,
    face: number,
    row: number,
  ) {
    const f = edgeFrame(a, b),
      count = Math.max(1, Math.round(f.length / 2.35)),
      pitch = f.length / count;
    const recess = balcony ? 1.55 : 0.22;
    for (let k = 0; k < count; k++) {
      const left = k * pitch + 0.055,
        right = (k + 1) * pitch - 0.055,
        back = recess + 2.7,
        room = rooms[(row * 13 + k * 7 + face) % rooms.length];
      const panel = (
        mat: T.Material,
        l: number,
        r: number,
        y0: number,
        y1: number,
        depth: number,
        uv?: number[],
      ) =>
        quad(
          mat,
          f.p(l, y0, depth),
          f.p(l, y1, depth),
          f.p(r, y1, depth),
          f.p(r, y0, depth),
          uv,
        );
      panel(room, left, right, low + 0.25, high - 0.16, back);
      quad(
        room,
        f.p(left, low + 0.25, recess),
        f.p(left, high - 0.16, recess),
        f.p(left, high - 0.16, back),
        f.p(left, low + 0.25, back),
      );
      quad(
        room,
        f.p(right, low + 0.25, back),
        f.p(right, high - 0.16, back),
        f.p(right, high - 0.16, recess),
        f.p(right, low + 0.25, recess),
      );
      if ((row * 5 + k * 3 + face) % 7 < 5) {
        const width = (right - left) * (0.22 + rand() * 0.72);
        panel(
          curtains[(row + k) % 3],
          left,
          left + width,
          low + 0.26,
          high - 0.18,
          recess + 0.24,
          [0, 0, 0, high - low, width, high - low, width, 0],
        );
      } else {
        // Original furniture silhouettes, visible through uncurtained bays.
        panel(
          wood,
          left + 0.15,
          right - 0.15,
          low + 0.32,
          low + 0.85,
          back - 0.5,
        );
        if ((row + k) % 4 === 0)
          panel(
            lamp,
            left + 0.18,
            left + 0.44,
            low + 1.0,
            low + 1.28,
            back - 0.2,
          );
      }
      const paneDepth = balcony ? recess : -0.075;
      panel(
        glass[face],
        left,
        right,
        balcony ? low + 0.24 : low - 0.02,
        high - 0.04,
        paneDepth,
      );
      if (!balcony)
        panel(spandrel, left, right, low - 0.015, low + 0.55, -0.09);
      panel(
        metal,
        k * pitch - 0.06,
        k * pitch + 0.06,
        low - 0.02,
        high - 0.02,
        paneDepth - 0.025,
      );
      panel(dark, left, right, low + 0.22, low + 0.27, paneDepth - 0.035);
      if (balcony) {
        panel(railing, left, right, low + 0.32, low + 1.27, 0.14);
        panel(metal, left, right, low + 1.26, low + 1.3, 0.13);
        panel(metal, left, left + 0.035, low + 0.3, low + 1.3, 0.13);
      }
    }
  }
  // True horizontal balcony slabs with separate soffits and fascia. A central
  // curtain wall remains flat; the inset rooms move independently in parallax.
  const levels = [15];
  for (const [top, steps] of [
    [68, 17],
    [92, 8],
    [128, 12],
    [132, 1],
    [140, 2],
  ]) {
    const base = levels.at(-1)!;
    for (let i = 1; i <= steps; i++)
      levels.push(base + ((top - base) * i) / steps);
  }
  for (let row = 0; row < levels.length - 1; row++) {
    const low = levels[row],
      high = levels[row + 1],
      polys = fairmontTowerSection(low + 0.01);
    for (const poly of polys) {
      cap(poly, low, slab);
      cap(poly, low + 0.22, slab);
      skin(poly, low, low + 0.22, slab);
      const ring = poly[0];
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i] as Point,
          b = ring[i + 1] as Point,
          f = edgeFrame(a, b);
        if (f.length < 0.2) continue;
        const north = f.outward[1] < -0.5,
          west = f.outward[0] < -0.5;
        const face = north ? 0 : west ? 2 : 1;
        const balcony =
          (!north && !west) ||
          (north && f.length < 14) ||
          (west && low >= 68 && low < 92);
        if (west && f.length > 20 && low >= 25) {
          const split: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          windows(a, split, low, high, true, face, row);
          windows(split, b, low, high, false, face, row);
        } else windows(a, b, low, high, balcony, face, row);
        // White hotel-floor bands and broad middle residential balconies.
        if (balcony && low < 68) {
          quad(
            slab,
            f.p(0, low + 0.22, -0.035),
            f.p(0, low + 0.6, -0.035),
            f.p(f.length, low + 0.6, -0.035),
            f.p(f.length, low + 0.22, -0.035),
          );
        }
      }
    }
  }
  // Podiums and the tower lobby have different heights and enclosure systems.
  for (const poly of fairmontTowerSection(0)) {
    skin(poly, -2, 1, stone);
    for (const [low, high] of [
      [1, 6.4],
      [6.4, 10.7],
      [10.7, 15],
    ]) {
      cap(poly, high - 0.18, stone);
      const ring = poly[0];
      for (let i = 0; i < ring.length - 1; i++)
        windows(ring[i] as Point, ring[i + 1] as Point, low, high, false, 0, i);
    }
  }
  for (const part of fairmontParts.filter(
    (p) => p.height <= 30 && p.height > 0,
  )) {
    const ring = [...part.pts, part.pts[0]],
      poly = [ring];
    if (part.height === 2) {
      skin(poly, -2, 2, stone);
      continue;
    }
    const suite = part.minHeight === 15;
    const low = suite ? 15 : 0,
      high = part.height;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1],
        f = edgeFrame(a, b);
      if (f.length < 0.1) continue;
      const front = f.outward[1] < -0.5;
      if (suite) {
        if (front || f.outward[0] < -0.5) {
          const l = 0.65,
            r = f.length - 0.65;
          for (const [x0, x1, y0, y1] of [
            [0, l, low, high],
            [r, f.length, low, high],
            [l, r, low, low + 1],
            [l, r, high - 1, high],
          ])
            quad(zinc, f.p(x0, y0), f.p(x0, y1), f.p(x1, y1), f.p(x1, y0));
          quad(
            wood,
            f.p(l, low + 1, 2),
            f.p(l, high - 1, 2),
            f.p(r, high - 1, 2),
            f.p(r, low + 1, 2),
          );
          quad(
            glass[2],
            f.p(l, low + 1, -0.035),
            f.p(l, high - 1, -0.035),
            f.p(r, high - 1, -0.035),
            f.p(r, low + 1, -0.035),
          );
          for (let y = low + 1; y < high; y += 3.2)
            quad(
              zinc,
              f.p(l, y, -0.07),
              f.p(l, y + 0.08, -0.07),
              f.p(r, y + 0.08, -0.07),
              f.p(r, y, -0.07),
            );
        } else
          quad(
            zinc,
            f.p(0, low),
            f.p(0, high),
            f.p(f.length, high),
            f.p(f.length, low),
          );
      } else {
        if (front) {
          // Upper limestone band, ribbon glazing and horizontal sunshades.
          windows(
            a,
            b,
            Math.max(1, collision.groundHeight(...a)),
            6.1,
            false,
            0,
            i,
          );
          windows(a, b, 6.5, 10.8, false, 0, i + 3);
          for (let y = 6.5; y < 10.8; y += 0.46)
            quad(
              metal,
              f.p(0, y, -0.16),
              f.p(0, y + 0.075, -0.16),
              f.p(f.length, y + 0.075, -0.16),
              f.p(f.length, y, -0.16),
            );
          quad(
            stone,
            f.p(0, 10.9),
            f.p(0, 15),
            f.p(f.length, 15),
            f.p(f.length, 10.9),
            [0, 0, 0, 2, f.length / 2, 2, f.length / 2, 0],
          );
        } else {
          quad(
            forest,
            f.p(0, 2),
            f.p(0, high),
            f.p(f.length, high),
            f.p(f.length, 2),
            [0, 2, 0, high, f.length, high, f.length, 2],
          );
          quad(
            stone,
            f.p(0, -2),
            f.p(0, 2),
            f.p(f.length, 2),
            f.p(f.length, -2),
          );
          for (let y = 4; y < high; y += 3)
            quad(
              dark,
              f.p(0, y, -0.025),
              f.p(0, y + 0.12, -0.025),
              f.p(f.length, y + 0.12, -0.025),
              f.p(f.length, y, -0.025),
            );
        }
      }
    }
  }
  for (const height of FAIRMONT_ROOFS)
    for (const poly of fairmontRoof(height))
      cap(poly, height, height <= 15 ? stone : gravel);

  // The harbour entrance sits beneath a layered glass canopy and round
  // pale columns. Posts terminate on the site's sloping ground.
  for (const u of [20, 29, 38, 47]) {
    const [x, z] = fairmontWorld(u, -0.3),
      ground = collision.groundHeight(x, z);
    beam([x, ground, z], [x, 6.45, z], 0.46, stone, 20);
    collision.addBarrier(x, z, x, z, 0.46, 6.45);
  }
  box(33.5, 6.45, -1.7, 35, 0.16, 4.2, metal);
  box(33.5, 6.57, -1.85, 35, 0.1, 4.4, railing);
  box(33.5, 6.74, -1.2, 34, 0.07, 3.4, railing);
  for (let u = 17; u < 51; u += 2.4) {
    box(u, 6.31, -1.7, 0.055, 0.14, 4.1, metal);
    box(u, 6.24, -0.7, 0.16, 0.025, 0.5, lamp);
  }
  // Roof planting reads as layered fronds, not conical placeholder trees.
  for (const [u, v] of [
    [19, 7],
    [26, 9],
    [32, 11],
    [37, 12],
  ]) {
    box(u, 15.3, v, 2.8, 0.6, 1.8, stone);
    box(u, 15.62, v, 2.5, 0.08, 1.5, gravel);
    const top = 20 + rand();
    beam(w(u, 15.65, v), w(u + 0.22, top, v), 0.15, trunk, 9);
    for (let j = 0; j < 12; j++) {
      const angle = (j * Math.PI) / 6,
        span = 2.3 + rand() * 0.8;
      const p = w(u + 0.22, top, v),
        mid = w(
          u + Math.cos(angle) * span * 0.5,
          top + 0.32,
          v + Math.sin(angle) * span * 0.5,
        ),
        tip = w(
          u + Math.cos(angle) * span,
          top - 0.9,
          v + Math.sin(angle) * span,
        );
      beam(p, mid, 0.035, trunk, 4);
      beam(mid, tip, 0.023, trunk, 4);
      for (let k = 1; k < 8; k++) {
        const t = k / 8,
          rr = span * t,
          yy = top + 0.3 * Math.sin(t * Math.PI) - 0.9 * t * t,
          width = 0.44 * Math.sin(t * Math.PI);
        quad(
          foliage,
          w(u + rr * Math.cos(angle), yy, v + rr * Math.sin(angle)),
          w(
            u + (rr + 0.2) * Math.cos(angle) - width * Math.sin(angle),
            yy - 0.17,
            v + (rr + 0.2) * Math.sin(angle) + width * Math.cos(angle),
          ),
          w(
            u + (rr + 0.45) * Math.cos(angle),
            yy - 0.18,
            v + (rr + 0.45) * Math.sin(angle),
          ),
          w(
            u + (rr + 0.2) * Math.cos(angle) + width * Math.sin(angle),
            yy - 0.17,
            v + (rr + 0.2) * Math.sin(angle) - width * Math.cos(angle),
          ),
        );
      }
    }
  }
  const sign = material("entrance name", 0xffffff, 0.7);
  sign.map =
    typeof document === "undefined"
      ? null
      : label("FAIRMONT PACIFIC RIM", 2048, 256, "#555a57", "#c5c3b7", 74);
  quad(
    sign,
    w(23, 12, -0.22),
    w(23, 13.1, -0.22),
    w(43, 13.1, -0.22),
    w(43, 12, -0.22),
    [1, 0, 1, 1, 0, 1, 0, 0],
  );
  // Interior text artwork is acknowledged in source notes. The model uses
  // original geometric bands rather than distributing a copied artwork image.
  for (const [mat, q] of buffers) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(q.uv, 2));
    g.setIndex(q.ix);
    g.computeVertexNormals();
    add(g, mat);
  }
  for (const [i, p] of [
    [55, -12],
    [95, 27],
    [-10, 17],
  ].entries()) {
    const [x, z] = fairmontWorld(p[0], p[1]);
    reflections.push({
      name: `Fairmont Pacific Rim ${["harbour", "east", "west"][i]}`,
      position: [x, 28, z],
      intensity: { day: 1.05, night: 0.2 },
      materials: [glass[i], ...(i === 0 ? [railing] : [])],
    });
  }
  batch.offsetY = previousOffset;
  return true;
}
