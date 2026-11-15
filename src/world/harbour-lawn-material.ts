import * as T from "three";
import type { Materials } from "./materials";
import type { Point } from "./data";

export interface LawnEdge {
  a: Point;
  b: Point;
  halfWidth: number;
}
export interface LawnTrunk {
  x: number;
  z: number;
  diameter: number;
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function lawnWear(
  x: number,
  z: number,
  edges: LawnEdge[],
  trunks: LawnTrunk[],
) {
  let wear = 0;
  for (const { a, b, halfWidth } of edges) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length2 = dx * dx + dz * dz;
    const t = length2
      ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2))
      : 0;
    const distance =
      Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) - halfWidth;
    // Under the paving the mask may continue; the opaque path covers it. A
    // soft 30–60cm shoulder avoids drawing an artificial second path outline.
    wear = Math.max(wear, 1 - smooth(0.02, 0.64, distance));
  }
  for (const tree of trunks) {
    const radius = Math.max(0.25, Math.min(0.7, tree.diameter * 0.5 + 0.16));
    wear = Math.max(
      wear,
      1 - smooth(radius, radius + 0.42, Math.hypot(x - tree.x, z - tree.z)),
    );
  }
  return wear;
}
export const LAWN_MASK = {
  x: -290,
  z: -940,
  width: 400,
  depth: 290,
  columns: 1024,
  rows: 768,
};
export function lawnWearTexture(edges: LawnEdge[], trunks: LawnTrunk[]) {
  const b = LAWN_MASK,
    pixels = new Uint8Array(b.columns * b.rows);
  // Spatial buckets bound setup cost rather than scanning every mapped edge
  // for every texel. A segment's expanded bounding box owns all relevant cells.
  const size = 8,
    buckets = new Map<string, { edges: LawnEdge[]; trunks: LawnTrunk[] }>();
  function add(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    edge?: LawnEdge,
    trunk?: LawnTrunk,
  ) {
    for (let x = Math.floor(x0 / size); x <= Math.floor(x1 / size); x++)
      for (let z = Math.floor(z0 / size); z <= Math.floor(z1 / size); z++) {
        const key = `${x},${z}`;
        let cell = buckets.get(key);
        if (!cell) buckets.set(key, (cell = { edges: [], trunks: [] }));
        if (edge) cell.edges.push(edge);
        if (trunk) cell.trunks.push(trunk);
      }
  }
  for (const e of edges) {
    const r = e.halfWidth + 0.7;
    add(
      Math.min(e.a[0], e.b[0]) - r,
      Math.min(e.a[1], e.b[1]) - r,
      Math.max(e.a[0], e.b[0]) + r,
      Math.max(e.a[1], e.b[1]) + r,
      e,
    );
  }
  for (const t of trunks)
    add(t.x - 1.2, t.z - 1.2, t.x + 1.2, t.z + 1.2, undefined, t);
  for (let row = 0; row < b.rows; row++)
    for (let col = 0; col < b.columns; col++) {
      const x = b.x + ((col + 0.5) / b.columns) * b.width,
        z = b.z + ((row + 0.5) / b.rows) * b.depth;
      const cell = buckets.get(
        `${Math.floor(x / size)},${Math.floor(z / size)}`,
      );
      if (cell)
        pixels[row * b.columns + col] = Math.round(
          lawnWear(x, z, cell.edges, cell.trunks) * 255,
        );
    }
  const texture = new T.DataTexture(pixels, b.columns, b.rows, T.RedFormat);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Reference: Darwin Harbour Green photos 3/6 show close-cut, open lawn with
 * subtle worn margins. Surface colour is an interpretation, not surveyed wear.
 * Uses the existing 2.51m grass scan; no new imagery or emissive grass. */
export function harbourLawnMaterial(
  m: Materials,
  edges: LawnEdge[],
  trunks: LawnTrunk[],
) {
  const wear = lawnWearTexture(edges, trunks);
  const lawn = new T.MeshStandardMaterial({
    name: "Harbour Green — maintained grass, close-cut turf and worn margins",
    color: 0xb4b38d,
    roughness: 1,
    metalness: 0,
    map: m.texture("harbour-green/grass_ground-color.webp", true),
    normalMap: m.texture("harbour-green/grass_ground-normal.webp"),
    normalScale: new T.Vector2(0.19, 0.19),
    roughnessMap: m.texture("harbour-green/grass_ground-roughness.webp"),
    side: T.DoubleSide,
  });
  lawn.onBeforeCompile = (shader) => {
    shader.uniforms.hgWear = { value: wear };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vHgGround;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHgGround=(modelMatrix*vec4(position,1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
varying vec2 vHgGround;
uniform sampler2D hgWear;
float hgHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float hgNoise(vec2 p) {
 vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(hgHash(i),hgHash(i+vec2(1.,0.)),f.x),mix(hgHash(i+vec2(0.,1.)),hgHash(i+vec2(1.)),f.x),f.y);
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
float hgMacro=hgNoise(vHgGround*.065)*.65+hgNoise(vHgGround*.23)*.35;
float hgFine=hgNoise(vHgGround*8.0);
float hgEdge=texture2D(hgWear,(vHgGround-vec2(-290.,-940.))/vec2(400.,290.)).r;
// Low amplitude organic colour variation replaces the repeating carpet. Fine
// turf detail lives in the scan, not isolated bright, upright triangle needles.
diffuseColor.rgb*=mix(vec3(.77,.81,.71),vec3(1.10,1.06,.96),hgMacro);
float hgWorn=hgEdge*mix(.53,.88,hgFine);
vec3 hgEarth=vec3(.105,.081,.047)*(0.83+hgFine*.30);
diffuseColor.rgb=mix(diffuseColor.rgb,hgEarth,hgWorn);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,0.94);",
    );
  };
  lawn.customProgramCacheKey = () => "harbour-close-cut-lawn-v1";
  lawn.addEventListener("dispose", () => wear.dispose());
  return lawn;
}
