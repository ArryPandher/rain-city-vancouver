import * as T from "three";

export type HoweMasonryFacade = {
  start: readonly [number, number];
  end: readonly [number, number];
  /** Absolute world ground height at each end, following the current street. */
  groundY: readonly [number, number];
  /** Along-facade metres where window sills drain, normally opening edges. */
  windowEdges: readonly number[];
};
export type HoweMasonryWeatheringSpec = {
  datumY: number;
  facades: readonly HoweMasonryFacade[];
  /** Heights relative to datumY, taken from the authored facade sections. */
  sillY: readonly number[];
  ledgeY: readonly number[];
  maxDarkening?: number;
  roughnessBoost?: number;
};

const VERSION = "howe-masonry-weathering-v1";
const finite = (x: number) => Number.isFinite(x);
const number = (x: number) => {
  const s = x.toFixed(7);
  return s === "-0.0000000" ? "0.0000000" : s;
};

function checked(spec: HoweMasonryWeatheringSpec) {
  if (
    !finite(spec.datumY) ||
    spec.facades.length < 1 ||
    spec.facades.length > 2 ||
    spec.sillY.length > 8 ||
    spec.ledgeY.length > 4 ||
    ![...spec.sillY, ...spec.ledgeY].every(finite)
  )
    throw new Error(
      "Howe weathering requires finite facade sections within its bounded budget",
    );
  for (const f of spec.facades) {
    const length = Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]);
    if (
      ![...f.start, ...f.end, ...f.groundY, ...f.windowEdges].every(finite) ||
      length < 1 ||
      f.windowEdges.length > 16 ||
      f.windowEdges.some((u) => u < 0 || u > length)
    )
      throw new Error(
        "Howe weathering requires valid facade lengths, ground and opening edges",
      );
  }
  const maxDarkening = spec.maxDarkening ?? 0.14;
  const roughnessBoost = spec.roughnessBoost ?? 0.055;
  if (
    !finite(maxDarkening) ||
    maxDarkening < 0 ||
    maxDarkening > 0.2 ||
    !finite(roughnessBoost) ||
    roughnessBoost < 0 ||
    roughnessBoost > 0.1
  )
    throw new Error(
      "Howe weathering must remain a restrained non-emissive surface change",
    );
  return { maxDarkening, roughnessBoost };
}

/** Shared shader source is exported so tests can execute the actual scalar
 * mask arithmetic. Tests do not claim to compile a GPU shader. No textures,
 * directional fake shadows, normal changes, displacement or random whole-wall
 * colour fields are introduced. The low-amplitude irregularity exists only
 * inside physically located base/ledge/sill exposure bands.
 */
export function howeMasonryWeatheringMaskSource(
  spec: HoweMasonryWeatheringSpec,
) {
  checked(spec);
  const faces = spec.facades
    .map((f, index) => {
      const dx = f.end[0] - f.start[0],
        dz = f.end[1] - f.start[1];
      const length = Math.hypot(dx, dz),
        tx = dx / length,
        tz = dz / length;
      const edgeTerms = f.windowEdges
        .map(
          (u) =>
            `edgeMask = max(edgeMask, 1.0-smoothstep(0.035,0.19,abs(along-(${number(u)})+wander)));`,
        )
        .join("\n");
      const sillTerms = spec.sillY
        .map(
          (y) =>
            `sillMask = max(sillMask, howeBelow(${number(y)}-localY,0.85));`,
        )
        .join("\n");
      const ledgeTerms = spec.ledgeY
        .map(
          (y) =>
            `ledgeMask = max(ledgeMask, howeBelow(${number(y)}-localY,1.05));`,
        )
        .join("\n");
      return `
// Facade ${index}: distance is measured from its real mapped plane.
{
float dx = x-(${number(f.start[0])});
float dz = z-(${number(f.start[1])});
float along = dx*${number(tx)}+dz*${number(tz)};
float planeDistance = abs(dx*${number(tz)}-dz*${number(tx)});
if (along >= 0.0 && along <= ${number(length)} && planeDistance < 0.70) {
  float planeMask = 1.0-smoothstep(0.48,0.70,planeDistance);
  float ground = mix(${number(f.groundY[0])},${number(f.groundY[1])},clamp(along/${number(length)},0.0,1.0));
  float aboveGround = y-ground;
  float baseMask = step(-0.08,aboveGround)*(1.0-smoothstep(0.06,0.70,aboveGround));
  float wander = 0.012*sin(localY*2.1+along*0.73);
  float edgeMask = 0.0;
  ${edgeTerms}
  float sillMask = 0.0;
  ${sillTerms}
  float ledgeMask = 0.0;
  ${ledgeTerms}
  float smallVariation = 0.82+0.18*sin(along*11.7+sin(localY*2.3))*sin(localY*4.1+along*0.3);
  float capDrips = 0.58+0.42*pow(0.5+0.5*sin(along*3.3+0.6*sin(along*7.1)),2.0);
  float exposure = max(0.72*baseMask, max(0.86*edgeMask*sillMask,0.92*ledgeMask*capDrips));
  result = max(result, exposure*smallVariation*planeMask);
}
}`;
    })
    .join("\n");
  return `
float howeBelow(float distanceBelow, float reach) {
  return step(0.0,distanceBelow)*(1.0-smoothstep(0.0,reach,distanceBelow));
}
float howeMasonryMask(float x, float y, float z) {
  float localY = y-(${number(spec.datumY)});
  float result = 0.0;
  ${faces}
  return clamp(result,0.0,1.0);
}`;
}

/** Apply only to the building's masonry materials, never to glass or metal.
 * The hook deliberately opts this material out of current static-chunk-batch
 * eligibility, which excludes custom shaders. It does NOT bypass that gate.
 * These building materials are already individually merged by Batcher; root
 * integration must still measure the resulting draw/CPU cost in the scene.
 * The world transform also respects Three's optional instance/batch matrices
 * so future reviewed batching support will not slide the weathering pattern.
 */
export function applyHoweMasonryWeathering(
  material: T.MeshStandardMaterial,
  spec: HoweMasonryWeatheringSpec,
) {
  const settings = checked(spec);
  if (material.userData.howeMasonryWeathering)
    throw new Error(
      "Howe masonry weathering is already applied to this material",
    );
  const maskSource = howeMasonryWeatheringMaskSource(spec);
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  const key = JSON.stringify({ spec, ...settings });
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    for (const token of ["#include <common>", "#include <worldpos_vertex>"])
      if (!shader.vertexShader.includes(token))
        throw new Error(`Howe weathering vertex hook missing ${token}`);
    for (const token of [
      "#include <common>",
      "#include <color_fragment>",
      "#include <roughnessmap_fragment>",
    ])
      if (!shader.fragmentShader.includes(token))
        throw new Error(`Howe weathering fragment hook missing ${token}`);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHoweWeatherWorld;",
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vec4 howeWeatherPosition = vec4(transformed,1.0);
#ifdef USE_BATCHING
  howeWeatherPosition = batchingMatrix*howeWeatherPosition;
#endif
#ifdef USE_INSTANCING
  howeWeatherPosition = instanceMatrix*howeWeatherPosition;
#endif
vHoweWeatherWorld = (modelMatrix*howeWeatherPosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vHoweWeatherWorld;\n${maskSource}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float howeMasonryExposure = howeMasonryMask(vHoweWeatherWorld.x,vHoweWeatherWorld.y,vHoweWeatherWorld.z);
diffuseColor.rgb *= 1.0-${number(settings.maxDarkening)}*howeMasonryExposure;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor+${number(settings.roughnessBoost)}*howeMasonryExposure,0.0,1.0);`,
      );
  };
  material.customProgramCacheKey = () => `${previousKey}|${VERSION}|${key}`;
  material.userData.howeMasonryWeathering = {
    version: VERSION,
    staticChunkBatchEligible: false,
    maxDarkening: settings.maxDarkening,
    roughnessBoost: settings.roughnessBoost,
    facadeCount: spec.facades.length,
  };
  material.needsUpdate = true;
  return material;
}
