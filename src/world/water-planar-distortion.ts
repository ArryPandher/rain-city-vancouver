import * as T from "three";

/** Authored visual limits, not measured Vancouver wave properties. The ray
 * reprojection is camera-oriented; its attenuated gain limits the approximation
 * for finite-depth objects that a single planar colour target cannot ray trace. */
export const WATER_PLANAR_DISTORTION = {
  angularGain: 0.15,
  maxTexels: 8,
  edgeTexels: 2,
  resolution: 512,
} as const;

export const waterPlanarDistortionGLSL = `
vec2 waterPlanarRippleUV(vec2 baseUV,vec3 toEye,vec3 normal){
  vec4 flatRay=waterPlanarWorldProjection*vec4(reflect(-toEye,vec3(0.0,1.0,0.0)),0.0);
  vec3 tiltedDirection=reflect(-toEye,normal);
  vec4 tiltedRay=waterPlanarWorldProjection*vec4(tiltedDirection,0.0);
  vec2 delta=(tiltedRay.xy/max(tiltedRay.w,0.000001)-flatRay.xy/max(flatRay.w,0.000001))*0.15;
  float maximum=8.0/512.0;
  delta*=inversesqrt(1.0+dot(delta,delta)/(maximum*maximum));
  delta*=smoothstep(0.0,0.05,flatRay.w)*smoothstep(0.0,0.05,tiltedRay.w);
  // Rays below the mean plane have no captured water/self-reflection coverage.
  delta*=smoothstep(0.0,0.02,tiltedDirection.y);
  // Reduce distortion, never replace its radiance with pale sky at the edge.
  float margin=max(0.0,min(min(baseUV.x,baseUV.y),min(1.0-baseUV.x,1.0-baseUV.y))-0.5/512.0);
  delta*=smoothstep(0.0,2.0/512.0,margin)*min(1.0,margin/max(length(delta),0.000001));
  return baseUV+delta;
}`;

/** CPU audit of the projective approximation and coverage boundary. */
export function waterPlanarRippleUV(
  baseUV: T.Vector2,
  worldProjection: T.Matrix4,
  toEye: T.Vector3,
  normal: T.Vector3,
) {
  const project = (n: T.Vector3) => {
    const ray = toEye.clone().negate().reflect(n);
    return new T.Vector4(ray.x, ray.y, ray.z, 0).applyMatrix4(worldProjection);
  };
  const flat = project(new T.Vector3(0, 1, 0)),
    tilted = project(normal);
  const tiltedDirection = toEye.clone().negate().reflect(normal);
  const q = WATER_PLANAR_DISTORTION;
  const delta = new T.Vector2(
    tilted.x / Math.max(tilted.w, 0.000001) -
      flat.x / Math.max(flat.w, 0.000001),
    tilted.y / Math.max(tilted.w, 0.000001) -
      flat.y / Math.max(flat.w, 0.000001),
  ).multiplyScalar(q.angularGain);
  const maximum = q.maxTexels / q.resolution;
  delta.multiplyScalar(
    1 / Math.sqrt(1 + delta.lengthSq() / (maximum * maximum)),
  );
  delta.multiplyScalar(
    T.MathUtils.smoothstep(flat.w, 0, 0.05) *
      T.MathUtils.smoothstep(tilted.w, 0, 0.05),
  );
  delta.multiplyScalar(T.MathUtils.smoothstep(tiltedDirection.y, 0, 0.02));
  const margin = Math.max(
    0,
    Math.min(baseUV.x, baseUV.y, 1 - baseUV.x, 1 - baseUV.y) -
      0.5 / q.resolution,
  );
  delta.multiplyScalar(
    T.MathUtils.smoothstep(margin, 0, q.edgeTexels / q.resolution) *
      Math.min(1, margin / Math.max(delta.length(), 0.000001)),
  );
  return baseUV.clone().add(delta);
}
