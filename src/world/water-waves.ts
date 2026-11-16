import * as T from "three";

/** Authored sheltered-harbour approximation, not a measured wind spectrum.
 * Heights in metres, wave numbers in rad/m, deep-water omega in rad/s. */
export const WATER_WAVES = [
  [11.7, -26, 0.022, 0.7],
  [8.1, -11, 0.028, 2.3],
  [5.6, 21, 0.033, 4.1],
  [3.8, 7, 0.036, 1.4],
  [2.5, -24, 0.04, 5.2],
  [1.6, 36, 0.04, 3.6],
  [0.95, -4, 0.035, 0.2],
  [0.55, 18, 0.025, 5.8],
].map(([wavelength, spread, slope, phase]) => {
  const angle = T.MathUtils.degToRad(32 + spread),
    k = (2 * Math.PI) / wavelength;
  return {
    wavelength,
    direction: [Math.cos(angle), Math.sin(angle)] as const,
    amplitude: slope / k,
    k,
    omega: Math.sqrt(9.81 * k),
    phase,
  };
});

const NORMAL =
  "float eps=.15;float dx=wave(p+vec2(eps,0))-wave(p-vec2(eps,0));float dz=wave(p+vec2(0,eps))-wave(p-vec2(0,eps));vec3 n=normalize(vec3(-dx,.65,-dz));";
const gl = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));
export function waterWavesFragment(original: string) {
  if (
    original.split(NORMAL).length !== 2 ||
    original.split("void main()").length !== 2
  )
    throw new Error("Water normal comparison contract changed");
  const components = WATER_WAVES.map(
    (w) => `
    { vec2 q = vec2(${gl(w.direction[0] * w.k)},${gl(w.direction[1] * w.k)});
      float footprint = max(abs(dot(q,pixelX)),abs(dot(q,pixelY)));
      float resolved = 1.0-smoothstep(1.570796326794897,3.141592653589793,footprint);
      slope += q * ${gl(w.amplitude)} * cos(dot(q,p)-${gl(w.omega)}*time+${gl(w.phase)}) * resolved;
    }`,
  ).join("\n");
  return original
    .replace(
      "void main()",
      `
  uniform float waterWavesEnabled;
  vec3 harbourWaveNormal(vec2 p) {
    vec2 pixelX=dFdx(p),pixelY=dFdy(p),slope=vec2(0.0);
    ${components}
    return normalize(vec3(-slope.x,1.0,-slope.y));
  }
  void main()`,
    )
    .replace(
      NORMAL,
      `vec3 n;
  if(waterWavesEnabled>0.0){n=harbourWaveNormal(p);}else{
    ${NORMAL.replace("vec3 n=", "n=")}
  }`,
    );
}

/** CPU audit of the same physical field; pixel vectors are world metres/pixel. */
export function waterWaveSample(
  x: number,
  z: number,
  time: number,
  pixelX: readonly number[] = [0, 0],
  pixelY: readonly number[] = [0, 0],
) {
  let height = 0,
    dx = 0,
    dz = 0;
  for (const w of WATER_WAVES) {
    const qx = w.direction[0] * w.k,
      qz = w.direction[1] * w.k;
    const footprint = Math.max(
      Math.abs(qx * pixelX[0] + qz * pixelX[1]),
      Math.abs(qx * pixelY[0] + qz * pixelY[1]),
    );
    const resolved =
      1 - T.MathUtils.smoothstep(footprint, Math.PI / 2, Math.PI);
    const phase = qx * x + qz * z - w.omega * time + w.phase;
    height += w.amplitude * Math.sin(phase) * resolved;
    const slope = w.amplitude * Math.cos(phase) * resolved;
    dx += qx * slope;
    dz += qz * slope;
  }
  return {
    height,
    slope: [dx, dz] as const,
    normal: new T.Vector3(-dx, 1, -dz).normalize(),
  };
}

/** Compiles after base-shader/HDR edits, without taking ownership of those.
 * A uniform day gate avoids recompilation during ordinary weather switches. */
export class WaterWavesComparison {
  private disposed = false;
  private readonly originalCompile: T.ShaderMaterial["onBeforeCompile"];
  private readonly originalKey: T.ShaderMaterial["customProgramCacheKey"];
  private readonly compile: T.ShaderMaterial["onBeforeCompile"];
  private readonly key: T.ShaderMaterial["customProgramCacheKey"];
  private readonly enabled = { value: 0 };
  private readonly onDispose = () => this.dispose();
  constructor(private readonly material: T.ShaderMaterial) {
    waterWavesFragment(material.fragmentShader); // Fail before changing ownership.
    this.originalCompile = material.onBeforeCompile;
    this.originalKey = material.customProgramCacheKey;
    const inheritedKey = material.customProgramCacheKey();
    this.compile = (shader, renderer) => {
      this.originalCompile.call(material, shader, renderer);
      shader.fragmentShader = waterWavesFragment(shader.fragmentShader);
      shader.uniforms.waterWavesEnabled = this.enabled;
    };
    this.key = () => `${inheritedKey}|harbour-directional-waves-v1`;
    material.onBeforeCompile = this.compile;
    material.customProgramCacheKey = this.key;
    material.addEventListener("dispose", this.onDispose);
    material.needsUpdate = true;
  }
  update(weather: string) {
    if (!this.disposed) this.enabled.value = weather === "day" ? 1 : 0;
  }
  diagnostics() {
    return {
      requested: !this.disposed,
      active: !this.disposed && this.enabled.value === 1,
      components: WATER_WAVES.length,
      model: "authored directional deep-water gravity normal field",
      filter: "4-to-2 pixels per crest fade",
      hdrRoughnessChanged: false,
      geometryDisplacement: false,
      extraTextures: 0,
      extraDraws: 0,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled.value = 0;
    this.material.removeEventListener("dispose", this.onDispose);
    if (this.material.onBeforeCompile === this.compile)
      this.material.onBeforeCompile = this.originalCompile;
    if (this.material.customProgramCacheKey === this.key)
      this.material.customProgramCacheKey = this.originalKey;
    this.material.needsUpdate = true;
  }
}
