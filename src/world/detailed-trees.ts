import { yieldDetailFrame } from "./detail-stream";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bakeGeometry } from "./geometry";
import { BASE } from "./materials";
import { calibrateStem } from "./tree-stem";
import { selectStreetTrees, STREET_TREE_REVISION } from "./street-tree-lod";
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
/** Correct source-surface foliage, with a second mesh level and independent
 * per-tree bounds so offscreen trees do not submit their complete leaf canopy. */
export class DetailedTrees {
  budget = 24;
  samples: TreeInstance[] = [];
  private selected: TreeInstance[] = [];
  private previousNear = new Set<TreeInstance>();
  private slots: { group: T.Group; levels: T.InstancedMesh[][] }[] = [];
  private width = 1;
  private stemDiameter = 0.04;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastY = Infinity;
  private lastBudget = -1;
  private lastView = new T.Quaternion();
  private lastProjectionScale: number | undefined;
  lodState = { near: 0, medium: 0 };
  static async load(scene: T.Scene) {
    const loader = new GLTFLoader();
    const models = [];
    // Keep GLB decode requests bounded instead of launching both large LODs.
    for (const suffix of ["", "-medium"]) {
      models.push(
        await loader.loadAsync(
          `${BASE}models/vancouver-street-tree${suffix}.glb?v=${STREET_TREE_REVISION}`,
        ),
      );
      await yieldDetailFrame();
    }
    return DetailedTrees.fromModels(
      scene,
      models.map((m) => m.scene),
    );
  }
  static fromModels(scene: T.Scene, models: T.Group[]) {
    const result = new DetailedTrees();
    models.forEach((m) => m.updateMatrixWorld(true));
    const box = new T.Box3().setFromObject(models[0]),
      height = box.max.y - box.min.y;
    result.width =
      Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / height;
    result.stemDiameter = 0.18 / height;
    const levels = models.map((model) => {
      const parts: {
        geometry: T.BufferGeometry;
        material: T.MeshStandardMaterial;
        depth: T.MeshDepthMaterial;
      }[] = [];
      model.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const geometry = bakeGeometry(o.geometry, o.matrixWorld);
        geometry.translate(0, -box.min.y, 0);
        geometry.scale(1 / height, 1 / height, 1 / height);
        // Bounds cover the calibrated lower stem as well as the original canopy.
        geometry.computeBoundingSphere();
        geometry.boundingSphere!.radius += 0.08;
        const material = (o.material as T.MeshStandardMaterial).clone();
        material.side = T.DoubleSide;
        material.transparent = false;
        material.depthWrite = true;
        // Retain the baked leaf-mask cutoff, including its distant mip coverage.
        material.alphaTest = material.alphaTest || 0.45;
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
        parts.push({ geometry, material, depth });
      });
      return parts;
    });
    for (let i = 0; i < 96; i++) {
      const group = new T.Group();
      group.matrixAutoUpdate = false;
      group.visible = false;
      group.name = "Street tree";
      const meshes = levels.map((parts, level) =>
        parts.map((part) => {
          // Share all large vertex/index buffers. Only the per-tree stem scale is
          // unique, so individual frustum culling does not duplicate model memory.
          const geometry = new T.BufferGeometry();
          geometry.setIndex(part.geometry.index);
          for (const [name, a] of Object.entries(part.geometry.attributes))
            geometry.setAttribute(name, a);
          geometry.boundingSphere = part.geometry.boundingSphere!.clone();
          const scale = new T.InstancedBufferAttribute(
            new Float32Array([1]),
            1,
          );
          scale.setUsage(T.DynamicDrawUsage);
          geometry.setAttribute("treeStemScale", scale);
          const mesh = new T.InstancedMesh(geometry, part.material, 1);
          mesh.setMatrixAt(0, new T.Matrix4());
          mesh.customDepthMaterial = part.depth;
          // WebGLShadowMap substitutes 0.5 for alpha-to-coverage before this
          // callback. Restore the source cutoff after that substitution.
          mesh.onBeforeShadow = (
            _renderer,
            _scene,
            _camera,
            _shadowCamera,
            _geometry,
            depthMaterial,
          ) => {
            depthMaterial.alphaTest = (mesh.material as T.Material).alphaTest;
          };
          mesh.frustumCulled = true;
          mesh.castShadow = mesh.receiveShadow = true;
          mesh.name = `Street tree ${level === 0 ? "near" : "medium"} ${part.material.name}`;
          mesh.computeBoundingSphere();
          group.add(mesh);
          return mesh;
        }),
      );
      scene.add(group);
      result.slots.push({ group, levels: meshes });
    }
    return result;
  }
  update(x: number, z: number, y = 0, camera?: T.Camera) {
    const projectionScale =
      camera instanceof T.PerspectiveCamera
        ? camera.projectionMatrix.elements[5]
        : undefined;
    if (
      Math.hypot(x - this.lastX, z - this.lastZ, y - this.lastY) < 3 &&
      this.lastBudget === this.budget &&
      this.lastProjectionScale === projectionScale &&
      (!camera || this.lastView.angleTo(camera.quaternion) < 0.04)
    )
      return;
    this.lastX = x;
    this.lastZ = z;
    this.lastY = y;
    this.lastBudget = this.budget;
    this.lastProjectionScale = projectionScale;
    if (camera) this.lastView.copy(camera.quaternion);
    const dirty = new Set<T.InstancedMesh>();
    for (const tree of this.selected) {
      tree.crown.setMatrixAt(tree.crownIndex, tree.crownMatrix);
      tree.trunk.setMatrixAt(tree.trunkIndex, tree.trunkMatrix);
      dirty.add(tree.crown);
      dirty.add(tree.trunk);
    }
    const selected = selectStreetTrees(
      this.samples,
      x,
      z,
      y,
      this.budget,
      this.previousNear,
      camera
        ? new T.Frustum().setFromProjectionMatrix(
            new T.Matrix4().multiplyMatrices(
              camera.projectionMatrix,
              camera.matrixWorldInverse,
            ),
          )
        : undefined,
      projectionScale,
      new Set(this.selected),
    );
    this.selected = selected.map((p) => p.tree);
    this.previousNear = new Set(
      selected.filter((p) => p.near).map((p) => p.tree),
    );
    this.lodState = {
      near: this.previousNear.size,
      medium: selected.length - this.previousNear.size,
    };
    const dummy = new T.Object3D(),
      hidden = new T.Matrix4().makeScale(0, 0, 0),
      color = new T.Color();
    this.slots.forEach((slot, index) => {
      const item = selected[index];
      slot.group.visible = !!item;
      if (!item) return;
      const { tree, near } = item;
      tree.crown.setMatrixAt(tree.crownIndex, hidden);
      tree.trunk.setMatrixAt(tree.trunkIndex, hidden);
      dirty.add(tree.crown);
      dirty.add(tree.trunk);
      dummy.position.set(tree.x, tree.y ?? 0, tree.z);
      dummy.rotation.set(0, tree.rotation, 0);
      const horizontal = tree.width / this.width;
      dummy.scale.set(horizontal, tree.height, horizontal);
      dummy.updateMatrix();
      slot.group.matrix.copy(dummy.matrix);
      slot.group.matrixWorldNeedsUpdate = true;
      color.setHSL(0.18, 0.025, 0.78 + (tree.rotation % 1) * 0.16);
      slot.levels.forEach((meshes, level) =>
        meshes.forEach((mesh) => {
          mesh.visible = level === (near ? 0 : 1);
          const attr = mesh.geometry.getAttribute(
            "treeStemScale",
          ) as T.InstancedBufferAttribute;
          attr.setX(
            0,
            Math.max(
              0.08,
              Math.min(3.5, tree.diameter / (this.stemDiameter * horizontal)),
            ),
          );
          attr.needsUpdate = true;
          mesh.setColorAt(0, color);
          mesh.instanceColor!.needsUpdate = true;
        }),
      );
    });
    dirty.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true));
  }
}
