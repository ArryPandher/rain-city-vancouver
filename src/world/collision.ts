import type { createIronworkersPathBoundary } from "./ironworkers-path-boundary";
import {
  ironworkersPoint,
  ironworkersSample,
  ironworkersContains,
} from "./ironworkers-alignment";
import { createHoweSceneTerrain } from "./howe-scene-terrain";
import { createRobsonRinkContact } from "./robson-rink-contact";
import { panPacificHowePodiumCameraClearance } from "./pan-pacific-howe-podium-camera";
import {
  createHoweCordovaJunctionSite,
  type HoweCordovaJunctionSite,
} from "./howe-cordova-junction-site";
import {
  createPacificCoastApronSite,
  type PacificCoastApronSite,
} from "./pacific-coast-apron-site";
import { PACIFIC_COAST_ID, PACIFIC_COAST_CENTRE } from "./pacific-coast-site";
import { HOWE_FORECOURT, HOWE_STATION } from "./howe-station-site";
import type { Terrain } from "./terrain";
import {
  createExteriorRecessCollision,
  type ExteriorRecessCollision,
} from "./exterior-recess-collision";
import { createFairmontArcadeSite } from "./fairmont-arcade-site";
import { createCanadaWalkingSurface } from "./canada-walking-surface";
import {
  createFairmontArrivalIsland,
  type FairmontArrivalIsland,
} from "./fairmont-arrival-island";
import {
  FAIRMONT_WATERFRONT_ID,
  FAIRMONT_WATERFRONT_RING,
} from "./fairmont-waterfront-site";
import { PWC_PLACE_ID, PWC_PLACE_RING } from "./pwc-place-site";
import { createPwcLobbySite } from "./pwc-lobby-site";
import {
  canadaPlaceCapabilities,
  type CanadaPlaceCapabilities,
} from "./canada-place-capabilities";
import { galleryRearStepHeight } from "./gallery-rear-entry";
import {
  robsonMoundCirculationHeight,
  robsonMoundCirculationTerrainHeight,
  robsonMoundCirculationBlocked,
} from "./robson-mound-circulation";
import { canadaPlacePromenadeFixtureAt } from "./canada-place-promenade-fixtures-data";
import { canadaPlaceGuardSegments } from "./canada-place-guards";
import {
  createCanadaPlaceSite,
  CANADA_PLACE_ROAD_IDS,
  CANADA_PLACE_SERVICE_IDS,
  type CanadaPlaceSite,
} from "./canada-place-site";
import {
  CANADA_PLACE_DECK_Y,
  CANADA_PLACE_ORIGIN,
  CANADA_PLACE_PIER,
  CANADA_PLACE_PIER_ID,
  CANADA_PLACE_HOTEL_ID,
  CANADA_PLACE_ENTRY_CONNECTOR,
  CANADA_PLACE_DECK_COLLIDER_IDS,
  canadaPlaceEastFrontRailAt,
  supportedDeck,
  solidAt,
  canadaPlaceGroundStayAt,
  inCanadaPlacePier,
} from "./canada-place-deck";
import { harbourTower } from "./harbour-towers-site";
import { harbourGroundHeight } from "./harbour-green-site";
import { FAIRMONT_ID, fairmontFootprint } from "./fairmont-site";
import { ROGERS_ID, rogersFootprint } from "./rogers-site";
import {
  JACK_BOUNDARY,
  jackBaseHeight,
  jackGroundHeight,
  jackRoofAccess,
  CACTUS_ID,
} from "./jack-poole-site";
import {
  ROBSON_GARDEN_ID,
  robsonWalkableBuilding,
  robsonHeight,
  robsonObstacle,
} from "./robson-site";
import { prospectLookoutHeight } from "./prospect-lookout-site";
import { prospectForecourtHeight } from "./prospect-site";
import {
  CONVENTION_ID,
  conventionSite,
  conventionDeckHeight,
  conventionApproachHeight,
  type ConventionSite,
} from "./convention-site";
import {
  CityData,
  Building,
  bounds,
  centroid,
  pointInPoly,
  segmentPoint,
  geo,
  Road,
  roadWidth,
  isStreet,
} from "./data";
export interface Bridge {
  id: string;
  name: string;
  a: [number, number];
  b: [number, number];
  width: number;
  height: number;
  style: "concrete" | "suspension" | "truss";
  points?: [number, number][];
}
export const BRIDGES: Bridge[] = [
  {
    id: "cambie",
    name: "Cambie Bridge",
    a: [208, 832],
    b: [363, 1590],
    points: [
      [208, 832],
      [328, 953],
      [365, 1025],
      [377, 1110],
      [363, 1590],
    ],
    width: 32,
    height: 17,
    style: "concrete",
  },
  {
    id: "granville",
    name: "Granville Bridge",
    a: geo(49.2763, -123.1291),
    b: geo(49.269, -123.1381),
    width: 28,
    height: 22,
    style: "truss",
  },
  {
    id: "burrard",
    name: "Burrard Bridge",
    a: geo(49.2771, -123.1334),
    b: geo(49.2729, -123.144),
    width: 23,
    height: 21,
    style: "concrete",
  },
  {
    id: "lions",
    name: "Lions Gate Bridge",
    a: [-1590, -3185],
    b: [-520, -4958],
    width: 22,
    height: 61,
    style: "suspension",
  },
  {
    id: "ironworkers",
    name: "Ironworkers Memorial Bridge",
    a: [6806, -952],
    b: [6776, -2268],
    width: 36,
    height: 39,
    style: "truss",
  },
];
export function bridgePoint(b: Bridge, t: number): [number, number] {
  if (b.id === "ironworkers") return ironworkersPoint(t);
  const pts = b.points || [b.a, b.b],
    lengths = pts
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])),
    total = lengths.reduce((a, b) => a + b, 0);
  let distance = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const f = distance / lengths[i];
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
      ];
    }
    distance -= lengths[i];
  }
  return b.b;
}
export function bridgeSample(b: Bridge, x: number, z: number) {
  if (b.id === "ironworkers") return ironworkersSample(x, z);
  const pts = b.points || [b.a, b.b],
    lengths = pts
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])),
    total = lengths.reduce((a, b) => a + b, 0);
  let offset = 0,
    best = { x: 0, z: 0, d: Infinity, t: 0 };
  for (let i = 0; i < lengths.length; i++) {
    const s = segmentPoint(x, z, ...pts[i], ...pts[i + 1]);
    if (s.d < best.d) best = { ...s, t: (offset + s.t * lengths[i]) / total };
    offset += lengths[i];
  }
  return best;
}
export const bridgeY = (
  b: Bridge,
  t: number,
  ends: [number, number] = [0, 0],
) => {
  t = Math.max(0, Math.min(1, t));
  const baseline = ends[0] * (1 - t) + ends[1] * t;
  const peak = Math.max(b.height, ends[0] + 3, ends[1] + 3);
  return (
    baseline +
    Math.pow(Math.sin(Math.PI * t), 1.1) * (peak - (ends[0] + ends[1]) / 2)
  );
};
export class SpatialHash<T> {
  cells = new Map<string, T[]>();
  constructor(public size = 64) {}
  add(v: T, minX: number, minZ: number, maxX = minX, maxZ = minZ) {
    for (
      let x = Math.floor(minX / this.size);
      x <= Math.floor(maxX / this.size);
      x++
    )
      for (
        let z = Math.floor(minZ / this.size);
        z <= Math.floor(maxZ / this.size);
        z++
      ) {
        const k = x + "," + z;
        let a = this.cells.get(k);
        if (!a) this.cells.set(k, (a = []));
        a.push(v);
      }
  }
  query(x: number, z: number, r = 0) {
    const out = new Set<T>();
    for (
      let ix = Math.floor((x - r) / this.size);
      ix <= Math.floor((x + r) / this.size);
      ix++
    )
      for (
        let iz = Math.floor((z - r) / this.size);
        iz <= Math.floor((z + r) / this.size);
        iz++
      )
        for (const v of this.cells.get(ix + "," + iz) || []) out.add(v);
    return [...out];
  }
}
export class CollisionWorld {
  private canadaGeometry = canadaPlaceCapabilities();
  setCanadaPlaceCapabilities(capabilities: CanadaPlaceCapabilities) {
    this.canadaGeometry = canadaPlaceCapabilities(
      capabilities.loaded,
      capabilities.concourse,
      capabilities.entranceCanopy,
      capabilities.promenadeFixtures,
      capabilities.howePodium,
    );
  }
  barriers = new SpatialHash<{
    ax: number;
    az: number;
    bx: number;
    bz: number;
    radius: number;
    top: number;
  }>(32);
  addBarrier(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    radius: number,
    top: number,
  ) {
    this.barriers.add(
      { ax, az, bx, bz, radius, top },
      Math.min(ax, bx) - radius,
      Math.min(az, bz) - radius,
      Math.max(ax, bx) + radius,
      Math.max(az, bz) + radius,
    );
  }
  harbour = false;
  gallery = false;
  robsonGarden?: Building;
  ironworkersPaths?: ReturnType<typeof createIronworkersPathBoundary>;
  robsonRink?: ReturnType<typeof createRobsonRinkContact>;
  convention?: ConventionSite;
  canada?: CanadaPlaceSite;
  howeTerrain?: Terrain;
  howeTerrainCutouts: number[][] = [];
  fairmontArrivalIsland?: FairmontArrivalIsland;
  pacificApron?: PacificCoastApronSite;
  howeCordovaJunction?: HoweCordovaJunctionSite;
  private canadaWalking?: ReturnType<typeof createCanadaWalkingSurface>;
  private exteriorRecesses = new Map<string, ExteriorRecessCollision>();
  buildings = new SpatialHash<Building>();
  roads = new SpatialHash<Road>(100);
  forestObstacles = new SpatialHash<{ x: number; z: number; radius: number }>(
    24,
  );
  addForestTrunk(x: number, z: number, radius: number) {
    this.forestObstacles.add(
      { x, z, radius },
      x - radius,
      z - radius,
      x + radius,
      z + radius,
    );
  }
  constructor(public data: CityData) {
    this.gallery = data.buildings.some((b) => b.id === "w69701736");
    this.harbour = data.areas.some((a) => a.name === "Harbour Green Park");
    for (const source of data.buildings) {
      let b = source;
      if (b.id === FAIRMONT_WATERFRONT_ID)
        b = { ...b, pts: FAIRMONT_WATERFRONT_RING.flat() };
      if (b.id === PWC_PLACE_ID) b = { ...b, pts: PWC_PLACE_RING.flat() };
      const harbour = harbourTower(b.id);
      if (harbour) b = { ...b, pts: harbour.parts[0].pts.flat() };
      if (b.id === FAIRMONT_ID) b = { ...b, pts: fairmontFootprint };
      if (b.id === ROGERS_ID) b = { ...b, pts: rogersFootprint };
      if (b.id === CONVENTION_ID) {
        this.convention = conventionSite(b);
        b = { ...b, pts: this.convention.footprint };
        for (const [a, c] of this.convention.shoreSegments)
          this.addBarrier(
            ...this.convention.world(...a),
            ...this.convention.world(...c),
            0.06,
            7.2,
          );
      }
      if (b.id === ROBSON_GARDEN_ID) {
        this.robsonGarden = b;
        this.robsonRink = createRobsonRinkContact();
      }
      if (robsonWalkableBuilding(b.id)) continue;
      const xs = b.pts.filter((_, i) => !(i % 2)),
        zs = b.pts.filter((_, i) => i % 2);
      this.buildings.add(
        b,
        Math.min(...xs),
        Math.min(...zs),
        Math.max(...xs),
        Math.max(...zs),
      );
    }
    if (
      data.buildings.some((b) => b.id === CANADA_PLACE_PIER_ID) &&
      [...CANADA_PLACE_ROAD_IDS].every((id) =>
        data.roads.some((r) => r.id === id),
      )
    ) {
      const ring = (p: number[]): [number, number][] =>
        Array.from({ length: p.length / 2 }, (_, i) => [
          p[i * 2],
          p[i * 2 + 1],
        ]);
      const initial = createCanadaPlaceSite({
        roads: data.roads,
        buildings: data.buildings,
        westernHeight: (x, z) => this.legacyGroundHeight(x, z),
        connectors: [ring(CANADA_PLACE_ENTRY_CONNECTOR)],
        existingDeck: ring(CANADA_PLACE_PIER),
      });
      const approach = this.convention
        ? [
            [150, -78],
            [214, -78],
            [214, -27],
            [150, -27],
          ].map((p) => this.convention!.world(p[0], p[1]))
        : undefined;
      this.howeTerrain = createHoweSceneTerrain({
        oldHeight: (x, z) =>
          initial.baselineHeight(x, z) ?? this.legacyGroundHeight(x, z),
        waterfrontPath: initial.waterfrontPath,
        waterfrontHeight: initial.supportHeight,
        protectedApproach: approach,
        protectedEdges: this.convention
          ? [{ ring: ring(JACK_BOUNDARY), height: jackBaseHeight }]
          : [],
        protectedHeight: (x, z) => {
          const [e, n] = this.convention!.local(x, z);
          return (
            this.convention!.deckHeight *
            Math.max(0, Math.min(1, (n + 78) / 49)) *
            Math.max(0, Math.min(1, (e - 150) / 13, (214 - e) / 17))
          );
        },
      });
      this.howeTerrainCutouts = [
        HOWE_STATION.surfaceCutout.flat(),
        ...(this.convention ? [JACK_BOUNDARY] : []),
        ...(approach ? [approach.flat()] : []),
        ...(this.convention ? [this.convention.platformWorld] : []),
        CANADA_PLACE_PIER,
      ];
      this.canada = createCanadaPlaceSite({
        roads: data.roads,
        buildings: data.buildings,
        westernHeight: (x, z) => this.existingGroundHeight(x, z),
        sharedHeight: (x, z) =>
          this.howeTerrain?.contains(x, z)
            ? this.existingGroundHeight(x, z)
            : undefined,
        connectors: [ring(CANADA_PLACE_ENTRY_CONNECTOR), HOWE_FORECOURT],
        cutouts: [HOWE_STATION.surfaceCutout],
        existingDeck: ring(CANADA_PLACE_PIER),
      });
      // The rendered gable/side glazing encloses an unplayable station volume.
      for (let i = 0; i < HOWE_STATION.footprint.length; i++)
        this.addBarrier(
          ...HOWE_STATION.footprint[i],
          ...HOWE_STATION.footprint[(i + 1) % HOWE_STATION.footprint.length],
          0.08,
          HOWE_STATION.maxY,
        );
      for (const rail of canadaPlaceGuardSegments(data, this.canada, (x, z) =>
        this.existingGroundHeight(x, z),
      ))
        this.addBarrier(
          ...rail.a,
          ...rail.b,
          0.06,
          Math.max(rail.topA, rail.topB),
        );
    }
    for (const r of data.roads) {
      for (let i = 0; i < r.pts.length - 2; i += 2)
        this.roads.add(
          r,
          Math.min(r.pts[i], r.pts[i + 2]),
          Math.min(r.pts[i + 1], r.pts[i + 3]),
          Math.max(r.pts[i], r.pts[i + 2]),
          Math.max(r.pts[i + 1], r.pts[i + 3]),
        );
    }
    const hotel = data.buildings.find((b) => b.id === FAIRMONT_WATERFRONT_ID);
    if (hotel) {
      if (this.canada?.fairmontApron)
        this.fairmontArrivalIsland = createFairmontArrivalIsland(
          this.baselineGroundHeight.bind(this),
        );
      const base = this.baselineGroundHeight(...centroid(hotel.pts));
      const site = createFairmontArcadeSite(
        this.baselineGroundHeight.bind(this),
        base,
      );
      this.exteriorRecesses.set(
        hotel.id,
        createExteriorRecessCollision({
          footprint: FAIRMONT_WATERFRONT_RING,
          openings: site.openPolygons,
          closures: site.closures.map((s) => [s.a, s.b]),
          columns: site.piers,
          floorAt: (x, z) => {
            const y = site.floorAt(x, z);
            return y === undefined ? undefined : base + y;
          },
          ceiling: (x, z) =>
            base + (site.ceilingAt(x, z) ?? site.canopyTopAt(x, z) - 0.64),
        }),
      );
    }
    const pwc = data.buildings.find((b) => b.id === PWC_PLACE_ID);
    if (pwc) {
      const base = this.baselineGroundHeight(...centroid(pwc.pts));
      const site = createPwcLobbySite(
        this.baselineGroundHeight.bind(this),
        base,
      );
      this.exteriorRecesses.set(
        pwc.id,
        createExteriorRecessCollision({
          footprint: PWC_PLACE_RING,
          openings: site.openPolygons,
          closures: site.closures,
          columns: site.columns.map((p) => ({
            point: [p.x, p.z],
            radius: p.radius,
          })),
          floorAt: (x, z) => {
            const y = site.floorAt(x, z);
            return y === undefined ? undefined : base + y;
          },
          ceiling: base + site.ceiling,
        }),
      );
    }
    if (data.buildings.some((building) => building.id === PACIFIC_COAST_ID)) {
      this.pacificApron = createPacificCoastApronSite(
        this.baselineGroundHeight.bind(this),
        this.baselineGroundHeight(...PACIFIC_COAST_CENTRE),
      );
      this.howeCordovaJunction = createHoweCordovaJunctionSite(
        data,
        this.baselineGroundHeight.bind(this),
        this.pacificApron,
      );
      for (const rail of this.pacificApron.rails)
        this.addBarrier(
          rail.a[0],
          rail.a[2],
          rail.b[0],
          rail.b[2],
          0.025,
          Math.max(rail.a[1], rail.b[1]),
        );
    }
  }
  /** On-foot contact includes the finish; the baseline remains the construction datum. */
  walkingHeight(x: number, z: number, referenceY = Infinity): number {
    const rink = this.robsonRink?.support(x, z, referenceY);
    if (rink !== undefined) return rink;
    const apron = this.pacificApron?.height(x, z);
    if (apron !== undefined) return apron;
    const junction = this.howeCordovaJunction?.height(x, z);
    if (junction !== undefined) return junction;
    if (this.canada && pointInPoly(x, z, HOWE_STATION.landing.flat()))
      return HOWE_STATION.landingHeight;
    const base = this.height(x, z, referenceY);
    if (
      !this.canada ||
      !this.canada.contains(x, z) ||
      this.bridgeAt(x, z, referenceY) ||
      supportedDeck(x, z, 0, this.canadaGeometry)
    )
      return base;
    // Existing arcade/recess floors already carry their own finished elevation.
    for (const recess of this.exteriorRecesses.values())
      if (recess.floorAt(x, z) !== undefined) return base;
    this.canadaWalking ??= createCanadaWalkingSurface(
      this.data,
      this.canada,
      (road, x, z) => this.roadHeight(road, x, z),
    );
    const previousWalking = this.canadaWalking.height(x, z);
    // Keep Canada's existing finished walking contact wherever it is already
    // higher than the local road provider's outer blend to historical grade.
    return this.howeCordovaJunction?.roadHeight(x, z) !== undefined
      ? Math.max(previousWalking ?? base, base)
      : (previousWalking ?? base);
  }
  groundHeight(x: number, z: number): number {
    const rink = this.robsonRink?.floor(x, z);
    if (rink !== undefined) return rink;
    for (const recess of this.exteriorRecesses.values()) {
      const y = recess.floorAt(x, z);
      if (y !== undefined) return y;
    }
    return this.baselineGroundHeight(x, z);
  }
  /** Exterior approach before recessed-building floor overrides. */
  baselineGroundHeight(x: number, z: number) {
    if (this.canada && supportedDeck(x, z, 0, this.canadaGeometry))
      return CANADA_PLACE_DECK_Y;
    return this.canada?.baselineHeight(x, z) ?? this.existingGroundHeight(x, z);
  }
  /** Shared neighborhood field, preserving the separately authored VCC approach. */
  existingGroundHeight(x: number, z: number) {
    if (
      this.howeTerrain?.contains(x, z) &&
      !(this.convention && jackGroundHeight(x, z) !== undefined) &&
      conventionDeckHeight(this.convention, x, z) === undefined &&
      conventionApproachHeight(this.convention, x, z) === undefined
    )
      return this.howeTerrain.height(x, z);
    return this.legacyGroundHeight(x, z);
  }
  /** Pre-neighborhood sampler: grid construction must never recurse into itself. */
  legacyGroundHeight(x: number, z: number) {
    const gallery = this.gallery ? galleryRearStepHeight(x, z) : undefined;
    if (gallery !== undefined) return gallery;
    const harbour = this.harbour ? harbourGroundHeight(x, z) : undefined;
    if (harbour !== undefined) return harbour;
    const plaza = this.convention && jackGroundHeight(x, z);
    if (plaza !== undefined) return plaza;
    const convention = conventionDeckHeight(this.convention, x, z);
    if (convention !== undefined) return convention;
    const approach = conventionApproachHeight(this.convention, x, z);
    if (approach !== undefined) return approach;
    const lookout = this.data.terrain && prospectLookoutHeight(x, z);
    if (lookout !== undefined) return lookout;
    const forecourt = this.data.terrain && prospectForecourtHeight(x, z);
    if (forecourt !== undefined) return forecourt;
    const mound =
      this.robsonGarden &&
      (robsonMoundCirculationHeight(x, z) ??
        robsonMoundCirculationTerrainHeight(x, z));
    if (mound !== undefined) return mound;
    return this.robsonGarden
      ? (robsonHeight(x, z, this.robsonGarden.pts) ??
          this.data.terrain?.height(x, z) ??
          0)
      : (this.data.terrain?.height(x, z) ?? 0);
  }
  roadHeight(road: Road, x: number, z: number) {
    // The new local finish must not feed back into the original road ribbons.
    // Their exact gutter band is replaced by matching supported geometry.
    if (this.howeCordovaJunction?.containsRoadSupportBounds(x, z))
      return this.groundHeight(x, z);
    if (this.canada && road.id && CANADA_PLACE_SERVICE_IDS.has(road.id))
      return this.existingGroundHeight(x, z);
    return this.data.terrain?.contains(x, z) &&
      !/Lions Gate Bridge/.test(road.name ?? "")
      ? this.groundHeight(x, z)
      : this.height(x, z);
  }
  bridgeHeight(b: Bridge, t: number) {
    return bridgeY(b, t, [
      this.groundHeight(...b.a),
      this.groundHeight(...b.b),
    ]);
  }
  bridgeAt(x: number, z: number, referenceY = Infinity) {
    for (const b of BRIDGES) {
      const ironworkers = b.id === "ironworkers";
      if (ironworkers && !ironworkersContains(x, z)) continue;
      const s = bridgeSample(b, x, z);
      if (
        (ironworkers || s.d < b.width * 0.52) &&
        this.bridgeHeight(b, s.t) <= referenceY + 3
      )
        return { bridge: b, ...s };
    }
    return null;
  }
  height(x: number, z: number, referenceY = Infinity) {
    const path = this.ironworkersPaths?.supportAt(x, z);
    if (path !== undefined && path <= referenceY + 3) return path;
    const rink = this.robsonRink?.support(x, z, referenceY);
    if (rink !== undefined) return rink;
    const b = this.bridgeAt(x, z, referenceY);
    return b
      ? this.bridgeHeight(b.bridge, b.t)
      : (this.pacificApron?.height(x, z) ??
          this.howeCordovaJunction?.height(x, z) ??
          this.howeCordovaJunction?.roadHeight(x, z) ??
          this.groundHeight(x, z));
  }
  water(x: number, z: number, referenceY = Infinity) {
    const path = this.ironworkersPaths?.supportAt(x, z);
    if (path !== undefined && path <= referenceY + 3) return false;
    if (
      this.canada &&
      referenceY >= CANADA_PLACE_DECK_Y - 0.5 &&
      (supportedDeck(x, z, 0, this.canadaGeometry) ||
        this.canada.contains(x, z))
    )
      return false;
    if (this.harbour && harbourGroundHeight(x, z) !== undefined) return false;
    if (this.convention && jackGroundHeight(x, z) !== undefined) return false;
    if (conventionDeckHeight(this.convention, x, z) !== undefined) return false;
    if (this.bridgeAt(x, z, referenceY)) return false;
    if (x < bounds.minX || z < -8500) return true;
    return (
      this.data.ocean.some((p) => pointInPoly(x, z, p)) ||
      this.data.areas.some(
        (a) => a.kind === "water" && pointInPoly(x, z, a.pts),
      )
    );
  }
  blocked(x: number, z: number, r = 0.4, referenceY = Infinity) {
    return this.blockedAt(x, z, r, referenceY, false);
  }
  /** Camera spheres may occupy air above the source pier railing. Walking
   * support masks must not become infinite walls for a third-person boom. */
  cameraBlocked(x: number, z: number, r: number, referenceY: number) {
    return this.blockedAt(x, z, r, referenceY, true);
  }
  private blockedAt(
    x: number,
    z: number,
    r: number,
    referenceY: number,
    camera: boolean,
  ) {
    if (this.robsonRink?.blocked(x, z, r, referenceY, camera)) return true;
    if (
      this.canada &&
      referenceY - (camera ? r : 0) < HOWE_STATION.maxY &&
      pointInPoly(x, z, HOWE_STATION.footprint.flat())
    )
      return true;
    if (this.fairmontArrivalIsland?.blocked(x, z, r, referenceY, camera))
      return true;
    // A retaining face is not a step: low actors cannot enter the raised
    // support through its side and be snapped up by ground-following physics.
    if (
      this.canada?.contains(x, z) &&
      Number.isFinite(referenceY) &&
      this.groundHeight(x, z) > referenceY + 0.45
    )
      return true;
    const canadaLevel =
      this.canada &&
      this.canadaGeometry.loaded &&
      referenceY >= CANADA_PLACE_DECK_Y - 0.5;
    // Only the chase camera may enter the source-validated podium recess.
    // The raised guard/private terrace does not become an actor route.
    const podiumCameraClear =
      camera &&
      this.canadaGeometry.loaded &&
      this.canadaGeometry.howePodium &&
      panPacificHowePodiumCameraClearance(
        x - CANADA_PLACE_ORIGIN[0],
        z - CANADA_PLACE_ORIGIN[1],
        r,
        referenceY - 0.08,
      );
    if (this.canada && this.canadaGeometry.promenadeFixtures) {
      const y = Number.isFinite(referenceY)
        ? referenceY
        : this.groundHeight(x, z);
      if (
        canadaPlacePromenadeFixtureAt(
          x,
          z,
          r,
          camera ? y - r : y,
          camera ? r * 2 : 1.8,
        )
      )
        return true;
    }
    // The exact east apron rail is outside parts of the coarser mapped pier.
    // Keep its visible finite-height barrier when source-backed support is live.
    if (
      this.canadaGeometry.loaded &&
      canadaPlaceEastFrontRailAt(x, z, r, referenceY, camera)
    )
      return true;
    // Public deck eligibility never opens the closed hotel/exhibition volumes.
    if (
      this.canada &&
      this.canadaGeometry.groundStays &&
      canadaPlaceGroundStayAt(x, z, r, referenceY)
    )
      return true;
    if (
      canadaLevel &&
      inCanadaPlacePier(x, z) &&
      !podiumCameraClear &&
      solidAt(x, z, r, referenceY, this.canadaGeometry)
    )
      return true;
    if (
      this.robsonGarden &&
      (robsonObstacle(x, z, r) ||
        robsonMoundCirculationBlocked(x, z, r, referenceY, camera))
    )
      return true;
    if (
      this.ironworkersPaths?.blockedAt(
        x,
        z,
        r,
        Number.isFinite(referenceY) ? referenceY : this.height(x, z),
        camera,
      )
    )
      return true;
    const bridge = this.bridgeAt(x, z, referenceY);
    if (
      bridge &&
      this.bridgeHeight(bridge.bridge, bridge.t) > this.groundHeight(x, z) + 2
    )
      return false;
    for (const tree of this.forestObstacles.query(x, z, r))
      if (Math.hypot(x - tree.x, z - tree.z) < r + tree.radius) return true;
    for (const wall of this.barriers.query(x, z, r))
      if (
        (!Number.isFinite(referenceY) || referenceY < wall.top + 0.2) &&
        segmentPoint(x, z, wall.ax, wall.az, wall.bx, wall.bz).d <
          r + wall.radius
      )
        return true;
    for (const b of this.buildings.query(x, z, r)) {
      // The mapped hotel relation overlaps the source HOTEL proxy near the
      // far bays. Both may yield only inside the same validated camera void.
      if (podiumCameraClear && b.id === CANADA_PLACE_HOTEL_ID) continue;
      if (
        canadaLevel &&
        CANADA_PLACE_DECK_COLLIDER_IDS.has(b.id) &&
        (podiumCameraClear ||
          !solidAt(x, z, r, referenceY, this.canadaGeometry)) &&
        // Source west rail top is 8.802 + .05 + .08 = 8.932 m.
        // Keep the proxy for lower cameras; only a sphere wholly above a
        // conservative 8.98 m rail envelope may ignore actor support margins.
        ((camera && referenceY - r > CANADA_PLACE_DECK_Y + 1.1) ||
          supportedDeck(x, z, r, this.canadaGeometry) ||
          (!inCanadaPlacePier(x, z) && this.canada!.contains(x, z)))
      )
        continue;
      if (b.id === CACTUS_ID && jackRoofAccess(x, z, referenceY)) continue;
      const recess = this.exteriorRecesses.get(b.id);
      if (recess) {
        if (recess.blocked(x, z, r, referenceY, camera)) return true;
        continue;
      }
      if (pointInPoly(x, z, b.pts)) return true;
      for (let i = 0; i < b.pts.length; i += 2) {
        const j = (i + 2) % b.pts.length;
        if (
          segmentPoint(x, z, b.pts[i], b.pts[i + 1], b.pts[j], b.pts[j + 1]).d <
          r
        )
          return true;
      }
    }
    return false;
  }
  onStreet(x: number, z: number, clearance = 0.3) {
    for (const road of this.roads.query(x, z, 24 + clearance)) {
      if (!isStreet(road)) continue;
      for (let i = 0; i < road.pts.length - 2; i += 2)
        if (
          segmentPoint(
            x,
            z,
            road.pts[i],
            road.pts[i + 1],
            road.pts[i + 2],
            road.pts[i + 3],
          ).d <
          roadWidth(road) / 2 + clearance
        )
          return true;
    }
    return false;
  }
  nearestRoad(x: number, z: number, max = 90) {
    let best: {
      x: number;
      z: number;
      t: number;
      d: number;
      heading: number;
      road: Road;
    } | null = null;
    for (const r of this.roads.query(x, z, max)) {
      if (
        ![
          "primary",
          "secondary",
          "tertiary",
          "residential",
          "unclassified",
          "cycleway",
          "pedestrian",
        ].includes(r.kind)
      )
        continue;
      for (let i = 0; i < r.pts.length - 2; i += 2) {
        const s = segmentPoint(
          x,
          z,
          r.pts[i],
          r.pts[i + 1],
          r.pts[i + 2],
          r.pts[i + 3],
        );
        if (s.d < max && (!best || s.d < best.d))
          best = {
            ...s,
            heading: Math.atan2(
              r.pts[i + 2] - r.pts[i],
              r.pts[i + 3] - r.pts[i + 1],
            ),
            road: r,
          };
      }
    }
    return best;
  }
  safe(x: number, z: number, r = 0.5) {
    if (!this.blocked(x, z, r) && !this.water(x, z))
      return [x, z] as [number, number];
    const p = this.nearestRoad(x, z, 180);
    if (p && !this.blocked(p.x, p.z, r)) return [p.x, p.z] as [number, number];
    for (let d = 3; d < 90; d += 4)
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        const nx = x + Math.sin(a) * d,
          nz = z + Math.cos(a) * d;
        if (!this.blocked(nx, nz, r) && !this.water(nx, nz))
          return [nx, nz] as [number, number];
      }
    return [x, z] as [number, number];
  }
  /** Choose a nearby door/rear exit on this level, including elevated roads. */
  vehicleExit(x: number, z: number, heading: number, y: number) {
    for (const [side, along] of [
      [2.3, 0],
      [-2.3, 0],
      [0, -3.2],
      [0, 3.2],
      [2.3, -1.8],
      [-2.3, -1.8],
    ]) {
      const xx = x + Math.cos(heading) * side + Math.sin(heading) * along;
      const zz = z - Math.sin(heading) * side + Math.cos(heading) * along;
      const h = this.height(xx, zz, y);
      if (
        Math.abs(h - y) <= 0.6 &&
        !this.blocked(xx, zz, 0.4, y) &&
        !this.water(xx, zz, y)
      )
        return [xx, zz] as [number, number];
    }
  }
  move(
    x: number,
    z: number,
    dx: number,
    dz: number,
    r: number,
    referenceY = Infinity,
  ) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(dx, dz) / Math.max(0.2, r * 0.6)),
    );
    let hit = false;
    for (let i = 0; i < steps; i++) {
      const nx = x + dx / steps,
        nz = z + dz / steps;
      if (!this.blocked(nx, nz, r, referenceY)) {
        x = nx;
        z = nz;
      } else {
        hit = true;
        if (!this.blocked(nx, z, r, referenceY)) x = nx;
        if (!this.blocked(x, nz, r, referenceY)) z = nz;
      }
    }
    return { x, z, hit };
  }
}
