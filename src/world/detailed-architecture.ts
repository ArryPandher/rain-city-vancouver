import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BASE } from "./materials";
import { bakeGeometry } from "./geometry";

export interface ArchitecturalDetail {
  kind: "door" | "window";
  variant: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  width: number;
  height: number;
}
interface DetailPool {
  parts: T.InstancedMesh[];
  width: number;
  height: number;
}
/** Close geometry is bounded and instanced; city-scale façades remain batched. */
export class DetailedArchitecture {
  samples: ArchitecturalDetail[] = [];
  budget = 192;
  private pools: DetailPool[] = [];
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastBudget = -1;
  static async load(scene: T.Scene) {
    const result = new DetailedArchitecture();
    const gltf = await new GLTFLoader().loadAsync(
      `${BASE}models/architectural-details.glb`,
    );
    gltf.scene.updateMatrixWorld(true);
    for (const name of [
      "door_centered_small_01",
      "door_centered_small_02",
      "window_centered_small_01",
    ]) {
      const object = gltf.scene.getObjectByName(name);
      if (!object) throw Error(`Missing architectural detail ${name}`);
      const box = new T.Box3().setFromObject(object);
      const pool: DetailPool = {
        parts: [],
        width: box.max.x - box.min.x,
        height: box.max.y - box.min.y,
      };
      object.traverse((child) => {
        if (!(child instanceof T.Mesh)) return;
        const geometry = bakeGeometry(child.geometry, child.matrixWorld);
        const material = (child.material as T.MeshStandardMaterial).clone();
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.envMapIntensity = 0.45;
        if (material.name.endsWith("glass")) {
          material.roughness = 0.28;
          material.metalness = 0.25;
        } else {
          material.roughness = 0.8;
        }
        const instances = new T.InstancedMesh(geometry, material, 384);
        instances.name = `Near-field architecture: ${name}`;
        instances.count = 0;
        instances.frustumCulled = false;
        instances.castShadow = instances.receiveShadow = true;
        instances.instanceMatrix.setUsage(T.DynamicDrawUsage);
        scene.add(instances);
        pool.parts.push(instances);
      });
      result.pools.push(pool);
    }
    return result;
  }
  update(x: number, z: number) {
    if (
      Math.hypot(x - this.lastX, z - this.lastZ) < 12 &&
      this.budget === this.lastBudget
    )
      return;
    this.lastX = x;
    this.lastZ = z;
    this.lastBudget = this.budget;
    const nearby = this.samples.filter(
      (s) => Math.hypot(s.x - x, s.z - z) < 105,
    );
    nearby.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "door" ? -1 : 1;
      return (
        (a.x - x) ** 2 +
        (a.z - z) ** 2 +
        a.y * a.y -
        ((b.x - x) ** 2 + (b.z - z) ** 2 + b.y * b.y)
      );
    });
    const counts = [0, 0, 0],
      dummy = new T.Object3D();
    for (const sample of nearby.slice(0, this.budget)) {
      const index = sample.kind === "window" ? 2 : sample.variant % 2,
        pool = this.pools[index],
        slot = counts[index]++;
      dummy.position.set(sample.x, sample.y, sample.z);
      dummy.rotation.set(0, sample.angle, 0);
      dummy.scale.set(
        sample.width / pool.width,
        sample.height / pool.height,
        1,
      );
      dummy.updateMatrix();
      for (const part of pool.parts) part.setMatrixAt(slot, dummy.matrix);
    }
    this.pools.forEach((pool, index) =>
      pool.parts.forEach((part) => {
        part.count = counts[index];
        part.instanceMatrix.needsUpdate = true;
      }),
    );
  }
}
