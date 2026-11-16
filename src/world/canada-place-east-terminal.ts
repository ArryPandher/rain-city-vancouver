import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import type { Materials } from "./materials";

/** Exact decoded face endpoints/cap, fitted photographic intermediate levels.
 * Ground and roof are owned by retained PIER/SAILS, not duplicated here. */
export const CANADA_PLACE_EAST_TERMINAL = {
  a: [-68.26823425292969, 58.59986114501953],
  b: [-18.662277221679688, 33.352752685546875],
  bottom: 7.6537394523620605,
  floor: 7.798935890197754,
  top: 17.64667510986328,
  lowerHead: 11.65,
  serviceFloor: 12.15,
  serviceHead: 16.35,
  depth: 0.8,
  bays: 10,
  pierWidth: 0.55,
} as const;
const D = CANADA_PLACE_EAST_TERMINAL;
export const CANADA_PLACE_EAST_TERMINAL_LENGTH = Math.hypot(
  D.b[0] - D.a[0],
  D.b[1] - D.a[1],
);
export function canadaPlaceEastTerminalPoint(s: number, y: number, out = 0) {
  const dx = (D.b[0] - D.a[0]) / CANADA_PLACE_EAST_TERMINAL_LENGTH,
    dz = (D.b[1] - D.a[1]) / CANADA_PLACE_EAST_TERMINAL_LENGTH;
  return new T.Vector3(
    D.a[0] + dx * s - dz * out,
    y,
    D.a[1] + dz * s + dx * out,
  );
}
type Role = "stone" | "metal" | "glass" | "backing";
export function createCanadaPlaceEastTerminalGeometry() {
  const bins: Record<Role, T.BufferGeometry[]> = {
    stone: [],
    metal: [],
    glass: [],
    backing: [],
  };
  function box(
    role: Role,
    s0: number,
    s1: number,
    y0: number,
    y1: number,
    o0: number,
    o1: number,
    roof = false,
  ) {
    const g = new T.BoxGeometry(s1 - s0, y1 - y0, o1 - o0);
    // LocalX follows source edge; localZ is its outward normal.
    const angle = -Math.atan2(D.b[1] - D.a[1], D.b[0] - D.a[0]);
    g.rotateY(angle);
    g.translate(
      ...canadaPlaceEastTerminalPoint(
        (s0 + s1) / 2,
        (y0 + y1) / 2,
        (o0 + o1) / 2,
      ).toArray(),
    );
    if (roof) {
      const n = g.getAttribute("normal"),
        p = g.getAttribute("position"),
        keep: number[] = [];
      for (let i = 0; i < g.index!.count; i += 3) {
        const ids = [0, 1, 2].map((j) => g.index!.getX(i + j));
        // Above the original footprint, the preserved cap owns the top face.
        if (
          n.getY(ids[0]) > 0.9 &&
          ids.every((id) => {
            const q = canadaPlaceEastTerminalPoint((s0 + s1) / 2, p.getY(id));
            return (
              (p.getX(id) - q.x) * -(D.b[1] - D.a[1]) +
                (p.getZ(id) - q.z) * (D.b[0] - D.a[0]) <=
              1e-5
            );
          })
        )
          continue;
        keep.push(...ids);
      }
      g.setIndex(keep);
    }
    g.clearGroups();
    bins[role].push(g);
  }
  const L = CANADA_PLACE_EAST_TERMINAL_LENGTH;
  // Continuous closed backing and ends; no unverified interior beyond apertures.
  box("backing", 0, L, D.bottom, D.top, -D.depth - 0.1, -D.depth, true);
  // Solid upper parapet/coping shares source cap; outward lip is separately capped.
  box("stone", 0, L, D.serviceHead, D.top, -D.depth, 0, true);
  box("stone", 0, L, D.top - 0.2, D.top, 0, 0.2);
  box("stone", 0, L, D.lowerHead, D.serviceFloor, -D.depth, 0.35);
  box("stone", 0, L, D.bottom, D.floor + 0.18, -D.depth, 0);
  const pitch = L / D.bays;
  for (let i = 0; i <= D.bays; i++) {
    const c = i * pitch,
      l = Math.max(0, c - D.pierWidth / 2),
      r = Math.min(L, c + D.pierWidth / 2);
    box("stone", l, r, D.bottom, D.serviceHead, -D.depth, 0.08);
  }
  for (let i = 0; i < D.bays; i++) {
    const l = i * pitch + D.pierWidth / 2,
      r = (i + 1) * pitch - D.pierWidth / 2;
    // Lower dock corridor: subdivided glazing, recessed behind real piers.
    box("glass", l, r, D.floor + 0.2, D.lowerHead - 0.1, -0.62, -0.6);
    for (const y of [D.floor + 0.24, D.lowerHead - 0.15])
      box("metal", l, r, y - 0.035, y + 0.035, -0.61, -0.54);
    for (let j = 0; j <= 3; j++) {
      const s = l + ((r - l) * j) / 3;
      box(
        "metal",
        Math.max(l, s - 0.025),
        Math.min(r, s + 0.025),
        D.floor + 0.2,
        D.lowerHead - 0.1,
        -0.61,
        -0.54,
      );
    }
    // Upper service openings remain closed, with clear full-depth side reveals.
    box("backing", l, r, D.serviceFloor, D.serviceHead, -0.79, -0.77);
    box(
      "metal",
      l + 0.12,
      r - 0.12,
      D.serviceFloor + 0.12,
      D.serviceHead - 0.12,
      -0.76,
      -0.73,
    );
    // Horizontal shutter/slat profile is bounded and nonemissive, not a fake room.
    for (let y = D.serviceFloor + 0.25; y < D.serviceHead - 0.15; y += 0.32)
      box("metal", l + 0.12, r - 0.12, y, y + 0.045, -0.75, -0.68);
  }
  const result = {} as Record<Role, T.BufferGeometry>;
  for (const role of Object.keys(bins) as Role[]) {
    result[role] = mergeGeometries(bins[role], false)!;
    bins[role].forEach((g) => g.dispose());
    landmarkSurfaceUV(result[role], [1, 1]);
    result[role].computeBoundingBox();
  }
  return result;
}
export function createCanadaPlaceEastTerminal(
  library: Pick<Materials, "texture">,
) {
  const g = createCanadaPlaceEastTerminalGeometry(),
    group = new T.Group();
  group.name = "Canada Place near east terminal";
  const mineral = (kind: string, color = false) => {
    const texture = library
      .texture(`canada-place-plinth/${kind}.webp`, color)
      .clone();
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.setScalar(0.5);
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    return texture;
  };
  const stone = new T.MeshStandardMaterial({
      name: "Canada east terminal mineral",
      color: 0xd7dad3,
      map: mineral("color", true),
      normalMap: mineral("normal"),
      roughnessMap: mineral("roughness"),
      normalScale: new T.Vector2(0.08, 0.08),
      roughness: 1,
      metalness: 0,
    }),
    materials = {
      stone,
      metal: new T.MeshStandardMaterial({
        name: "Canada east terminal service metal",
        color: 0x8c9698,
        roughness: 0.65,
        metalness: 0.25,
      }),
      glass: new T.MeshStandardMaterial({
        name: "Canada east terminal recessed glazing",
        color: 0x344b54,
        roughness: 0.12,
        metalness: 0.25,
        envMapIntensity: 0.8,
      }),
      backing: new T.MeshStandardMaterial({
        name: "Canada east terminal closed service backing",
        color: 0x343a3b,
        roughness: 1,
      }),
    };
  for (const role of Object.keys(g) as Role[]) {
    const mesh = new T.Mesh(g[role], materials[role]);
    mesh.name = `canada-east-terminal-${role}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group, materials };
}
