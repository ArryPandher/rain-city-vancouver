import * as T from "three";
import polygonClipping from "polygon-clipping";
import type { Building, Point } from "./data";
import { centroid } from "./data";
import { Batcher } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { GranvilleSquareTowerMaterials } from "./granville-square-tower-materials";
import {
  GRANVILLE_SQUARE_TOWER as D,
  GRANVILLE_SQUARE_TOWER_ID as ID,
  GRANVILLE_SQUARE_TOWER_RING as ring,
  GRANVILLE_SQUARE_TOWER_PARTS as parts,
  granvilleSquareTowerLevel as level,
} from "./granville-square-tower-data";

/** Exact-ID replacement; all coordinates use the shared world datum, including
 * the roof. The public floor, low Howe wing and parkade remain separately owned. */
export function buildGranvilleSquareTower(
  batch: Batcher,
  building: Pick<Building, "id" | "pts">,
  m: GranvilleSquareTowerMaterials,
  groundHeight?: (x: number, z: number) => number,
) {
  if (building.id !== ID) return false;
  const savedOffset = batch.offsetY,
    centre = centroid(ring.flat()),
    ground = groundHeight ?? (() => savedOffset),
    base = ground(...centre),
    mesh = new ArchitecturalMesh(batch, ...centre);
  batch.offsetY = 0;
  type Frame = ReturnType<typeof facadeFrame>;
  const quad = (material: T.Material, p: Vertex3[], desired: Vertex3) => {
    const n = new T.Vector3(...p[1])
      .sub(new T.Vector3(...p[0]))
      .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    if (n.lengthSq() < 1e-12) return;
    if (n.dot(new T.Vector3(...desired)) < 0) p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1])),
      h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(material, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  };
  const face = (
    f: Frame,
    material: T.Material,
    l: number,
    r: number,
    lo: number,
    hi: number,
    depth = 0,
  ) => {
    if (r - l < 1e-6 || hi - lo < 1e-6) return;
    quad(
      material,
      [
        f.p(l, lo, depth),
        f.p(r, lo, depth),
        f.p(r, hi, depth),
        f.p(l, hi, depth),
      ],
      [f.outward[0], 0, f.outward[1]],
    );
  };
  const surround = (
    f: Frame,
    l: number,
    r: number,
    lo: number,
    hi: number,
    ol: number,
    or: number,
    ob: number,
    ot: number,
    il: number,
    ir: number,
    ib: number,
    it: number,
    depth: number,
    glass: T.Material,
    louver = false,
  ) => {
    // Four front stone regions and four splayed reveals. The outer ends of
    // neighbouring cells meet exactly, forming solid L-shaped corner piers.
    face(f, m.concrete, l, ol, lo, hi);
    face(f, m.concrete, or, r, lo, hi);
    face(f, m.concrete, ol, or, lo, ob);
    face(f, m.concrete, ol, or, ot, hi);
    const out: Vertex3 = [f.outward[0], 0, f.outward[1]],
      front = [f.p(ol, ob), f.p(or, ob), f.p(or, ot), f.p(ol, ot)],
      inside = [
        f.p(il, ib, depth),
        f.p(ir, ib, depth),
        f.p(ir, it, depth),
        f.p(il, it, depth),
      ];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      quad(m.concrete, [front[j], front[k], inside[k], inside[j]], out);
    }
    const backDepth = depth + 0.38;
    face(f, m.backing, il, ir, ib, it, backDepth);
    // Closed lining from the pane to the backing, relevant to transparent base
    // glazing as well as shadow/contact at the coated upper panes.
    const rear = [
      f.p(il, ib, backDepth),
      f.p(ir, ib, backDepth),
      f.p(ir, it, backDepth),
      f.p(il, it, backDepth),
    ];
    const directions: Vertex3[] = [
      [0, 1, 0],
      [-(f.p(1, 0)[0] - f.p(0, 0)[0]), 0, -(f.p(1, 0)[2] - f.p(0, 0)[2])],
      [0, -1, 0],
      [f.p(1, 0)[0] - f.p(0, 0)[0], 0, f.p(1, 0)[2] - f.p(0, 0)[2]],
    ];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      quad(m.backing, [inside[j], inside[k], rear[k], rear[j]], directions[j]);
    }
    if (louver) {
      face(f, m.frame, il, ir, ib, it, depth + 0.05);
      const blades = Math.max(2, Math.floor((it - ib) / 0.19));
      for (let k = 1; k < blades; k++) {
        const y = ib + (k * (it - ib)) / blades;
        quad(
          m.frame,
          [
            f.p(il, y - 0.045, depth - 0.04),
            f.p(ir, y - 0.045, depth - 0.04),
            f.p(ir, y + 0.045, depth + 0.07),
            f.p(il, y + 0.045, depth + 0.07),
          ],
          [out[0], 1, out[2]],
        );
      }
    } else {
      face(f, glass, il, ir, ib, it, depth);
      const mid = (il + ir) / 2;
      face(f, m.frame, il, il + 0.045, ib, it, depth - 0.012);
      face(f, m.frame, ir - 0.045, ir, ib, it, depth - 0.012);
      face(f, m.frame, il, ir, ib, ib + 0.045, depth - 0.012);
      face(f, m.frame, il, ir, it - 0.045, it, depth - 0.012);
      face(
        f,
        m.frame,
        mid - D.mullion / 2,
        mid + D.mullion / 2,
        ib,
        it,
        depth - 0.025,
      );
    }
  };
  const inset = ring.map((p, i) => {
    const prev = facadeFrame(ring[(i + 3) % 4], p).outward,
      next = facadeFrame(p, ring[(i + 1) % 4]).outward,
      den = 1 + prev[0] * next[0] + prev[1] * next[1];
    return [
      p[0] - (0.35 * (prev[0] + next[0])) / den,
      p[1] - (0.35 * (prev[1] + next[1])) / den,
    ] as Point;
  });
  const bodyBottom = level(0, base),
    bodyTop = level(D.bodyRows, base);
  for (let edge = 0; edge < 4; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]),
      cols = D.bays[edge],
      pitch = f.length / cols;
    for (let col = 0; col < cols; col++)
      for (let row = 0; row < D.bodyRows; row++) {
        const l = col * pitch,
          r = (col + 1) * pitch,
          lo = level(row, base),
          hi = level(row + 1, base),
          ol = l + D.openingSide,
          or = r - D.openingSide,
          ob = lo + D.openingBottom,
          ot = hi - D.openingTop;
        surround(
          f,
          l,
          r,
          lo,
          hi,
          ol,
          or,
          ob,
          ot,
          ol + D.splay,
          or - D.splay,
          ob + 0.12,
          ot - 0.12,
          D.recess,
          m.glass,
          row === D.louverRow,
        );
      }
    // Two larger base levels, four structural bays per elevation as visible in
    // the owner aerial. Closed glass, no new passage or access behind the shell.
    for (let bay = 0; bay < 4; bay++) {
      const l = (bay * f.length) / 4,
        r = ((bay + 1) * f.length) / 4,
        lowL =
          ground(...([f.p(l, 0)[0], f.p(l, 0)[2]] as [number, number])) - 0.04,
        lowR =
          ground(...([f.p(r, 0)[0], f.p(r, 0)[2]] as [number, number])) - 0.04,
        sill = Math.max(lowL, lowR) + 0.38,
        split = base + D.baseSplitAboveGround;
      quad(
        m.concrete,
        [f.p(l, lowL), f.p(r, lowR), f.p(r, sill), f.p(l, sill)],
        [f.outward[0], 0, f.outward[1]],
      );
      const tiers = [
        [sill, split],
        [split, bodyBottom],
      ];
      for (const [tier, [lo, hi]] of tiers.entries()) {
        const ol = l + 0.52,
          or = r - 0.52,
          [bottomFraction, topFraction] = D.baseOpeningFractions[tier],
          // Photo proportions are fitted inside the already registered base;
          // no inferred raised plaza, threshold or public terrain is introduced.
          // The existing graded footing still prevents glazing below ground.
          ob = Math.max(
            lo + 0.12,
            base + D.bodyBaseAboveGround * bottomFraction,
          ),
          ot = base + D.bodyBaseAboveGround * topFraction;
        surround(
          f,
          l,
          r,
          lo,
          hi,
          ol,
          or,
          ob,
          ot,
          ol + 0.12,
          or - 0.12,
          ob + 0.05,
          ot - 0.05,
          D.baseRecess,
          m.lobbyGlass,
        );
      }
    }
    // The continuous coping sits over a recessed shadow slit, not another
    // repeated office row. Real end corners close through the shared ring.
    face(f, m.concrete, 0, f.length, bodyTop, bodyTop + 0.38);
    const back = facadeFrame(inset[edge], inset[(edge + 1) % 4]),
      y = bodyTop + 0.38 + D.shadowSlitHeight;
    face(back, m.backing, 0, back.length, bodyTop + 0.38, y);
    for (const [height, normalY] of [
      [y, -1],
      [bodyTop + 0.38, 1],
    ])
      quad(
        m.concrete,
        [
          f.p(0, height),
          f.p(f.length, height),
          back.p(back.length, height),
          back.p(0, height),
        ],
        [0, normalY, 0],
      );
    face(f, m.concrete, 0, f.length, y, D.roof);
  }
  // Retain measured roof-part differences, map only their plan coordinates into
  // the exact tower outline. Lower caps subtract higher volumes, never overlap.
  const close = (p: Point[]) => [...p, p[0]],
    partPolys = parts.map((p) => [close(p.ring)]);
  const roofPolys = polygonClipping.difference([close(ring)], ...partPolys);
  for (const p of roofPolys) mesh.cap(p as Point[][], D.roof, m.roof);
  for (const part of parts) {
    const top = part.absoluteTop + D.datumOffset,
      pr = part.ring.slice(0, -1);
    if (part.id === 165377) {
      // The ATC cab flares outward above a closed pale service pedestal. Its
      // detailed instrument/antenna inventory is not inferred from the aerial.
      const c = centroid(pr.flat()),
        inner = pr.map(
          ([x, z]) =>
            [c[0] + (x - c[0]) * 0.79, c[1] + (z - c[1]) * 0.79] as Point,
        ),
        glassBottom = top - 2.25,
        glassTop = top - 0.35;
      for (let j = 0; j < pr.length; j++) {
        const k = (j + 1) % pr.length,
          f = facadeFrame(inner[j], inner[k]),
          normal: Vertex3 = [f.outward[0], 0, f.outward[1]];
        quad(
          m.concrete,
          [
            [pr[j][0], D.roof, pr[j][1]],
            [pr[k][0], D.roof, pr[k][1]],
            [inner[k][0], glassBottom, inner[k][1]],
            [inner[j][0], glassBottom, inner[j][1]],
          ],
          normal,
        );
        quad(
          m.glass,
          [
            [inner[j][0], glassBottom, inner[j][1]],
            [inner[k][0], glassBottom, inner[k][1]],
            [pr[k][0], glassTop, pr[k][1]],
            [pr[j][0], glassTop, pr[j][1]],
          ],
          normal,
        );
        const outer = facadeFrame(pr[j], pr[k]);
        face(outer, m.frame, 0, outer.length, glassTop, top);
        mesh.beam(
          [inner[j][0], glassBottom, inner[j][1]],
          [pr[j][0], glassTop, pr[j][1]],
          0.045,
          m.frame,
          5,
        );
      }
      mesh.cap([close(pr)], top, m.roof);
      mesh.cap([close(inner)], glassBottom, m.backing);
      // One thin central mast is confidently visible; height is an estimate.
      mesh.beam([c[0], top, c[1]], [c[0], top + 4.0, c[1]], 0.055, m.frame, 6);
    } else {
      for (let j = 0; j < pr.length; j++) {
        const f = facadeFrame(pr[j], pr[(j + 1) % pr.length]);
        face(f, m.concrete, 0, f.length, D.roof, top);
      }
      mesh.cap([close(pr)], top, m.roof);
    }
  }
  mesh.finish();
  batch.offsetY = savedOffset;
  return true;
}
