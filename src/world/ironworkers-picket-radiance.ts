import * as T from "three";
import {
  ironworkersFilteredPicketCoverage,
  type IronworkersPicketSection,
} from "./ironworkers-picket-coverage";

/** Periodic first-hit face coverage; nearer neighbours clip the projected side. */
export function ironworkersFirstHitCoverage(
  section: IronworkersPicketSection,
  cell: number,
  pixelWidth: number,
  signedSlope: number,
) {
  const frontDuty = section.width / section.pitch;
  const sideDuty = Math.min(
    (section.depth * Math.abs(signedSlope)) / section.pitch,
    1 - frontDuty,
  );
  const shift = (signedSlope * section.depth) / (2 * section.pitch);
  const front = ironworkersFilteredPicketCoverage(
    cell + shift,
    pixelWidth,
    frontDuty,
  );
  const side = ironworkersFilteredPicketCoverage(
    cell + shift - (Math.sign(signedSlope) * (frontDuty + sideDuty)) / 2,
    pixelWidth,
    sideDuty,
  );
  return { front, side, total: Math.min(1, front + side) };
}

/** Resolved box coverage tends to the exact area mean before its periodic
 * modulation exceeds Nyquist. Front/side share the same weight so legal full
 * grazing occlusion remains1. No opacity or structural duty reduction. */
export function ironworkersBandlimitedCoverage(
  section: IronworkersPicketSection,
  cell: number,
  pixelWidth: number,
  signedSlope: number,
) {
  const exact = ironworkersFirstHitCoverage(
    section,
    cell,
    pixelWidth,
    signedSlope,
  );
  const width = Math.abs(pixelWidth),
    t = T.MathUtils.smoothstep(width, 0.25, 0.75);
  const frontMean = section.width / section.pitch;
  const sideMean = Math.min(
    (section.depth * Math.abs(signedSlope)) / section.pitch,
    1 - frontMean,
  );
  const front = T.MathUtils.lerp(exact.front, frontMean, t),
    side = T.MathUtils.lerp(exact.side, sideMean, t);
  return { front, side, total: Math.min(1, front + side) };
}

/** Debug-only radiance average. Same steel response, two actual face normals.
 * Continuous alpha requires separately sorted side chunks and no depth write. */
export function createIronworkersRadianceCoverageMaterial(
  source: T.MeshStandardMaterial,
  section: IronworkersPicketSection,
) {
  if (
    source.type !== "MeshStandardMaterial" ||
    source.normalMap ||
    source.bumpMap ||
    source.displacementMap ||
    ![section.width, section.depth, section.pitch].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    section.width > section.pitch
  )
    throw Error("Unsupported rectangular steel filter");
  const material = source.clone();
  material.name = "Ironworkers debug first-hit radiance filter";
  material.side = T.DoubleSide;
  material.forceSinglePass = true;
  material.transparent = true;
  material.blending = T.NormalBlending;
  material.opacity = 1;
  material.alphaTest = 0;
  material.alphaToCoverage = false;
  material.depthTest = true;
  material.depthWrite = false;
  material.userData.ironworkersRadianceTrial = { ...section };
  const original = source.onBeforeCompile,
    key = source.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    original.call(this, shader, renderer);
    shader.uniforms.ironworkersPicketSection = {
      value: new T.Vector3(section.width, section.depth, section.pitch),
    };
    const varyings = `\nvarying float vFenceCell;\nvarying vec3 vFenceAlong;\nvarying vec3 vFenceNormal;`;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${varyings}`)
      .replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>
vFenceCell=uv.x;
vec3 fenceAlong=vec3(1.,0.,0.);
#ifdef USE_INSTANCING
fenceAlong=mat3(instanceMatrix)*fenceAlong;
#endif
vFenceAlong=normalize(mat3(modelViewMatrix)*fenceAlong);
vFenceNormal=normalize(transformedNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>${varyings}
uniform vec3 ironworkersPicketSection;
float fenceIntegral(float s,float duty){return floor(s)*duty+min(fract(s),duty);}
float fenceCoverage(float cell,float width,float duty){float w=max(abs(width),.00001);float phase=cell-.5+duty*.5;return clamp((fenceIntegral(phase+w*.5,duty)-fenceIntegral(phase-w*.5,duty))/w,0.,1.);}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 fenceView=isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition);
vec3 fenceFront=normalize(vFenceNormal);
fenceFront*=dot(fenceView,fenceFront)<0.?-1.:1.;
vec3 fenceSide=normalize(vFenceAlong);
float fenceSlope=dot(fenceView,fenceSide)/max(abs(dot(fenceView,fenceFront)),.00001);
fenceSide*=fenceSlope<0.?-1.:1.;
float fenceFrontDuty=ironworkersPicketSection.x/ironworkersPicketSection.z;
float fenceSideDuty=min(ironworkersPicketSection.y*abs(fenceSlope)/ironworkersPicketSection.z,1.-fenceFrontDuty);
float fenceShift=fenceSlope*ironworkersPicketSection.y/(2.*ironworkersPicketSection.z);
float fenceFrontCell=vFenceCell+fenceShift;
float fenceSideCell=fenceFrontCell-sign(fenceSlope)*(fenceFrontDuty+fenceSideDuty)*.5;
float fenceFootprint=max(fwidth(fenceFrontCell),fwidth(fenceSideCell));
float fenceMeanWeight=smoothstep(.25,.75,fenceFootprint);
float fenceFrontCoverage=mix(fenceCoverage(fenceFrontCell,fenceFootprint,fenceFrontDuty),fenceFrontDuty,fenceMeanWeight);
float fenceSideCoverage=mix(fenceCoverage(fenceSideCell,fenceFootprint,fenceSideDuty),fenceSideDuty,fenceMeanWeight);
float fenceTotal=clamp(fenceFrontCoverage+fenceSideCoverage,0.,1.);
vec2 fenceWeights=vec2(fenceFrontCoverage,fenceSideCoverage)/max(fenceTotal,.00001);
ReflectedLight fenceSum=ReflectedLight(vec3(0.),vec3(0.),vec3(0.),vec3(0.));`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `{
normal=fenceFront;nonPerturbedNormal=fenceFront;
#include <lights_physical_fragment>`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
fenceSum.directDiffuse=reflectedLight.directDiffuse*fenceWeights.x;
fenceSum.directSpecular=reflectedLight.directSpecular*fenceWeights.x;
fenceSum.indirectDiffuse=reflectedLight.indirectDiffuse*fenceWeights.x;
fenceSum.indirectSpecular=reflectedLight.indirectSpecular*fenceWeights.x;
}
{
normal=fenceSide;nonPerturbedNormal=fenceSide;
reflectedLight=ReflectedLight(vec3(0.),vec3(0.),vec3(0.),vec3(0.));
#include <lights_physical_fragment>
#include <lights_fragment_begin>
#include <lights_fragment_maps>
#include <lights_fragment_end>
#include <aomap_fragment>
fenceSum.directDiffuse+=reflectedLight.directDiffuse*fenceWeights.y;
fenceSum.directSpecular+=reflectedLight.directSpecular*fenceWeights.y;
fenceSum.indirectDiffuse+=reflectedLight.indirectDiffuse*fenceWeights.y;
fenceSum.indirectSpecular+=reflectedLight.indirectSpecular*fenceWeights.y;
}
reflectedLight=fenceSum;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `diffuseColor.a=fenceTotal;
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () =>
    `${key}:ironworkers-first-hit-radiance-v2-bandlimited`;
  return material;
}
