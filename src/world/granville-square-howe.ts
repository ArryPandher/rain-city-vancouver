import * as T from "three";
import type { Building, Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import {
  createGranvilleHoweMaterials,
  createGranvilleHoweSignMap,
  granvilleHoweCavityUVs,
  type GranvilleHoweMaterials,
} from "./granville-square-howe-materials";
import type { Materials } from "./materials";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import {
  GRANVILLE_HOWE_ID as ID,
  GRANVILLE_HOWE_ORIGIN as centre,
  GRANVILLE_HOWE_RING as ring,
  GRANVILLE_HOWE_LOW_RING as lowRing,
  GRANVILLE_HOWE_HIGH_ROOF as highRoof,
  GRANVILLE_HOWE_HIGH_TOP as highTop,
  GRANVILLE_HOWE_LOW_TOP as lowTop,
  GRANVILLE_HOWE_SIGN_EDGE as signEdge,
  GRANVILLE_HOWE_SECTION as section,
  granvilleHoweFacades,
} from "./granville-square-howe-site";
import source from "./granville-square-howe-parts.json";

/** Replace only the misclassified Howe wing. The tower, parkade and station
 * remain separate mapped features. The retained collision outline is unchanged. */
export function buildGranvilleSquareHowe(
  batch: Batcher,
  building: Pick<Building, "id" | "pts">,
  m: GranvilleHoweMaterials,
) {
  if (building.id !== ID) return false;
  const mesh = new ArchitecturalMesh(batch, ...centre);
  // A second UV set belongs only to this concrete. Batcher merges attributes
  // without normalizeGeometry(), so UV1 survives without a shared-layout change.
  const concrete = {
    p: [] as number[],
    uv: [] as number[],
    uv1: [] as number[],
    ix: [] as number[],
  };
  const quad = (
    material: T.Material,
    p: Vertex3[],
    normal: Vertex3,
    metric = true,
    cavityUV?: number[],
  ) => {
    const cross = new T.Vector3(...p[1])
      .sub(new T.Vector3(...p[0]))
      .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    const w = metric ? Math.hypot(...p[1].map((v, i) => v - p[0][i])) : 1,
      h = metric ? Math.hypot(...p[3].map((v, i) => v - p[0][i])) : 1;
    let uv = [0, 0, w, 0, w, h, 0, h];
    let uv1 = cavityUV ?? Array(8).fill(0.5 / 128);
    if (cross.dot(new T.Vector3(...normal)) < 0) {
      p = [p[0], p[3], p[2], p[1]];
      uv = [0, 0, 0, h, w, h, w, 0];
      uv1 = [0, 3, 2, 1].flatMap((i) => uv1.slice(i * 2, i * 2 + 2));
    }
    if (material === m.concrete) {
      const n = concrete.p.length / 3;
      concrete.p.push(...p.flat());
      concrete.uv.push(...uv);
      concrete.uv1.push(...uv1);
      concrete.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
    } else mesh.quad(material, p[0], p[1], p[2], p[3], uv);
  };
  type Frame = ReturnType<typeof facadeFrame>;
  const face = (
    f: Frame,
    material: T.Material,
    left: number,
    right: number,
    low: number,
    high: number,
    depth = 0,
    metric = true,
  ) => {
    if (right - left < 1e-5 || high - low < 1e-5) return;
    quad(
      material,
      [
        f.p(left, low, depth),
        f.p(right, low, depth),
        f.p(right, high, depth),
        f.p(left, high, depth),
      ],
      [f.outward[0], 0, f.outward[1]],
      metric,
    );
  };
  const horizontal = (
    f: Frame,
    material: T.Material,
    left: number,
    right: number,
    y: number,
    near: number,
    far: number,
    up = true,
    cavityUV?: number[],
  ) =>
    quad(
      material,
      [
        f.p(left, y, near),
        f.p(right, y, near),
        f.p(right, y, far),
        f.p(left, y, far),
      ],
      [0, up ? 1 : -1, 0],
      true,
      cavityUV,
    );
  const end = (
    f: Frame,
    material: T.Material,
    u: number,
    low: number,
    high: number,
    near: number,
    far: number,
    toward: 1 | -1,
    cavityUV?: number[],
  ) => {
    const a = f.p(0, 0),
      b = f.p(f.length, 0);
    quad(
      material,
      [
        f.p(u, low, near),
        f.p(u, low, far),
        f.p(u, high, far),
        f.p(u, high, near),
      ],
      [toward * (b[0] - a[0]), 0, toward * (b[2] - a[2])],
      true,
      cavityUV,
    );
  };
  const cap = (poly: Point[][], y: number, material: T.Material) =>
    mesh.add(
      flatPolygon(
        poly[0].flat(),
        poly.slice(1).map((p) => p.flat()),
        y,
        1,
      ),
      material,
    );

  // Every recess terminates at opaque glazing. The base is a retaining wall,
  // not a door or speculative arcade on the unsupported side of the Howe grade.
  const windows = (f: Frame, low: number, high: number, depth: number) => {
    const count = Math.max(1, Math.round(f.length / section.targetBay)),
      width = f.length / count,
      pier = Math.min(section.pier, width * 0.28);
    for (let i = 0; i < count; i++) {
      const a = i * width,
        b = (i + 1) * width,
        left = a + pier / 2,
        right = b - pier / 2;
      face(f, m.concrete, a, left, low, high);
      face(f, m.concrete, right, b, low, high);
      const jambUV = granvilleHoweCavityUVs(
          m.concrete,
          right - left,
          high - low,
          depth,
          "jamb",
        ),
        horizontalUV = granvilleHoweCavityUVs(
          m.concrete,
          right - left,
          high - low,
          depth,
          "horizontal",
        );
      end(f, m.concrete, left, low, high, 0, depth, 1, jambUV);
      end(f, m.concrete, right, low, high, 0, depth, -1, jambUV);
      horizontal(f, m.concrete, left, right, low, 0, depth, true, horizontalUV);
      horizontal(
        f,
        m.concrete,
        left,
        right,
        high,
        0,
        depth,
        false,
        horizontalUV,
      );
      const trim = 0.065;
      face(f, m.frame, left, right, low, high, depth);
      face(
        f,
        m.glass,
        left + trim,
        right - trim,
        low + trim,
        high - trim,
        depth - 0.006,
      );
      // A narrow central extrusion divides the broad lower windows.
      if (high - low > 3) {
        face(
          f,
          m.frame,
          (left + right) / 2 - 0.025,
          (left + right) / 2 + 0.025,
          low,
          high,
          depth - 0.012,
        );
      }
    }
  };
  const belt = (f: Frame) => {
    const b = section.belt,
      count = Math.max(1, Math.round(f.length / section.targetBay)),
      width = f.length / count;
    for (let i = 0; i < count; i++) {
      const a = i * width,
        c = (i + 1) * width;
      // Continuous closed slope, with a real narrow recessed construction joint.
      for (const [left, right, inset, material] of [
        [a, c - 0.025, 0, m.concrete],
        [c - 0.025, c, 0.025, m.frame],
      ] as const) {
        quad(
          material,
          [
            f.p(left, b.low, b.lowDepth + inset),
            f.p(right, b.low, b.lowDepth + inset),
            f.p(right, b.knee, b.highDepth + inset),
            f.p(left, b.knee, b.highDepth + inset),
          ],
          [f.outward[0], -0.2, f.outward[1]],
        );
        face(f, material, left, right, b.knee, b.high, b.highDepth + inset);
      }
      for (const [u, direction] of [
        [c - 0.025, 1],
        [c, -1],
      ] as const) {
        const vector = f
          .p(direction, 0)
          .map((v, j) => v - f.p(0, 0)[j]) as Vertex3;
        quad(
          m.concrete,
          [
            f.p(u, b.low, b.lowDepth),
            f.p(u, b.low, b.lowDepth + 0.025),
            f.p(u, b.knee, b.highDepth + 0.025),
            f.p(u, b.knee, b.highDepth),
          ],
          vector,
        );
        end(
          f,
          m.concrete,
          u,
          b.knee,
          b.high,
          b.highDepth,
          b.highDepth + 0.025,
          direction,
        );
      }
    }
    horizontal(f, m.concrete, 0, f.length, b.high, 0, b.highDepth);
    // Both terminations close the splayed section to the ordinary wall plane.
    for (const u of [0, f.length])
      quad(
        m.concrete,
        [
          f.p(u, b.low, 0),
          f.p(u, b.low, b.lowDepth),
          f.p(u, b.knee, b.highDepth),
          f.p(u, b.knee, 0),
        ],
        [
          u
            ? f.p(f.length, 0)[0] - f.p(0, 0)[0]
            : f.p(0, 0)[0] - f.p(f.length, 0)[0],
          0,
          u
            ? f.p(f.length, 0)[2] - f.p(0, 0)[2]
            : f.p(0, 0)[2] - f.p(f.length, 0)[2],
        ],
      );
    end(f, m.concrete, 0, b.knee, b.high, 0, b.highDepth, -1);
    end(f, m.concrete, f.length, b.knee, b.high, 0, b.highDepth, 1);
  };
  for (const s of granvilleHoweFacades()) {
    if (s.edge === signEdge) continue;
    const f = facadeFrame(s.a, s.b);
    face(f, m.concrete, 0, f.length, 0, section.lower.sill);
    windows(f, section.lower.sill, section.lower.head, section.lower.recess);
    face(f, m.concrete, 0, f.length, section.lower.head, section.middle.sill);
    if (s.top === highTop) {
      windows(
        f,
        section.middle.sill,
        section.middle.head,
        section.middle.recess,
      );
      belt(f);
      windows(f, section.upper.sill, section.upper.head, section.upper.recess);
      face(f, m.concrete, 0, f.length, section.upper.head, highTop);
    } else {
      windows(f, section.middle.sill, 9.1, 0.85);
      face(f, m.concrete, 0, f.length, 9.1, lowTop);
    }
  }
  cap([lowRing], lowTop, m.roof);
  for (const polygon of highRoof) cap(polygon, highTop, m.roof);
  // A single opaque wall at the actual roof break, not two overlapping shells.
  const boundary = source.sharedBoundary.registered as Point[];
  for (let i = 1; i < boundary.length; i++) {
    const f = facadeFrame(boundary[i - 1], boundary[i]);
    face(f, m.concrete, 0, f.length, lowTop, highTop);
  }

  const f = facadeFrame(ring[signEdge], ring[signEdge + 1]),
    top = section.signTop,
    depth = section.signDepth;
  face(f, m.sign, 0, f.length, 0, top, 0.18);
  end(f, m.sign, 0, 0, top, 0, depth, -1);
  end(f, m.sign, f.length, 0, top, 0, depth, 1);
  horizontal(f, m.sign, 0, f.length, top, 0, depth);
  // Back of the raised sign is exposed only above the main roof.
  const back = facadeFrame(
    [f.p(f.length, 0, depth)[0], f.p(f.length, 0, depth)[2]],
    [f.p(0, 0, depth)[0], f.p(0, 0, depth)[2]],
  );
  face(back, m.sign, 0, back.length, highTop, top);
  for (const [left, right] of [
    [0, 0.23],
    [0.81, 1.06],
    [f.length - 0.22, f.length],
  ]) {
    face(f, m.sign, left, right, 0, top);
    end(f, m.sign, left, 0, top, 0, 0.18, -1);
    end(f, m.sign, right, 0, top, 0, 0.18, 1);
  }
  const rows = 11,
    step = top / rows;
  for (let j = 0; j < rows; j++) {
    const lo = j * step + 0.008,
      hi = (j + 1) * step - 0.008;
    face(f, m.sign, 1.06, f.length - 0.22, lo, hi, 0.115);
    horizontal(f, m.sign, 1.06, f.length - 0.22, lo, 0.115, 0.18, false);
    horizontal(f, m.sign, 1.06, f.length - 0.22, hi, 0.115, 0.18);
  }
  if (m.lettering.map) {
    // A CCW façade's increasing along coordinate points to the outside
    // observer's LEFT. Start the text quad there so texture U reads left→right.
    quad(
      m.lettering,
      [
        f.p(5.68, 4.6, 0.106),
        f.p(2.08, 4.6, 0.106),
        f.p(2.08, 5.95, 0.106),
        f.p(5.68, 5.95, 0.106),
      ],
      [f.outward[0], 0, f.outward[1]],
      false,
    );
  }
  const concreteGeometry = new T.BufferGeometry();
  concreteGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(concrete.p, 3),
  );
  concreteGeometry.setAttribute(
    "uv",
    new T.Float32BufferAttribute(concrete.uv, 2),
  );
  concreteGeometry.setAttribute(
    "uv1",
    new T.Float32BufferAttribute(concrete.uv1, 2),
  );
  concreteGeometry.setIndex(concrete.ix);
  concreteGeometry.computeVertexNormals();
  mesh.add(concreteGeometry, m.concrete);
  mesh.finish();
  return true;
}

/** One local street capture for the photographed main Howe ribbon facade.
 * A facade-midpoint cube is an exterior approximation, not per-pane parallax. */
export function granvilleHoweReflection(
  glass: T.MeshPhysicalMaterial,
  datum: number,
): ReflectionProbeSpec {
  const frame = facadeFrame(ring[3], ring[4]);
  return {
    name: "Granville Square Howe recessed ribbons",
    resolution: 256,
    position: frame.p(
      frame.length / 2,
      datum + (section.middle.head + section.upper.sill) / 2,
      -1.2,
    ),
    // All uses of this unique receiver are omitted while capturing. Concrete,
    // existing closed backings, and neighboring buildings remain in the scene.
    materials: [glass],
    intensity: { day: 0.9, night: 0.9 },
  };
}

/** Dedicated dispatch prevents heritage photo tiles and fictional shop generation. */
export function granvilleSquareHowe(
  building: Building,
  batch: Batcher,
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
) {
  if (building.id !== ID) return false;
  const materials = createGranvilleHoweMaterials(
    library,
    createGranvilleHoweSignMap(),
  );
  if (!buildGranvilleSquareHowe(batch, building, materials)) return false;
  reflections.push(granvilleHoweReflection(materials.glass, batch.offsetY));
  return true;
}
