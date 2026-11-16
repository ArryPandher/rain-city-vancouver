import { WaterWavesComparison } from "./water-waves";
import { WaterOpticsComparison } from "./water-optics";
import { galleryWestTreeExcluded } from "./gallery-west-tree-placement";
import { createNorthShorePhotoHorizon, NORTH_SHORE_PHOTO_HORIZON } from "./north-shore-photo-horizon";
import { createNorthShoreDemGroup } from "./north-shore-dem";
import { createNorthShoreUrbanHorizon } from "./north-shore-urban-horizon";
import {
  createIronworkersLightStandards,
  replacesIronworkersStreetLamp,
} from "./ironworkers-light-standards";
import { readNorthShoreDiagnostics } from "./north-shore-diagnostics";
import { buildRobsonStreetEdge } from "./robson-street-edge-materials";
import { clipRobsonStreetPaths } from "./robson-street-edge-paths";
import {
  createIronworkersPathBoundary,
  IRONWORKERS_PATH,
} from "./ironworkers-path-boundary";
import {
  createIronworkersApproachClipper,
  IRONWORKERS_APPROACH_IDS,
} from "./ironworkers-approach-finish";
import { createHoweStationRoadFinishClipper } from "./howe-station-road-finish";
import {
  clipRobsonRinkOpenings,
  ROBSON_RINK_TERRAIN_CUTOUTS,
} from "./robson-rink-openings";
import { createRobsonRinkExteriorMeshes } from "./robson-rink-materials";
import { HOWE_STATION_SPEC } from "./howe-station-site";
import { buildCordovaStreetDetails } from "./cordova-street-details";
import {
  buildHoweCordovaJunction,
  clipHoweCordovaPaths,
  clipHoweCordovaRoadEdges,
  createHoweCordovaJunctionMaterials,
} from "./howe-cordova-junction";
import {
  createCordovaPavementMaterial,
  hasCordovaPavement,
} from "./cordova-pavement-material";
import {
  createRobsonRoadMaterial,
  hasRobsonAsphalt,
} from "./robson-road-material";
import {
  createIronworkersRoadMaterial,
  hasIronworkersAsphalt,
} from "./ironworkers-road-material";
import { buildHoweStationPavilion } from "./howe-station-pavilion";
import { createHoweStationPavilionMaterials } from "./howe-station-pavilion-materials";
import { batchFallbackTrees } from "./fallback-tree-batch";
import { batchTerrainTiles } from "./terrain-batch";
import { ShadowCasterVolume } from "../rendering/shadow-caster-volume";
import {
  comparisonSunOffset as sunOffset,
  applyDaylightOrientation,
  daylightOrientationProfile,
  DEFAULT_DAYLIGHT_ORIENTATION,
  type DebugDaylightOrientation,
} from "./daylight-orientation";
import { batchStaticChunks } from "./static-chunk-batch";
import { batchPhotographicFacades } from "./photographic-facade-batch";
import { clipGalleryStairPath } from "./gallery-rear-entry";
import { buildCanadaPlaceApproach } from "./canada-place-approach";
import { clipCanadaPlacePaths } from "./canada-place-paths";
import { TreeDetailStream } from "./detail-stream";
import {
  curbObstacles,
  harbourCurbGeometry,
  hasHarbourCurbs,
} from "./street-curbs";
import { buildHarbourFrontage } from "./harbour-frontage";
import { buildHarbourGreen } from "./harbour-green";
import {
  HARBOUR_CUSTOM_ROADS,
  harbourIntersects,
  harbourClearGround,
} from "./harbour-green-site";
import { conventionApproachHeight } from "./convention-site";
import { buildJackPoole } from "./jack-poole";
import {
  JACK_CUSTOM_ROADS,
  jackIntersects,
  jackSurface,
} from "./jack-poole-site";
import coniferShapes from "./conifer-shapes.json";
import { CONIFER_ASSET_REVISION } from "./conifer-foliage";
import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  CityData,
  centroid,
  seeded,
  hash,
  roadWidth,
  isStreet,
  geo,
  bounds,
  pointInPoly,
  Road,
} from "./data";
import { Materials, mesh, box, label, BASE } from "./materials";
import { Batcher, flatPolygon, ribbon, walls, subdividePath } from "./geometry";
import { CollisionWorld, BRIDGES } from "./collision";
import { inCanadaPlacePier } from "./canada-place-deck";
import {
  VehicleRoadSurfaceBuilder,
  type VehicleRoadSurface,
} from "./vehicle-road-surface";
import { architecture } from "./architecture";
import { buildLandmarks } from "./landmarks";
import { loadVancouverLandmarks } from "./vancouver-landmarks";
import { DetailedTrees, TreeInstance } from "./detailed-trees";
import {
  installBroadleafVolumes,
  loadBroadleafVolumeMaterials,
  updateBroadleafDistance,
} from "./broadleaf-volume";
import {
  DetailedArchitecture,
  ArchitecturalDetail,
} from "./detailed-architecture";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import {
  crosswalkMarkings,
  roadMarkings,
  roadJunctionGaps,
  sidewalkSides,
} from "./road-profile";
import { ROBSON_PLANTERS, gridXZ } from "./robson-site";
import { clipRobsonGardenPaths } from "./robson-garden-paths";
import { isIronworkersCarriageway } from "./ironworkers-alignment";
import { buildRobsonMound, fitRobsonMoundPath } from "./robson-mound";
import { robsonMoundIntersects } from "./robson-mound-site";
import {
  clipRobsonMoundCirculation,
  robsonMoundCirculationTerrainHeight,
} from "./robson-mound-circulation";
import { buildRobsonMoundTrees, isRobsonMoundTree } from "./robson-mound-trees";
import { reconcileTrees, treeProfile, type TreeProfile } from "./tree-profile";
import { ForestHabitat } from "./forest-habitat";
import { ForestDetail, forestGround } from "./forest";
import {
  terrainMeshes,
  terrainCutWall,
  type TerrainArea,
} from "./terrain-mesh";
import { cliffMaterials } from "./cliff-material";
import { buildSeawall, seawallPavers } from "./seawall";
import { buildProspectLookout } from "./prospect-lookout";
import { LOOKOUT_ROADS, LOOKOUT_CUTOUTS } from "./prospect-lookout-site";
import { buildProspectBank } from "./prospect-bank";
import { addProspectGeology } from "./prospect-geology";
import { CoastalVegetation } from "./coastal-vegetation";
import { coastalCoverMaterials } from "./coastal-cover";
import { PROSPECT_FORECOURT } from "./prospect-site";
export type Weather = "day" | "golden" | "overcast" | "night";
export class World {
  private readonly casterVolume = new ShadowCasterVolume();
  root = new T.Group();
  readonly constructorTimings = { materialsMs: 0, collisionMs: 0 };
  materials = (() => {
    const started = performance.now();
    const materials = new Materials();
    this.constructorTimings.materialsMs = performance.now() - started;
    return materials;
  })();
  private cordovaPavement?: T.MeshStandardMaterial;
  private robsonRoadMaterial?: T.MeshStandardMaterial;
  private ironworkersRoadMaterial?: T.MeshStandardMaterial;
  debugDaylightOrientation: DebugDaylightOrientation = DEFAULT_DAYLIGHT_ORIENTATION;
  collision: CollisionWorld;
  private vehicleRoadSurface?: VehicleRoadSurface;
  chunks: T.Mesh[] = [];
  sun = new T.DirectionalLight(0xffe0b3, 3.2);
  ambient = new T.HemisphereLight(0xc6dfed, 0x697265, 2.0);
  water!: T.ShaderMaterial;
  private waterOpticsComparison?: WaterOpticsComparison;
  private waterOpticsError: string | null = null;
  private waterWavesComparison?: WaterWavesComparison;
  weather: Weather = "day";
  rain!: T.Points;
  time = 0;
  skyTextures: Record<string, T.Texture> = {};
  reflectionTextures: Record<string, T.Texture> = {};
  nightLights: T.MeshStandardMaterial[] = [];
  northShore?: T.MeshBasicMaterial;
  northShoreTerrain?: T.Group;
  northShoreUrban?: ReturnType<typeof createNorthShoreUrbanHorizon>;
  detailedTrees?: DetailedTrees;
  broadleafVolume?: ReturnType<typeof installBroadleafVolumes>;
  forestHabitat!: ForestHabitat;
  forestDetail?: ForestDetail;
  coastalVegetation?: CoastalVegetation;
  coniferSamples: TreeInstance[] = [];
  detailedArchitecture?: DetailedArchitecture;
  architecturalDetails: ArchitecturalDetail[] = [];
  reflections: ReflectionProbeSpec[] = [];
  treeSamples: TreeInstance[] = [];
  streetFurniture: { kind: "lamp" | "sign"; x: number; z: number }[] = [];
  stats = { buildings: 0, trees: 0, roads: 0 };
  constructor(
    public scene: T.Scene,
    public data: CityData,
    private readonly facadeMultiDraw = false,
    private readonly fallbackTreeExperiment = false,
    private readonly vehicleSurfaceSupport = false,
  ) {
    const collisionStarted = performance.now();
    this.collision = new CollisionWorld(data);
    this.constructorTimings.collisionMs = performance.now() - collisionStarted;
    scene.add(this.root);
    scene.add(this.sun, this.sun.target, this.ambient);
    sunOffset(this.weather, this.sun.position);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 650;
    // This map spans 649 m in light depth: the former -.0005 bias displaced
    // contact by ~0.32 m before the normal offset, visibly detaching feet.
    this.sun.shadow.bias = -0.00004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3.5;
    scene.fog = new T.FogExp2(0xc2cbd0, 0.00032);
  }
  treeDetailStream?: TreeDetailStream;
  get vehicleSurfaceStats() {
    return this.vehicleRoadSurface?.stats;
  }
  /** Opt-in car contact with the rendered finish; pedestrian/datum APIs stay intact. */
  vehicleGroundHeight(x: number, z: number, referenceY = Infinity): number {
    const collision = this.collision;
    if (!this.vehicleSurfaceSupport || !this.vehicleRoadSurface)
      return collision.height(x, z, referenceY);
    if (collision.bridgeAt(x, z, referenceY))
      return collision.height(x, z, referenceY);
    const custom =
      collision.robsonStreetEdge?.height(x, z) ??
      collision.pacificApron?.height(x, z) ??
      collision.howeCordovaJunction?.height(x, z);
    if (custom !== undefined) return custom;
    // Source pier/deck support depends on loaded landmark capabilities. Never
    // add a generic road finish to that separately authored surface.
    if (collision.canada && inCanadaPlacePier(x, z))
      return collision.walkingHeight(x, z, referenceY);
    return (
      this.vehicleRoadSurface.height(x, z, referenceY) ??
      (collision.canada?.contains(x, z)
        ? collision.walkingHeight(x, z, referenceY)
        : collision.height(x, z, referenceY))
    );
  }
  onDetailReady = () => {};
  async build(
    report: (text: string, n: number) => void | Promise<void>,
    mark: (text: string, n: number) => void = () => {},
  ) {
    await report("Preparing Vancouver collision and ground", 0.12);
    // The constructor already indexed this map and built its walking surfaces.
    addProspectGeology(this.data, this.collision);
    this.forestHabitat = new ForestHabitat(this.data, this.collision);
    await report("Building terrain and ground batches", 0.15);
    this.terrain();
    const ironworkers = BRIDGES.find((b) => b.id === "ironworkers")!;
    const pathBoundary = createIronworkersPathBoundary(
      (t) => this.collision.bridgeHeight(ironworkers, t),
      (x, z) => this.collision.groundHeight(x, z) + 0.07,
    );
    const pathMeshes = pathBoundary.createRenderGroup(
      new T.MeshStandardMaterial({ color: 0x92958e, roughness: 0.82 }),
      new T.MeshStandardMaterial({
        color: 0xa7afac,
        roughness: 0.5,
        metalness: 0.75,
      }),
      {
        // Preserve close physical bars, integrate distant projected coverage.
        // The old all-physical path remains available for explicit comparisons.
        filterTrial: !(
          typeof location !== "undefined" &&
          new URLSearchParams(location.search).has("debug") &&
          new URLSearchParams(location.search).get("fence") === "physical"
        ),
      },
    );
    pathMeshes.group.name = "Ironworkers shared paths and finite safety fence";
    this.root.add(pathMeshes.group);
    this.collision.ironworkersPaths = pathBoundary;
    const bridgeLights = createIronworkersLightStandards(
      (t) => this.collision.bridgeHeight(ironworkers, t),
    );
    this.root.add(bridgeLights);
    for (const mesh of bridgeLights.children)
      if (mesh instanceof T.Mesh) this.chunks.push(mesh);
    if (this.collision.robsonRink) {
      const rink = createRobsonRinkExteriorMeshes(this.materials);
      this.root.add(...rink);
      this.chunks.push(...rink);
    }
    if (this.collision.robsonGarden)
      this.chunks.push(
        ...buildRobsonMound(this.root, this.materials, this.data.roads),
      );
    await report("Building streets and pavement batches", 0.19);
    this.roads();
    await report("Building waterfront paths and approaches", 0.23);
    if (this.collision.canada)
      this.chunks.push(
        ...buildCanadaPlaceApproach(
          this.root,
          this.data,
          this.materials,
          this.collision.canada,
          (x, z) => this.collision.existingGroundHeight(x, z),
        ),
      );
    if (this.collision.canada) {
      const stationBatch = new Batcher(this.root, 160),
        stationMaterials = createHoweStationPavilionMaterials(this.materials);
      const station = buildHoweStationPavilion(
        stationBatch,
        {
          ...HOWE_STATION_SPEC,
          groundHeight: (x, z) =>
            this.collision.baselineGroundHeight(x, z) + 0.15,
        },
        stationMaterials,
      );
      this.chunks.push(...stationBatch.finish());
      // The enclosure reflects its actual street surroundings. A single static
      // 128px capture is shared by metal and glass; receivers are omitted from
      // their own capture by SceneReflections, with the sky as failure fallback.
      this.reflections.push({
        name: "Howe station street enclosure",
        position: station.p(0, 1.8, station.length / 2),
        materials: [stationMaterials.glass, stationMaterials.metal],
        intensity: { day: 1, night: 1 },
      });
    }
    this.chunks.push(
      ...buildHarbourGreen(
        this.root,
        this.data,
        this.materials,
        this.collision,
        this.reflections,
      ),
      ...buildHarbourFrontage(
        this.root,
        this.data,
        this.materials,
        this.collision,
      ),
      ...buildJackPoole(
        this.root,
        this.data,
        this.materials,
        this.collision,
        this.reflections,
      ),
      ...buildSeawall(this.root, this.data, this.materials, this.collision),
      ...buildProspectLookout(
        this.root,
        this.data,
        this.materials,
        this.collision,
      ),
      ...buildProspectBank(
        this.root,
        this.data,
        this.materials,
        this.collision,
      ),
    );
    await new Promise((r) => setTimeout(r, 20));
    await report("Loading Vancouver landmark models", 0.3);
    const accurateLandmarks = new T.Group();
    this.root.add(accurateLandmarks);
    const loadedLandmarks = await loadVancouverLandmarks(
      accurateLandmarks,
      this.materials,
      this.reflections,
    );
    this.collision.setCanadaPlaceCapabilities(loadedLandmarks.canadaPlace);
    await report("Merging Vancouver landmark geometry", 0.35);
    this.mergeStatic(accurateLandmarks);
    await report("Generating and merging downtown geometry", 0.38);
    this.buildings(() => mark("Packing downtown draw batches", 0.42));
    await report("Loading detailed architecture", 0.46);
    try {
      this.detailedArchitecture = await DetailedArchitecture.load(this.scene);
      this.detailedArchitecture.samples = this.architecturalDetails;
    } catch (error) {
      console.warn(
        "Detailed architecture unavailable; retaining base façades",
        error,
      );
    }
    await new Promise((r) => setTimeout(r, 20));
    await report("Placing Vancouver trees", 0.49);
    this.vegetation();
    await report("Loading and installing tree canopies", 0.54);
    try {
      this.broadleafVolume = installBroadleafVolumes(
        this.treeSamples,
        await loadBroadleafVolumeMaterials(),
      );
      if (this.fallbackTreeExperiment)
        batchFallbackTrees(this.root, this.treeSamples, this.facadeMultiDraw);
    } catch (error) {
      console.warn(
        "Layered broadleaf canopy unavailable; retaining mapped crowns",
        error,
      );
    }
    await new Promise((r) => setTimeout(r, 20));
    await report("Loading coastal planting", 0.61);
    try {
      this.coastalVegetation = await CoastalVegetation.load(
        this.root,
        this.data,
        this.collision,
      );
    } catch (error) {
      console.warn("Coastal planting unavailable", error);
    }
    await report("Building and merging waterfront landmarks", 0.68);
    const landmarkRoot = new T.Group();
    this.root.add(landmarkRoot);
    buildLandmarks(
      landmarkRoot,
      this.materials,
      this.collision,
      this.ironworkersRoadMaterial,
    );
    this.mergeStatic(landmarkRoot);
    await report("Building street furniture and detail batches", 0.76);
    this.streetDetails();
    await new Promise((r) => setTimeout(r, 20));
    await report("Preparing mountains and sky", 0.84);
    this.mountains();
    this.createRain();
    try {
      const loader = new HDRLoader().setDataType(T.HalfFloatType);
      const [sunset, overcast, env, daylight, nightEnv] = await Promise.all(
        [
          "sunset",
          "overcast",
          "city-reflections",
          "afternoon-sky",
          "night-reflections",
        ].map((name) => loader.loadAsync(`${BASE}textures/${name}.hdr`)),
      );
      await report("Preparing daylight environment pixels", 0.92);
      for (const t of [sunset, overcast, env, daylight, nightEnv])
        t.mapping = T.EquirectangularReflectionMapping;
      // Keep very bright HDR emitters localized in reflections and bloom.
      // Unbounded sun pixels can otherwise wash out half the view near the sun.
      for (const [texture, limit] of [
        [env, 8],
        [nightEnv, 4],
        [daylight, 16],
        [sunset, 16],
        [overcast, 16],
      ] as const) {
        const pixels = texture.image.data as Uint16Array;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = T.DataUtils.fromHalfFloat(pixels[i]),
            g = T.DataUtils.fromHalfFloat(pixels[i + 1]),
            b = T.DataUtils.fromHalfFloat(pixels[i + 2]),
            luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
          if (luminance > limit) {
            const scale = limit / luminance;
            pixels[i] = T.DataUtils.toHalfFloat(r * scale);
            pixels[i + 1] = T.DataUtils.toHalfFloat(g * scale);
            pixels[i + 2] = T.DataUtils.toHalfFloat(b * scale);
          }
        }
        texture.needsUpdate = true;
      }
      this.reflectionTextures = {
        day: daylight,
        golden: env,
        overcast: env,
        night: nightEnv,
      };
      this.skyTextures = {
        day: daylight,
        golden: sunset,
        overcast,
        night: sunset,
      };
      this.scene.environment = env;
      this.scene.background = sunset;
      this.scene.backgroundRotation.y = 2.3;
      this.scene.environmentRotation.y = 1.2;
      this.scene.backgroundIntensity = 0.8;
      this.scene.environmentIntensity = 0.75;
    } catch {
      this.scene.background = new T.Color(0xb6ccd7);
    }

    await report("Finalizing static world transforms", 0.98);
    this.root.updateMatrixWorld(true);
    this.root.traverse((object) => {
      object.matrixAutoUpdate = false;
      object.matrixWorldAutoUpdate = false;
    });
    this.setWeather("day");
    this.treeDetailStream = new TreeDetailStream(
      {
        street: async () => {
          const detail = await DetailedTrees.load(this.scene);
          detail.samples = this.treeSamples;
          this.detailedTrees = detail;
          this.onDetailReady();
        },
        forest: async () => {
          const detail = await ForestDetail.load(
            this.scene,
            this.forestHabitat,
          );
          detail.samples = this.coniferSamples;
          this.forestDetail = detail;
          this.onDetailReady();
        },
      },
      (kind, error) =>
        console.warn(
          `${kind} detail unavailable; retaining existing trees`,
          error,
        ),
    );
    await report("World geometry ready", 1);
  }
  addEasternRoad() {
    // Authored connector outside the extracted downtown map. The core map remains OSM geometry.
    const coords = [
      [49.28113, -123.097],
      [49.2812, -123.08],
      [49.2818, -123.061],
      [49.2823, -123.046],
      [49.2838, -123.032],
      [49.289, -123.023],
      [49.2941, -123.0236],
    ];
    const r: Road = {
      name: "East Vancouver connector",
      kind: "primary",
      pts: coords.flatMap(([lat, lon]) => geo(lat, lon)),
    };
    this.data.roads.push(r);
    const north: Road = {
      name: "North Shore approach",
      kind: "primary",
      pts: [
        ...geo(49.3153, -123.0286),
        ...geo(49.319, -123.034),
        ...geo(49.324, -123.052),
        ...geo(49.326, -123.075),
        ...geo(49.3276, -123.13645),
      ],
    };
    this.data.roads.push(north);
  }
  terrain() {
    const m = this.materials;
    const rinkCut = (g: T.BufferGeometry) =>
      this.collision.robsonRink ? clipRobsonRinkOpenings(g) : g;
    const rinkCutouts = this.collision.robsonRink
      ? ROBSON_RINK_TERRAIN_CUTOUTS
      : [];
    const floorGeometry = new T.PlaneGeometry(24000, 24000);
    floorGeometry.rotateX(-Math.PI / 2);
    floorGeometry.translate(2000, -0.09, 0);
    const floor = mesh(rinkCut(floorGeometry), m.grass, this.root);
    floor.geometry
      .getAttribute("uv")
      .array.forEach((_, i, a) => (a[i] *= 2800));
    floor.castShadow = false;
    const elevationGrid = this.data.terrain;
    const b = new Batcher(this.root, 600),
      woodlandMaterial = forestGround(m);
    const terrainAreas: TerrainArea[] = [];
    for (const a of this.data.areas) {
      if (a.kind === "water") continue;
      let mat = this.forestHabitat.woodland.includes(a)
        ? woodlandMaterial
        : m.grass;
      if (["parking", "plaza", "campus", "construction"].includes(a.kind))
        mat = m.concrete;
      if (a.kind === "beach")
        mat = new T.MeshStandardMaterial({ color: 0xb2a894, roughness: 1 });
      const [x, z] = centroid(a.pts);
      if (elevationGrid?.intersects(a.pts)) {
        terrainAreas.push({
          area: a,
          material: mat,
          priority:
            mat === m.concrete || a.kind === "beach"
              ? 30
              : a.kind === "grass"
                ? 20
                : mat === woodlandMaterial
                  ? 10
                  : 0,
        });
        if (
          a.pts.every(
            (v, i) => i % 2 === 1 || elevationGrid.contains(v, a.pts[i + 1]),
          )
        )
          continue;
      }
      try {
        const elevation =
          mat === m.concrete
            ? 0.02
            : a.kind === "beach"
              ? -0.005
              : mat === woodlandMaterial
                ? -0.012
                : a.kind === "grass"
                  ? -0.008
                  : -0.02;
        b.add(
          rinkCut(
            flatPolygon(
              a.pts,
              a.holes,
              elevation,
              mat === woodlandMaterial ? 2.11 : 5,
            ),
          ),
          mat,
          x,
          z,
        );
      } catch {}
    }
    if (elevationGrid) {
      const cliff = cliffMaterials(m),
        cover = coastalCoverMaterials(m, this.data, this.collision);
      const ground = terrainMeshes(
        elevationGrid,
        terrainAreas.map((item) => ({
          ...item,
          material:
            item.material === m.concrete
              ? item.material
              : cover(cliff(item.material)),
        })),
        cover(cliff(m.grass)),
        this.data.ocean,
        [PROSPECT_FORECOURT, ...LOOKOUT_CUTOUTS, ...rinkCutouts],
      );
      ground.push(
        terrainCutWall(elevationGrid, PROSPECT_FORECOURT, 2.06, cliff(m.stone)),
      );
      this.root.add(...ground);
      try {
        batchTerrainTiles(this.root, ground, this.facadeMultiDraw);
      } catch (error) {
        console.warn(
          "Terrain batching unavailable; keeping original tiles",
          error,
        );
      }
      this.chunks.push(...ground);
    }
    if (this.collision.howeTerrain) {
      const ground = terrainMeshes(
        this.collision.howeTerrain,
        [],
        m.concrete,
        this.data.ocean,
        [...this.collision.howeTerrainCutouts, ...rinkCutouts],
      );
      this.root.add(...ground);
      this.chunks.push(...ground);
    }
    const cityBase = mesh(
      rinkCut(
        flatPolygon(
          [
            bounds.minX,
            bounds.minZ,
            bounds.maxX,
            bounds.minZ,
            bounds.maxX,
            bounds.maxZ,
            bounds.minX,
            bounds.maxZ,
          ],
          [],
          -0.035,
          5,
        ),
      ),
      m.concrete,
      this.root,
    );
    cityBase.castShadow = false;
    const chunks = b.finish(false);
    batchStaticChunks(this.root, chunks, this.facadeMultiDraw, {
      releaseOwnedPreRenderGeometry: true,
    });
    this.chunks.push(...chunks);
    this.water = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new T.Color(0x204b58) },
        sky: { value: new T.Color(0xbccdd1) },
        sunDir: { value: sunOffset(this.weather).normalize() },
        sunColor: { value: new T.Color(0xffd5a3) },
        night: { value: 0 },
      },
      vertexShader: `varying vec3 vWorld; varying vec3 vView; void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorld=wp.xyz;vView=cameraPosition-wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
      fragmentShader: `uniform float time;uniform vec3 deep,sky,sunDir,sunColor;uniform float night;varying vec3 vWorld;varying vec3 vView;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float wave(vec2 p){return sin(p.x*.72+time*.9)*.12+sin(p.y*.92-time*.7)*.09+noise(p*2.+time*.12)*.14+noise(p*.18-time*.08)*.4;}void main(){vec2 p=vWorld.xz;float eps=.15;float dx=wave(p+vec2(eps,0))-wave(p-vec2(eps,0));float dz=wave(p+vec2(0,eps))-wave(p-vec2(0,eps));vec3 n=normalize(vec3(-dx,.65,-dz));vec3 v=normalize(vView);float fres=pow(1.-max(dot(n,v),0.),3.);vec3 color=mix(deep,sky,fres*.85);float spec=pow(max(dot(reflect(-sunDir,n),v),0.),220.);color+=sunColor*spec*2.3*(1.-night*.8);color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);float fog=1.-exp(-length(vView)*.00035);color=mix(color,sky,fog);gl_FragColor=vec4(color,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    });
    for (const o of this.data.ocean)
      mesh(flatPolygon(o, [], 0.065, 1), this.water, this.root).castShadow =
        false;
    for (const a of this.data.areas.filter((a) => a.kind === "water"))
      mesh(
        flatPolygon(
          a.pts,
          [],
          (this.data.terrain?.meta.lakes.find((l) => l.name === a.name)
            ?.height ?? 0) + 0.065,
          1,
        ),
        this.water,
        this.root,
      ).castShadow = false;
    // Ocean outside the core extract, with land on either side of the inlet.
    const oceanRect = (
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number,
    ) =>
      (mesh(
        flatPolygon(
          [minX, minZ, maxX, minZ, maxX, maxZ, minX, maxZ],
          [],
          0.065,
        ),
        this.water,
        this.root,
      ).castShadow = false);
    oceanRect(-12000, bounds.minX, -18000, 10000);
    oceanRect(bounds.minX, 15000, -18000, -8500);
  }
  roads() {
    const clipIronworkers =
      this.collision.ironworkersPaths &&
      createIronworkersApproachClipper(this.collision.ironworkersPaths);
    const clipStationFinish = this.collision.canada
      ? createHoweStationRoadFinishClipper(this.data, this.collision.canada)
      : undefined;
    const vehicleSurface = this.vehicleSurfaceSupport
      ? new VehicleRoadSurfaceBuilder()
      : undefined;
    this.collision.robsonStreetEdge?.beginRoadContact();
    const b = new Batcher(this.root, 450),
      m = this.materials;
    this.cordovaPavement = createCordovaPavementMaterial(m);
    this.robsonRoadMaterial = createRobsonRoadMaterial(m);
    this.ironworkersRoadMaterial = createIronworkersRoadMaterial(m);
    const cobble = m.pbr("cobblestone_floor_05", 0xb1aaa2, 0.88);
    const stripes = new T.MeshStandardMaterial({
      color: 0xdfd8c0,
      roughness: 0.6,
    });
    const junctions = roadJunctionGaps(this.data.roads);
    const curbCuts = curbObstacles(this.data.roads);
    for (const r of this.data.roads) {
      if (
        r.id &&
        (JACK_CUSTOM_ROADS.has(r.id) ||
          (this.collision.harbour && HARBOUR_CUSTOM_ROADS.has(r.id)))
      ) {
        this.stats.roads++;
        continue;
      }
      if (this.data.terrain && r.id && LOOKOUT_ROADS.has(r.id)) {
        this.stats.roads++;
        continue;
      }
      // The mapped Prospect shore steps have a solid descending profile.
      if (r.id === "w731791394" && this.data.seawall) {
        this.stats.roads++;
        continue;
      }
      if (
        clipIronworkers &&
        IRONWORKERS_PATH.replacedCycleways.some((id) => id === r.id)
      )
        continue;
      const [x, z] = centroid(r.pts),
        width = roadWidth(r),
        street = isStreet(r),
        historic =
          /^(Water Street|Alexander Street)$/.test(r.name ?? "") &&
          x > 450 &&
          x < 1800;
      const moundRoad =
        !!this.collision.robsonGarden && robsonMoundIntersects(r.pts);
      const onTerrain =
        isIronworkersCarriageway(r.id) ||
        moundRoad ||
        (this.collision.canada?.intersects(r.pts) ?? false) ||
        (this.collision.howeTerrain?.intersects(r.pts) ?? false) ||
        (this.data.terrain?.intersects(r.pts) ?? false) ||
        jackIntersects(r.pts) ||
        (this.collision.harbour && harbourIntersects(r.pts)) ||
        r.pts.some(
          (x, i) =>
            i % 2 === 0 &&
            conventionApproachHeight(
              this.collision.convention,
              x,
              r.pts[i + 1],
            ) !== undefined,
        );
      const seawall = /^Stanley Park Seawall/.test(r.name ?? "");
      const bridgeRoute = /Lions Gate Bridge/.test(r.name ?? "");
      const height = (x: number, z: number) => {
        if (clipIronworkers && IRONWORKERS_APPROACH_IDS.has(r.id ?? "")) {
          const b = this.collision.bridgeAt(x, z);
          return b
            ? this.collision.bridgeHeight(b.bridge, b.t)
            : this.collision.groundHeight(x, z);
        }
        return (
          (moundRoad ? robsonMoundCirculationTerrainHeight(x, z) : undefined) ??
          this.collision.roadHeight(r, x, z)
        );
      };
      const roadRibbon = (
        points: number[],
        width: number,
        y = 0,
        _height = height,
        scale = 5,
      ) => {
        let geometry = ribbon(
          onTerrain ? subdividePath(points) : points,
          width,
          y,
          height,
          scale,
          onTerrain && !bridgeRoute,
        );
        if (clipIronworkers) geometry = clipIronworkers(geometry, r);
        if (moundRoad) {
          geometry = clipRobsonMoundCirculation(geometry, height, y);
          geometry = fitRobsonMoundPath(geometry, height, y);
        }
        if (
          this.collision.canada &&
          ["footway", "path", "pedestrian", "steps"].includes(r.kind)
        )
          geometry = clipCanadaPlacePaths(geometry, height, y);
        geometry = clipRobsonGardenPaths(
          geometry,
          this.collision.robsonGarden,
          height,
          y,
          r,
        );
        return this.collision.gallery &&
          ["footway", "path", "pedestrian", "steps"].includes(r.kind)
          ? clipGalleryStairPath(geometry, height, y)
          : geometry;
      };
      const canadaCurbs = !!(r.id && this.collision.canada?.roadIds.has(r.id));
      if (!canadaCurbs && hasHarbourCurbs(r)) {
        const edges = harbourCurbGeometry(r, curbCuts, height);
        b.add(edges.gutter, m.concrete, x, z, "harbour-gutter");
        b.add(edges.curb, m.stone, x, z, "harbour-curb-face");
        b.add(edges.apron, m.concrete, x, z, "harbour-curb-apron");
      }
      if (street && !canadaCurbs && !hasHarbourCurbs(r))
        for (let i = 0; i < r.pts.length - 2; i += 2) {
          const ax = r.pts[i],
            az = r.pts[i + 1],
            bx = r.pts[i + 2],
            bz = r.pts[i + 3],
            len = Math.hypot(bx - ax, bz - az);
          if (len < 20) continue;
          const dx = (bx - ax) / len,
            dz = (bz - az) / len;
          for (const side of sidewalkSides(r)) {
            const offset = side * (width / 2 + 1.25),
              points = [
                ax + dx * 7 + dz * offset,
                az + dz * 7 - dx * offset,
                bx - dx * 7 + dz * offset,
                bz - dz * 7 - dx * offset,
              ];
            b.add(
              roadRibbon(points, 2.5, 0.15, height, 4),
              m.concrete,
              x,
              z,
              "sidewalk",
            );
            const curbOffset = side * (width / 2 + 0.08),
              curb = [
                ax + dx * 7 + dz * curbOffset,
                az + dz * 7 - dx * curbOffset,
                bx - dx * 7 + dz * curbOffset,
                bz - dz * 7 - dx * curbOffset,
              ];
            b.add(
              roadRibbon(curb, 0.17, 0.17, height, 4),
              m.stone,
              x,
              z,
              "curb-edge",
            );
          }
        }
      let surface = roadRibbon(
        r.pts,
        width,
        street ? 0.092 : r.walkway ? 0.15 : 0.07,
        height,
        historic ? 1.6 : 5,
      );
      if (this.collision.robsonStreetEdge)
        surface = clipRobsonStreetPaths(
          surface,
          this.collision.robsonStreetEdge,
          r,
        );
      if (this.collision.howeCordovaJunction) {
        if (street || r.kind === "service")
          surface = clipHoweCordovaRoadEdges(
            surface,
            this.collision.howeCordovaJunction,
          );
        else if (["footway", "path", "pedestrian", "steps"].includes(r.kind))
          surface = clipHoweCordovaPaths(
            surface,
            this.collision.howeCordovaJunction,
          );
      }
      if (clipStationFinish) surface = clipStationFinish(surface, r);
      // Copy only final clipped road triangles, before batching disposes them.
      // Sidewalks, curb faces and paint decals are not road contact layers.
      vehicleSurface?.add(surface);
      this.collision.robsonStreetEdge?.captureRoadContact(surface, r);
      b.add(
        surface,
        seawall && r.surface === "paving_stones"
          ? seawallPavers(m)
          : historic
            ? cobble
            : street || (seawall && r.surface === "asphalt")
              ? hasCordovaPavement(r)
                ? this.cordovaPavement
                : hasRobsonAsphalt(r)
                  ? this.robsonRoadMaterial
                  : hasIronworkersAsphalt(r)
                    ? this.ironworkersRoadMaterial
                    : m.asphalt
              : m.concrete,
        x,
        z,
        "road",
      );
      if (street && !historic && r.kind !== "residential")
        for (const line of roadMarkings(r, junctions.get(r)))
          b.add(
            roadRibbon(line.pts, 0.1, 0.102, height),
            line.yellow ? m.yellow : stripes,
            line.pts[0],
            line.pts[1],
            "stripe",
          );
      for (const line of crosswalkMarkings(r))
        b.add(
          roadRibbon(line.pts, line.width, 0.111, height),
          stripes,
          line.pts[0],
          line.pts[1],
          "crossing",
        );
      this.stats.roads++;
    }
    this.vehicleRoadSurface = vehicleSurface?.finish();
    this.collision.robsonStreetEdge?.finishRoadContact();
    for (const group of b.groups.values())
      for (const geometry of group.geo) {
        const p = geometry.getAttribute("position"),
          uv = geometry.getAttribute("uv");
        const scale = group.mat === cobble ? 1.6 : 5;
        for (let i = 0; i < p.count; i++)
          uv.setXY(i, p.getX(i) / scale, p.getZ(i) / scale);
      }
    const junctionMaterials = this.collision.howeCordovaJunction
      ? createHoweCordovaJunctionMaterials(m)
      : undefined;
    // After legacy road UV normalization: this geometry carries metre UVs.
    if (this.collision.howeCordovaJunction && junctionMaterials)
      buildHoweCordovaJunction(
        b,
        this.collision.howeCordovaJunction,
        junctionMaterials,
      );
    const robsonStreetMaterials = this.collision.robsonStreetEdge
      ? buildRobsonStreetEdge(b, this.collision.robsonStreetEdge, m)
      : undefined;
    const chunks = b.finish(false);
    if (junctionMaterials)
      for (const chunk of chunks)
        if (chunk.material === junctionMaterials.curb)
          chunk.castShadow = chunk.userData.allowShadow = true;
    if (robsonStreetMaterials)
      for (const chunk of chunks)
        if (chunk.material === robsonStreetMaterials.curb)
          chunk.castShadow = chunk.userData.allowShadow = true;
    batchStaticChunks(this.root, chunks, this.facadeMultiDraw, {
      releaseOwnedPreRenderGeometry: true,
    });
    this.chunks.push(...chunks);
  }
  buildings(beforePacking: () => void = () => {}) {
    const result = architecture(
      this.root,
      this.data,
      this.materials,
      this.collision,
    );
    // Synchronous marker only: direct generator callers retain their old contract.
    beforePacking();
    batchPhotographicFacades(
      this.root,
      result.chunks,
      this.materials.photoFacades,
      this.facadeMultiDraw,
    );
    batchStaticChunks(this.root, result.chunks, this.facadeMultiDraw, {
      releaseOwnedPreRenderGeometry: true,
    });
    this.chunks.push(...result.chunks);
    this.stats.buildings = result.count;
    this.architecturalDetails = result.architecturalDetails;
    this.reflections.push(...result.reflections);
  }

  vegetation() {
    const rand = seeded(7503),
      m = this.materials,
      mappedTrees = reconcileTrees(
        this.data.trees,
        this.data.publicTrees,
      ).filter(
        (t) =>
          !(this.collision.gallery && galleryWestTreeExcluded(t)) &&
          !jackSurface(t.x, t.z) &&
          !(this.collision.harbour && harbourClearGround(t.x, t.z)) &&
          !this.collision.water(t.x, t.z) &&
          !this.collision.blocked(t.x, t.z, 0.35),
      );
    if (this.collision.robsonGarden) {
      const moundTrees = buildRobsonMoundTrees(
        this.root,
        m,
        mappedTrees,
        (x, z) => this.collision.groundHeight(x, z),
      );
      for (const mesh of moundTrees.children)
        if (mesh instanceof T.Mesh) this.chunks.push(mesh);
    }
    const trees = this.collision.robsonGarden
      ? mappedTrees.filter((t) => !isRobsonMoundTree(t.x, t.z))
      : mappedTrees;
    // Densify the forest interior while keeping mapped roads and trails open.
    if (this.collision.robsonGarden)
      for (const bed of ROBSON_PLANTERS) {
        const [cx, cz] = gridXZ(bed.u, bed.v),
          base = this.collision.height(cx, cz) + 0.84;
        for (const offset of [-3.7, 0, 3.7]) {
          const [x, z] = gridXZ(bed.u + offset, bed.v);
          trees.push({
            ...treeProfile(x, z, 5.5 + rand() * 2.5),
            ground: base,
          });
        }
      }
    const forestTrees = this.forestHabitat.trees(trees);
    trees.push(...forestTrees);
    const chunkTrees = new Map<string, TreeProfile[]>();
    for (const t of trees) {
      const k = Math.floor(t.x / 192) + "," + Math.floor(t.z / 192);
      let a = chunkTrees.get(k);
      if (!a) chunkTrees.set(k, (a = []));
      a.push(t);
    }
    const foliageMap = m.texture("broadleaf-branch.png", true),
      pineMap = m.texture(
        `forest/conifer-atlas-pair.webp?v=${CONIFER_ASSET_REVISION}`,
        true,
      );
    foliageMap.wrapS =
      foliageMap.wrapT =
      pineMap.wrapS =
      pineMap.wrapT =
        T.ClampToEdgeWrapping;
    const leafMat = new T.MeshStandardMaterial({
      map: foliageMap,
      color: 0xc2cbbb,
      alphaTest: 0.4,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 0.93,
      emissive: 0x162419,
      emissiveIntensity: 0.16,
    });
    const pineMat = new T.MeshStandardMaterial({
      map: pineMap,
      color: 0xffffff,
      alphaTest: 0.18,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 1,
      emissive: 0x10251a,
      emissiveIntensity: 0.15,
    });
    const leafParts: T.BufferGeometry[] = [];
    for (let i = 0; i < 165; i++) {
      const u = rand() * Math.PI * 2,
        v = Math.acos(rand() * 2 - 1),
        r = 0.35 + rand() * 0.65;
      const g = new T.PlaneGeometry(0.51 + rand() * 0.22, 0.57 + rand() * 0.24);
      g.rotateX((rand() - 0.5) * Math.PI);
      g.rotateY(rand() * Math.PI * 2);
      g.rotateZ(rand() * Math.PI);
      g.translate(
        Math.sin(v) * Math.cos(u) * r,
        Math.cos(v) * r,
        Math.sin(v) * Math.sin(u) * r,
      );
      leafParts.push(g);
    }
    const crownGeo = mergeGeometries(leafParts)!;
    crownGeo.computeBoundingBox();
    const crownBounds = crownGeo.boundingBox!.clone();
    crownGeo.translate(
      -(crownBounds.min.x + crownBounds.max.x) / 2,
      -crownBounds.min.y,
      -(crownBounds.min.z + crownBounds.max.z) / 2,
    );
    crownGeo.scale(
      1 / (crownBounds.max.x - crownBounds.min.x),
      1 / (crownBounds.max.y - crownBounds.min.y),
      1 / (crownBounds.max.z - crownBounds.min.z),
    );
    const pineGeometries = [0, 1].map((variant) => {
      const parts: T.BufferGeometry[] = [];
      for (let side = 0; side < 2; side++) {
        const g = new T.PlaneGeometry(1, 1),
          uv = g.getAttribute("uv");
        for (let i = 0; i < uv.count; i++)
          uv.setX(i, (uv.getX(i) + side + variant * 2) / 4);
        g.translate(0, 0.5, 0);
        g.rotateY((side * Math.PI) / 2);
        parts.push(g);
      }
      return mergeGeometries(parts)!;
    });
    const bark = new T.MeshStandardMaterial({
      map: m.texture("fir_tree_01-bark_diff.png", true),
      color: 0xaaa494,
      roughness: 1,
    });
    const dummy = new T.Object3D(),
      color = new T.Color();
    for (const [key, list] of chunkTrees) {
      const trunk = new T.InstancedMesh(
          new T.CylinderGeometry(0.35, 0.55, 1, 10),
          bark,
          list.length,
        ),
        leaves = new T.InstancedMesh(crownGeo, leafMat, list.length),
        pines = pineGeometries.map(
          (g) => new T.InstancedMesh(g, pineMat, list.length),
        );
      let li = 0,
        pi = [0, 0];
      for (let i = 0; i < list.length; i++) {
        const profile = list[i],
          { x, z, height: h, width, diameter, crownBase, rotation } = profile;
        const t = rotation / (Math.PI * 2);
        const ground = profile.ground ?? this.collision.groundHeight(x, z);
        const trunkHeight = h * (crownBase + 0.2);
        dummy.position.set(x, ground + trunkHeight / 2, z);
        dummy.rotation.set(0, rotation, 0);
        dummy.scale.set(diameter, trunkHeight, diameter);
        dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix);
        const trunkMatrix = dummy.matrix.clone();
        const pine = profile.form === "conifer";
        if (pine) {
          // The two crossed silhouettes include the trunk; the original cylinder is hidden.
          trunkMatrix.makeScale(0, 0, 0);
          trunk.setMatrixAt(i, trunkMatrix);
          const variant = hash(`conifer:${x}:${z}`) % 3 === 0 ? 0 : 1;
          const pineMesh = pines[variant];
          const rootDepth = Math.min(0.6, diameter * 0.5);
          dummy.position.set(x, ground - rootDepth, z);
          const silhouetteWidth = width * coniferShapes[variant].atlasWidth;
          dummy.scale.set(silhouetteWidth, h + rootDepth, silhouetteWidth);
          dummy.updateMatrix();
          pineMesh.setMatrixAt(pi[variant], dummy.matrix);
          this.coniferSamples.push({
            x,
            y: ground,
            z,
            height: h,
            rootDepth,
            coniferVariant: variant,
            width,
            diameter,
            sourceId: profile.sourceId,
            form: profile.form,
            rotation,
            crown: pineMesh,
            crownIndex: pi[variant],
            crownMatrix: dummy.matrix.clone(),
            trunk,
            trunkIndex: i,
            trunkMatrix,
          });
          color.setHSL(0.18 + t * 0.03, 0.04, 0.8 + t * 0.15);
          pineMesh.setColorAt(pi[variant]++, color);
        } else {
          dummy.position.set(x, ground + h * crownBase, z);
          dummy.scale.set(width, h * (1 - crownBase), width);
          dummy.updateMatrix();
          leaves.setMatrixAt(li, dummy.matrix);
          color.setHSL(0.16 + t * 0.09, 0.08 + t * 0.08, 0.65 + t * 0.2);
          this.treeSamples.push({
            x,
            y: ground,
            z,
            height: h,
            width,
            diameter,
            sourceId: profile.sourceId,
            form: profile.form,
            rotation,
            crown: leaves,
            crownIndex: li,
            crownMatrix: dummy.matrix.clone(),
            trunk,
            trunkIndex: i,
            trunkMatrix,
          });
          leaves.setColorAt(li++, color);
        }
      }
      leaves.count = li;
      pines.forEach((p, i) => (p.count = pi[i]));
      for (const obj of [trunk, leaves, ...pines]) {
        obj.castShadow = obj.receiveShadow = true;
        obj.computeBoundingSphere();
        obj.userData.center = key.split(",").map((v) => Number(v) * 192 + 96);
        obj.userData.treeCellRadius = Math.SQRT2 * 96;
        this.root.add(obj);
        this.chunks.push(obj);
      }
    }
    this.stats.trees = trees.length;
    for (const t of forestTrees)
      this.collision.addForestTrunk(t.x, t.z, t.diameter / 2);
  }
  streetDetails() {
    const b = new Batcher(this.root, 240),
      m = this.materials,
      rand = seeded(44);
    const lampMat = new T.MeshStandardMaterial({
      color: 0xffedc7,
      emissive: 0xffd48b,
      emissiveIntensity: 2,
    });
    this.nightLights.push(lampMat);
    const signCache = new Map<string, T.Material>();
    let count = 0;
    for (const r of this.data.roads) {
      if (!isStreet(r) || r.kind === "residential") continue;
      for (let i = 0; i < r.pts.length - 2; i += 2) {
        b.offsetY = 0;
        const ax = r.pts[i],
          az = r.pts[i + 1],
          bx = r.pts[i + 2],
          bz = r.pts[i + 3],
          len = Math.hypot(bx - ax, bz - az);
        if (len < 20) continue;
        const dx = (bx - ax) / len,
          dz = (bz - az) / len,
          offset = roadWidth(r) / 2 + 1.4;
        for (let d = 15; d < len; d += 47) {
          const side = count++ % 2 ? 1 : -1,
            x = ax + dx * d + dz * offset * side,
            z = az + dz * d - dx * offset * side;
          // Preserve the generic placement sequence elsewhere. The bridge's
          // standards use its actual deck grade and source-specific silhouette.
          if (replacesIronworkersStreetLamp(r)) continue;
          if (
            this.collision.water(x, z) ||
            this.collision.blocked(x, z, 0.5) ||
            this.collision.onStreet(x, z, 0.4)
          )
            continue;
          this.streetFurniture.push({ kind: "lamp", x, z });
          const h = this.collision.groundHeight(x, z);
          if (
            /^(Water Street|Alexander Street|Carrall Street)$/.test(
              r.name ?? "",
            ) &&
            x > 450 &&
            x < 1800
          ) {
            const add = (
              g: T.BufferGeometry,
              mat: T.Material,
              xx = x,
              yy = h,
              zz = z,
            ) => {
              g.translate(xx, yy, zz);
              b.add(g, mat, x, z);
            };
            add(
              new T.CylinderGeometry(0.13, 0.24, 5.3, 10),
              m.dark,
              x,
              h + 2.65,
              z,
            );
            add(new T.BoxGeometry(0.54, 0.18, 0.54), m.dark, x, h + 0.16, z);
            add(
              new T.CylinderGeometry(0.23, 0.38, 0.65, 10),
              m.dark,
              x,
              h + 0.52,
              z,
            );
            for (let q = 0; q < 5; q++) {
              const angle = q * Math.PI * 0.5,
                radius = q === 4 ? 0 : 0.64,
                yy = q === 4 ? 5.8 : 5.1;
              const xx = x + Math.sin(angle) * radius,
                zz = z + Math.cos(angle) * radius;
              const arm = new T.CylinderGeometry(0.045, 0.045, 0.86, 8);
              arm.rotateZ(q === 4 ? 0 : Math.PI * 0.38);
              arm.rotateY(angle);
              add(arm, m.dark, (x + xx) / 2, h + 4.65, (z + zz) / 2);
              add(new T.SphereGeometry(0.25, 12, 8), lampMat, xx, h + yy, zz);
              add(
                new T.CylinderGeometry(0.11, 0.16, 0.18, 8),
                m.dark,
                xx,
                h + yy - 0.29,
                zz,
              );
            }
            continue;
          }
          let geo: T.BufferGeometry = new T.CylinderGeometry(0.055, 0.09, 8, 6);
          geo.translate(x, h + 4, z);
          b.add(geo, m.dark, x, z);
          geo = new T.BoxGeometry(1.4, 0.12, 0.27);
          geo.rotateY(-Math.atan2(dz, dx));
          geo.translate(x - dz * 0.5 * side, h + 8, z + dx * 0.5 * side);
          b.add(geo, m.chrome, x, z);
          geo = new T.BoxGeometry(0.85, 0.04, 0.22);
          geo.translate(x - dz * 0.5 * side, h + 7.92, z + dx * 0.5 * side);
          b.add(geo, lampMat, x, z);
          if (count % 6 === 0 && !this.collision.onStreet(x + 1, z, 0.3)) {
            geo = new T.CylinderGeometry(0.23, 0.23, 0.85, 10);
            geo.translate(x + 1, h + 0.43, z);
            b.add(geo, m.dark, x, z);
          }
        }
        if (
          /^(Granville Street|Robson Street|West Georgia Street|West Hastings Street|Burrard Street)$/.test(
            r.name ?? "",
          ) &&
          ax > -1800 &&
          ax < 1900 &&
          az > -1600 &&
          az < 1450 &&
          len > 28
        ) {
          const cable = (points: T.Vector3[]) => {
            // The Burrard tie is elevated; keep this affected span's wires
            // above both its new grade and the existing western approach.
            if (
              this.collision.canada?.intersects([ax, az, bx, bz]) ||
              this.collision.howeTerrain?.intersects([ax, az, bx, bz])
            )
              for (const p of points)
                p.y += this.collision.groundHeight(p.x, p.z);
            const curve = new T.CatmullRomCurve3(points);
            b.add(
              new T.TubeGeometry(curve, 8, 0.018, 4, false),
              m.dark,
              ax,
              az,
            );
          };
          for (const lane of [-2.8, 2.8])
            for (const conductor of [-0.25, 0.25]) {
              const off = lane + conductor;
              cable([
                new T.Vector3(ax + dz * off, 6.1, az - dx * off),
                new T.Vector3(
                  (ax + bx) / 2 + dz * off,
                  5.88,
                  (az + bz) / 2 - dx * off,
                ),
                new T.Vector3(bx + dz * off, 6.1, bz - dx * off),
              ]);
            }
          for (let t = 12; t < len; t += 48) {
            const xx = ax + dx * t,
              zz = az + dz * t;
            cable([
              new T.Vector3(xx + dz * offset, 6.45, zz - dx * offset),
              new T.Vector3(xx, 6.0, zz),
              new T.Vector3(xx - dz * offset, 6.45, zz + dx * offset),
            ]);
          }
        }
        if (r.name && i === 0 && len > 38) {
          const x = ax + dx * 10 + dz * offset,
            z = az + dz * 10 - dx * offset;
          if (
            this.collision.blocked(x, z, 1) ||
            this.collision.onStreet(x, z, 0.4)
          )
            continue;
          this.streetFurniture.push({ kind: "sign", x, z });
          b.offsetY = this.collision.groundHeight(x, z);
          let mat = signCache.get(r.name);
          if (!mat) {
            mat = new T.MeshStandardMaterial({
              map: label(
                r.name.toUpperCase(),
                512,
                96,
                "#f5f4e7",
                "#20403c",
                42,
              ),
              roughness: 0.7,
            });
            signCache.set(r.name, mat);
          }
          const sign = new T.BoxGeometry(3.1, 0.53, 0.07);
          sign.rotateY(Math.atan2(dx, dz));
          sign.translate(x, 3.4, z);
          b.add(sign, mat, x, z);
          const pole = new T.CylinderGeometry(0.045, 0.045, 3.4, 6);
          pole.translate(x, 1.7, z);
          b.add(pole, m.chrome, x, z);
        }
      }
    }
    this.streetFurniture.push(
      ...buildCordovaStreetDetails(
        b,
        {
          groundHeight: (x, z) =>
            this.collision.howeCordovaJunction?.height(x, z) ??
            this.collision.groundHeight(x, z),
          blocked: this.collision.blocked.bind(this.collision),
          onStreet: this.collision.onStreet.bind(this.collision),
          water: this.collision.water.bind(this.collision),
        },
        this.streetFurniture,
      ),
    );
    const chunks = b.finish();
    batchStaticChunks(this.root, chunks, this.facadeMultiDraw, {
      releaseOwnedPreRenderGeometry: true,
    });
    this.chunks.push(...chunks);
  }
  mergeStatic(root: T.Group) {
    root.updateWorldMatrix(true, true);
    const batch = new Batcher(this.root, 400),
      remove: T.Mesh[] = [];
    root.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        o.geometry &&
        !(o instanceof T.InstancedMesh) &&
        !Array.isArray(o.material)
      ) {
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (!g.getAttribute("uv"))
          g.setAttribute(
            "uv",
            new T.Float32BufferAttribute(
              new Float32Array(g.getAttribute("position").count * 2),
              2,
            ),
          );
        const p = new T.Vector3();
        o.getWorldPosition(p);
        batch.add(g, o.material, p.x, p.z);
        remove.push(o);
      }
    });
    remove.forEach((o) => o.removeFromParent());
    this.chunks.push(...batch.finish());
  }
  northShoreDiagnostics() {
    return {
      ...readNorthShoreDiagnostics(this.northShoreTerrain, this.northShore),
      urban: this.northShoreUrban
        ? { ...this.northShoreUrban.stats, visibleCells: this.northShoreUrban.group.children.filter((c) => c.visible).length }
        : null,
    };
  }
  mountains() {
    const params = new URLSearchParams(
      typeof location === "undefined" ? "" : location.search,
    );
    if (params.has("debug") && params.get("terrain") === "dem") {
      this.northShoreTerrain = createNorthShoreDemGroup({ imagery: true });
      this.root.add(this.northShoreTerrain);
      this.northShoreUrban = createNorthShoreUrbanHorizon(this.data?.buildings ?? []);
      if (this.northShoreUrban) {
        this.northShoreUrban.update(0, 0);
        this.root.add(this.northShoreUrban.group);
      }
      return;
    }
    const photo = new T.TextureLoader().load(
      `${BASE}${NORTH_SHORE_PHOTO_HORIZON.texture}`,
    );
    const horizon = createNorthShorePhotoHorizon(photo);
    this.northShore = horizon.material;
    this.root.add(horizon);
  }
  createRain() {
    const a = new Float32Array(2000 * 3),
      rand = seeded(24);
    for (let i = 0; i < a.length; i += 3) {
      a[i] = (rand() - 0.5) * 70;
      a[i + 1] = rand() * 40;
      a[i + 2] = (rand() - 0.5) * 70;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(a, 3));
    this.rain = new T.Points(
      g,
      new T.PointsMaterial({
        color: 0xc3dae1,
        size: 0.04,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.scene.add(this.rain);
  }
  setDebugWaterWaves(enabled: boolean) {
    if (!enabled) {
      this.waterWavesComparison?.dispose();
      this.waterWavesComparison = undefined;
      return true;
    }
    if (
      typeof location === "undefined" ||
      !new URLSearchParams(location.search).has("debug") ||
      !this.water
    ) return false;
    this.waterWavesComparison ??= new WaterWavesComparison(this.water);
    this.waterWavesComparison.update(this.weather);
    return true;
  }
  waterWavesDiagnostics() {
    return this.waterWavesComparison?.diagnostics() ?? {
      requested: false, active: false, components: 0,
    };
  }
  setDebugWaterOptics(renderer: T.WebGLRenderer, enabled: boolean) {
    if (!enabled) {
      this.waterOpticsComparison?.dispose();
      this.waterOpticsComparison = undefined;
      this.waterOpticsError = null;
      return true;
    }
    if (
      typeof location === "undefined" ||
      !new URLSearchParams(location.search).has("debug")
    ) return false;
    if (this.waterOpticsComparison) return true;
    if (!this.water || !this.skyTextures.day) return false;
    try {
      this.waterOpticsComparison = new WaterOpticsComparison(
        this.water, this.skyTextures.day, renderer,
      );
      this.waterOpticsComparison.update(
        this.weather, this.scene.backgroundRotation, this.scene.backgroundIntensity,
      );
      this.waterOpticsError = null;
      return true;
    } catch (error) {
      this.waterOpticsError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }
  waterOpticsDiagnostics() {
    return this.waterOpticsComparison?.diagnostics() ?? {
      requested: false, active: false, status: this.waterOpticsError ? "error" : "original",
      retainedGpuBytes: 0, error: this.waterOpticsError,
    };
  }
  setDebugDaylightOrientation(orientation: DebugDaylightOrientation) {
    this.debugDaylightOrientation = orientation;
    applyDaylightOrientation(this, orientation);
    this.waterOpticsComparison?.update(
      this.weather, this.scene.backgroundRotation, this.scene.backgroundIntensity,
    );
  }
  daylightOrientationProfile() {
    return daylightOrientationProfile(this, this.debugDaylightOrientation);
  }
  setWeather(w: Weather) {
    this.weather = w;
    // Startup reflection captures happen before update() follows the player.
    // Establish the same directional offset immediately, around the current target.
    applyDaylightOrientation(this, this.debugDaylightOrientation);
    this.northShore?.color.set(
      w === "night" ? 0x233953 : w === "overcast" ? 0x9eafbb : 0xddd6ce,
    );
    const night = w === "night",
      rain = w === "overcast",
      day = w === "day";
    // Day's sky, distant reflections and direct light share the same measured
    // solar direction. Local probes capture that lighting in world space.
    if (this.skyTextures[w]) this.scene.background = this.skyTextures[w];
    if (this.reflectionTextures[w])
      this.scene.environment = this.reflectionTextures[w];
    this.sun.color.set(
      night ? 0xaec9f9 : rain ? 0xcbd9e2 : day ? 0xffefd9 : 0xffc28c,
    );
    this.sun.intensity = night ? 0.32 : rain ? 1.1 : day ? 3.4 : 3.1;
    this.ambient.intensity = night ? 0.4 : rain ? 1.45 : day ? 1.15 : 0.9;
    this.ambient.color.set(
      night ? 0x4f6d90 : rain ? 0xb7c8d1 : day ? 0xc7deef : 0xb4c8d8,
    );
    this.scene.backgroundIntensity = night
      ? 0.045
      : rain
        ? 0.67
        : day
          ? 1
          : 0.85;
    this.scene.environmentIntensity = night ? 0.45 : rain ? 0.72 : 0.8;
    const fog = this.scene.fog as T.FogExp2;
    fog.color.set(
      night ? 0x182a3c : rain ? 0x9aaeb8 : day ? 0xb2c8d4 : 0xb3b1b0,
    );
    fog.density = night ? 0.0006 : rain ? 0.00055 : day ? 0.00015 : 0.00023;
    this.materials.setNight(night ? 1 : 0.1);
    this.materials.asphalt.roughness = rain ? 0.45 : night ? 0.65 : 1;
    this.materials.asphalt.metalness = 0;
    if (this.cordovaPavement) {
      this.cordovaPavement.roughness = this.materials.asphalt.roughness;
      this.cordovaPavement.metalness = this.materials.asphalt.metalness;
    }
    if (this.robsonRoadMaterial) {
      this.robsonRoadMaterial.roughness = this.materials.asphalt.roughness;
      this.robsonRoadMaterial.metalness = this.materials.asphalt.metalness;
    }
    if (this.ironworkersRoadMaterial) {
      this.ironworkersRoadMaterial.roughness = this.materials.asphalt.roughness;
      this.ironworkersRoadMaterial.metalness = this.materials.asphalt.metalness;
    }
    this.rain.visible = rain;
    this.water.uniforms.deep.value.set(
      night ? 0x091923 : rain ? 0x344d57 : 0x294956,
    );
    this.water.uniforms.sky.value.copy(fog.color);
    this.water.uniforms.sunDir.value
      .copy(this.sun.position)
      .sub(this.sun.target.position)
      .normalize();
    this.water.uniforms.night.value = night ? 1 : 0;
    this.waterWavesComparison?.update(w);
    this.waterOpticsComparison?.update(
      w, this.scene.backgroundRotation, this.scene.backgroundIntensity,
    );
    this.nightLights.forEach((m) => (m.emissiveIntensity = night ? 2.0 : 0.25));
  }

  update(
    dt: number,
    x: number,
    z: number,
    y = this.collision.groundHeight(x, z),
    camera?: T.Camera,
  ) {
    this.time += dt;
    if (this.time > 1) this.treeDetailStream?.update(x, z);
    for (const uniform of this.materials.animatedUniforms)
      uniform.value = this.time;
    for (const beacon of this.materials.beacons) {
      const lit = this.time % beacon.period < beacon.period / 2;
      beacon.material.emissiveIntensity = lit
        ? this.weather === "night"
          ? 5
          : 1.8
        : 0.02;
      beacon.light.intensity = lit && this.weather === "night" ? 8 : 0;
    }
    this.coastalVegetation?.update(this.time, x, z);
    this.detailedTrees?.update(x, z, y, camera);
    this.forestDetail?.update(x, z, y);
    this.detailedArchitecture?.update(x, z);
    this.water.uniforms.time.value = this.time;
    const sx = Math.round(x / 2) * 2,
      sz = Math.round(z / 2) * 2,
      ground = this.collision.groundHeight(x, z);
    this.sun.target.position.set(sx, ground, sz);
    sunOffset(
      this.weather,
      this.sun.position,
      this.debugDaylightOrientation,
    ).add(this.sun.target.position);
    this.water.uniforms.sunDir.value
      .copy(this.sun.position)
      .sub(this.sun.target.position)
      .normalize();
    this.rain.position.set(x, ground, z);
    if (this.rain.visible) {
      const a = this.rain.geometry.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * 25;
        if (y < 0) y = 40;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    this.casterVolume.update(this.sun);
    this.northShoreUrban?.update(x, z);
    for (const c of this.chunks) {
      const p = c.userData.center;
      if (!p) continue;
      const dist = Math.hypot(p[0] - x, p[1] - z);
      updateBroadleafDistance(c, dist);
      c.visible =
        dist <
        (c.userData.detail ? 350 : c instanceof T.InstancedMesh ? 1400 : 2900);
      c.castShadow = this.casterVolume.includes(c);
    }
  }
}
