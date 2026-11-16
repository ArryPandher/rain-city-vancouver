import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { IRONWORKERS_PATH } from "./ironworkers-path-boundary";
import {
  IRONWORKERS_ALIGNMENT,
  IRONWORKERS_PLAN_LENGTH,
  ironworkersFrame,
  ironworkersPoint,
  ironworkersGradeT,
  ironworkersTAtDistance,
} from "./ironworkers-alignment";

type V = [number, number, number];
/** Photo-derived envelope, not surveyed pole stations or a manufacturer model. */
export const IRONWORKERS_LIGHT_STANDARD = {
  interval: 47,
  firstStation: 25,
  endMargin: 25,
  chunkLength: 240,
  side: IRONWORKERS_PATH.curbSide,
  mountingRise: IRONWORKERS_PATH.rise + IRONWORKERS_PATH.curbHeight,
  mountingEmbed: 0.02,
  poleHeight: 11.6,
  armReach: 3.4,
  lampHeight: 11.3,
  baseWidth: 0.34,
  baseDepth: 0.36,
} as const;
/** Use only after the generic street loop increments count, preserving every other road's sequence. */
export function replacesIronworkersStreetLamp(road: {
  id?: string;
  kind: string;
}) {
  return (
    road.kind === "primary" &&
    !!road.id &&
    IRONWORKERS_ALIGNMENT.roadIds.includes(road.id)
  );
}
function template(braced: boolean) {
  const metal: T.BufferGeometry[] = [],
    lens: T.BufferGeometry[] = [];
  function member(a: V, b: V, radius: number, endRadius = radius) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(endRadius, radius, delta.length(), 8);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...start.add(end).multiplyScalar(0.5).toArray());
    metal.push(g);
  }
  function box(size: V, point: V, target = metal) {
    const g = new T.BoxGeometry(...size);
    g.translate(...point);
    target.push(g);
  }
  const d = IRONWORKERS_LIGHT_STANDARD;
  box([d.baseWidth, 0.035, d.baseDepth], [0, 0.0175, 0]);
  if (braced) {
    member([0, 0.035, 0], [0, d.poleHeight, 0], 0.15, 0.085);
    member([0, 10.65, 0], [d.armReach, d.lampHeight, 0], 0.05, 0.042);
    member([0, 9.95, 0], [3.12, 11.24, 0], 0.027);
    member([1.45, 10.55, 0], [1.45, 10.93, 0], 0.021);
  } else {
    member([0, 0.035, 0], [0, 9.4, 0], 0.15, 0.072);
    // Continuous bent cobra arm; no through-road steel or invented overhead span.
    const points: V[] = [
      [0, 9.4, 0],
      [0.12, 10.05, 0],
      [0.48, 10.6, 0],
      [1.08, 11.02, 0],
      [1.83, 11.28, 0],
      [2.62, 11.35, 0],
      [d.armReach, d.lampHeight, 0],
    ];
    for (let i = 0; i < points.length - 1; i++)
      member(points[i], points[i + 1], 0.071 - i * 0.004);
  }
  // Opaque housing and unlit diffuser; night lighting remains a separate policy.
  box([0.82, 0.16, 0.3], [d.armReach + 0.24, d.lampHeight, 0]);
  box([0.68, 0.018, 0.24], [d.armReach + 0.24, d.lampHeight - 0.086, 0], lens);
  const combined = {
    metal: mergeGeometries(metal)!,
    lens: mergeGeometries(lens)!,
  };
  for (const g of [...metal, ...lens]) g.dispose();
  return combined;
}
export function ironworkersLightPlacements(deckHeight: (t: number) => number) {
  const d = IRONWORKERS_LIGHT_STANDARD;
  const placements: {
    station: number;
    sign: number;
    base: V;
    inward: [number, number];
    braced: boolean;
  }[] = [];
  for (
    let station = d.firstStation;
    station <= IRONWORKERS_PLAN_LENGTH - d.endMargin;
    station += d.interval
  ) {
    const t = ironworkersTAtDistance(station),
      frame = ironworkersFrame(t),
      length = Math.hypot(frame.nx, frame.nz);
    for (const sign of [-1, 1]) {
      const [x, z] = ironworkersPoint(t, sign * d.side);
      placements.push({
        station,
        sign,
        base: [
          x,
          deckHeight(ironworkersGradeT(x, z)) +
            d.mountingRise -
            d.mountingEmbed,
          z,
        ],
        inward: [(-sign * frame.nx) / length, (-sign * frame.nz) / length],
        braced: sign < 0,
      });
    }
  }
  return placements;
}
export function createIronworkersLightStandards(
  deckHeight: (t: number) => number,
) {
  const group = new T.Group();
  group.name = "Ironworkers deck-mounted light standards";
  const metal = new T.MeshStandardMaterial({
    name: "Ironworkers galvanized light standards",
    color: 0xb8bfc0,
    roughness: 0.48,
    metalness: 0.62,
  });
  const lens = new T.MeshStandardMaterial({
    name: "Ironworkers unlit luminaire diffuser",
    color: 0xc4c7c6,
    roughness: 0.7,
    metalness: 0,
  });
  const templates = [template(false), template(true)];
  const bins = new Map<
    number,
    { metal: T.BufferGeometry[]; lens: T.BufferGeometry[] }
  >();
  const placements = ironworkersLightPlacements(deckHeight);
  for (const p of placements) {
    const key = Math.floor(p.station / IRONWORKERS_LIGHT_STANDARD.chunkLength);
    let bin = bins.get(key);
    if (!bin) {
      bin = { metal: [], lens: [] };
      bins.set(key, bin);
    }
    const [ix, iz] = p.inward;
    const matrix = new T.Matrix4().makeBasis(
      new T.Vector3(ix, 0, iz),
      new T.Vector3(0, 1, 0),
      new T.Vector3(-iz, 0, ix),
    );
    matrix.setPosition(...p.base);
    const model = templates[Number(p.braced)];
    for (const role of ["metal", "lens"] as const)
      bin[role].push(model[role].clone().applyMatrix4(matrix));
  }
  let triangles = 0;
  for (const [key, bin] of bins)
    for (const role of ["metal", "lens"] as const) {
      const geometry = mergeGeometries(bin[role])!;
      for (const g of bin[role]) g.dispose();
      geometry.computeBoundingBox();
      const centre = geometry.boundingBox!.getCenter(new T.Vector3());
      geometry.translate(-centre.x, -centre.y, -centre.z);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, role === "metal" ? metal : lens);
      mesh.position.copy(centre);
      mesh.name = `Ironworkers light standards ${key} ${role}`;
      mesh.castShadow = role === "metal";
      mesh.receiveShadow = true;
      mesh.userData.allowShadow = mesh.castShadow;
      mesh.userData.center = [centre.x, centre.z];
      group.add(mesh);
      triangles += geometry.index!.count / 3;
    }
  for (const model of templates) {
    model.metal.dispose();
    model.lens.dispose();
  }
  group.userData.ironworkersLightStandards = {
    fixtures: placements.length,
    triangles,
    draws: group.children.length,
    lights: 0,
  };
  return group;
}
