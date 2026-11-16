import * as T from "three";
import { geo } from "./data";
import source from "./canada-place-deck-data.json";
import { PAN_PACIFIC_NEAR_PODIUM as D } from "./pan-pacific-near-podium-data";

/** Fine aligned mineral panels inferred from Handford20; not measured stone CAD. */
export const PAN_PACIFIC_NEAR_PANEL_JOINTS = {
  width: 0.8,
  height: 0.9,
  seam: 0.006,
  relief: 0.0015,
  darkening: 0.14,
} as const;
const origin = geo(source.origin[1], source.origin[0]);
function arcPrimitive(x: number) {
  return 0.5 * (x * Math.sqrt(1 + x * x) + Math.asinh(x));
}
export function nearPodiumSpineArc(s: number, width: number, depth: number) {
  const k = (4 * depth) / width;
  return (
    (width / (2 * k)) *
    (arcPrimitive(k) - arcPrimitive(k * (1 - (2 * s) / width)))
  );
}
export const PAN_PACIFIC_NEAR_PANEL_RUNS = Object.values(D.tiers).flatMap(
  ({ scale }) => {
    let offset = 0;
    return D.sourceVertices.slice(1).map((b, i) => {
      const a = D.sourceVertices[i];
      const start = [-132 + (a[0] + 132) * scale, 69 + (a[1] - 69) * scale];
      const end = [-132 + (b[0] + 132) * scale, 69 + (b[1] - 69) * scale];
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      const width = i === 0 ? D.spineWidth * scale : 0,
        depth = i === 0 ? D.spineCurveDepth : 0;
      const run = { start, end, length, offset, width, depth };
      offset +=
        length + (width ? nearPodiumSpineArc(width, width, depth) - width : 0);
      return run;
    });
  },
);
/** Source-world metric reference for continuity/batching checks. The shader
 * evaluates the same run projection per vertex, independent of texture UVs. */
export function nearPodiumPanelCoordinates(world: T.Vector3): [number, number] {
  const x = world.x - origin[0],
    z = world.z - origin[1];
  let best = Infinity,
    u = 0;
  for (const r of PAN_PACIFIC_NEAR_PANEL_RUNS) {
    const dx = (r.end[0] - r.start[0]) / r.length,
      dz = (r.end[1] - r.start[1]) / r.length;
    const s = Math.max(
      0,
      Math.min(r.length, (x - r.start[0]) * dx + (z - r.start[1]) * dz),
    );
    const distance =
      (x - r.start[0] - dx * s) ** 2 + (z - r.start[1] - dz * s) ** 2;
    if (distance >= best) continue;
    best = distance;
    const curved = r.width
      ? nearPodiumSpineArc(Math.min(s, r.width), r.width, r.depth) +
        Math.max(0, s - r.width)
      : s;
    u = r.offset + curved;
  }
  return [u, world.y - D.floor - 0.08];
}

/** Concrete only: install after the soffit clone is made. Existing mineral
 * samplers, physical maps and lit PBR response remain. No geometry displacement. */
export function addNearPodiumPanelJoints(material: T.MeshStandardMaterial) {
  const q = PAN_PACIFIC_NEAR_PANEL_JOINTS,
    previous = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.userData.nearPodiumPanelJoints = q;
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.nearPanelOrigin = { value: new T.Vector2(...origin) };
    shader.uniforms.nearPanelRuns = {
      value: PAN_PACIFIC_NEAR_PANEL_RUNS.map(
        (r) => new T.Vector4(...r.start, ...r.end),
      ),
    };
    shader.uniforms.nearPanelMeta = {
      value: PAN_PACIFIC_NEAR_PANEL_RUNS.map(
        (r) => new T.Vector4(r.length, r.offset, r.width, r.depth),
      ),
    };
    shader.uniforms.nearPanelSize = {
      value: new T.Vector4(q.width, q.height, q.seam, q.relief),
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vNearPanelMetres;
varying float vNearPanelVertical;
uniform vec2 nearPanelOrigin;
uniform vec4 nearPanelRuns[15];
uniform vec4 nearPanelMeta[15];
float nearArcPrimitive(float x){float r=sqrt(1.0+x*x);return .5*(x*r+log(x+r));}
float nearArc(float s,float width,float depth){float k=4.0*depth/width;return width/(2.0*k)*(nearArcPrimitive(k)-nearArcPrimitive(k*(1.0-2.0*s/width)));}
`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 nearPanelPosition=vec4(transformed,1.0);
#ifdef USE_BATCHING
nearPanelPosition=batchingMatrix*nearPanelPosition;
#endif
#ifdef USE_INSTANCING
nearPanelPosition=instanceMatrix*nearPanelPosition;
#endif
vec3 nearPanelWorld=(modelMatrix*nearPanelPosition).xyz;
vec2 nearPanelLocal=nearPanelWorld.xz-nearPanelOrigin;
float nearBest=1e20;float nearU=0.0;
for(int i=0;i<15;i++){
  vec4 r=nearPanelRuns[i];vec4 meta=nearPanelMeta[i];
  vec2 tangent=(r.zw-r.xy)/meta.x;
  float s=clamp(dot(nearPanelLocal-r.xy,tangent),0.0,meta.x);
  vec2 distance=nearPanelLocal-r.xy-tangent*s;float d=dot(distance,distance);
  if(d<nearBest){nearBest=d;nearU=meta.y+s;
    if(meta.z>0.0)nearU=meta.y+nearArc(min(s,meta.z),meta.z,meta.w)+max(0.0,s-meta.z);
  }
}
vNearPanelMetres=vec2(nearU,nearPanelWorld.y-${(D.floor + 0.08).toFixed(10)});
vNearPanelVertical=1.0-abs(inverseTransformDirection(transformedNormal,viewMatrix).y);
`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vNearPanelMetres;
varying float vNearPanelVertical;
uniform vec4 nearPanelSize;
float nearPanelSeam(vec2 metres){
  vec2 cell=metres/nearPanelSize.xy;
  vec2 edge=min(fract(cell),1.0-fract(cell))*nearPanelSize.xy;
  vec2 footprint=max(fwidth(metres),vec2(.0001));
  vec2 coverage=(1.0-smoothstep(vec2(nearPanelSize.z*.5),vec2(nearPanelSize.z*.5)+footprint*.5,edge))*min(vec2(1.0),nearPanelSize.z/footprint);
  return max(coverage.x,coverage.y)*smoothstep(.80,.95,vNearPanelVertical);
}
`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
float nearJoint=nearPanelSeam(vNearPanelMetres);
float nearRelief=-nearJoint*nearPanelSize.w;
diffuseColor.rgb*=1.0-nearJoint*${q.darkening.toFixed(3)};
`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 nearDx=dFdx(-vViewPosition),nearDy=dFdy(-vViewPosition);
vec3 nearR1=cross(nearDy,normal),nearR2=cross(normal,nearDx);
float nearDet=dot(nearDx,nearR1);
vec3 nearGradient=sign(nearDet)*(dFdx(nearRelief)*nearR1+dFdy(nearRelief)*nearR2);
if(abs(nearDet)>1e-8)normal=normalize(abs(nearDet)*normal-nearGradient);
`,
      );
  };
  material.customProgramCacheKey = () => `${key}:near-podium-panel-joints-v1`;
  return material;
}
