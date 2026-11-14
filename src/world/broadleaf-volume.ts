import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import data from "./broadleaf-volume-data.json";
import { BASE } from "./materials";
import { calibrateStem } from "./tree-stem";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bakeGeometry } from "./geometry";
import type { TreeInstance } from "./detailed-trees";

export const BROADLEAF_VOLUME_REVISION = "source-volume-20261114";
export const broadleafShape = {
  height: data.height,
  width:
    Math.max(
      data.bounds.max[0] - data.bounds.min[0],
      data.bounds.max[2] - data.bounds.min[2],
    ) / data.height,
  stemDiameter: 0.18 / data.height,
};
/** Hidden zero-scale instances are not geometry at the world origin. Including
 * them makes remote tree groups intersect the downtown view unnecessarily. */
export function activeTreeBounds(mesh: T.InstancedMesh) {
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const result = new T.Sphere().makeEmpty(),
    sample = new T.Sphere(),
    matrix = new T.Matrix4();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    if (matrix.getMaxScaleOnAxis() < 1e-8) continue;
    sample.copy(mesh.geometry.boundingSphere!).applyMatrix4(matrix);
    result.union(sample);
  }
  mesh.boundingSphere = result;
}
/** Cropped depth layers preserve source-space branch positions. The top view
 * covers elevated cameras without turning the canopy into a stack of edges. */
export function broadleafVolumeGeometry() {
  const parts: T.BufferGeometry[] = [];
  const centre = new T.Vector3()
    .fromArray(data.centre)
    .divideScalar(data.height);
  const span = data.span / data.height;
  for (const [row, axis] of [2, 0, 1].entries()) {
    const right = row === 1 ? new T.Vector3(0, 0, -1) : new T.Vector3(1, 0, 0);
    const up = row === 2 ? new T.Vector3(0, 0, -1) : new T.Vector3(0, 1, 0);
    const normal = new T.Vector3().crossVectors(right, up);
    const basis = new T.Matrix4().makeBasis(right, up, normal);
    for (let i = 0; i < 8; i++) {
      const depth =
        (data.bounds.min[axis] +
          ((data.bounds.max[axis] - data.bounds.min[axis]) * (i + 0.5)) / 8) /
        data.height;
      for (const [left, top, rightPx, bottom] of data.cuts[row * 8 + i]) {
        const geometry = new T.PlaneGeometry(
          ((rightPx - left) / 512) * span,
          ((bottom - top) / 512) * span,
        );
        const uv = geometry.getAttribute("uv");
        for (let j = 0; j < uv.count; j++)
          uv.setXY(
            j,
            (i + (left + (rightPx - left) * uv.getX(j)) / 512) / 8,
            (3 - row - bottom / 512 + ((bottom - top) * uv.getY(j)) / 512) / 3,
          );
        geometry.translate(
          ((left + rightPx) / 1024 - 0.5) * span,
          (0.5 - (top + bottom) / 1024) * span,
          0,
        );
        geometry.applyMatrix4(basis);
        const offset = centre.clone();
        offset.setComponent(axis, depth);
        geometry.translate(offset.x, offset.y, offset.z);
        geometry.setAttribute(
          "sliceAxis",
          new T.Float32BufferAttribute(new Float32Array(4).fill(row), 1),
        );
        parts.push(geometry);
      }
    }
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function volumeShader(material: T.Material, normals?: T.Texture) {
  calibrateStem(material);
  const stem = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    stem(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float sliceAxis;
varying float vSliceAxis;
varying vec3 vSliceWeights;
varying vec3 vSliceNormalX;
varying vec3 vSliceNormalY;
varying vec3 vSliceNormalZ;
varying vec3 vSlicePosition;
varying float vStemScale;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
mat4 treeWorld=modelMatrix*instanceMatrix;
vec3 treeView=normalize(cameraPosition-(treeWorld*vec4(${data.centre.map((x) => x / data.height).join(",")},1.0)).xyz);
vec3 weights=pow(abs(vec3(dot(treeView,normalize(treeWorld[2].xyz)),dot(treeView,normalize(treeWorld[0].xyz)),dot(treeView,normalize(treeWorld[1].xyz)))),vec3(6.0));
vSliceWeights=weights/max(.00001,weights.x+weights.y+weights.z);
vSliceAxis=sliceAxis;vSlicePosition=position;vStemScale=treeStemScale;
mat3 treeInstance=mat3(instanceMatrix);
vSliceNormalX=normalMatrix*treeInstance[0]/dot(treeInstance[0],treeInstance[0]);
vSliceNormalY=normalMatrix*treeInstance[1]/dot(treeInstance[1],treeInstance[1]);
vSliceNormalZ=normalMatrix*treeInstance[2]/dot(treeInstance[2],treeInstance[2]);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vSliceAxis;
varying vec3 vSliceWeights;
varying vec3 vSliceNormalX;
varying vec3 vSliceNormalY;
varying vec3 vSliceNormalZ;
varying vec3 vSlicePosition;
varying float vStemScale;
uniform sampler2D broadleafVolumeNormal;`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
float viewDither=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));
float start=vSliceAxis<.5?0.0:(vSliceAxis<1.5?vSliceWeights.x:vSliceWeights.x+vSliceWeights.y);
float end=vSliceAxis<.5?vSliceWeights.x:(vSliceAxis<1.5?vSliceWeights.x+vSliceWeights.y:1.0);
if(viewDither<start||viewDither>=end)discard;`,
      );
    if (normals) {
      shader.uniforms.broadleafVolumeNormal = { value: normals };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 sliceNormal=texture2D(broadleafVolumeNormal,vMapUv).xyz*2.0-1.0;
float stemT=clamp((vSlicePosition.y-.15)/.35,0.0,1.0);
float factor=mix(vStemScale,1.0,stemT*stemT*(3.0-2.0*stemT));
sliceNormal.xz/=factor;
sliceNormal.y-=(1.0-vStemScale)*6.0*stemT*(1.0-stemT)/.35*dot(vSlicePosition.xz,sliceNormal.xz);
normal=normalize(vSliceNormalX*sliceNormal.x+vSliceNormalY*sliceNormal.y+vSliceNormalZ*sliceNormal.z)*faceDirection;`,
      );
    }
  };
  material.customProgramCacheKey = () => `broadleaf-volume-v1-${!!normals}`;
}
export async function loadBroadleafVolumeMaterials() {
  const loader = new T.TextureLoader();
  const results = await Promise.allSettled([
    ...["color", "normal"].map((kind) =>
      loader.loadAsync(
        `${BASE}textures/broadleaf/${kind}.webp?v=${BROADLEAF_VOLUME_REVISION}`,
      ),
    ),
    new GLTFLoader().loadAsync(
      `${BASE}models/vancouver-street-tree-branches.glb?v=${BROADLEAF_VOLUME_REVISION}`,
    ),
    new GLTFLoader().loadAsync(
      `${BASE}models/vancouver-street-tree-branches-distant.glb?v=${BROADLEAF_VOLUME_REVISION}`,
    ),
  ]);
  const failure = results.find((r) => r.status === "rejected");
  if (failure) {
    for (const r of results)
      if (r.status === "fulfilled") {
        if (r.value instanceof T.Texture) r.value.dispose();
        else
          r.value.scene.traverse((o) => {
            if (o instanceof T.Mesh) {
              o.geometry.dispose();
              for (const m of [o.material].flat()) {
                for (const v of Object.values(m))
                  if (v instanceof T.Texture) v.dispose();
                m.dispose();
              }
            }
          });
      }
    throw failure.reason;
  }
  const [map, normals] = results
    .slice(0, 2)
    .map((r) => (r as PromiseFulfilledResult<T.Texture>).value);
  map.colorSpace = T.SRGBColorSpace;
  normals.colorSpace = T.NoColorSpace;
  for (const texture of [map, normals]) {
    texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    texture.anisotropy = 8;
  }
  const material = new T.MeshStandardMaterial({
    name: "Vancouver broadleaf — layered source canopy",
    map,
    alphaTest: 0.18,
    alphaToCoverage: true,
    side: T.DoubleSide,
    roughness: 0.96,
    envMapIntensity: 0.35,
  });
  const depth = new T.MeshDepthMaterial({
    map,
    depthPacking: T.RGBADepthPacking,
    alphaTest: 0.18,
    side: T.DoubleSide,
  });
  volumeShader(material, normals);
  volumeShader(depth);
  const model = (
    results[2] as PromiseFulfilledResult<
      Awaited<ReturnType<GLTFLoader["loadAsync"]>>
    >
  ).value.scene;
  model.updateMatrixWorld(true);
  const parts: T.BufferGeometry[] = [],
    branchMaterials: T.Material[] = [];
  model.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const g = bakeGeometry(o.geometry, o.matrixWorld);
    g.translate(0, data.rootOffset, 0);
    g.scale(1 / data.height, 1 / data.height, 1 / data.height);
    parts.push(g);
    const m = (o.material as T.MeshStandardMaterial).clone();
    m.side = T.DoubleSide;
    m.roughness = 0.88;
    calibrateStem(m);
    branchMaterials.push(m);
  });
  const branchGeometry = mergeGeometries(parts, true)!;
  parts.forEach((g) => g.dispose());
  branchGeometry.computeBoundingSphere();
  branchGeometry.boundingSphere!.radius += 0.08;
  const distantModel = (
    results[3] as PromiseFulfilledResult<
      Awaited<ReturnType<GLTFLoader["loadAsync"]>>
    >
  ).value.scene;
  distantModel.updateMatrixWorld(true);
  const distantParts: T.BufferGeometry[] = [],
    materialIndices: number[] = [];
  distantModel.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const material = o.material as T.MeshStandardMaterial;
    const index = branchMaterials.findIndex((m) => m.name === material.name);
    if (index < 0)
      throw new Error(`Unknown distant branch material ${material.name}`);
    materialIndices.push(index);
    const g = bakeGeometry(o.geometry, o.matrixWorld);
    g.translate(0, data.rootOffset, 0);
    g.scale(1 / data.height, 1 / data.height, 1 / data.height);
    distantParts.push(g);
    for (const v of Object.values(material))
      if (v instanceof T.Texture) v.dispose();
    material.dispose();
  });
  const distantGeometry = mergeGeometries(distantParts, true)!;
  distantGeometry.groups.forEach(
    (g, i) => (g.materialIndex = materialIndices[i]),
  );
  distantParts.forEach((g) => g.dispose());
  distantGeometry.computeBoundingSphere();
  distantGeometry.boundingSphere!.radius += 0.08;
  const branchDepth = new T.MeshDepthMaterial({
    depthPacking: T.RGBADepthPacking,
    side: T.DoubleSide,
  });
  calibrateStem(branchDepth);
  return {
    material,
    depth,
    branches: {
      geometry: branchGeometry,
      distantGeometry,
      materials: branchMaterials,
      depth: branchDepth,
    },
  };
}
/** Group centres include a 350 m tile; far simplification starts only beyond
 * 600 m, with a 50 m return band to avoid repeated switching while driving. */
export function updateBroadleafDistance(mesh: T.Mesh, distance: number) {
  const high = mesh.userData.branchNearGeometry as T.BufferGeometry | undefined;
  if (!high) return;
  const low = mesh.userData.branchFarGeometry as T.BufferGeometry;
  const far = distance > (mesh.geometry === low ? 550 : 600);
  mesh.geometry = far ? low : high;
}
/** Replace only the visual fallback, preserving source records and collisions.
 * Stored matrices become the exact fallback restored by nearby detail slots. */
export function installBroadleafVolumes(
  samples: TreeInstance[],
  materials: Awaited<ReturnType<typeof loadBroadleafVolumeMaterials>>,
) {
  const source = broadleafVolumeGeometry(),
    meshes = new Map<T.InstancedMesh, T.InstancedBufferAttribute>();
  const trunks = new Map<T.InstancedMesh, T.InstancedBufferAttribute>();
  const matrix = new T.Matrix4(),
    rotation = new T.Quaternion(),
    axis = new T.Vector3(0, 1, 0),
    color = new T.Color();
  for (const t of samples) {
    let stem = meshes.get(t.crown);
    if (!stem) {
      const g = new T.BufferGeometry();
      g.setIndex(source.index);
      for (const [name, a] of Object.entries(source.attributes))
        g.setAttribute(name, a);
      g.boundingBox = source.boundingBox!.clone();
      g.boundingSphere = source.boundingSphere!.clone();
      g.boundingSphere.radius += 0.08;
      stem = new T.InstancedBufferAttribute(
        new Float32Array(t.crown.instanceMatrix.count).fill(1),
        1,
      );
      g.setAttribute("treeStemScale", stem);
      t.crown.geometry = g;
      t.crown.material = materials.material;
      t.crown.customDepthMaterial = materials.depth;
      meshes.set(t.crown, stem);
    }
    const width = t.width / broadleafShape.width;
    matrix.compose(
      new T.Vector3(t.x, t.y ?? 0, t.z),
      rotation.setFromAxisAngle(axis, t.rotation),
      new T.Vector3(width, t.height, width),
    );
    t.crownMatrix.copy(matrix);
    t.crown.setMatrixAt(t.crownIndex, matrix);
    stem.setX(
      t.crownIndex,
      Math.max(
        0.08,
        Math.min(3.5, t.diameter / (broadleafShape.stemDiameter * width)),
      ),
    );
    let trunkStem = trunks.get(t.trunk);
    if (!trunkStem) {
      const source = materials.branches.geometry,
        g = new T.BufferGeometry();
      g.setIndex(source.index);
      for (const [name, a] of Object.entries(source.attributes))
        g.setAttribute(name, a);
      for (const group of source.groups)
        g.addGroup(group.start, group.count, group.materialIndex);
      g.boundingSphere = source.boundingSphere!.clone();
      trunkStem = new T.InstancedBufferAttribute(
        new Float32Array(t.trunk.instanceMatrix.count).fill(1),
        1,
      );
      g.setAttribute("treeStemScale", trunkStem);
      const farSource = materials.branches.distantGeometry,
        far = new T.BufferGeometry();
      far.setIndex(farSource.index);
      for (const [name, a] of Object.entries(farSource.attributes))
        far.setAttribute(name, a);
      for (const group of farSource.groups)
        far.addGroup(group.start, group.count, group.materialIndex);
      far.boundingSphere = farSource.boundingSphere!.clone();
      far.setAttribute("treeStemScale", trunkStem);
      t.trunk.geometry = g;
      t.trunk.userData.branchNearGeometry = g;
      t.trunk.userData.branchFarGeometry = far;
      t.trunk.material = materials.branches.materials;
      t.trunk.customDepthMaterial = materials.branches.depth;
      trunks.set(t.trunk, trunkStem);
    }
    t.trunkMatrix.copy(matrix);
    t.trunk.setMatrixAt(t.trunkIndex, matrix);
    trunkStem.setX(t.trunkIndex, stem.getX(t.crownIndex));
    t.trunk.instanceMatrix.needsUpdate = true;
    color.setHSL(0.18, 0.025, 0.78 + (t.rotation % 1) * 0.16);
    t.crown.setColorAt(t.crownIndex, color);
  }
  for (const [mesh, stem] of meshes) {
    stem.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    activeTreeBounds(mesh);
  }
  for (const [mesh, stem] of trunks) {
    stem.needsUpdate = true;
    activeTreeBounds(mesh);
  }
  return {
    trees: samples.length,
    chunks: meshes.size,
    triangles: source.index!.count / 3,
  };
}
