import * as T from "three";
import data from "./canada-place-concourse-data.json";
import { canadaPlaceRoofOutwardAt } from "./canada-place-concourse-layout";

/** Rayner section proportions, authored estimates rather than surveyed sizes.
 * The longitudinal preview is aligned to an existing central frame, not a
 * claim that photographs establish an exact primary-column schedule. */
export const CANADA_PLACE_PRIMARY_SUPPORT = {
  previewStation: (30 * data.length) / 58,
  outward: 7.15,
  floorY: 7.825,
  roofY: 17.625,
  stemWidth: 0.5,
  pedestalWidth: 0.8,
  pedestalTop: 12.55,
  collarWidth: 0.78,
  collarBottom: 14.65,
  collarTop: 14.85,
  bearingWidth: 0.72,
  bearingBottom: 17.48,
} as const;

/** Estimated sparse primary rhythm: every second central curved frame.
 * Opt-in only; photographs do not establish an exact structural column count. */
export const CANADA_PLACE_CENTRAL_PRIMARY_STATIONS: readonly number[] = [
  22, 26, 30, 34, 38,
].map((i) => (i * data.length) / 58);

export function canadaPlacePrimarySupportPoint(
  s: number,
  out: number,
  y: number,
) {
  if (!Number.isFinite(s) || s <= 33 || s >= 70)
    throw new Error("Primary-support preview must remain inside central hall");
  let i = 1;
  while (i < data.stations.length - 1 && data.stations[i].s < s) i++;
  const a = data.stations[i - 1],
    b = data.stations[i];
  const t = (s - a.s) / (b.s - a.s);
  return new T.Vector3(
    a.x + (b.x - a.x) * t + (a.nx + (b.nx - a.nx) * t) * out,
    y,
    a.z + (b.z - a.z) * t + (a.nz + (b.nz - a.nz) * t) * out,
  );
}

/** Continuous closed pedestal/stem/collar/bearing, one batch. Source-local
 * coordinates: caller uses the same landmark transform as the hall facade.
 * No automatic full-group repetition: the primary station schedule is unresolved. */
export function addCanadaPlacePrimarySupports(
  parent: T.Object3D,
  options: {
    stations?: readonly number[];
    material?: T.MeshStandardMaterial;
  } = {},
) {
  const cfg = CANADA_PLACE_PRIMARY_SUPPORT;
  const stations = options.stations ?? [cfg.previewStation];
  if (!stations.length || new Set(stations).size !== stations.length)
    throw new Error("Primary supports require distinct preview stations");
  const positions: number[] = [],
    indices: number[] = [],
    uv: number[] = [];
  const quad = (v: T.Vector3[], outward: T.Vector3) => {
    if (v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).dot(outward) < 0)
      v = [v[0], v[3], v[2], v[1]];
    const start = positions.length / 3;
    const horizontal = Math.abs(outward.y) > 0.5;
    const edge = v[1].clone().sub(v[0]).normalize();
    for (const p of v) {
      positions.push(...p.toArray());
      uv.push(horizontal ? p.x : p.dot(edge), horizontal ? p.z : p.y);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  for (const s of stations) {
    const center = canadaPlacePrimarySupportPoint(s, cfg.outward, 0);
    const out = canadaPlacePrimarySupportPoint(s, cfg.outward + 1, 0)
      .sub(center)
      .normalize();
    const along = new T.Vector3(-out.z, 0, out.x);
    if (
      cfg.outward + cfg.pedestalWidth / 2 >=
      canadaPlaceRoofOutwardAt(s) - 0.05
    )
      throw new Error("Support bearing must remain within existing roof");
    // The small bevels soften section corners, without detached stacked boxes
    // or coplanar internal caps at changes in section.
    const levels: [number, number][] = [
      [cfg.floorY, cfg.pedestalWidth],
      [cfg.pedestalTop - 0.05, cfg.pedestalWidth],
      [cfg.pedestalTop, cfg.pedestalWidth - 0.1],
      [cfg.pedestalTop, cfg.stemWidth],
      [cfg.collarBottom, cfg.stemWidth],
      [cfg.collarBottom, cfg.collarWidth - 0.04],
      [cfg.collarBottom + 0.02, cfg.collarWidth],
      [cfg.collarTop - 0.02, cfg.collarWidth],
      [cfg.collarTop, cfg.collarWidth - 0.04],
      [cfg.collarTop, cfg.stemWidth],
      [cfg.bearingBottom, cfg.stemWidth],
      [cfg.bearingBottom, cfg.bearingWidth],
      [cfg.roofY, cfg.bearingWidth],
    ];
    const rings = levels.map(([y, width]) => {
      const h = width / 2,
        bevel = 0.02;
      return [
        [-h + bevel, -h],
        [h - bevel, -h],
        [h, -h + bevel],
        [h, h - bevel],
        [h - bevel, h],
        [-h + bevel, h],
        [-h, h - bevel],
        [-h, -h + bevel],
      ].map(([a, o]) =>
        center
          .clone()
          .addScaledVector(along, a)
          .addScaledVector(out, o)
          .setY(y),
      );
    });
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1],
        b = rings[i];
      for (let j = 0; j < 8; j++) {
        const k = (j + 1) % 8;
        const normal =
          levels[i][0] === levels[i - 1][0]
            ? new T.Vector3(0, levels[i][1] < levels[i - 1][1] ? 1 : -1, 0)
            : a[j].clone().add(a[k]).multiplyScalar(0.5).sub(center).setY(0);
        quad([a[j], a[k], b[k], b[j]], normal);
      }
    }
    for (const end of [0, rings.length - 1]) {
      const ring = rings[end],
        c = center.clone().setY(levels[end][0]);
      for (let j = 0; j < 8; j++) {
        // Indexed triangular caps, not degenerate duplicate triangle quads.
        const v = [c, ring[j], ring[(j + 1) % 8]];
        const n = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
        if (n.y * (end === 0 ? -1 : 1) < 0) [v[1], v[2]] = [v[2], v[1]];
        const start = positions.length / 3;
        for (const p of v) {
          positions.push(...p.toArray());
          uv.push(p.x, p.z);
        }
        indices.push(start, start + 1, start + 2);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material =
    options.material ??
    new T.MeshStandardMaterial({
      name: "canada-place-primary-support",
      color: 0x969e94,
      roughness: 0.76,
      metalness: 0,
    });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Canada Place primary concourse support";
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
