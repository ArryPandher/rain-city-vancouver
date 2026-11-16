import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Bridge } from "./collision";
import {
  createIronworkersDeckGeometry,
  IRONWORKERS_PLAN_LENGTH,
  IRONWORKERS_DECK_STATIONS,
  ironworkersTAtDistance,
  ironworkersFrame,
  ironworkersPoint,
  ironworkersGradeT,
} from "./ironworkers-alignment";

/** BC2018/SEABC:142+335+142m main deck truss and four~86m approach spans.
 * Stations are fitted to the existing playable crest, not surveyed pier locations.
 * Member sections/depths are photo estimates; the road alignment/grade is untouched. */
export const IRONWORKERS_STRUCTURE = {
  mainSpan: 335,
  anchorSpan: 142,
  approachSpan: 86,
  approachCount: 4,
  panelTarget: 10.5,
  trussSpacing: 14.6,
  deckDepth: 0.42,
  topChordDrop: 1.35,
  anchorDepth: 23,
  midspanDepth: 7.8,
  endDepth: 13,
  approachDepth: 13,
  steelColor: 0xb39a52,
} as const;
export function ironworkersStations(length: number) {
  const d = IRONWORKERS_STRUCTURE,
    centre = length / 2,
    southPier = centre - d.mainSpan / 2,
    northPier = centre + d.mainSpan / 2;
  return {
    start: southPier - d.anchorSpan,
    southPier,
    centre,
    northPier,
    end: northPier + d.anchorSpan,
  };
}
export function ironworkersTrussDepth(station: number, length: number) {
  const d = IRONWORKERS_STRUCTURE,
    s = ironworkersStations(length);
  if (station < s.start || station > s.end) return d.approachDepth;
  if (station < s.southPier)
    return T.MathUtils.lerp(
      d.endDepth,
      d.anchorDepth,
      (station - s.start) / d.anchorSpan,
    );
  if (station > s.northPier)
    return T.MathUtils.lerp(
      d.anchorDepth,
      d.endDepth,
      (station - s.northPier) / d.anchorSpan,
    );
  return (
    d.midspanDepth +
    (d.anchorDepth - d.midspanDepth) *
      Math.pow(Math.abs(station - s.centre) / (d.mainSpan / 2), 1.6)
  );
}
export type IronworkersGeometry = {
  steel: T.BufferGeometry;
  concrete: T.BufferGeometry;
  stats: {
    triangles: number;
    panels: number;
    bearings: number;
    meshes: number;
  };
};
/** Below-deck architecture only. The caller keeps its existing road ribbon,
 * road markings, rails and shared collision profile. No new walkable surface. */
export function createIronworkersBridgeGeometry(
  bridge: Bridge,
  deckHeight: (t: number) => number,
): IronworkersGeometry {
  const d = IRONWORKERS_STRUCTURE,
    length = IRONWORKERS_PLAN_LENGTH,
    span = ironworkersStations(length);
  const bins: Record<"steel" | "concrete", T.BufferGeometry[]> = {
    steel: [],
    concrete: [],
  };
  const at = (s: number, side: number, y: number) => {
    const t = ironworkersTAtDistance(s),
      [x, z] = ironworkersPoint(t, side);
    return new T.Vector3(
      x,
      y + deckHeight(ironworkersGradeT(x, z)) - deckHeight(t),
      z,
    );
  };
  const y = (s: number) => deckHeight(ironworkersTAtDistance(s));
  function member(
    a: T.Vector3,
    b: T.Vector3,
    width: number,
    depth: number,
    role: "steel" | "concrete" = "steel",
    flanged = false,
  ) {
    const v = b.clone().sub(a),
      len = v.length();
    if (len < 0.001) return;
    const rotation = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      v.normalize(),
    );
    const centre = a.clone().add(b).multiplyScalar(0.5);
    const pieces = flanged
      ? [
          [width, 0.085, (depth - 0.085) / 2],
          [width, 0.085, -(depth - 0.085) / 2],
          [0.085, depth - 0.17, 0],
        ]
      : [[width, depth, 0]];
    for (const [w, zDepth, zOffset] of pieces) {
      const g = new T.BoxGeometry(w, len, zDepth);
      g.translate(0, 0, zOffset);
      g.applyQuaternion(rotation);
      g.translate(centre.x, centre.y, centre.z);
      bins[role].push(g);
    }
  }
  function quad(
    role: "concrete",
    a: T.Vector3,
    b: T.Vector3,
    c: T.Vector3,
    e: T.Vector3,
  ) {
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [a, b, c, e].flatMap((v) => v.toArray()),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    bins[role].push(g);
  }
  // Deck underside and fascia only: the live asphalt remains the single top.
  const underside = createIronworkersDeckGeometry(deckHeight, -d.deckDepth),
    undersideIndex = underside.index!;
  for (let i = 0; i < undersideIndex.count; i += 3) {
    const a = undersideIndex.getX(i);
    undersideIndex.setX(i, undersideIndex.getX(i + 1));
    undersideIndex.setX(i + 1, a);
  }
  underside.computeVertexNormals();
  bins.concrete.push(underside);
  const deckStations = IRONWORKERS_DECK_STATIONS.map(
      (t) => ironworkersFrame(t).distance,
    ),
    deckSegments = deckStations.length - 1;
  for (let i = 0; i < deckSegments; i++) {
    const a = deckStations[i],
      b = deckStations[i + 1],
      half = bridge.width / 2;
    for (const sign of [-1, 1]) {
      const v = [
        at(a, sign * half, y(a) - 0.025),
        at(b, sign * half, y(b) - 0.025),
        at(b, sign * half, y(b) - d.deckDepth),
        at(a, sign * half, y(a) - d.deckDepth),
      ];
      if (sign < 0) v.reverse();
      quad("concrete", v[0], v[1], v[2], v[3]);
    }
  }
  const bearings: { station: number; bottom: number }[] = [];
  let panels = 0;
  const framedNodes = new Set<number>();
  function truss(a: number, b: number, depth: (s: number) => number) {
    const count = Math.ceil((b - a) / d.panelTarget),
      nodes = Array.from(
        { length: count + 1 },
        (_, i) => a + ((b - a) * i) / count,
      );
    panels += count;
    for (let i = 0; i < nodes.length; i++) {
      const s = nodes[i],
        top = y(s) - d.topChordDrop,
        bottom = y(s) - depth(s);
      const key = Math.round(s * 100000),
        freshFrame = !framedNodes.has(key);
      framedNodes.add(key);
      // Floor beams sit wholly below the deck and connect both primary trusses.
      if (freshFrame)
        member(
          at(s, -bridge.width / 2 + 0.25, y(s) - 0.91),
          at(s, bridge.width / 2 - 0.25, y(s) - 0.91),
          0.32,
          0.6,
          "steel",
          true,
        );
      for (const sign of [-1, 1]) {
        const side = (sign * d.trussSpacing) / 2;
        if (freshFrame)
          member(
            at(s, side, bottom),
            at(s, side, top),
            0.44,
            0.55,
            "steel",
            true,
          );
        if (i === nodes.length - 1) continue;
        const next = nodes[i + 1],
          nextTop = y(next) - d.topChordDrop,
          nextBottom = y(next) - depth(next);
        member(
          at(s, side, top),
          at(next, side, nextTop),
          0.65,
          0.75,
          "steel",
          true,
        );
        member(
          at(s, side, bottom),
          at(next, side, nextBottom),
          0.72,
          0.8,
          "steel",
          true,
        );
        // Alternating Warren webs, not the repeated one-way above-road ladder.
        member(
          at(s, side, i % 2 ? top : bottom),
          at(next, side, i % 2 ? nextBottom : nextTop),
          0.4,
          0.48,
          "steel",
          true,
        );
      }
      if (i < nodes.length - 1) {
        const next = nodes[i + 1];
        member(
          at(s, -d.trussSpacing / 2, top - 0.5),
          at(next, d.trussSpacing / 2, y(next) - d.topChordDrop - 0.5),
          0.18,
          0.2,
        );
        member(
          at(s, d.trussSpacing / 2, top - 0.5),
          at(next, -d.trussSpacing / 2, y(next) - d.topChordDrop - 0.5),
          0.18,
          0.2,
        );
      }
    }
    bearings.push(
      { station: a, bottom: y(a) - depth(a) },
      { station: b, bottom: y(b) - depth(b) },
    );
  }
  for (const [a, b] of [
    [span.start, span.southPier],
    [span.southPier, span.northPier],
    [span.northPier, span.end],
  ])
    truss(a, b, (s) => ironworkersTrussDepth(s, length));
  // Fit the short north approach to the remaining supported run. The four
  // spans keep their documented86m rhythm; the final landward stub stays plain.
  let start = span.end;
  for (let i = 0; i < d.approachCount; i++) {
    const end = Math.min(length, start + d.approachSpan);
    if (end - start > 1) truss(start, end, () => d.approachDepth);
    start = end;
  }
  // Retain a plain south approach; its exact substructure stationing is not
  // recovered. These supports follow the existing road instead of crossing it.
  for (let s = 48; s < span.start - 24; s += 48)
    bearings.push({ station: s, bottom: y(s) - 1.5 });
  const unique = new Map<number, number>();
  for (const b of bearings)
    unique.set(
      b.station,
      Math.min(unique.get(b.station) ?? Infinity, b.bottom),
    );
  for (const [s, bottom] of unique) {
    const capY = bottom - 0.4;
    // Sole plates connect the cut ends of inclined chords to flat pier caps.
    // A plain approach head rises to the deck underside; no suspended cap.
    for (const sign of [-1, 1])
      member(
        at(s, (sign * d.trussSpacing) / 2, capY),
        at(
          s,
          (sign * d.trussSpacing) / 2,
          s < span.start ? y(s) - d.deckDepth : bottom + 0.3,
        ),
        1.1,
        1.2,
      );
    member(
      at(s, -d.trussSpacing / 2 - 1, capY - 0.65),
      at(s, d.trussSpacing / 2 + 1, capY - 0.65),
      1.3,
      2.8,
      "concrete",
    );
    for (const sign of [-1, 1])
      member(
        at(s, (sign * d.trussSpacing) / 2, Math.min(-6, capY - 6)),
        at(s, (sign * d.trussSpacing) / 2, capY - 1.3),
        2.1,
        3.4,
        "concrete",
      );
  }
  const result = {} as IronworkersGeometry;
  let triangles = 0;
  for (const role of ["steel", "concrete"] as const) {
    const g = mergeGeometries(bins[role], false)!;
    bins[role].forEach((g) => g.dispose());
    g.computeBoundingBox();
    g.computeBoundingSphere();
    result[role] = g;
    triangles += g.index!.count / 3;
  }
  result.stats = { triangles, panels, bearings: unique.size, meshes: 2 };
  return result;
}

export function addIronworkersBridgeStructure(
  parent: T.Group,
  bridge: Bridge,
  deckHeight: (t: number) => number,
  concrete: T.Material,
) {
  const result = createIronworkersBridgeGeometry(bridge, deckHeight);
  const steel = new T.MeshStandardMaterial({
    name: "Ironworkers ochre painted structural steel",
    color: IRONWORKERS_STRUCTURE.steelColor,
    roughness: 0.67,
    metalness: 0.28,
  });
  for (const role of ["steel", "concrete"] as const) {
    const mesh = new T.Mesh(result[role], role === "steel" ? steel : concrete);
    mesh.name = `Ironworkers below-deck ${role}`;
    mesh.userData.allowShadow = true;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
  return result.stats;
}
