import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded } from "./data";
import { broadleafVolumeGeometry } from "./broadleaf-volume";
import type { Materials } from "./materials";
import type { TreeProfile } from "./tree-profile";

/** Quantized existing OSM positions. Live nodes retain broadleaved tags but no
 * species or dimensions. Widths interpret the registered aerial canopy groups,
 * not a tree survey. See docs/sources/robson-mound-trees.md. */
export const ROBSON_MOUND_TREE_SITES = [
  { osmId: 13778746316, x: -125.951401, z: 95.87, width: 7.2 },
  { osmId: 13778746317, x: -119.451401, z: 85.37, width: 6.5 },
  { osmId: 13778746318, x: -114.451401, z: 79.37, width: 6.2 },
  { osmId: 13778746319, x: -128.951401, z: 74.87, width: 7.4 },
  { osmId: 13778746320, x: -134.951401, z: 83.37, width: 7.2 },
  { osmId: 13778746321, x: -129.951401, z: 67.37, width: 6.8 },
  { osmId: 13778746322, x: -126.951401, z: 61.37, width: 7.6 },
  { osmId: 13778746323, x: -121.951401, z: 66.37, width: 8.5 },
] as const;

function siteAt(x: number, z: number) {
  return ROBSON_MOUND_TREE_SITES.find(
    (s) => Math.hypot(s.x - x, s.z - z) < 0.35,
  );
}
export function isRobsonMoundTree(x: number, z: number) {
  return !!siteAt(x, z);
}
type HeightSampler = (x: number, z: number) => number;

/** Closed tapered wood with a continuous ring at each bend. */
function woodTube(points: T.Vector3[], radii: number[], sides = 7) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  let length = 0;
  for (let j = 0; j < points.length; j++) {
    if (j) length += points[j].distanceTo(points[j - 1]);
    const tangent = points[Math.min(j + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(0, j - 1)])
      .normalize();
    const side = new T.Vector3(0, 0, 1).cross(tangent).normalize();
    const up = new T.Vector3().crossVectors(tangent, side).normalize();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const p = points[j]
        .clone()
        .addScaledVector(side, Math.cos(angle) * radii[j])
        .addScaledVector(up, Math.sin(angle) * radii[j]);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / sides, length * 0.6);
      if (j && i < sides) {
        const a = j * (sides + 1) + i,
          b = a - sides - 1;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  for (const end of [0, points.length - 1]) {
    const centre = positions.length / 3,
      p = points[end];
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5, end ? length * 0.6 : 0);
    for (let i = 0; i < sides; i++) {
      const a = end * (sides + 1) + i;
      if (end) indices.push(centre, a, a + 1);
      else indices.push(centre, a + 1, a);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** One bounded physical tree; this never changes the passed profile or top. */
export function robsonMoundTreeGeometry(
  profile: TreeProfile,
  height: HeightSampler,
) {
  const site = siteAt(profile.x, profile.z);
  if (!site)
    throw new Error("Robson tree profile has no registered source site");
  const ground = height(profile.x, profile.z),
    h = profile.height;
  if (![ground, h, profile.diameter].every(Number.isFinite) || h < 3)
    throw new Error("Robson tree needs a finite supported profile");
  const random = seeded(site.osmId),
    width = site.width,
    top = ground + h;
  const wood: T.BufferGeometry[] = [],
    leaves: T.BufferGeometry[] = [];
  const coarse = broadleafVolumeGeometry(true),
    full = broadleafVolumeGeometry();
  const crownBox = coarse.boundingBox!,
    crownCentre = crownBox.getCenter(new T.Vector3());
  const crownSize = crownBox.getSize(new T.Vector3());
  const radius = profile.diameter / 2;
  const root = new T.Vector3(profile.x, ground - 0.025, profile.z);
  const fork = new T.Vector3(profile.x, ground + 2.5, profile.z);
  wood.push(
    woodTube(
      [root, root.clone().lerp(fork, 0.42), fork],
      [radius, radius * 0.87, radius * 0.68],
      10,
    ),
  );

  // Keep overhanging wood and leaves above pedestrian headroom on the uphill
  // side. Draw the crown inward only where the shared mound grade requires it.
  const clear = (p: T.Vector3, allowance = 2.25) => {
    for (let i = 0; i < 14 && height(p.x, p.z) + allowance > top - 0.12; i++) {
      p.x = profile.x + (p.x - profile.x) * 0.8;
      p.z = profile.z + (p.z - profile.z) * 0.8;
    }
    p.y = Math.min(top - 0.06, Math.max(p.y, height(p.x, p.z) + allowance));
    return p;
  };
  const branch = (a: T.Vector3, b: T.Vector3, r: number) => {
    const middle = clear(a.clone().lerp(b, 0.52));
    middle.y = Math.max(a.y, middle.y - h * 0.035);
    wood.push(woodTube([a, middle, b], [r, r * 0.66, r * 0.26]));
  };
  const clump = (
    centre: T.Vector3,
    span: number,
    tall: number,
    detailed = false,
  ) => {
    const g = (detailed ? full : coarse).clone();
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal");
    const angles: number[] = [],
      centres: number[] = [],
      scales: number[] = [],
      colors: number[] = [];
    const angle = profile.rotation + random() * Math.PI,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const sx = span / crownSize.x,
      sy = tall / crownSize.y,
      sz = (span * 0.88) / crownSize.z;
    const tint = new T.Color().setHSL(
      0.19 + random() * 0.025,
      0.04,
      0.86 + random() * 0.1,
    );
    for (let i = 0; i < p.count; i++) {
      const dx = (p.getX(i) - crownCentre.x) * sx,
        dz = (p.getZ(i) - crownCentre.z) * sz;
      const q = clear(
        new T.Vector3(
          centre.x + dx * c + dz * s,
          centre.y + (p.getY(i) - crownCentre.y) * sy,
          centre.z - dx * s + dz * c,
        ),
      );
      // The top clump reaches exactly the inherited tree top; no new height.
      if (detailed && p.getY(i) >= crownBox.max.y - 1e-6) q.y = top;
      p.setXYZ(i, q.x, q.y, q.z);
      const normal = q
        .clone()
        .sub(centre)
        .setY((q.y - centre.y) * 0.65 + tall * 0.2)
        .normalize();
      n.setXYZ(i, normal.x, normal.y, normal.z);
      centres.push(centre.x, centre.y, centre.z);
      angles.push(angle);
      scales.push(sx, sy, sz);
      colors.push(tint.r, tint.g, tint.b);
    }
    g.setAttribute("canopyCentre", new T.Float32BufferAttribute(centres, 3));
    g.setAttribute("canopyAngle", new T.Float32BufferAttribute(angles, 1));
    g.setAttribute("canopyScale", new T.Float32BufferAttribute(scales, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    leaves.push(g);
  };
  for (let i = 0; i < 4; i++) {
    const a = profile.rotation + (i * Math.PI) / 2 + (random() - 0.5) * 0.35;
    const reach = width * (0.19 + random() * 0.035);
    const limb = clear(
      new T.Vector3(
        profile.x + Math.cos(a) * reach,
        ground + h * (0.58 + random() * 0.06),
        profile.z + Math.sin(a) * reach,
      ),
    );
    branch(fork, limb, radius * 0.59);
    clump(
      limb.clone().add(new T.Vector3(0, h * 0.09, 0)),
      width * 0.31,
      h * 0.3,
    );
    for (let j = 0; j < 3; j++) {
      const direction = a + (j - 1) * 0.64;
      const r = width * (0.3 + random() * 0.045);
      const tip = clear(
        new T.Vector3(
          profile.x + Math.cos(direction) * r,
          ground + h * (0.67 + random() * 0.11),
          profile.z + Math.sin(direction) * r,
        ),
      );
      branch(limb, tip, radius * 0.31);
      clump(
        tip.clone().add(new T.Vector3(0, h * 0.035, 0)),
        width * (0.27 + random() * 0.035),
        h * 0.27,
      );
      for (const turn of [-0.65, 0.65]) {
        const twig = clear(
          tip
            .clone()
            .add(
              new T.Vector3(
                Math.cos(direction + turn) * width * 0.055,
                h * 0.07,
                Math.sin(direction + turn) * width * 0.055,
              ),
            ),
        );
        wood.push(woodTube([tip, twig], [radius * 0.13, radius * 0.025], 5));
      }
    }
  }
  const centre = new T.Vector3(profile.x, top - h * 0.21, profile.z);
  clump(centre, width * 0.53, h * 0.42, true);
  const mergedWood = mergeGeometries(wood)!,
    mergedLeaves = mergeGeometries(leaves)!;
  for (const g of [...wood, ...leaves, coarse, full]) g.dispose();
  for (const g of [mergedWood, mergedLeaves]) {
    g.computeBoundingBox();
    g.computeBoundingSphere();
  }
  return {
    wood: mergedWood,
    leaves: mergedLeaves,
    site,
    ground,
    height: h,
    width,
  };
}

function canopyShader(material: T.Material, normals?: T.Texture) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 canopyCentre; attribute float canopyAngle; attribute vec3 canopyScale;
attribute float sliceAxis;
varying float vCanopyAxis; varying vec3 vCanopyWeights;
varying vec3 vCanopyNormalX; varying vec3 vCanopyNormalY; varying vec3 vCanopyNormalZ;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
float cc=cos(canopyAngle), ss=sin(canopyAngle);
vec3 axisX=vec3(cc,0.0,-ss),axisZ=vec3(ss,0.0,cc);
vec3 view=normalize(cameraPosition-(modelMatrix*vec4(canopyCentre,1.0)).xyz);
vec3 weights=pow(abs(vec3(dot(view,axisZ),dot(view,axisX),view.y)),vec3(6.0));
vCanopyWeights=weights/max(.00001,weights.x+weights.y+weights.z); vCanopyAxis=sliceAxis;
vCanopyNormalX=normalMatrix*axisX/canopyScale.x;
vCanopyNormalY=normalMatrix*vec3(0.0,1.0,0.0)/canopyScale.y;
vCanopyNormalZ=normalMatrix*axisZ/canopyScale.z;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vCanopyAxis; varying vec3 vCanopyWeights;
varying vec3 vCanopyNormalX; varying vec3 vCanopyNormalY; varying vec3 vCanopyNormalZ;
uniform sampler2D robsonCanopyNormals;`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
float choice=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));
float start=vCanopyAxis<.5?0.0:(vCanopyAxis<1.5?vCanopyWeights.x:vCanopyWeights.x+vCanopyWeights.y);
float end=vCanopyAxis<.5?vCanopyWeights.x:(vCanopyAxis<1.5?vCanopyWeights.x+vCanopyWeights.y:1.0);
if(choice<start||choice>=end)discard;`,
      );
    if (normals) {
      shader.uniforms.robsonCanopyNormals = { value: normals };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 sourceNormal=texture2D(robsonCanopyNormals,vMapUv).xyz*2.0-1.0;
normal=normalize(vCanopyNormalX*sourceNormal.x+vCanopyNormalY*sourceNormal.y+vCanopyNormalZ*sourceNormal.z)*faceDirection;`,
      );
    }
  };
  material.customProgramCacheKey = () =>
    `robson-mature-broadleaf-v1-${!!normals}`;
}

/** Call once with reconciled profiles, removing matching sites from the normal
 * tree pipeline. Two meshes share one bark and one foliage material. */
export function buildRobsonMoundTrees(
  parent: T.Object3D,
  materials: Materials,
  profiles: TreeProfile[],
  height: HeightSampler,
) {
  const group = new T.Group();
  group.name = "Robson mapped mature broadleaf trees";
  const selected = profiles.filter((p) => isRobsonMoundTree(p.x, p.z));
  const unique = [
    ...new Map(selected.map((p) => [siteAt(p.x, p.z)!.osmId, p])).values(),
  ];
  if (!unique.length) return group;
  const parts = unique.map((p) => robsonMoundTreeGeometry(p, height));
  const bark = new T.MeshStandardMaterial({
    name: "Robson tree bark",
    map: materials.texture("tree_small_02-branch_diff.png", true),
    color: 0xb4b0a3,
    roughness: 0.97,
  });
  const map = materials.texture("broadleaf/color.webp", true),
    normals = materials.texture("broadleaf/normal.webp");
  for (const t of [map, normals]) t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
  const leaf = new T.MeshStandardMaterial({
    name: "Robson layered broadleaf crowns",
    map,
    vertexColors: true,
    color: 0xffffff,
    alphaTest: 0.18,
    alphaToCoverage: true,
    side: T.DoubleSide,
    roughness: 0.96,
    envMapIntensity: 0.35,
  });
  const depth = new T.MeshDepthMaterial({
    map,
    alphaTest: 0.18,
    side: T.DoubleSide,
    depthPacking: T.RGBADepthPacking,
  });
  canopyShader(leaf, normals);
  canopyShader(depth);
  let triangles = 0;
  for (const [kind, material] of [
    ["wood", bark],
    ["leaves", leaf],
  ] as const) {
    const geometry = mergeGeometries(parts.map((p) => p[kind]))!;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = `Robson mapped trees — ${kind}`;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.center = [-127, 78];
    mesh.userData.robsonMoundTreePart = kind;
    if (kind === "leaves") {
      mesh.customDepthMaterial = depth;
      // Three substitutes .5 for alpha-to-coverage in the shadow pass. Keep
      // the same source leaf threshold instead of thinning the canopy shadow.
      mesh.onBeforeShadow = (
        _renderer,
        _scene,
        _camera,
        _shadowCamera,
        _geometry,
        shadowMaterial,
      ) => {
        shadowMaterial.alphaTest = leaf.alphaTest;
      };
    }
    triangles +=
      (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
    group.add(mesh);
  }
  for (const p of parts) {
    p.wood.dispose();
    p.leaves.dispose();
  }
  group.userData.robsonMoundTrees = {
    count: unique.length,
    triangles,
    sourceIds: parts.map((p) => p.site.osmId),
    species: "OSM broadleaved; species unresolved",
  };
  parent.add(group);
  return group;
}
