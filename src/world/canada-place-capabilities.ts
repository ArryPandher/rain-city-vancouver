/** Per-loaded-instance geometry capabilities. No shared mutable availability flags. */
export type CanadaPlaceCapabilities = {
  loaded: boolean;
  concourse: boolean;
  entranceCanopy: boolean;
  groundStays: boolean;
  promenadeFixtures: boolean;
  howePodium?: boolean;
};
export function canadaPlaceCapabilities(
  loaded = false,
  concourse = false,
  entranceCanopy = false,
  promenadeFixtures = false,
  howePodium = false,
): CanadaPlaceCapabilities {
  return {
    loaded,
    concourse: loaded && concourse,
    entranceCanopy: loaded && entranceCanopy,
    groundStays: loaded && concourse,
    promenadeFixtures: loaded && promenadeFixtures,
    howePodium: loaded && howePodium,
  };
}
