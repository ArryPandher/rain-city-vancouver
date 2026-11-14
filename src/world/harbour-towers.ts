import * as T from "three";
import type { Building, Point } from "./data";
import { centroid, seeded } from "./data";
import { Batcher } from "./geometry";
import { ArchitecturalMesh, facadeFrame } from "./architectural-mesh";
import { Materials } from "./materials";
import type { CollisionWorld } from "./collision";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import {
  harbourTower,
  harbourTowerSection,
  harbourTowerRoof,
  harbourTowerLevels,
} from "./harbour-towers-site";

/** Original exterior geometry guided by ASPAC's photographs and OSM parts.
 * Window backplanes create facade depth; there are no enterable interiors. */
export function harbourGreenTower(
  b: Building,
  batch: Batcher,
  m: Materials,
  collision: CollisionWorld,
  refs: ReflectionProbeSpec[],
) {
  const found = harbourTower(b.id);
  if (!found) return false;
  const site = found;
  const saved = batch.offsetY;
  const centre = centroid(site.parts[0].pts.flat());
  const base = collision.groundHeight(...centre);
  batch.offsetY = 0;
  const mesh = new ArchitecturalMesh(batch, ...centre),
    random = seeded(224131617 + site.index);
  const material = (
    name: string,
    color: number,
    roughness = 0.7,
    metalness = 0,
  ) =>
    new T.MeshStandardMaterial({
      name: `${site.name} — ${name}`,
      color,
      roughness,
      metalness,
      side: T.DoubleSide,
    });
  const slab = material(
    "pale slab edges",
    site.index === 2 ? 0xa8aaa0 : 0xc9c6b8,
    0.78,
  );
  const frame = material(
    "metal window frames",
    site.index === 2 ? 0x506a66 : 0x9daba9,
    0.36,
    0.64,
  );
  const seal = material("recessed seals", 0x263735, 0.79);
  const stone = material(
    "park-edge stone",
    site.index === 0 ? 0xb2a38d : 0x9e9c8e,
    0.86,
  );
  stone.map = m.texture("cast-concrete/color.jpg", true);
  stone.normalMap = m.texture("cast-concrete/normal.jpg");
  stone.normalScale.set(0.11, 0.11);
  const red = material("terracotta vertical blade", 0x995248, 0.72);
  const roof = material("roof membrane", 0x707b74, 0.93);
  const soil = material("planter soil", 0x3c3930, 0.96);
  const leaf = material("terrace planting", 0x345747, 0.93);
  const spandrel = material(
    "silver green spandrels",
    site.index === 2 ? 0x73928c : 0x97aba5,
    0.37,
    0.36,
  );
  const glass = [0, 1].map((i) => {
    const g = new T.MeshPhysicalMaterial({
      name: `${site.name} — ${i ? "street" : "harbour"} glass`,
      color: site.index === 2 ? 0x79a7a2 : 0x9db8be,
      roughness: 0.17,
      metalness: 0.18,
      clearcoat: 0.75,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: T.DoubleSide,
      envMapIntensity: 0.72,
    });
    g.userData.castShadow = false;
    return g;
  });
  const guard = glass[0].clone();
  guard.name = `${site.name} — balcony guard glass`;
  guard.opacity = 0.29;
  guard.roughness = 0.2;
  const backs = [0x3e514f, 0x57605a, 0x6e7263, 0x354549].map((color, i) => {
    const mat = material(`window depth ${i}`, color, 0.94);
    mat.emissive.setHex(0xffcc89);
    m.neonMaterials.push({
      material: mat,
      day: 0,
      night: [0.015, 0.07, 0.27, 0.02][i],
    });
    return mat;
  });
  const blinds = [0xa8b2a8, 0xc6c6b7, 0x8faaa9].map((color, i) => {
    const mat = material(`blinds ${i}`, color, 0.92);
    mat.emissive.setHex(0xffd398);
    m.neonMaterials.push({
      material: mat,
      day: 0,
      night: [0.025, 0.13, 0.02][i],
    });
    mat.onBeforeCompile = (s) => {
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
          "#include <map_fragment>\nfloat ph=vBlind.y*72.;float fl=1.-smoothstep(.4,2.4,fwidth(ph));diffuseColor.rgb*=.94+.06*cos(ph)*fl;",
        );
    };
    mat.customProgramCacheKey = () => "harbour-tower-blinds-v1";
    return mat;
  });
  const light = material("entry soffit lights", 0xffecc7, 0.45);
  light.emissive.setHex(0xffd995);
  m.neonMaterials.push({ material: light, day: 0.15, night: 1.4 });

  function facade(
    a: Point,
    c: Point,
    lo: number,
    hi: number,
    row: number,
    podium: boolean,
  ) {
    const f = facadeFrame(a, c);
    if (f.length < 0.12 || hi - lo < 0.09) return;
    const bays = Math.max(1, Math.round(f.length / (podium ? 2.5 : 2.05))),
      pitch = f.length / bays;
    const panel = (
      mat: T.Material,
      l: number,
      r: number,
      y0: number,
      y1: number,
      depth = 0,
    ) => {
      if (r <= l || y1 <= y0) return;
      mesh.quad(
        mat,
        f.p(l, y0, depth),
        f.p(l, y1, depth),
        f.p(r, y1, depth),
        f.p(r, y0, depth),
        [0, 0, 0, y1 - y0, r - l, y1 - y0, r - l, 0],
      );
    };
    const midx = (a[0] + c[0]) / 2,
      midz = (a[1] + c[1]) / 2;
    // Long side galleries have a recessed window line. The mapped footprint
    // already contains the balcony perimeter, so no slab intrudes on park paths.
    const balconyFace =
      !podium &&
      f.length > 7 &&
      (site.index === 0
        ? f.outward[0] < -0.7 || (f.outward[0] > 0.7 && midz > -700)
        : site.index === 1
          ? f.outward[0] > 0.65 || (f.outward[0] < -0.65 && midz > -673)
          : f.outward[0] < -0.8 || f.outward[1] > 0.85);
    for (let k = 0; k < bays; k++) {
      const l = k * pitch + 0.055,
        r = (k + 1) * pitch - 0.055;
      const balcony =
        balconyFace &&
        (site.index === 2
          ? (k < 2 || k >= bays - 2) && !(row > 20 && row < 23)
          : k < 2 || k >= bays - 2);
      const depth = balcony ? 2.05 : 0.1;
      const back = depth + 1.1;
      const paneLow = lo + (podium ? 0.36 : 0.62),
        paneHigh = hi - 0.12;
      const shade =
        backs[
          (Math.floor(k / 2) + row * 7 + Math.round(midx)) % 4 < 0
            ? 0
            : (Math.floor(k / 2) + row * 7 + Math.round(midx)) % 4
        ];
      panel(shade, l, r, lo + 0.15, hi - 0.14, back);
      mesh.quad(
        seal,
        f.p(l, lo + 0.17, depth),
        f.p(l, hi - 0.14, depth),
        f.p(l, hi - 0.14, back),
        f.p(l, lo + 0.17, back),
      );
      mesh.quad(
        seal,
        f.p(r, lo + 0.17, back),
        f.p(r, hi - 0.14, back),
        f.p(r, hi - 0.14, depth),
        f.p(r, lo + 0.17, depth),
      );
      panel(glass[f.outward[1] < 0 ? 0 : 1], l, r, paneLow, paneHigh, depth);
      panel(spandrel, l, r, lo + 0.16, paneLow - 0.02, depth - 0.02);
      panel(
        frame,
        k * pitch - 0.047,
        k * pitch + 0.047,
        lo + 0.15,
        hi,
        depth - 0.035,
      );
      panel(frame, l, r, hi - 0.12, hi - 0.055, depth - 0.04);
      panel(seal, l, r, paneLow - 0.025, paneLow + 0.025, depth - 0.04);
      if (paneHigh - paneLow > 1.2)
        panel(frame, l, r, paneLow + 0.68, paneLow + 0.73, depth - 0.045);
      if (random() < 0.68 && paneHigh - paneLow > 0.3) {
        const blindBottom =
          paneLow + (paneHigh - paneLow) * (0.1 + random() * 0.65);
        panel(
          blinds[Math.floor(random() * 3)],
          l,
          l + (r - l) * (0.55 + random() * 0.45),
          blindBottom,
          paneHigh - 0.01,
          depth + 0.16,
        );
      }
      if (balcony && hi - lo > 1.45) {
        mesh.quad(
          slab,
          f.p(l, lo + 0.16, -0.14),
          f.p(l, lo + 0.16, depth),
          f.p(r, lo + 0.16, depth),
          f.p(r, lo + 0.16, -0.14),
        );
        panel(slab, l, r, lo - 0.02, lo + 0.16, -0.14);
        panel(guard, l, r, lo + 0.21, lo + 1.18, -0.03);
        panel(frame, l, r, lo + 1.18, lo + 1.225, -0.04);
        mesh.beam(f.p(l, lo + 0.17), f.p(l, lo + 1.22), 0.026, frame, 5);
        if (k === 0 || k === bays - 1) {
          const side = k === 0 ? l : r;
          mesh.quad(
            guard,
            f.p(side, lo + 0.2),
            f.p(side, lo + 1.18),
            f.p(side, lo + 1.18, depth),
            f.p(side, lo + 0.2, depth),
          );
        }
      }
      // Vertical terracotta fins distinguish One's side galleries and rounded bay.
      if (
        site.index === 0 &&
        !podium &&
        f.outward[0] < -0.7 &&
        k === Math.floor(bays / 2)
      ) {
        panel(red, l, l + Math.min(0.65, pitch * 0.5), lo, hi, -0.1);
      }
      if (podium && row === 0 && k % 3 === 1 && f.length > 8) {
        // Closed exterior entry: frame, transom, pull handles and shallow canopy.
        const dl = l + 0.12,
          dr = r - 0.12,
          doorTop = Math.min(lo + 2.65, hi - 0.15);
        panel(frame, dl - 0.04, dl + 0.04, lo + 0.08, doorTop, depth - 0.09);
        panel(frame, dr - 0.04, dr + 0.04, lo + 0.08, doorTop, depth - 0.09);
        panel(frame, dl, dr, doorTop - 0.04, doorTop + 0.04, depth - 0.09);
        mesh.beam(
          f.p(dr - 0.2, lo + 0.9, depth - 0.16),
          f.p(dr - 0.2, lo + 1.55, depth - 0.16),
          0.024,
          frame,
          6,
        );
        mesh.quad(
          slab,
          f.p(dl - 0.15, doorTop + 0.25, -0.45),
          f.p(dl - 0.15, doorTop + 0.25, 0.25),
          f.p(dr + 0.15, doorTop + 0.25, 0.25),
          f.p(dr + 0.15, doorTop + 0.25, -0.45),
        );
        panel(light, dl + 0.1, dr - 0.1, doorTop + 0.19, doorTop + 0.23, -0.2);
      }
    }
    if (podium) {
      for (let y = lo + 0.2; y < hi; y += 0.65)
        panel(
          stone,
          0,
          Math.min(0.42, f.length),
          y,
          Math.min(y + 0.62, hi),
          -0.06,
        );
    }
  }
  const levels = harbourTowerLevels(site);
  for (let row = 0; row < levels.length - 1; row++) {
    const lo = levels[row],
      hi = levels[row + 1],
      podium = lo < site.podium - 0.01;
    for (const poly of harbourTowerSection(site, (lo + hi) / 2)) {
      mesh.cap(poly, base + lo + 0.13, slab);
      mesh.skin(poly, base + lo - 0.025, base + lo + 0.13, slab);
      for (let i = 0; i < poly[0].length - 1; i++)
        facade(poly[0][i], poly[0][i + 1], base + lo, base + hi, row, podium);
    }
  }
  // Follow the park's grade at the foot of the podium; upper floor datums remain
  // level. This skirt closes the downhill foundation without reshaping paths.
  const outline = site.parts[0].pts;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      c = outline[(i + 1) % outline.length],
      f = facadeFrame(a, c);
    if (f.length < 0.1) continue;
    const count = Math.ceil(f.length / 2);
    for (let k = 0; k < count; k++) {
      const l = (k * f.length) / count,
        r = ((k + 1) * f.length) / count,
        pa = f.p(l, 0),
        pb = f.p(r, 0);
      const ga = collision.groundHeight(pa[0], pa[2]) - 0.07,
        gb = collision.groundHeight(pb[0], pb[2]) - 0.07;
      mesh.quad(
        stone,
        f.p(l, Math.min(ga, base - 0.1), -0.025),
        f.p(l, Math.max(ga, base + 0.25), -0.025),
        f.p(r, Math.max(gb, base + 0.25), -0.025),
        f.p(r, Math.min(gb, base - 0.1), -0.025),
      );
    }
  }
  for (const h of [...new Set(site.parts.map((p) => p.height))]) {
    for (const poly of harbourTowerRoof(site, h)) {
      mesh.cap(poly, base + h, roof);
      mesh.skin(poly, base + h, base + h + 0.19, slab);
      const ring = poly[0];
      for (let i = 0; i < ring.length - 1; i++) {
        const f = facadeFrame(ring[i], ring[i + 1]);
        if (f.length < 0.15) continue;
        if (h < site.height - 7) {
          mesh.quad(
            guard,
            f.p(0, base + h + 0.19),
            f.p(0, base + h + 1.16),
            f.p(f.length, base + h + 1.16),
            f.p(f.length, base + h + 0.19),
          );
          mesh.beam(
            f.p(0, base + h + 1.18),
            f.p(f.length, base + h + 1.18),
            0.025,
            frame,
            5,
          );
        } else {
          // Thin roof planes overhang the crown; One's faceted mapped round penthouse
          // gets its own curved/faceted canopy rather than a generic flat box.
          mesh.quad(
            slab,
            f.p(0, base + h + 0.21, -0.85),
            f.p(0, base + h + 0.21, 0.6),
            f.p(f.length, base + h + 0.21, 0.6),
            f.p(f.length, base + h + 0.21, -0.85),
          );
          if (site.index === 2) {
            mesh.quad(
              glass[0],
              f.p(0, base + h - 3.1),
              f.p(0, base + h + 0.17),
              f.p(f.length, base + h + 0.17),
              f.p(f.length, base + h - 3.1),
            );
            for (let d = 0; d < f.length; d += 1.8)
              mesh.beam(
                f.p(d, base + h - 3),
                f.p(d, base + h + 0.2),
                0.045,
                frame,
                5,
              );
          }
        }
      }
    }
  }
  // Roof-terrace planters remain inside the podium. No pedestrian collision is
  // added on the adjacent public lawn, footpaths or stairs.
  for (const poly of harbourTowerRoof(site, site.podium)) {
    const ring = poly[0];
    for (let i = 0; i < ring.length - 1; i++) {
      const f = facadeFrame(ring[i], ring[i + 1]);
      if (f.length < 8) continue;
      for (let d = 2; d < f.length - 2; d += 7) {
        const p = f.p(d, base + site.podium + 0.33, 1.2),
          angle = -Math.atan2(
            ring[i + 1][1] - ring[i][1],
            ring[i + 1][0] - ring[i][0],
          );
        mesh.box(p, 1.7, 0.65, 0.65, stone, angle);
        mesh.box([p[0], p[1] + 0.34, p[2]], 1.58, 0.05, 0.54, soil, angle);
        for (let j = 0; j < 6; j++) {
          const q = f.p(
            d + (random() - 0.5) * 1.35,
            p[1] + 0.6 + random() * 0.3,
            1.2 + (random() - 0.5) * 0.3,
          );
          const g = new T.SphereGeometry(0.25, 5, 4);
          g.scale(1, 0.7, 1);
          g.translate(...q);
          mesh.add(g, leaf);
        }
      }
    }
  }
  refs.push(
    {
      name: `${site.name} harbour facade`,
      position: [centre[0] - 30, base + 22, centre[1] - 43],
      materials: [glass[0], guard],
      intensity: { day: 0.7, night: 0.3 },
    },
    {
      name: `${site.name} street facade`,
      position: [centre[0] + 29, base + 20, centre[1] + 32],
      materials: [glass[1]],
      intensity: { day: 0.64, night: 0.28 },
    },
  );
  mesh.finish();
  batch.offsetY = saved;
  return true;
}
