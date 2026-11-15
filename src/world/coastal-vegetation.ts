import { harbourPlantSites } from "./harbour-green";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BASE } from "./materials";
import { bakeGeometry } from "./geometry";
import { SpatialInstances } from "./spatial-instances";
import { coastalPlantSites, type CoastalPlantSite } from "./prospect-bank";
import type { CityData } from "./data";
import type { CollisionWorld } from "./collision";

export class CoastalVegetation {
  enabled = true;
  sites: CoastalPlantSite[] = [];
  batches: SpatialInstances[] = [];
  wind = { value: 0 };
  static async load(
    parent: T.Object3D,
    data: CityData,
    collision: CollisionWorld,
  ) {
    const result = new CoastalVegetation();
    result.sites = [
      ...coastalPlantSites(data, collision),
      ...harbourPlantSites(collision),
      ...(collision.fairmontArrivalIsland?.plants ?? []),
    ];
    const model = await new GLTFLoader().loadAsync(
      `${BASE}models/forest/coastal-broadleaf.glb`,
    );
    model.scene.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(model.scene),
      height = bounds.max.y - bounds.min.y;
    const animate = (material: T.Material) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.coastalWind = result.wind;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform float coastalWind;",
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
vec4 coastalRoot=instanceMatrix*vec4(0.0,0.0,0.0,1.0);
float sway=sin(coastalWind*.85+coastalRoot.x*.37+coastalRoot.z*.21)*.018;
transformed.x+=sway*pow(clamp(position.y,0.0,1.0),2.0);`,
          );
      };
      material.customProgramCacheKey = () => "prospect-coastal-wind-v1";
    };
    model.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const geometry = bakeGeometry(o.geometry, o.matrixWorld);
      geometry.translate(
        -(bounds.min.x + bounds.max.x) / 2,
        -bounds.min.y,
        -(bounds.min.z + bounds.max.z) / 2,
      );
      geometry.scale(1 / height, 1 / height, 1 / height);
      geometry.deleteAttribute("color");
      const material = (o.material as T.MeshStandardMaterial).clone();
      material.vertexColors = false;
      material.side = T.DoubleSide;
      material.alphaTest = 0.28;
      material.transparent = false;
      material.alphaToCoverage = true;
      material.roughness = 0.91;
      material.metalness = 0;
      material.envMapIntensity = 0.35;
      material.color.set(0x91b376);
      animate(material);
      const source = new T.InstancedMesh(
        geometry,
        material,
        result.sites.length,
      );
      source.name = "Prospect coastal broadleaf clusters";
      source.castShadow = source.receiveShadow = true;
      const depth = new T.MeshDepthMaterial({
        depthPacking: T.RGBADepthPacking,
        map: material.map,
        alphaTest: 0.28,
        side: T.DoubleSide,
      });
      animate(depth);
      source.customDepthMaterial = depth;
      const dummy = new T.Object3D(),
        up = new T.Vector3(0, 1, 0),
        color = new T.Color();
      result.sites.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z);
        dummy.quaternion.setFromUnitVectors(up, new T.Vector3(...s.normal));
        dummy.quaternion.multiply(
          new T.Quaternion().setFromAxisAngle(up, s.angle),
        );
        dummy.scale.setScalar(s.height);
        dummy.updateMatrix();
        source.setMatrixAt(i, dummy.matrix);
        color.setHSL(0.2, 0.03, 0.82 + (s.angle % 1) * 0.17);
        source.setColorAt(i, color);
      });
      source.instanceMatrix.needsUpdate = true;
      if (source.instanceColor) source.instanceColor.needsUpdate = true;
      const batch = new SpatialInstances(source, parent, 24);
      batch.update();
      result.batches.push(batch);
    });
    return result;
  }
  update(time: number, x: number, z: number) {
    this.wind.value = time;
    for (const batch of this.batches)
      for (const tile of batch.tiles) {
        const b = tile.boundingSphere;
        tile.visible =
          this.enabled &&
          (!b || Math.hypot(x - b.center.x, z - b.center.z) < 420 + b.radius);
      }
  }
}
