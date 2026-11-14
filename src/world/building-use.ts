const homes = new Set([
  "house",
  "detached",
  "semidetached_house",
  "terrace",
  "bungalow",
]);
const nonRetail = new Set([
  "garage",
  "garages",
  "shed",
  "roof",
  "school",
  "university",
  "church",
  "chapel",
  "hospital",
  "industrial",
  "warehouse",
]);
export function hasStorefront(kind?: string, roadName = "") {
  if (homes.has(kind ?? "") || nonRetail.has(kind ?? "")) return false;
  if (kind === "residential" || kind === "apartments")
    return /\b(Robson|Davie|Denman|Granville|Burrard|Hastings|Main|Water|Cordova|Pender|Broadway)\b/i.test(
      roadName,
    );
  return true;
}

export function isResidential(kind?: string) {
  return (
    homes.has(kind ?? "") || kind === "residential" || kind === "apartments"
  );
}

export const isHouse = (kind?: string) => homes.has(kind ?? "");
export const isUtilityBuilding = (kind?: string) =>
  ["garage", "garages", "shed", "roof", "carport"].includes(kind ?? "");
export const isIndustrial = (kind?: string) =>
  ["industrial", "warehouse"].includes(kind ?? "");
