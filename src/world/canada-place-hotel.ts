import { landmarkSurfaceUV } from "./landmark-surfaces";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import canopy from "./canada-place-canopy-data.json";
import {
  canadaPlaceCanopyPoint,
  CANADA_PLACE_CANOPY_LENGTH,
} from "./canada-place-canopy";

/** Source .94 tier face15; finish dimensions and photo-to-tier registration
 * are estimates. The circular louver belongs to a different south return. */
export const CANADA_PLACE_HOTEL_JUNCTION = {
  start: 0.8297647908500366,
  end: 49.59057488502217,
  wallOut: -2.3106388876802315,
  base: 14.65,
  top: 20.2,
  glassBottom: 15.5,
  glassTop: 19,
  transom: 17.25,
  faceOffset: 0.12,
  glassOffset: -0.08,
  overhang: 0.75,
  soffitY: 20.02,
  paneCount: 34,
} as const;
export const canadaPlaceHotelPoint = canadaPlaceCanopyPoint;

/** Closed recessed west windows, attached upper soffit and crown flashing.
 * No source removal here; caller must preflight/cut only .94 face15 first. */
export function createCanadaPlaceHotelJunction(
  source: Map<string, T.MeshStandardMaterial>,
): T.Group {
  const root = new T.Group();
  root.name = "Canada Place hotel west junction";
  const sourceStone = source.get("concrete");
  const stone = sourceStone?.clone() ?? new T.MeshStandardMaterial();
  stone.name = "canada-hotel-stone";
  stone.color.setHex(0xc4c8bd);
  stone.roughness = 0.78;
  if (sourceStone) {
    stone.onBeforeCompile = sourceStone.onBeforeCompile;
    stone.customProgramCacheKey = sourceStone.customProgramCacheKey;
  }
  const frame = new T.MeshStandardMaterial({
    name: "canada-hotel-frame",
    color: 0xa0afa1,
    roughness: 0.4,
    metalness: 0.18,
  });
  const glass = (source.get("glass") ?? new T.MeshStandardMaterial()).clone();
  glass.name = "canada-hotel-glass";
  glass.color.setHex(0x688c80);
  glass.roughness = 0.19;
  glass.metalness = 0.18;
  glass.transparent = false;
  glass.opacity = 1;
  glass.depthWrite = true;
  glass.side = T.FrontSide;
  glass.envMapIntensity = 1;
  if (glass instanceof T.MeshPhysicalMaterial) {
    glass.transmission = 0;
    glass.clearcoat = 0.12;
  }
  const shadow = new T.MeshStandardMaterial({
    name: "canada-hotel-soffit-recess",
    color: 0x49544e,
    roughness: 0.9,
  });
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  const at = canadaPlaceCanopyPoint;
  const origin = at(0, 0, 0),
    along = at(1, 0, 0).sub(origin).normalize(),
    out = at(0, 0, 1).sub(origin).normalize();
  const up = new T.Vector3(0, 1, 0),
    q = CANADA_PLACE_HOTEL_JUNCTION;
  function quad(m: T.Material, v: T.Vector3[], n: T.Vector3) {
    if (v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).dot(n) < 0)
      v = [v[0], v[3], v[2], v[1]];
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        v.flatMap((p) => p.toArray()),
        3,
      ),
    );
    g.setAttribute(
      "normal",
      new T.Float32BufferAttribute(
        v.flatMap(() => n.toArray()),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        v.flatMap((p) => [
          p.dot(along),
          Math.abs(n.y) > 0.5 ? p.dot(out) : p.y,
        ]),
        2,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const list = buckets.get(m) ?? [];
    list.push(g);
    buckets.set(m, list);
  }
  const plane = (
    m: T.Material,
    l: number,
    r: number,
    low: number,
    high: number,
    o: number,
  ) =>
    quad(
      m,
      [at(l, low, o), at(r, low, o), at(r, high, o), at(l, high, o)],
      out,
    );
  function box(
    m: T.Material,
    l: number,
    r: number,
    low: number,
    high: number,
    inside: number,
    outside: number,
  ) {
    plane(m, l, r, low, high, outside);
    quad(
      m,
      [
        at(l, low, inside),
        at(r, low, inside),
        at(r, high, inside),
        at(l, high, inside),
      ],
      out.clone().negate(),
    );
    quad(
      m,
      [
        at(l, low, inside),
        at(l, low, outside),
        at(l, high, outside),
        at(l, high, inside),
      ],
      along.clone().negate(),
    );
    quad(
      m,
      [
        at(r, low, inside),
        at(r, low, outside),
        at(r, high, outside),
        at(r, high, inside),
      ],
      along,
    );
    for (const [y, n] of [
      [low, up.clone().negate()],
      [high, up],
    ] as const)
      quad(
        m,
        [
          at(l, y, inside),
          at(r, y, inside),
          at(r, y, outside),
          at(l, y, outside),
        ],
        n,
      );
  }
  const front = q.wallOut + q.faceOffset,
    rear = q.wallOut + q.glassOffset;
  plane(stone, q.start, q.end, q.base, q.glassBottom, front);
  plane(stone, q.start, q.end, q.glassTop, q.top, front);
  const pitch = (q.end - q.start) / q.paneCount,
    half = 0.045;
  for (let i = 0; i <= q.paneCount; i++) {
    const s = q.start + i * pitch;
    plane(
      frame,
      Math.max(q.start, s - half),
      Math.min(q.end, s + half),
      q.glassBottom,
      q.glassTop,
      front,
    );
  }
  plane(frame, q.start, q.end, q.transom - 0.045, q.transom + 0.045, front);
  for (let i = 0; i < q.paneCount; i++) {
    const l = q.start + i * pitch + half,
      r = q.start + (i + 1) * pitch - half;
    for (const [low, high] of [
      [q.glassBottom, q.transom - 0.045],
      [q.transom + 0.045, q.glassTop],
    ]) {
      plane(glass, l, r, low, high, rear);
      for (const [s, n] of [
        [l, along],
        [r, along.clone().negate()],
      ] as const)
        quad(
          frame,
          [
            at(s, low, rear),
            at(s, low, front),
            at(s, high, front),
            at(s, high, rear),
          ],
          n,
        );
      for (const [y, n] of [
        [low, up],
        [high, up.clone().negate()],
      ] as const)
        quad(
          frame,
          [at(l, y, rear), at(r, y, rear), at(r, y, front), at(l, y, front)],
          n,
        );
    }
  }
  // Whole-face end cheeks and top/bottom returns join preserved neighboring
  // source faces; no hidden open building edge behind the recessed panes.
  for (const [s, n] of [
    [q.start, along.clone().negate()],
    [q.end, along],
  ] as const)
    quad(
      stone,
      [
        at(s, q.base, rear),
        at(s, q.base, front),
        at(s, q.top, front),
        at(s, q.top, rear),
      ],
      n,
    );
  quad(
    stone,
    [
      at(q.start, q.base, q.wallOut),
      at(q.end, q.base, q.wallOut),
      at(q.end, q.base, front),
      at(q.start, q.base, front),
    ],
    up.clone().negate(),
  );
  // Photographed upper overhang maps approximately to source20.2 tier cap.
  // Its projection is wholly inboard of accepted canopy out0..3 envelope.
  box(
    stone,
    q.start,
    q.end,
    q.soffitY,
    q.top,
    q.wallOut,
    q.wallOut + q.overhang,
  );
  // Recessed underside behind narrow pale longitudinal blades. The dark plane
  // is 35mm above the blade soffits, creating actual depth instead of stripes.
  quad(
    shadow,
    [
      at(q.start, q.soffitY - 0.002, q.wallOut + 0.13),
      at(q.end, q.soffitY - 0.002, q.wallOut + 0.13),
      at(q.end, q.soffitY - 0.002, q.wallOut + 0.7),
      at(q.start, q.soffitY - 0.002, q.wallOut + 0.7),
    ],
    up.clone().negate(),
  );
  for (let i = 0; i < 5; i++) {
    const o = q.wallOut + 0.15 + i * 0.11;
    box(
      stone,
      q.start,
      q.end,
      q.soffitY - 0.037,
      q.soffitY + 0.001,
      o,
      o + 0.075,
    );
  }
  // Narrow inboard flashing contacts the accepted crown beam (top14.89).
  // No new deck or broad slab is introduced across the curved canopy.
  box(
    frame,
    0,
    CANADA_PLACE_CANOPY_LENGTH,
    canopy.crown + 0.085,
    canopy.crown + 0.105,
    -0.24,
    -0.04,
  );
  for (const [m, parts] of buckets) {
    const g = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    if (m === stone) landmarkSurfaceUV(g, [1, 1]);
    const mesh = new T.Mesh(g, m);
    mesh.name = m.name;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
