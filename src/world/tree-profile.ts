import { hash, seeded } from "./data";

export interface TreeSpecies {
  name: string;
  genus: string;
  species: string;
  cultivar: string;
}
export type PublicTreeRecord = [
  number,
  number,
  number,
  number | null,
  number | null,
  number,
];
export interface PublicTreeLayer {
  species: TreeSpecies[];
  trees: PublicTreeRecord[];
  plantingSites: number[];
}
export interface TreeProfile {
  x: number;
  z: number;
  height: number;
  width: number;
  diameter: number;
  crownBase: number;
  rotation: number;
  form: "broad" | "columnar" | "conifer";
  ground?: number;
  sourceId?: number;
}
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
/** Crown dimensions are a bounded visual interpretation; the inventory measures height and DBH only. */
export function treeProfile(
  x: number,
  z: number,
  height?: number | null,
  diameter?: number | null,
  species?: TreeSpecies,
  sourceId?: number,
): TreeProfile {
  const random = seeded(sourceId ?? hash(`${x.toFixed(1)},${z.toFixed(1)}`));
  const name =
    `${species?.name} ${species?.genus} ${species?.species} ${species?.cultivar}`.toUpperCase();
  const conifer =
    /\b(ABIES|PICEA|PINUS|PSEUDOTSUGA|THUJA|TSUGA|CEDRUS|CHAMAECYPARIS|CUPRESSUS|SEQUOIA|SEQUOIADENDRON|CRYPTOMERIA|TAXUS|LARIX|METASEQUOIA|JUNIPERUS|CONIFEROUS)\b/.test(
      name,
    );
  const columnar =
    /FASTIGIATA|PYRAMIDAL|COLUMNAR|CHANTICLEER|CAPITAL|DAWYCK|BOWHALL|ARMSTRONG|FRANS FONTAINE/.test(
      name,
    );
  const h =
    height && Number.isFinite(height) && height > 0 && height <= 75
      ? height
      : clamp(
          diameter && diameter > 0
            ? 3 + Math.sqrt(diameter) * 17
            : 5 + random() * 6,
          2,
          32,
        );
  const dbh =
    diameter && Number.isFinite(diameter) && diameter > 0 && diameter <= 5
      ? diameter
      : clamp(h * 0.025, 0.05, 1.2);
  const form = conifer ? "conifer" : columnar ? "columnar" : "broad";
  const ratio = conifer
    ? 0.43
    : columnar
      ? 0.35
      : /PRUNUS|MALUS/.test(name)
        ? 0.86
        : 0.68;
  const width = clamp(
    h * ratio * (0.92 + random() * 0.16),
    0.65,
    conifer ? 14 : columnar ? 8 : 18,
  );
  const crownBase = conifer ? 0.2 : columnar ? 0.26 : 0.34;
  return {
    x,
    z,
    height: h,
    width,
    diameter: dbh,
    crownBase,
    form,
    rotation: random() * Math.PI * 2,
    sourceId,
  };
}
/** City records own public positions; nearby OSM points are duplicate observations, not extra trees. */
export function reconcileTrees(
  osm: number[],
  layer?: PublicTreeLayer,
): TreeProfile[] {
  if (!layer) {
    const out: TreeProfile[] = [];
    for (let i = 0; i < osm.length; i += 2)
      out.push(treeProfile(osm[i], osm[i + 1]));
    return out;
  }
  const occupied = new Map<string, [number, number, number][]>();
  const key = (x: number, z: number) =>
    `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
  const add = (x: number, z: number, radius: number) => {
    const k = key(x, z),
      bucket = occupied.get(k) ?? [];
    bucket.push([x, z, radius]);
    occupied.set(k, bucket);
  };
  const out: TreeProfile[] = [];
  for (const [id, x, z, h, d, si] of layer.trees) {
    if (![id, x, z].every(Number.isFinite)) continue;
    out.push(treeProfile(x, z, h, d, layer.species[si], id));
    add(x, z, 5);
  }
  for (let i = 0; i < layer.plantingSites.length; i += 2)
    add(layer.plantingSites[i], layer.plantingSites[i + 1], 3);
  for (let i = 0; i < osm.length; i += 2) {
    const x = osm[i],
      z = osm[i + 1],
      cx = Math.floor(x / 6),
      cz = Math.floor(z / 6);
    let found = false;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        if (
          occupied
            .get(`${cx + a},${cz + b}`)
            ?.some(([tx, tz, r]) => Math.hypot(tx - x, tz - z) <= r)
        )
          found = true;
      }
    if (!found) out.push(treeProfile(x, z));
  }
  return out;
}
