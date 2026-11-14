import * as T from "three";
import polygonClipping from "polygon-clipping";
import { Building, centroid, pointInPoly, seeded, Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import { Materials, label } from "./materials";
import {
  CONVENTION_ID,
  conventionSite,
  offsetOutline,
} from "./convention-site";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
type V3 = [number, number, number];

/** Original reference-guided exterior. Foyer volumes provide real depth through
 * the glazing; the mapped site and public perimeter share collision geometry. */
export function conventionCentre(
  b: Building,
  batch: Batcher,
  m: Materials,
  reflections: ReflectionProbeSpec[],
) {
  if (b.id !== CONVENTION_ID) return false;
  const site = conventionSite(b),
    [cx, cz] = centroid(b.pts),
    random = seeded(85240507);
  const previousOffset = batch.offsetY;
  batch.offsetY = 0;
  const concrete = new T.MeshStandardMaterial({
    name: "Convention Centre — concrete",
    color: 0xb4b8b0,
    roughness: 0.92,
    map: m.texture("cast-concrete/color.jpg", true),
    normalMap: m.texture("cast-concrete/normal.jpg"),
    normalScale: new T.Vector2(0.18, 0.18),
    side: T.DoubleSide,
  });
  const metal = new T.MeshStandardMaterial({
    name: "Convention Centre — charcoal fascia",
    color: 0x39434a,
    metalness: 0.5,
    roughness: 0.48,
  });
  const frame = new T.MeshStandardMaterial({
    name: "Convention Centre — glazing frame",
    color: 0x839398,
    metalness: 0.6,
    roughness: 0.4,
  });
  const timber = new T.MeshStandardMaterial({
    name: "Convention Centre — timber soffit",
    color: 0x9b713c,
    roughness: 0.84,
    map: m.texture("houses/painted-wood-color.webp", true),
    normalMap: m.texture("houses/painted-wood-normal.webp"),
    normalScale: new T.Vector2(0.12, 0.12),
    side: T.DoubleSide,
  });
  const interior = new T.MeshStandardMaterial({
    name: "Convention Centre — hall core",
    color: 0x8c744f,
    roughness: 0.92,
    side: T.DoubleSide,
  });
  interior.emissive.setHex(0xc59453);
  m.neonMaterials.push({ material: interior, day: 0, night: 0.18 });
  const floor = new T.MeshStandardMaterial({
    name: "Convention Centre — foyer floors",
    color: 0x595650,
    roughness: 0.65,
    side: T.DoubleSide,
  });
  const glazing = ["north", "east", "west"].map((name) => {
    const material = new T.MeshPhysicalMaterial({
      name: `Convention Centre — ${name} clear glazing`,
      color: 0x809693,
      metalness: 0.02,
      roughness: 0.12,
      clearcoat: 0.5,
      clearcoatRoughness: 0.14,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: T.DoubleSide,
      envMapIntensity: 0.55,
    });
    material.userData.castShadow = false;
    return material;
  });
  const roofMaterials = [0x667040, 0x777245, 0x576c40, 0x827750].map(
    (color) => {
      const material = m.grass.clone();
      material.color.setHex(color);
      material.name = "Convention Centre — planted roof";
      material.side = T.DoubleSide;
      const origin = site.world(0, 0),
        east = site.world(1, 0),
        north = site.world(0, 1);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.roofOrigin = { value: new T.Vector2(...origin) };
        shader.uniforms.roofAxes = {
          value: new T.Vector4(
            east[0] - origin[0],
            east[1] - origin[1],
            north[0] - origin[0],
            north[1] - origin[1],
          ),
        };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform vec2 roofOrigin; uniform vec4 roofAxes; varying vec2 vRoofPlot;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvec2 roofD=position.xz-roofOrigin; vRoofPlot=vec2(dot(roofD,roofAxes.xy),dot(roofD,roofAxes.zw));",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec2 vRoofPlot;",
          )
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
float bed=floor(vRoofPlot.y/11.0),crossBed=fract(vRoofPlot.y/11.0);
float diagonal=fract(vRoofPlot.x/85.0+mod(bed,2.0)*.4);
float meadow=smoothstep(diagonal-.035,diagonal+.035,crossBed);
diffuseColor.rgb*=mix(vec3(.79,.88,.73),vec3(1.11,1.03,.77),meadow);`,
          );
      };
      material.customProgramCacheKey = () => "convention-meadow-beds-v1";
      return material;
    },
  );
  const blades = [0x465327, 0x51572a, 0x354c29].map(
    (color) =>
      new T.MeshStandardMaterial({
        name: "Convention Centre — roof grasses",
        color,
        roughness: 1,
        side: T.DoubleSide,
      }),
  );
  const lamp = new T.MeshStandardMaterial({
    name: "Convention Centre — warm foyer light",
    color: 0xffe8b6,
    emissive: 0xffcc7d,
    emissiveIntensity: 0.25,
  });
  m.neonMaterials.push({ material: lamp, day: 0.25, night: 2.5 });
  const groups = new Map<
    T.Material,
    { p: number[]; uv: number[]; ix: number[] }
  >();
  const world = ([e, y, n]: V3): V3 => {
    const [x, z] = site.world(e, n);
    return [x, y, z];
  };
  const add = (g: T.BufferGeometry, mat: T.Material) =>
    batch.add(g, mat, cx, cz);
  function quad(mat: T.Material, a: V3, b: V3, c: V3, d: V3, scale = 2) {
    let q = groups.get(mat);
    if (!q) groups.set(mat, (q = { p: [], uv: [], ix: [] }));
    const offset = q.p.length / 3,
      points = [a, b, c, d].map(world),
      u = new T.Vector3(...points[1])
        .sub(new T.Vector3(...points[0]))
        .normalize(),
      v = new T.Vector3(...points[3])
        .sub(new T.Vector3(...points[0]))
        .normalize();
    for (const p of points) {
      q.p.push(...p);
      const vec = new T.Vector3(...p);
      q.uv.push(vec.dot(u) / scale, vec.dot(v) / scale);
    }
    q.ix.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  function beam(a: V3, b: V3, r: number, mat: T.Material = frame, sides = 6) {
    const p = new T.Vector3(...world(a)),
      q = new T.Vector3(...world(b)),
      d = q.clone().sub(p);
    if (d.length() < 0.005) return;
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
  const paneFace = (
    outline: Point[],
    low: (e: number, n: number) => number,
    high: (e: number, n: number) => number,
    lean: number,
    ground = false,
  ) => {
    const inset = offsetOutline(outline, -lean);
    for (let edge = 0; edge < outline.length; edge++) {
      const a = outline[edge],
        b = outline[(edge + 1) % outline.length],
        aa = inset[edge],
        bb = inset[(edge + 1) % outline.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.ceil(length / 2.2));
      const mat =
        glazing[(a[1] + b[1]) / 2 > 85 ? 0 : (a[0] + b[0]) / 2 > 145 ? 1 : 2];
      const point = (t: number, y: number): V3 => {
        const e = a[0] + (b[0] - a[0]) * t,
          n = a[1] + (b[1] - a[1]) * t,
          ratio = T.MathUtils.clamp(
            (y - low(e, n)) / Math.max(0.1, high(e, n) - low(e, n)),
            0,
            1,
          );
        return [
          aa[0] +
            (bb[0] - aa[0]) * t +
            (e - aa[0] - (bb[0] - aa[0]) * t) * ratio,
          y,
          aa[1] +
            (bb[1] - aa[1]) * t +
            (n - aa[1] - (bb[1] - aa[1]) * t) * ratio,
        ];
      };
      for (let col = 0; col < count; col++) {
        const t0 = col / count,
          t1 = (col + 1) / count,
          e = a[0] + ((b[0] - a[0]) * (t0 + t1)) / 2,
          n = a[1] + ((b[1] - a[1]) * (t0 + t1)) / 2,
          l = low(e, n),
          h = high(e, n);
        if (h <= l + 0.15) continue;
        const levels = [
          l,
          ...[2.5, 5.2, 7.8, 10.4, 13, 15.6, 18.2, 20.8, 23.4, 26, 28.6].filter(
            (y) => y > l + 0.15 && y < h - 0.15,
          ),
          h,
        ];
        for (let row = 0; row < levels.length - 1; row++) {
          const y0 = levels[row],
            y1 = levels[row + 1];
          quad(
            mat,
            point(t0, y0),
            point(t1, y0),
            point(t1, y1),
            point(t0, y1),
            1,
          );
          beam(point(t0, y0), point(t1, y0), 0.045);
        }
        beam(point(t0, l), point(t0, h), col % 4 === 0 ? 0.08 : 0.04);
        if (col === count - 1) beam(point(t1, l), point(t1, h), 0.08);
        if (ground && col % 4 === 0) {
          beam(point(t0, 0.1), point(t0, h - 0.15), 0.28, concrete, 10);
          beam(point(t0, 5.2), point(t1, 5.2), 0.17, metal);
        }
      }
    }
  };
  // Body roof has deep perimeter overhangs; ground walls sit inside the mapped roof outline.
  paneFace(
    offsetOutline(site.outline, -0.65),
    () => 0.04,
    (e, n) => site.baseHeight(e, n) - 0.85,
    3.15,
    true,
  );
  for (const roof of site.roofs)
    paneFace(
      offsetOutline(roof.outline, -0.65),
      (e, n) => site.baseHeight(e, n) - 0.9,
      (e, n) => roof.height(e, n) - 0.9,
      0.9,
    );
  function roofSurface(
    rings: Point[][],
    height: (e: number, n: number) => number,
    seed: number,
  ) {
    const points = site.flatWorld(rings[0]),
      holes = rings.slice(1).map(site.flatWorld),
      g = flatPolygon(points, holes, 0, 3.8),
      pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const [e, n] = site.local(pos.getX(i), pos.getZ(i));
      pos.setY(i, height(e, n));
    }
    g.computeVertexNormals();
    add(g, roofMaterials[seed % 4]);
    // Slate fascia, planted border and a real timber underside on every roof edge.
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          h0 = height(...a),
          h1 = height(...b);
        quad(
          metal,
          [a[0], h0 - 0.95, a[1]],
          [b[0], h1 - 0.95, b[1]],
          [b[0], h1 + 0.14, b[1]],
          [a[0], h0 + 0.14, a[1]],
          1,
        );
        beam([a[0], h0 + 0.15, a[1]], [b[0], h1 + 0.15, b[1]], 0.09, frame);
        const dx = b[0] - a[0],
          dn = b[1] - a[1],
          length = Math.hypot(dx, dn),
          mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          areaContains = (e: number, n: number) =>
            pointInPoly(e, n, rings[0].flat()) &&
            !rings.slice(1).some((r) => pointInPoly(e, n, r.flat()));
        let nx = -dn / length,
          nn = dx / length;
        if (!areaContains(mid[0] + nx * 0.1, mid[1] + nn * 0.1)) {
          nx = -nx;
          nn = -nn;
        }
        quad(
          timber,
          [a[0], h0 - 0.94, a[1]],
          [b[0], h1 - 0.94, b[1]],
          [b[0] + nx * 5, h1 - 1, b[1] + nn * 5],
          [a[0] + nx * 5, h0 - 1, a[1] + nn * 5],
          1,
        );
        for (let d = 0.5; d < length; d += 0.65) {
          const t = d / length,
            e = a[0] + dx * t,
            n = a[1] + dn * t,
            y = height(e, n) - 1;
          let reach = 0.4;
          while (
            reach < 4.8 &&
            areaContains(e + nx * (reach + 0.2), n + nn * (reach + 0.2))
          )
            reach += 0.2;
          beam(
            [e, y, n],
            [
              e + nx * reach,
              height(e + nx * reach, n + nn * reach) - 1,
              n + nn * reach,
            ],
            0.065,
            timber,
            4,
          );
        }
      }
    }
    const xs = rings[0].map((p) => p[0]),
      ns = rings[0].map((p) => p[1]),
      outer = rings[0].flat(),
      inner = rings.slice(1).map((p) => p.flat());
    for (let e = Math.min(...xs) + 0.9; e < Math.max(...xs); e += 1.6)
      for (let n = Math.min(...ns) + 0.9; n < Math.max(...ns); n += 1.6) {
        const x = e + (random() - 0.5) * 1.5,
          z = n + (random() - 0.5) * 1.5;
        if (
          !pointInPoly(x, z, outer) ||
          inner.some((p) => pointInPoly(x, z, p))
        )
          continue;
        const h = height(x, z) + 0.03,
          mat = blades[Math.floor(random() * 3)],
          angle = random() * Math.PI,
          heightBlade = 0.16 + random() * 0.22;
        for (let j = 0; j < 3; j++) {
          const a = angle + j * 1.047,
            dx = Math.cos(a) * 0.12,
            dn = Math.sin(a) * 0.12;
          quad(
            mat,
            [x - dx, h, z - dn],
            [x + dx, h, z + dn],
            [x + dx * 0.35 + 0.08, h + heightBlade, z + dn * 0.35],
            [x - dx * 0.35 + 0.08, h + heightBlade, z - dn * 0.35],
            1,
          );
        }
      }
  }
  for (const [i, p] of site.base.entries())
    roofSurface(
      p.map((r) => r.slice(0, -1) as Point[]),
      site.baseHeight,
      i,
    );
  for (const [i, r] of site.roofs.entries())
    roofSurface([r.outline], r.height, i + 2);
  // The dark inter-hall slot reads as a recessed service/light court, not an open hole.
  const court: Point[] = [
    [134, 18],
    [150, 18],
    [150, 110],
    [134, 110],
  ];
  add(flatPolygon(site.flatWorld(court), [], 12.8, 2), floor);
  // Foyer floors and a recessed warm core remain visible through transparent glass.
  const body = site.body;
  add(flatPolygon(site.flatWorld(body), [], 0.06, 2), floor);
  for (const y of [5.2, 13, 20.8]) {
    const regions: Point[][] = [];
    for (const plane of [
      { outline: body, height: site.baseHeight },
      ...site.roofs,
    ]) {
      const p = offsetOutline(plane.outline, -1.2),
        clipped: Point[] = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          da = plane.height(...a) - y - 1,
          db = plane.height(...b) - y - 1;
        if (da >= 0) clipped.push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db);
          clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      if (clipped.length >= 3) regions.push(clipped);
    }
    if (regions.length) {
      const polygons = polygonClipping.intersection(
        polygonClipping.union(
          [regions[0]],
          ...regions.slice(1).map((r) => [r]),
        ),
        [offsetOutline(body, -0.6)],
      );
      for (const polygon of polygons)
        add(
          flatPolygon(
            site.flatWorld(polygon[0]),
            polygon.slice(1).map(site.flatWorld),
            y,
            2,
          ),
          floor,
        );
    }
  }
  const core: Point[] = [
    [66, 18],
    [139, 18],
    [163, 79],
    [69, 79],
  ];
  for (let i = 0; i < core.length; i++) {
    const a = core[i],
      b = core[(i + 1) % core.length];
    quad(
      interior,
      [a[0], 0, a[1]],
      [b[0], 0, b[1]],
      [b[0], 12, b[1]],
      [a[0], 12, a[1]],
      2,
    );
  }
  for (let e = 62; e < 185; e += 13)
    for (const n of [8, 99]) {
      if (!pointInPoly(e, n, body.flat())) continue;
      for (const y of [4.8, 12.6]) beam([e, y, n], [e + 4, y, n], 0.055, lamp);
    }
  // Stacked wood and small lounge groups give the waterfront foyer scale.
  const origin = site.world(0, 0),
    axis = site.world(1, 0),
    angle = -Math.atan2(axis[1] - origin[1], axis[0] - origin[0]);
  const block = (
    e: number,
    y: number,
    n: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
  ) => {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(angle);
    g.translate(...world([e, y, n]));
    add(g, mat);
  };
  for (let row = 0; row < 12; row++)
    for (let e = 60 + (row % 2) * 0.6; e < 194; e += 1.2)
      block(
        e,
        5.45 + row * 0.55,
        98,
        1.16,
        0.51,
        0.13 + random() * 0.12,
        timber,
      );
  const upholstery = new T.MeshStandardMaterial({
    name: "Convention Centre — lounge upholstery",
    color: 0x785232,
    roughness: 0.96,
  });
  for (const e of [66, 82, 100, 119, 155, 173, 190]) {
    for (const shift of [-1.5, 1.5]) {
      block(e + shift, 5.63, 108, 0.85, 0.2, 0.85, upholstery);
      block(e + shift, 6.05, 108.32, 0.85, 0.75, 0.18, upholstery);
      for (const dx of [-0.31, 0.31])
        for (const dn of [-0.3, 0.3])
          beam(
            [e + shift + dx, 5.2, 108 + dn],
            [e + shift + dx, 5.55, 108 + dn],
            0.022,
            metal,
          );
    }
    block(e, 5.82, 107.6, 0.75, 0.07, 0.75, timber);
    beam([e, 5.2, 107.6], [e, 5.78, 107.6], 0.045, metal);
  }
  // Perimeter paving and north shore rail. Deck height is shared with collision.
  add(
    flatPolygon(site.platformWorld, [site.footprint], site.deckHeight, 2),
    concrete,
  );
  for (const [northA, northB] of site.shoreSegments) {
    const length = Math.hypot(northA[0] - northB[0], northA[1] - northB[1]);
    for (let d = 0; d <= length; d += 2) {
      const t = d / length,
        e = northA[0] + (northB[0] - northA[0]) * t,
        n = northA[1] + (northB[1] - northA[1]) * t;
      beam([e, 0.04, n], [e, 1.15, n], 0.045, metal);
    }
    for (const y of [0.4, 0.75, 1.16])
      beam([northA[0], y, northA[1]], [northB[0], y, northB[1]], 0.035, metal);
    for (let d = 4; d < length; d += 9) {
      const t = d / length,
        e = northA[0] + (northB[0] - northA[0]) * t,
        n = northA[1] + (northB[1] - northA[1]) * t;
      beam([e, -3.2, n], [e, -0.16, n], 0.55, concrete, 10);
    }
  }
  // Roof identification is geometry and original text, not a photographed logo.
  const sign = new T.MeshStandardMaterial({
    name: "Convention Centre — entrance name",
    map:
      typeof document === "undefined"
        ? null
        : label(
            "VANCOUVER CONVENTION CENTRE",
            2048,
            128,
            "#d5dcd8",
            "#303a3e",
            62,
          ),
    roughness: 0.8,
    side: T.DoubleSide,
  });
  quad(
    sign,
    [80, 4.1, -21.4],
    [139, 4.1, -21.4],
    [139, 5.65, -21.4],
    [80, 5.65, -21.4],
    1,
  );
  // Sign uses the full text once across the panel.
  groups.get(sign)!.uv = [0, 0, 1, 0, 1, 1, 0, 1];
  for (const [mat, q] of groups) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(q.uv, 2));
    g.setIndex(q.ix);
    g.computeVertexNormals();
    add(g, mat);
  }
  for (const [i, p] of [
    [120, 129],
    [217, 60],
    [-10, 45],
  ].entries()) {
    const [x, z] = site.world(...(p as Point));
    reflections.push({
      name: `Convention Centre ${["harbour", "east", "west"][i]} glazing`,
      position: [x, 10, z],
      materials: [glazing[i]],
    });
  }
  batch.offsetY = previousOffset;
  return true;
}
