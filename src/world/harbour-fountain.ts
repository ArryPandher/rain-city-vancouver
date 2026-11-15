import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Materials } from "./materials";
import { seeded } from "./data";
import { fountainWorld, HARBOUR_POOL_LEVEL } from "./harbour-green-site";

export interface FountainNozzle {
  u: number;
  v: number;
  du: number;
  dv: number;
  vy: number;
  life: number;
}
export const FOUNTAIN_NOZZLES: FountainNozzle[] = [
  ...[3.5, 10.2].flatMap((u) =>
    [4, 11, 18].map((v) => ({ u, v, du: 0, dv: 0, vy: 5.4, life: 1.1 })),
  ),
  ...[6.5, 15.5].flatMap((v) => [
    { u: -0.3, v, du: 5.2, dv: 0, vy: 6.5, life: 1.32 },
    { u: 14.1, v, du: -5.2, dv: 0, vy: 6.5, life: 1.32 },
  ]),
];

export function fountainJetPoint(n: FountainNozzle, t: number): T.Vector3 {
  const p = fountainWorld(n.u + n.du * t, n.v + n.dv * t);
  return new T.Vector3(
    p[0],
    HARBOUR_POOL_LEVEL + 0.08 + n.vy * t - 4.9 * t * t,
    p[1],
  );
}

/** One opaque stone substrate with a water film: reflection does not erase the
 * granite beneath a pale alpha-blended plane, and the walkable datum is unchanged. */
export function fountainWetStone(m: Materials, time: { value: number }) {
  const water = new T.MeshPhysicalMaterial({
    name: "Harbour Green — granite fountain paving / water film",
    color: 0x8e9797,
    roughness: 0.3,
    metalness: 0,
    map: m.texture("harbour-green/granite_tile-color.webp", true),
    normalMap: m.texture("harbour-green/granite_tile-normal.webp"),
    roughnessMap: m.texture("harbour-green/granite_tile-roughness.webp"),
    normalScale: new T.Vector2(0.085, 0.085),
    clearcoat: 0.85,
    clearcoatRoughness: 0.26,
    side: T.DoubleSide,
  });
  water.userData.castShadow = false;
  water.onBeforeCompile = (s) => {
    s.uniforms.hgTime = time;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 hgPoint;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nhgPoint=position.xz;",
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float hgTime; varying vec2 hgPoint;
vec2 hgLocal(vec2 p) { vec2 d=p-vec2(-105.02,-771.08); return vec2(dot(d,vec2(.8769,.4806)),dot(d,vec2(.4806,-.8769))); }
float hgWetness(vec2 p) {
  vec2 uv=hgLocal(p);
  float edge=min(min(uv.x+1.3,15.1-uv.x),min(uv.y+1.,23.-uv.y));
  float variation=.5+.5*sin(uv.x*1.7+sin(uv.y*.71))*sin(uv.y*1.23);
  return smoothstep(-.5,1.0,edge)*(.78+.22*variation);
}
vec2 hgRipples(vec2 p) {
  vec2 uv=hgLocal(p); vec2 nearest=vec2(uv.x<6.85?3.5:10.2,4.+7.*clamp(floor((uv.y-.5)/7.),0.,2.));
  vec2 d=uv-nearest; float r=max(length(d),.05);
  float slope=sin(r*22.-hgTime*11.)*.006*exp(-r*.55);
  return d/r*slope+vec2(sin(uv.y*9.+hgTime*1.7),cos(uv.x*11.-hgTime*1.4))*.0015;
}`,
      )
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.rgb*=mix(1.,.68,hgWetness(hgPoint));",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=mix(max(.55,roughnessFactor),.40+.06*sin(hgPoint.x*2.1)*sin(hgPoint.y*1.7),hgWetness(hgPoint));",
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec2 hgSlope=hgRipples(hgPoint);
vec3 hgWorldSlope=vec3(-hgSlope.x*.8769-hgSlope.y*.4806,0.,-hgSlope.x*.4806+hgSlope.y*.8769);
normal=normalize(normal+mat3(viewMatrix)*hgWorldSlope);`,
      )
      .replace(
        "#include <clearcoat_normal_fragment_maps>",
        `#include <clearcoat_normal_fragment_maps>
clearcoatNormal=normalize(clearcoatNormal+mat3(viewMatrix)*hgWorldSlope*2.);`,
      );
  };
  water.customProgramCacheKey = () => "harbour-wet-granite-v2";
  return water;
}

/** Continuous slender streams plus scattered subpixel drops and soft breakup.
 * All emitters share one stream mesh and one particle draw. No 5px white beads. */
export function fountainSpray(
  time: { value: number },
  water: T.MeshStandardMaterial,
) {
  const random = seeded(223936056),
    origins: number[] = [],
    velocities: number[] = [],
    phases: number[] = [],
    lifetimes: number[] = [],
    sizes: number[] = [],
    opacities: number[] = [],
    aspects: number[] = [];
  const tubes: T.BufferGeometry[] = [];
  for (const n of FOUNTAIN_NOZZLES) {
    // Keep the coherent water core thin; the turbulent breakup is the particles.
    const points = Array.from({ length: 41 }, (_, i) =>
      fountainJetPoint(n, (n.life * i) / 40),
    );
    tubes.push(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points),
        40,
        n.du === 0 ? 0.012 : 0.018,
        5,
        false,
      ),
    );
    const origin = fountainJetPoint(n, 0),
      basis = fountainWorld(n.u + n.du, n.v + n.dv);
    const count = n.du === 0 ? 1200 : 480;
    for (let i = 0; i < count; i++) {
      const mist = i % 4 === 0,
        fan = n.du === 0;
      const theta = random() * Math.PI * 2;
      const spread = fan ? 0.12 + random() * 0.8 : 0.015 + random() * 0.18;
      origins.push(origin.x, origin.y, origin.z);
      velocities.push(
        basis[0] - origin.x + Math.cos(theta) * spread,
        n.vy + (random() - 0.5) * (fan ? 1.5 : 0.38),
        basis[1] - origin.z + Math.sin(theta) * spread,
      );
      phases.push((i + random()) / count);
      lifetimes.push(n.life);
      sizes.push(mist ? 0.09 + random() * 0.11 : 0.022 + random() * 0.035);
      aspects.push(mist ? 1 : 0.18);
      opacities.push(mist ? 0.05 : 0.38 + random() * 0.14);
    }
  }
  const coreGeo = mergeGeometries(tubes)!;
  tubes.forEach((g) => g.dispose());
  const coreMaterial = new T.MeshPhysicalMaterial({
    name: "Harbour Green — continuous water streams",
    color: 0xbecbc9,
    roughness: 0.12,
    metalness: 0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    side: T.FrontSide,
  });
  const core = new T.Mesh(coreGeo, coreMaterial);
  core.name = "Harbour Green continuous fountain streams";
  core.castShadow = false;
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(origins, 3));
  g.setAttribute("velocity", new T.Float32BufferAttribute(velocities, 3));
  for (const [name, a] of [
    ["phase", phases],
    ["life", lifetimes],
    ["dropSize", sizes],
    ["dropAlpha", opacities],
    ["dropAspect", aspects],
  ] as const)
    g.setAttribute(name, new T.Float32BufferAttribute(a, 1));
  // Bounds include every ballistic path, not just emitter origins.
  const bounds = new T.Box3();
  for (const n of FOUNTAIN_NOZZLES)
    for (let j = 0; j <= 32; j++)
      bounds.expandByPoint(fountainJetPoint(n, (n.life * j) / 32));
  g.boundingBox = bounds.expandByScalar(2);
  g.boundingSphere = new T.Sphere();
  bounds.getBoundingSphere(g.boundingSphere);
  const spray = new T.ShaderMaterial({
    name: "Harbour Green — fine spray and breakup",
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...T.UniformsUtils.clone(T.UniformsLib.fog),
      hgTime: time,
      hgScale: { value: 500 },
      hgLight: { value: 1 },
    },
    fog: true,
    vertexShader: `uniform float hgTime;uniform float hgScale;
attribute vec3 velocity;attribute float phase;attribute float life;attribute float dropSize;attribute float dropAlpha;attribute float dropAspect;
varying float alpha;varying float aspect;
#include <fog_pars_vertex>
void main(){aspect=dropAspect;float t=fract(hgTime/life+phase)*life;vec3 p=position+velocity*t;p.y-=4.9*t*t;
vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
float pixels=dropSize*hgScale/max(.1,-mvPosition.z);
gl_PointSize=clamp(pixels,.6,18.);
float above=smoothstep(1.57,1.7,p.y);
alpha=dropAlpha*min(1.,pixels/.6)*above*smoothstep(0.,.045,t)*(1.-smoothstep(life-.12,life,t));
#include <fog_vertex>
}`,
    fragmentShader: `uniform float hgLight;varying float alpha;varying float aspect;
#include <fog_pars_fragment>
void main(){vec2 q=gl_PointCoord-.5;float d=length(vec2(q.x/aspect,q.y))*2.;if(d>1.)discard;
gl_FragColor=vec4(vec3(.66,.74,.77)*hgLight,exp(-d*d*4.)*alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  });
  const jets = new T.Points(g, spray);
  jets.name = "Harbour Green fountain jets";
  const size = new T.Vector2();
  jets.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(size);
    spray.uniforms.hgScale.value =
      size.y * camera.projectionMatrix.elements[5] * 0.5;
    spray.uniforms.hgLight.value = T.MathUtils.clamp(
      water.envMapIntensity,
      0.2,
      1.15,
    );
  };
  core.onBeforeRender = () => {
    if (coreMaterial.envMap !== water.envMap) {
      coreMaterial.envMap = water.envMap;
      coreMaterial.needsUpdate = true;
    }
    coreMaterial.envMapIntensity = water.envMapIntensity;
  };
  return { core, jets };
}
