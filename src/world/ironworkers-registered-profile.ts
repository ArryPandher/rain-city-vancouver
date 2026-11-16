import {
  ironworkersFrame,
  ironworkersTAtDistance,
} from "./ironworkers-alignment";

/** BC 2018 risk report Fig.2.3, physical PDF p31. Printed horizontal dimensions;
 * vertical pixels are an approximate trace, NOT surveyed deck elevations.
 * Deliberately uninstalled until both highway approaches share this datum. */
export const IRONWORKERS_REGISTERED_SOURCE = {
  metresPerPixel: 335.28 / (1604 - 905),
  highWaterPixel: 284,
  highWaterAboveMeanWater: 5.0 - 3.1,
  verticalUncertainty: 2,
  planRegistrationUncertainty: 10,
  source:
    "https://www2.gov.bc.ca/assets/gov/driving-and-transportation/reports-and-reference/reports-and-studies/lower-mainland/2018-03-16-ironworkers-risk-assessment.pdf",
} as const;

export const IRONWORKERS_REGISTERED_SPANS = [
  { south: "P18", north: "P17", length: 32.614 },
  { south: "P17", north: "P16", length: 141.77 },
  { south: "P16", north: "P15", length: 335.28 },
  { south: "P15", north: "P14", length: 142.151 },
  { south: "P14", north: "P13", length: 86.843 },
  { south: "P13", north: "P12", length: 85.852 },
  { south: "P12", north: "P11", length: 85.852 },
] as const;

export function ironworkersElevationFromPixel(pixelY: number) {
  const d = IRONWORKERS_REGISTERED_SOURCE;
  return (
    (d.highWaterPixel - pixelY) * d.metresPerPixel + d.highWaterAboveMeanWater
  );
}
const stationByPier = new Map<string, number>([["P18", 0]]);
let cumulative = 0;
for (const span of IRONWORKERS_REGISTERED_SPANS) {
  cumulative += span.length;
  stationByPier.set(span.north, cumulative);
}
const controls = [
  ["P18", 191, 201],
  ["P17", 185, 214],
  ["P16", 171, 267],
  ["crest", 160, 188],
  ["P15", 171, 267],
  ["P14", 188, 214],
  ["P13", 197, 225],
  ["P12", 204, 234],
  ["P11", 214, 244],
] as const;
export const IRONWORKERS_REGISTERED_CONTROLS = controls.map(
  ([name, deckPixel, steelPixel]) => ({
    name,
    station:
      name === "crest"
        ? (stationByPier.get("P16")! + stationByPier.get("P15")!) / 2
        : stationByPier.get(name)!,
    deckPixel,
    steelPixel,
    deck: ironworkersElevationFromPixel(deckPixel),
    steel: ironworkersElevationFromPixel(steelPixel),
  }),
);
export const IRONWORKERS_REGISTERED_LIMIT = cumulative;
/** Source P18 is at t0, not the start of the rendered six-metre approach tie. */
export const IRONWORKERS_REGISTERED_PLAN_ORIGIN = ironworkersFrame(0).distance;

function slopes(values: number[]) {
  const c = IRONWORKERS_REGISTERED_CONTROLS;
  const h = c.slice(1).map((p, i) => p.station - c[i].station);
  const d = h.map((v, i) => (values[i + 1] - values[i]) / v);
  return values.map((_, i) => {
    if (i === 0) return d[0];
    if (i === values.length - 1) return d.at(-1)!;
    if (d[i - 1] * d[i] <= 0) return 0;
    const w1 = 2 * h[i] + h[i - 1],
      w2 = h[i] + 2 * h[i - 1];
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
}
const deckSlopes = slopes(IRONWORKERS_REGISTERED_CONTROLS.map((p) => p.deck));
const steelSlopes = slopes(IRONWORKERS_REGISTERED_CONTROLS.map((p) => p.steel));
/** No extrapolation into the unresolved north tail or south ground approach. */
export function sampleIronworkersRegisteredProfile(station: number) {
  if (
    !Number.isFinite(station) ||
    station < 0 ||
    station > IRONWORKERS_REGISTERED_LIMIT
  )
    return undefined;
  const c = IRONWORKERS_REGISTERED_CONTROLS;
  let i = 0;
  while (i < c.length - 2 && station > c[i + 1].station) i++;
  const a = c[i],
    b = c[i + 1],
    h = b.station - a.station,
    t = (station - a.station) / h;
  const interpolate = (key: "deck" | "steel", m: number[]) =>
    (2 * t ** 3 - 3 * t * t + 1) * a[key] +
    (t ** 3 - 2 * t * t + t) * h * m[i] +
    (-2 * t ** 3 + 3 * t * t) * b[key] +
    (t ** 3 - t * t) * h * m[i + 1];
  const deck = interpolate("deck", deckSlopes),
    steel = interpolate("steel", steelSlopes);
  return { station, deck, steel, depth: deck - steel };
}
export function ironworkersRegisteredPoint(
  station: number,
  side = 0,
  surface: "deck" | "steel" = "deck",
): [number, number, number] | undefined {
  const profile = sampleIronworkersRegisteredProfile(station);
  if (!profile) return undefined;
  const f = ironworkersFrame(
    ironworkersTAtDistance(IRONWORKERS_REGISTERED_PLAN_ORIGIN + station),
  );
  return [f.x + side * f.nx, profile[surface], f.z + side * f.nz];
}
