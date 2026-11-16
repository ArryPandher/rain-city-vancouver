import type { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export interface BloomHighlightFilter {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
}

const UNIFORM = "rainCityBloomHighlightFilterEnabled";
const BEGIN = "// Rain City bloom highlight filter v1 begin";
const END = "// Rain City bloom highlight filter v1 end";
const LUMINANCE = "float v = luminance( texel.xyz );";
const OUTPUT = "gl_FragColor = mix( outputColor, texel, alpha );";
const installed = new WeakSet<UnrealBloomPass>();

/** Compress only the HDR values sent into bloom's blur pyramid. Base scene
 * radiance, the original-luminance threshold gate, strength, radius, and hue
 * remain unchanged. This is an optical/artifact-control approximation, not a
 * correction to the reflecting material or energy-conserving light transport.
 *
 * Luminance <= 8 is unchanged. Above 8 the response has a continuous unit
 * derivative and approaches 16. One existing shader/uniform table is patched;
 * no render targets, textures, materials, or rendering passes are allocated.
 */
export function installBloomHighlightFilter(
  pass: UnrealBloomPass,
): BloomHighlightFilter {
  const material = pass.materialHighPassFilter;
  if (installed.has(pass) || material.fragmentShader.includes(BEGIN))
    throw new Error("Bloom highlight filter is already installed");
  const source = material.fragmentShader;
  if (
    source.split(LUMINANCE).length !== 2 ||
    source.split(OUTPUT).length !== 2 ||
    !source.includes(
      "smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v )",
    ) ||
    source.indexOf(LUMINANCE) > source.indexOf(OUTPUT)
  )
    throw new Error(
      "Bloom highlight filter expected Three's original luminance and output shader anchors",
    );
  if (Object.hasOwn(material.uniforms, UNIFORM))
    throw new Error("Bloom highlight filter uniform name is already occupied");

  const toggle = { value: 1 };
  material.uniforms[UNIFORM] = toggle;
  material.fragmentShader = `uniform float ${UNIFORM};\n${source}`.replace(
    LUMINANCE,
    `${LUMINANCE}
${BEGIN}
if (${UNIFORM} > 0.5 && v > 8.0) {
  float bloomFilteredLuminance = 8.0 + 8.0 * (1.0 - exp(-(v - 8.0) / 8.0));
  texel.rgb *= bloomFilteredLuminance / v;
}
${END}`,
  );
  material.needsUpdate = true;
  installed.add(pass);
  return {
    get enabled() {
      return toggle.value === 1;
    },
    setEnabled(enabled: boolean) {
      toggle.value = enabled ? 1 : 0;
    },
  };
}
