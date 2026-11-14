import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bakeGeometry } from "./geometry";
import { BASE } from "./materials";
import { calibrateStem } from "./tree-stem";
export interface TreeInstance {
  x: number;
  y?: number;
  z: number;
  height: number;
  rootDepth?: number;
  coniferVariant?: number;
  width: number;
  diameter: number;
  sourceId?: number;
  form?: string;
  rotation: number;
  crown: T.InstancedMesh;
  crownIndex: number;
  crownMatrix: T.Matrix4;
  trunk: T.InstancedMesh;
  trunkIndex: number;
  trunkMatrix: T.Matrix4;
}
/** A bounded pool of photographed, modelled trees replaces the nearest low-detail crowns. */
export class DetailedTrees {
  budget = 24;
  samples: TreeInstance[] = [];
  private selected: TreeInstance[] = [];
  private parts: T.InstancedMesh[] = [];
  private width = 1;
  private stemDiameter = 0.04;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastBudget = -1;
  static async load(scene: T.Scene) {
    const result = new DetailedTrees();
    const gltf = await new GLTFLoader().loadAsync(
      `${BASE}models/vancouver-street-tree.glb`,
    );
    gltf.scene.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(gltf.scene);
    const height = box.max.y - box.min.y;
    result.width =
      Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / height;
    // The source's lower stem spans about 18 cm. This preserves the inventory DBH
    // as a useful visual scale without pretending the generic mesh is a surveyed tree.
    result.stemDiameter = 0.18 / height;
    gltf.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const geometry = bakeGeometry(o.geometry, o.matrixWorld);
      geometry.translate(0, -box.min.y, 0);
      geometry.scale(1 / height, 1 / height, 1 / height);
      const stemScales = new T.InstancedBufferAttribute(
        new Float32Array(96).fill(1),
        1,
      );
      stemScales.setUsage(T.DynamicDrawUsage);
      geometry.setAttribute("treeStemScale", stemScales);
      const material = (o.material as T.MeshStandardMaterial).clone();
      material.side = T.DoubleSide;
      material.transparent = false;
      material.depthWrite = true;
      material.alphaTest = 0.45;
      material.alphaToCoverage = true;
      material.roughness = 0.88;
      if (material.name.includes("leaves")) {
        material.roughnessMap = null;
        material.roughness = 0.96;
        material.metalness = 0;
        material.envMapIntensity = 0.35;
        material.normalScale.set(0.35, 0.35);
      }
      calibrateStem(material);
      const depth = new T.MeshDepthMaterial({
        depthPacking: T.RGBADepthPacking,
        map: material.map,
        alphaTest: material.alphaTest,
        side: T.DoubleSide,
      });
      calibrateStem(depth);
      const pool = new T.InstancedMesh(geometry, material, 96);
      pool.customDepthMaterial = depth;
      pool.count = 0;
      pool.castShadow = pool.receiveShadow = true;
      pool.frustumCulled = false;
      pool.name = "Detailed street trees";
      pool.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(pool);
      result.parts.push(pool);
    });
    return result;
  }
  update(x: number, z: number) {
    if (
      Math.hypot(x - this.lastX, z - this.lastZ) < 22 &&
      this.lastBudget === this.budget
    )
      return;
    this.lastX = x;
    this.lastZ = z;
    this.lastBudget = this.budget;
    const dirty = new Set<T.InstancedMesh>();
    for (const tree of this.selected) {
      tree.crown.setMatrixAt(tree.crownIndex, tree.crownMatrix);
      tree.trunk.setMatrixAt(tree.trunkIndex, tree.trunkMatrix);
      dirty.add(tree.crown);
      dirty.add(tree.trunk);
    }
    this.selected = this.samples
      .filter((t) => Math.hypot(t.x - x, t.z - z) < 105)
      .sort(
        (a, b) =>
          (a.x - x) ** 2 + (a.z - z) ** 2 - (b.x - x) ** 2 - (b.z - z) ** 2,
      )
      .slice(0, this.budget);
    const dummy = new T.Object3D(),
      hidden = new T.Matrix4().makeScale(0, 0, 0),
      color = new T.Color();
    this.selected.forEach((tree, index) => {
      tree.crown.setMatrixAt(tree.crownIndex, hidden);
      tree.trunk.setMatrixAt(tree.trunkIndex, hidden);
      dirty.add(tree.crown);
      dirty.add(tree.trunk);
      dummy.position.set(tree.x, tree.y ?? 0, tree.z);
      dummy.rotation.set(0, tree.rotation, 0);
      const horizontalScale = tree.width / this.width;
      dummy.scale.set(horizontalScale, tree.height, horizontalScale);
      dummy.updateMatrix();
      color.setHSL(0.18, 0.025, 0.78 + (tree.rotation % 1) * 0.16);
      for (const part of this.parts) {
        const stem = part.geometry.getAttribute(
          "treeStemScale",
        ) as T.InstancedBufferAttribute;
        stem.setX(
          index,
          Math.max(
            0.08,
            Math.min(
              3.5,
              tree.diameter / (this.stemDiameter * horizontalScale),
            ),
          ),
        );
        part.setMatrixAt(index, dummy.matrix);
        part.setColorAt(index, color);
      }
    });
    dirty.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true));
    for (const part of this.parts) {
      part.count = this.selected.length;
      part.instanceMatrix.needsUpdate = true;
      (
        part.geometry.getAttribute(
          "treeStemScale",
        ) as T.InstancedBufferAttribute
      ).needsUpdate = true;
      if (part.instanceColor) part.instanceColor.needsUpdate = true;
    }
  }
}
