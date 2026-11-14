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
import { Batcher, flatPolygon, ribbon, walls } from "./geometry";
import { CollisionWorld, BRIDGES } from "./collision";
import { architecture } from "./architecture";
import { buildLandmarks } from "./landmarks";
import { loadVancouverLandmarks } from "./vancouver-landmarks";
import { DetailedTrees, TreeInstance } from "./detailed-trees";
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
import { reconcileTrees, treeProfile, type TreeProfile } from "./tree-profile";
import { ForestHabitat } from "./forest-habitat";
import { ForestDetail, forestGround } from "./forest";
export type Weather = "day" | "golden" | "overcast" | "night";
export class World {
  root = new T.Group();
  materials = new Materials();
  collision: CollisionWorld;
  chunks: T.Mesh[] = [];
  sun = new T.DirectionalLight(0xffe0b3, 3.2);
  ambient = new T.HemisphereLight(0xc6dfed, 0x697265, 2.0);
  water!: T.ShaderMaterial;
  weather: Weather = "day";
  rain!: T.Points;
  time = 0;
  skyTextures: Record<string, T.Texture> = {};
  reflectionTextures: Record<string, T.Texture> = {};
  nightLights: T.MeshStandardMaterial[] = [];
  northShore?: T.MeshBasicMaterial;
  detailedTrees?: DetailedTrees;
  forestHabitat!: ForestHabitat;
  forestDetail?: ForestDetail;
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
  ) {
    this.collision = new CollisionWorld(data);
    scene.add(this.root);
    scene.add(this.sun, this.sun.target, this.ambient);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 650;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.14;
    this.sun.shadow.radius = 3.5;
    scene.fog = new T.FogExp2(0xc2cbd0, 0.00032);
  }
  async build(report: (text: string, n: number) => void) {
    report("Loading Vancouver’s streets", 0.12);
    this.collision = new CollisionWorld(this.data);
    this.forestHabitat = new ForestHabitat(this.data, this.collision);
    this.terrain();
    this.roads();
    await new Promise((r) => setTimeout(r, 20));
    report("Raising the downtown skyline", 0.3);
    const accurateLandmarks = new T.Group();
    this.root.add(accurateLandmarks);
    await loadVancouverLandmarks(accurateLandmarks, this.materials);
    this.mergeStatic(accurateLandmarks);
    this.buildings();
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
    report("Planting Stanley Park", 0.49);
    this.vegetation();
    this.detailedTrees = await DetailedTrees.load(this.scene);
    this.detailedTrees.samples = this.treeSamples;
    try {
      this.forestDetail = await ForestDetail.load(this.scene, this.forestHabitat);
      this.forestDetail.samples = this.coniferSamples;
    } catch (error) {
      console.warn("Forest detail unavailable; retaining distant trees", error);
    }
    await new Promise((r) => setTimeout(r, 20));
    report("Building the waterfront", 0.68);
    const landmarkRoot = new T.Group();
    this.root.add(landmarkRoot);
    buildLandmarks(landmarkRoot, this.materials);
    this.mergeStatic(landmarkRoot);
    this.streetDetails();
    await new Promise((r) => setTimeout(r, 20));
    report("Lighting the coast", 0.84);
    this.mountains();
    this.createRain();
    try {
      const loader = new HDRLoader().setDataType(T.HalfFloatType);
      const [sunset, overcast, env, daylight, nightEnv] = await Promise.all(
        [
          "sunset",
          "overcast",
          "city-reflections",
          "sky",
          "night-reflections",
        ].map((name) => loader.loadAsync(`${BASE}textures/${name}.hdr`)),
      );
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
        day: env,
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

    this.root.updateMatrixWorld(true);
    this.root.traverse((object) => {
      object.matrixAutoUpdate = false;
      object.matrixWorldAutoUpdate = false;
    });
    this.setWeather("day");
    report("Ready to explore", 1);
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
    const floor = mesh(
      new T.PlaneGeometry(24000, 24000),
      m.grass,
      this.root,
      2000,
      -0.09,
      0,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.geometry
      .getAttribute("uv")
      .array.forEach((_, i, a) => (a[i] *= 2800));
    floor.castShadow = false;
    const b = new Batcher(this.root, 600),
      woodlandMaterial = forestGround(m);
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
          flatPolygon(
            a.pts,
            a.holes,
            elevation,
            mat === woodlandMaterial ? 2.11 : 5,
          ),
          mat,
          x,
          z,
        );
      } catch {}
    }
    const cityBase = mesh(
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
      m.concrete,
      this.root,
    );
    cityBase.castShadow = false;
    this.chunks.push(...b.finish(false));
    this.water = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new T.Color(0x204b58) },
        sky: { value: new T.Color(0xbccdd1) },
        sunDir: { value: new T.Vector3(-0.6, 0.28, -0.5).normalize() },
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
      mesh(flatPolygon(a.pts, [], 0.065, 1), this.water, this.root).castShadow =
        false;
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
    const b = new Batcher(this.root, 450),
      m = this.materials;
    const cobble = m.pbr("cobblestone_floor_05", 0xb1aaa2, 0.88);
    const stripes = new T.MeshStandardMaterial({
      color: 0xdfd8c0,
      roughness: 0.6,
    });
    const junctions = roadJunctionGaps(this.data.roads);
    for (const r of this.data.roads) {
      const [x, z] = centroid(r.pts),
        width = roadWidth(r),
        street = isStreet(r),
        historic =
          /^(Water Street|Alexander Street)$/.test(r.name ?? "") &&
          x > 450 &&
          x < 1800;
      const height = (x: number, z: number) => this.collision.height(x, z);
      if (street)
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
              ribbon(points, 2.5, 0.15, height, 4),
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
              ribbon(curb, 0.17, 0.17, height, 4),
              m.stone,
              x,
              z,
              "curb-edge",
            );
          }
        }
      b.add(
        ribbon(
          r.pts,
          width,
          street ? 0.092 : r.walkway ? 0.15 : 0.07,
          height,
          historic ? 1.6 : 5,
        ),
        historic ? cobble : street ? m.asphalt : m.concrete,
        x,
        z,
        "road",
      );
      if (street && !historic && r.kind !== "residential")
        for (const line of roadMarkings(r, junctions.get(r)))
          b.add(
            ribbon(line.pts, 0.1, 0.102, height),
            line.yellow ? m.yellow : stripes,
            line.pts[0],
            line.pts[1],
            "stripe",
          );
      for (const line of crosswalkMarkings(r))
        b.add(
          ribbon(line.pts, line.width, 0.111, height),
          stripes,
          line.pts[0],
          line.pts[1],
          "crossing",
        );
      this.stats.roads++;
    }
    for (const group of b.groups.values())
      for (const geometry of group.geo) {
        const p = geometry.getAttribute("position"),
          uv = geometry.getAttribute("uv");
        const scale = group.mat === cobble ? 1.6 : 5;
        for (let i = 0; i < p.count; i++)
          uv.setXY(i, p.getX(i) / scale, p.getZ(i) / scale);
      }
    this.chunks.push(...b.finish(false));
  }
  buildings() {
    const result = architecture(
      this.root,
      this.data,
      this.materials,
      this.collision,
    );
    this.chunks.push(...result.chunks);
    this.stats.buildings = result.count;
    this.architecturalDetails = result.architecturalDetails;
    this.reflections = result.reflections;
  }

  vegetation() {
    const rand = seeded(7503),
      m = this.materials,
      trees = reconcileTrees(this.data.trees, this.data.publicTrees).filter(
        (t) =>
          !this.collision.water(t.x, t.z) &&
          !this.collision.blocked(t.x, t.z, 0.35),
      );
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
      const k = Math.floor(t.x / 350) + "," + Math.floor(t.z / 350);
      let a = chunkTrees.get(k);
      if (!a) chunkTrees.set(k, (a = []));
      a.push(t);
    }
    const foliageMap = m.texture("broadleaf-branch.png", true),
      pineMap = m.texture("forest/conifer-atlas.webp", true);
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
      alphaTest: 0.35,
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
    const pineParts: T.BufferGeometry[] = [];
    for (let side = 0; side < 2; side++) {
      const g = new T.PlaneGeometry(1, 1),
        uv = g.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) + side) / 2);
      g.translate(0, 0.5, 0);
      g.rotateY((side * Math.PI) / 2);
      pineParts.push(g);
    }
    const pineGeo = mergeGeometries(pineParts)!;
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
        pines = new T.InstancedMesh(pineGeo, pineMat, list.length);
      let li = 0,
        pi = 0;
      for (let i = 0; i < list.length; i++) {
        const profile = list[i],
          { x, z, height: h, width, diameter, crownBase, rotation } = profile;
        const t = rotation / (Math.PI * 2);
        const ground = profile.ground ?? this.collision.height(x, z);
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
          const rootDepth = Math.min(0.6, diameter * 0.5);
          dummy.position.set(x, ground - rootDepth, z);
          dummy.scale.set(width * 1.1513, h + rootDepth, width * 1.1513);
          dummy.updateMatrix();
          pines.setMatrixAt(pi, dummy.matrix);
          this.coniferSamples.push({
            x,
            y: ground,
            z,
            height: h,
            rootDepth,
            width,
            diameter,
            sourceId: profile.sourceId,
            form: profile.form,
            rotation,
            crown: pines,
            crownIndex: pi,
            crownMatrix: dummy.matrix.clone(),
            trunk,
            trunkIndex: i,
            trunkMatrix,
          });
          color.setHSL(0.18 + t * 0.03, 0.04, 0.8 + t * 0.15);
          pines.setColorAt(pi++, color);
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
      pines.count = pi;
      for (const obj of [trunk, leaves, pines]) {
        obj.castShadow = obj.receiveShadow = true;
        obj.computeBoundingSphere();
        obj.userData.center = key.split(",").map((v) => Number(v) * 350 + 175);
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
          if (
            this.collision.water(x, z) ||
            this.collision.blocked(x, z, 0.5) ||
            this.collision.onStreet(x, z, 0.4)
          )
            continue;
          this.streetFurniture.push({ kind: "lamp", x, z });
          const h = this.collision.height(x, z);
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
    this.chunks.push(...b.finish());
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
  mountains() {
    const photo = new T.TextureLoader().load(
      `${BASE}textures/vancouver/north-shore.webp`,
    );
    photo.colorSpace = T.SRGBColorSpace;
    photo.anisotropy = 8;
    this.northShore = new T.MeshBasicMaterial({
      map: photo,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.northShore.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.a *= smoothstep(0.0,0.13,vMapUv.x)*(1.0-smoothstep(0.87,1.0,vMapUv.x));",
      );
    };
    const horizon = new T.Mesh(
      new T.PlaneGeometry(24000, 1977),
      this.northShore,
    );
    horizon.position.set(400, 480, -7000);
    horizon.renderOrder = -1;
    horizon.name = "Photographic North Shore mountain horizon";
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
  setWeather(w: Weather) {
    this.weather = w;
    this.northShore?.color.set(
      w === "night" ? 0x233953 : w === "overcast" ? 0x9eafbb : 0xddd6ce,
    );
    const night = w === "night",
      rain = w === "overcast",
      day = w === "day";
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
    this.rain.visible = rain;
    this.water.uniforms.deep.value.set(
      night ? 0x091923 : rain ? 0x344d57 : 0x294956,
    );
    this.water.uniforms.sky.value.copy(fog.color);
    this.water.uniforms.sunDir.value.set(-0.71, 0.35, 0.55).normalize();
    this.water.uniforms.night.value = night ? 1 : 0;
    this.nightLights.forEach((m) => (m.emissiveIntensity = night ? 2.0 : 0.25));
  }

  update(dt: number, x: number, z: number) {
    this.time += dt;
    this.detailedTrees?.update(x, z);
    this.forestDetail?.update(x, z);
    this.detailedArchitecture?.update(x, z);
    this.water.uniforms.time.value = this.time;
    const sx = Math.round(x / 2) * 2,
      sz = Math.round(z / 2) * 2;
    this.sun.position.set(
      sx - 220,
      this.weather === "day" ? 330 : 110,
      sz + 170,
    );
    this.sun.target.position.set(sx, 0, sz);
    this.rain.position.set(x, 0, z);
    if (this.rain.visible) {
      const a = this.rain.geometry.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * 25;
        if (y < 0) y = 40;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    for (const c of this.chunks) {
      const p = c.userData.center;
      if (!p) continue;
      const dist = Math.hypot(p[0] - x, p[1] - z);
      c.visible =
        dist <
        (c.userData.detail ? 350 : c instanceof T.InstancedMesh ? 1400 : 2900);
      c.castShadow = c.userData.allowShadow !== false && dist < 210;
    }
  }
}
