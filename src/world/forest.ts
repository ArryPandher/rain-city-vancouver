import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bakeGeometry } from "./geometry";
import { BASE, Materials } from "./materials";
import { hash, seeded } from "./data";
import { SpatialHash } from "./collision";
import { ForestHabitat, STANLEY_BOUNDS } from "./forest-habitat";
import type { TreeInstance } from "./detailed-trees";
import { calibrateStem } from "./tree-stem";
import { selectForestLods } from "./forest-lod";
import { SpatialInstances } from "./spatial-instances";

export function forestGround(m: Materials) {
  const mat = new T.MeshStandardMaterial({
    map: m.texture("forest/forest_ground_06-color.webp", true),
    normalMap: m.texture("forest/forest_ground_06-normal.webp"),
    roughnessMap: m.texture("forest/forest_ground_06-roughness.webp"),
    roughness: 0.96,
    color: 0xb6b6a7,
    normalScale: new T.Vector2(0.75, 0.75),
  });
  const leaves = m.texture("forest/leaves_forest_ground-color.webp", true);
  mat.name = "Stanley forest soil and leaf litter";
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.forestLeaves = { value: leaves };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vForestPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvForestPosition = (modelMatrix * vec4(position, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D forestLeaves;\nvarying vec3 vForestPosition;",
      )
      .replace(
        "#include <map_fragment>",
        `
#ifdef USE_MAP
  vec4 soil = texture2D(map, vMapUv);
  vec2 p = vForestPosition.xz;
  float litterAmount = smoothstep(-0.1, 1.1, sin(p.x * 0.073 + sin(p.y * 0.035)) + sin(p.y * 0.063));
  vec4 litter = texture2D(forestLeaves, mat2(0.8, -0.6, 0.6, 0.8) * p / 1.26);
  diffuseColor *= mix(soil, litter, litterAmount * 0.72);
  diffuseColor.rgb *= 0.85 + 0.15 * sin(p.x * 0.019 + sin(p.y * 0.028));
#endif`,
      );
  };
  mat.customProgramCacheKey = () => "stanley-soil-v1";
  return mat;
}
interface Site {
  x: number;
  z: number;
  seed: number;
}
interface Pool {
  mesh: T.InstancedMesh;
  kind: "fern" | "moss" | "rock" | "stump" | "shrub" | "nettle";
  variant: number;
  height: number;
  width: number;
}
export class ForestDetail {
  budget = 8;
  private ground = (_x: number, _z: number) => 0;
  samples: TreeInstance[] = [];
  private selected: TreeInstance[] = [];
  private mediumSelected: TreeInstance[] = [];
  private conifers: T.InstancedMesh[][] = [[], []];
  private mediumConifers: T.InstancedMesh[][] = [[], []];
  private sourceWidth = [1, 1];
  private sourceStem = [0.08, 0.08];
  private pools: Pool[] = [];
  private batches: SpatialInstances[] = [];
  private sites = new SpatialHash<Site>(40);
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastBudget = -1;
  siteCount = 0;
  static async load(scene: T.Scene, habitat: ForestHabitat) {
    const result = new ForestDetail();
    result.ground = (x, z) => habitat.collision.groundHeight(x, z);
    const loader = new GLTFLoader();
    const ids = [
      "fir_tree_01",
      "fern_02",
      "moss_01",
      "rock_moss_set_01",
      "tree_stump_01",
      "shrub_04",
      "nettle_plant",
      "fir_tree_01-medium",
      "fir_tree_01-b",
      "fir_tree_01-b-medium",
    ];
    const models = await Promise.all(
      ids.map((id) => loader.loadAsync(`${BASE}models/forest/${id}.glb`)),
    );
    const sourceBounds: T.Box3[] = [];
    for (let mi = 0; mi < models.length; mi++) {
      const root = models[mi].scene;
      root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(root),
        height = bounds.max.y - bounds.min.y;
      if (mi === 0 || mi >= 7) {
        const variant = mi >= 8 ? 1 : 0;
        const medium = mi === 7 || mi === 9;
        const capacity = medium ? 128 : 24;
        if (!medium) sourceBounds[variant] = bounds;
        const reference = sourceBounds[variant];
        const referenceHeight = reference.max.y - reference.min.y;
        result.sourceWidth[variant] =
          Math.max(
            reference.max.x - reference.min.x,
            reference.max.z - reference.min.z,
          ) / referenceHeight;
        result.sourceStem[variant] = 1.1 / referenceHeight;
        root.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          const geometry = bakeGeometry(o.geometry, o.matrixWorld);
          geometry.translate(0, -reference.min.y, 0);
          geometry.scale(
            1 / referenceHeight,
            1 / referenceHeight,
            1 / referenceHeight,
          );
          geometry.deleteAttribute("color");
          geometry.setAttribute(
            "treeStemScale",
            new T.InstancedBufferAttribute(
              new Float32Array(capacity).fill(1),
              1,
            ).setUsage(T.DynamicDrawUsage),
          );
          const material = (o.material as T.MeshStandardMaterial).clone();
          material.vertexColors = false;
          material.side = T.DoubleSide;
          material.transparent = false;
          material.alphaTest = 0.42;
          material.alphaToCoverage = true;
          material.roughness = 0.96;
          material.metalness = 0;
          material.envMapIntensity = 0.5;
          material.normalScale.set(0.75, 0.75);
          calibrateStem(material);
          const mesh = new T.InstancedMesh(geometry, material, capacity);
          const depth = new T.MeshDepthMaterial({
            depthPacking: T.RGBADepthPacking,
            map: material.map,
            alphaTest: material.alphaTest,
            side: T.DoubleSide,
          });
          calibrateStem(depth);
          mesh.customDepthMaterial = depth;
          mesh.count = 0;
          mesh.name = `${medium ? "Medium" : "Detailed"} Stanley conifers ${variant}`;
          mesh.frustumCulled = false;
          mesh.castShadow = mesh.receiveShadow = true;
          scene.add(mesh);
          result.batches.push(
            new SpatialInstances(mesh, scene, 32, ["treeStemScale"]),
          );
          (medium ? result.mediumConifers : result.conifers)[variant].push(
            mesh,
          );
        });
      } else {
        const kind = (
          ["", "fern", "moss", "rock", "stump", "shrub", "nettle"] as const
        )[mi] as Pool["kind"];
        let variant = 0;
        root.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          // A few variants per plant type keep batching bounded.
          const limit =
            kind === "fern" ||
            kind === "moss" ||
            kind === "shrub" ||
            kind === "nettle"
              ? 3
              : kind === "rock"
                ? 2
                : 1;
          if (variant >= limit) return;
          const geometry = bakeGeometry(o.geometry, o.matrixWorld);
          geometry.computeBoundingBox();
          const b = geometry.boundingBox!.clone();
          geometry.translate(
            -(b.min.x + b.max.x) / 2,
            -b.min.y,
            -(b.min.z + b.max.z) / 2,
          );
          geometry.deleteAttribute("color");
          const material = (o.material as T.MeshStandardMaterial).clone();
          material.vertexColors = false;
          material.side = T.DoubleSide;
          material.transparent = false;
          material.alphaTest = 0.42;
          material.alphaToCoverage = true;
          material.roughness = 1;
          material.metalness = 0;
          material.envMapIntensity = 0.4;
          const capacity =
            kind === "fern"
              ? 600
              : kind === "shrub"
                ? 420
                : kind === "nettle"
                  ? 300
                  : kind === "moss"
                    ? 900
                    : kind === "rock"
                      ? 35
                      : 20;
          const mesh = new T.InstancedMesh(geometry, material, capacity);
          mesh.count = 0;
          mesh.frustumCulled = false;
          mesh.name = `Stanley ${kind} ${variant}`;
          mesh.castShadow = kind !== "moss";
          mesh.receiveShadow = true;
          scene.add(mesh);
          result.batches.push(new SpatialInstances(mesh, scene, 24));
          result.pools.push({
            mesh,
            kind,
            variant: variant++,
            height: b.max.y - b.min.y,
            width: Math.max(b.max.x - b.min.x, b.max.z - b.min.z),
          });
        });
      }
    }
    const b = STANLEY_BOUNDS;
    for (let x = b.minX; x < b.maxX; x += 5)
      for (let z = b.minZ; z < b.maxZ; z += 5) {
        const seed = hash(`forest-floor:${x}:${z}`),
          random = seeded(seed);
        const xx = x + (random() - 0.5) * 4,
          zz = z + (random() - 0.5) * 4;
        if (!habitat.clear(xx, zz, 2.2)) continue;
        result.sites.add({ x: xx, z: zz, seed }, xx, zz, xx, zz);
        result.siteCount++;
      }
    return result;
  }
  update(x: number, z: number) {
    if (
      Math.hypot(x - this.lastX, z - this.lastZ) < 12 &&
      this.lastBudget === this.budget
    )
      return;
    this.lastX = x;
    this.lastZ = z;
    this.lastBudget = this.budget;
    const dirty = new Set<T.InstancedMesh>(),
      hidden = new T.Matrix4().makeScale(0, 0, 0);
    for (const t of [...this.selected, ...this.mediumSelected]) {
      t.crown.setMatrixAt(t.crownIndex, t.crownMatrix);
      t.trunk.setMatrixAt(t.trunkIndex, t.trunkMatrix);
      dirty.add(t.crown);
      dirty.add(t.trunk);
    }
    const selection = selectForestLods(
      this.samples,
      x,
      z,
      this.budget,
      this.selected,
      this.mediumSelected,
    );
    this.selected = selection.near;
    this.mediumSelected = selection.medium;
    const dummy = new T.Object3D(),
      color = new T.Color();
    const fill = (meshes: T.InstancedMesh[][], samples: TreeInstance[]) => {
      const counts = [0, 0];
      for (const t of samples) {
        const variant = t.coniferVariant ?? 0,
          i = counts[variant]++;
        t.crown.setMatrixAt(t.crownIndex, hidden);
        t.trunk.setMatrixAt(t.trunkIndex, hidden);
        dirty.add(t.crown);
        dirty.add(t.trunk);
        const width = t.width / this.sourceWidth[variant];
        dummy.position.set(t.x, (t.y ?? 0) - (t.rootDepth ?? 0), t.z);
        dummy.rotation.set(0, t.rotation, 0);
        dummy.scale.set(width, t.height + (t.rootDepth ?? 0), width);
        dummy.updateMatrix();
        color.setHSL(0.19, 0.03, 0.84 + (t.rotation % 1) * 0.1);
        for (const mesh of meshes[variant]) {
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, color);
          (
            mesh.geometry.getAttribute(
              "treeStemScale",
            ) as T.InstancedBufferAttribute
          ).setX(
            i,
            Math.max(
              0.12,
              Math.min(3, t.diameter / (width * this.sourceStem[variant])),
            ),
          );
        }
      }
      for (let variant = 0; variant < 2; variant++)
        for (const mesh of meshes[variant]) {
          mesh.count = counts[variant];
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          (
            mesh.geometry.getAttribute(
              "treeStemScale",
            ) as T.InstancedBufferAttribute
          ).needsUpdate = true;
        }
    };
    fill(this.conifers, this.selected);
    fill(this.mediumConifers, this.mediumSelected);
    for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
    for (const p of this.pools) p.mesh.count = 0;
    const sites = this.sites
      .query(x, z, this.budget ? 95 : 45)
      .filter((s) => Math.hypot(s.x - x, s.z - z) < (this.budget ? 95 : 45))
      .sort(
        (a, b) =>
          (a.x - x) ** 2 + (a.z - z) ** 2 - (b.x - x) ** 2 - (b.z - z) ** 2,
      );
    const add = (
      kind: Pool["kind"],
      variant: number,
      xx: number,
      zz: number,
      size: number,
      angle: number,
    ) => {
      const variants = this.pools.filter((p) => p.kind === kind);
      const pool = variants[variant % variants.length];
      if (!pool || pool.mesh.count >= pool.mesh.instanceMatrix.count) return;
      const scale =
        size /
        (kind === "fern" ||
        kind === "stump" ||
        kind === "shrub" ||
        kind === "nettle"
          ? pool.height
          : pool.width);
      dummy.position.set(
        xx,
        this.ground(xx, zz) + (kind === "rock" ? -0.12 : -0.02),
        zz,
      );
      dummy.rotation.set(0, angle, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      pool.mesh.setMatrixAt(pool.mesh.count, dummy.matrix);
      color.setHSL(0.18, 0.04, 0.82 + (angle % 1) * 0.16);
      pool.mesh.setColorAt(pool.mesh.count++, color);
    };
    for (const site of sites) {
      const r = seeded(site.seed),
        angle = r() * Math.PI * 2;
      if (r() > 0.2)
        for (let i = 0; i < 3; i++)
          add(
            "fern",
            Math.floor(r() * 3),
            site.x + (r() - 0.5) * 1.4,
            site.z + (r() - 0.5) * 1.4,
            0.45 + r() * 0.55,
            angle + i * 1.8,
          );
      for (let i = 0; i < 4; i++)
        add(
          "moss",
          Math.floor(r() * 3),
          site.x + (r() - 0.5) * 2,
          site.z + (r() - 0.5) * 2,
          0.03 + r() * 0.04,
          angle + i,
        );
      const thicket =
        Math.sin(site.x * 0.041 + Math.sin(site.z * 0.028)) +
        Math.cos(site.z * 0.052);
      if (thicket > -0.3)
        for (let i = 0; i < 3; i++)
          add(
            "shrub",
            Math.floor(r() * 3),
            site.x + (r() - 0.5) * 1.6,
            site.z + (r() - 0.5) * 1.6,
            0.6 + r() * 0.65,
            angle + i * 1.2,
          );
      if (thicket < 0.6)
        for (let i = 0; i < 2; i++)
          add(
            "nettle",
            Math.floor(r() * 3),
            site.x + (r() - 0.5) * 1.2,
            site.z + (r() - 0.5) * 1.2,
            0.35 + r() * 0.4,
            angle + i * 2.2,
          );
      const prop = r();
      if (prop < 0.025)
        add("stump", 0, site.x, site.z, 0.45 + r() * 0.5, angle);
      else if (prop < 0.11)
        add(
          "rock",
          Math.floor(r() * 2),
          site.x,
          site.z,
          0.65 + r() * 1.1,
          angle,
        );
    }
    for (const p of this.pools) {
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
    for (const batch of this.batches) batch.update();
  }
}
