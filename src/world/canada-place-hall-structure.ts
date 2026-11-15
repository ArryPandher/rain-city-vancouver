import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import data from "./canada-place-concourse-data.json";
import {
  canadaPlaceSolidBayAt,
  canadaPlaceUpperFasciaAt,
} from "./canada-place-concourse-layout";
/** Existing regular exterior subdivision rhythm, NOT a surveyed structural grid.
 * Added material boundaries/interpolated plan bends are not extra frame planes. */
export const CANADA_PLACE_HALL_RIB_PITCH = data.length / 58;
export const CANADA_PLACE_HALL_FRAME_STATIONS = Array.from(
  { length: 59 },
  (_, i) => i * CANADA_PLACE_HALL_RIB_PITCH,
).filter((s, i) => i % 2 === 0 && s > 33 && s < 70);
export const CANADA_PLACE_HALL_PREVIEW_STATION =
  30 * CANADA_PLACE_HALL_RIB_PITCH;
export const CANADA_PLACE_HALL_WEB = {
  frontDepth: 0.09,
  backDepth: 0.29,
  width: 0.075,
};
export type HallStructureOptions = { frameStations?: number[]; ties?: boolean };
function sample(s: number) {
  let i = 1;
  while (i < data.stations.length - 1 && data.stations[i].s < s) i++;
  const a = data.stations[i - 1],
    b = data.stations[i],
    t = (s - a.s) / (b.s - a.s);
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    nx: a.nx + (b.nx - a.nx) * t,
    nz: a.nz + (b.nz - a.nz) * t,
    scale: a.scale + (b.scale - a.scale) * t,
  };
}
export function canadaPlaceHallFramePoint(
  s: number,
  tier: number,
  index: number,
  depth: number,
) {
  const st = sample(s),
    k = 1 + tier * 8 + index,
    [out, y] = data.profile[k],
    theta = (index * Math.PI) / 16;
  const normal = new T.Vector3(
    st.nx * Math.cos(theta),
    (14.4 / 14.8) * st.scale * Math.sin(theta),
    st.nz * Math.cos(theta),
  ).normalize();
  return new T.Vector3(
    st.x + st.nx * out * st.scale,
    y,
    st.z + st.nz * out * st.scale,
  ).addScaledVector(normal, -depth);
}
/** One estimated structural frame type, then repeat only on selected regular
 * exterior ribs in the registered central hall. Pass [PREVIEW_STATION] for A/B.
 * No pane, backing, floor, collision or material/probe changes are performed. */
export function addCanadaPlaceHallStructure(
  parent: T.Object3D,
  options: HallStructureOptions = {},
) {
  const stations = options.frameStations ?? CANADA_PLACE_HALL_FRAME_STATIONS;
  if (
    stations.some(
      (s) =>
        !Number.isFinite(s) || s <= 33 || s >= 70 || canadaPlaceSolidBayAt(s),
    )
  )
    throw new Error("Hall frames must stay in registered central glazing");
  const geometries: T.BufferGeometry[] = [];
  const { frontDepth, backDepth, width } = CANADA_PLACE_HALL_WEB;
  const tiers = (s: number) => (canadaPlaceUpperFasciaAt(s) ? 2 : 3);
  function prism(rings: T.Vector3[][]) {
    const p: number[] = [],
      ix: number[] = [];
    const face = (v: T.Vector3[], out: T.Vector3) => {
      if (v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).dot(out) < 0)
        v = [v[0], v[3], v[2], v[1]];
      const n = p.length / 3;
      p.push(...v.flatMap((q) => q.toArray()));
      ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1],
        b = rings[i],
        center = [...a, ...b]
          .reduce((v, p) => v.add(p), new T.Vector3())
          .multiplyScalar(0.125);
      for (let j = 0; j < 4; j++) {
        const n = (j + 1) % 4,
          v = [a[j], b[j], b[n], a[n]],
          out = v
            .reduce((v, p) => v.add(p), new T.Vector3())
            .multiplyScalar(0.25)
            .sub(center);
        face(v, out);
      }
    }
    for (const i of [0, rings.length - 1]) {
      const near = rings[i === 0 ? 1 : i - 1],
        center = rings[i]
          .reduce((v, p) => v.add(p), new T.Vector3())
          .multiplyScalar(0.25),
        other = near
          .reduce((v, p) => v.add(p), new T.Vector3())
          .multiplyScalar(0.25);
      face(rings[i], center.sub(other));
    }
    const g = new T.BufferGeometry().setAttribute(
      "position",
      new T.Float32BufferAttribute(p, 3),
    );
    g.setIndex(ix);
    g.computeVertexNormals();
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        p.flatMap((_, i) => (i % 3 === 0 ? [p[i], p[i + 1]] : [])),
        2,
      ),
    );
    geometries.push(g);
  }
  for (const s of stations) {
    const st = sample(s),
      along = new T.Vector3(-st.nz, 0, st.nx)
        .normalize()
        .multiplyScalar(width / 2);
    let prior: T.Vector3[] | undefined;
    for (let tier = 0; tier < tiers(s); tier++) {
      const rings = Array.from({ length: 9 }, (_, i) => {
        const front = canadaPlaceHallFramePoint(s, tier, i, frontDepth),
          back = canadaPlaceHallFramePoint(s, tier, i, backDepth);
        return [
          front.clone().sub(along),
          front.clone().add(along),
          back.clone().add(along),
          back.clone().sub(along),
        ];
      });
      // A short knee closes each change of tier direction; no floating arch ends.
      if (prior) prism([prior, rings[0]]);
      prism(rings);
      prior = rings.at(-1)!;
    }
  }
  if (options.ties !== false)
    for (let j = 1; j < stations.length; j++)
      for (let tier = 0; tier < 2; tier++) {
        // Segmented at existing plan bends, but these cuts do not create extra frames.
        const cuts = [
          stations[j - 1],
          ...data.stations
            .map((s) => s.s)
            .filter((s) => s > stations[j - 1] && s < stations[j]),
          stations[j],
        ];
        for (let i = 1; i < cuts.length; i++) {
          const a = canadaPlaceHallFramePoint(cuts[i - 1], tier, 8, 0.26),
            b = canadaPlaceHallFramePoint(cuts[i], tier, 8, 0.26),
            v = b.clone().sub(a),
            g = new T.BoxGeometry(0.045, v.length(), 0.045);
          g.applyQuaternion(
            new T.Quaternion().setFromUnitVectors(
              new T.Vector3(0, 1, 0),
              v.normalize(),
            ),
          );
          g.translate(...a.add(b).multiplyScalar(0.5).toArray());
          geometries.push(g);
        }
      }
  const geometry = mergeGeometries(geometries, false)!;
  geometries.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  const material = new T.MeshStandardMaterial({
    name: "Canada Place inward hall structure",
    color: 0x8f9b8c,
    roughness: 0.74,
    metalness: 0.06,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Canada Place central transverse structure";
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
