import * as T from "three";

export interface IronworkersPicketSection {
  width: number;
  depth: number;
  /** Actual centre spacing after distributing the integer member count. */
  pitch: number;
}

/** Orthographic local projection of a rectangular section onto the fence plane.
 * At grazing incidence its depth occludes adjacent gaps; coverage is not a
 * constant opacity hack. viewAlong/viewNormal are fence-local components. */
export function ironworkersProjectedPicketDuty(
  section: IronworkersPicketSection,
  viewAlong: number,
  viewNormal: number,
) {
  const slope = Math.abs(viewAlong) / Math.max(Math.abs(viewNormal), 1e-5);
  return T.MathUtils.clamp(
    (section.width + section.depth * slope) / section.pitch,
    0,
    1,
  );
}

/** Exact 1D box integral of periodic centered bars. Pixel width is in pitches;
 * negative coordinates and multi-period footprints retain the area average. */
export function ironworkersFilteredPicketCoverage(
  cell: number,
  pixelWidth: number,
  duty: number,
) {
  duty = T.MathUtils.clamp(duty, 0, 1);
  const width = Math.max(Math.abs(pixelWidth), 1e-5);
  const primitive = (s: number) =>
    Math.floor(s) * duty + Math.min(s - Math.floor(s), duty);
  const phase = cell - 0.5 + duty * 0.5;
  return T.MathUtils.clamp(
    (primitive(phase + width * 0.5) - primitive(phase - width * 0.5)) / width,
    0,
    1,
  );
}

/** Far LOD only: unit XY planes, UV.x=0..1 across one full pitch, local X
 * following the fence and local Y up. Instance X scale MUST be section.pitch,
 * not bar width. Near boxes and all physical contacts remain separate.
 * Requires the existing multisampled beauty target: alpha controls covered
 * samples once, with normal opaque depth testing and no alpha-test threshold.
 */
export function createIronworkersPicketCoverageMaterial(
  source: T.MeshStandardMaterial,
  section: IronworkersPicketSection,
) {
  if (
    ![section.width, section.depth, section.pitch].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    section.width > section.pitch
  )
    throw new Error("Invalid Ironworkers rectangular picket section");
  const material = source.clone();
  material.name = "Ironworkers distant filtered pickets";
  material.side = T.DoubleSide;
  material.forceSinglePass = true;
  material.transparent = false;
  material.blending = T.NormalBlending;
  material.opacity = 1;
  material.alphaTest = 0;
  material.alphaToCoverage = true;
  material.depthWrite = true;
  material.depthTest = true;
  material.userData.ironworkersPicketCoverage = { ...section };
  const compile = source.onBeforeCompile;
  const sourceKey = source.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.ironworkersPicketSection = {
      value: new T.Vector3(section.width, section.depth, section.pitch),
    };
    const varyings = `
varying float vIronworkersPicketCell;
varying vec3 vIronworkersPicketAlong;
varying vec3 vIronworkersPicketNormal;`;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${varyings}`)
      .replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>
vIronworkersPicketCell=uv.x;
vec3 ironworkersAlong=vec3(1.,0.,0.);
#ifdef USE_INSTANCING
ironworkersAlong=mat3(instanceMatrix)*ironworkersAlong;
#endif
vIronworkersPicketAlong=normalize(mat3(modelViewMatrix)*ironworkersAlong);
vIronworkersPicketNormal=normalize(transformedNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>${varyings}
uniform vec3 ironworkersPicketSection;
float ironworkersBarIntegral(float s,float duty){
  return floor(s)*duty+min(fract(s),duty);
}
float ironworkersBarCoverage(float cell,float footprint,float duty){
  float w=max(abs(footprint),.00001);
  float phase=cell-.5+duty*.5;
  return clamp((ironworkersBarIntegral(phase+w*.5,duty)-ironworkersBarIntegral(phase-w*.5,duty))/w,0.,1.);
}`,
      )
      .replace(
        "#include <opaque_fragment>",
        `vec3 ironworkersView=normalize(vViewPosition);
float ironworkersSlope=abs(dot(ironworkersView,normalize(vIronworkersPicketAlong)))/max(abs(dot(ironworkersView,normalize(vIronworkersPicketNormal))),.00001);
float ironworkersDuty=clamp((ironworkersPicketSection.x+ironworkersPicketSection.y*ironworkersSlope)/ironworkersPicketSection.z,0.,1.);
diffuseColor.a=ironworkersBarCoverage(vIronworkersPicketCell,fwidth(vIronworkersPicketCell),ironworkersDuty);
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () =>
    `${sourceKey}:ironworkers-picket-coverage-v1`;
  return material;
}
