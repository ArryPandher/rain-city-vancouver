import * as T from "three";

/** Preserve authored PBR maps; adapt thin glazing and game-controlled lamps. */
export function e30CarMaterial(source: T.Material): T.Material {
  const material = source.clone();
  if (!(material instanceof T.MeshStandardMaterial)) return material;
  const name = material.name;
  if (name === "BMW_E30_M3_PAINT") {
    material.userData.vehicleRole = "paint";
    // Pigmented automotive paint is dielectric beneath its clearcoat. The
    // source ORM is uniformly metal=1 and was behaving like tinted chrome.
    material.metalness = 0;
    material.roughness = 0.4;
    if (material instanceof T.MeshPhysicalMaterial) {
      material.clearcoatRoughness = 0.12;
    }
  }
  if (name === "BMW_E30_M3_TAILLIGHT_REFLECTOR") {
    material.userData.vehicleRole = "brakes";
    // The authored emission texture is grayscale; tint its mask red for brakes.
    // A single rear reflector material cannot model separate indicators/reverse.
    material.emissive.set(0xff2410);
    material.emissiveIntensity = 0.35;
  }
  if (name === "BMW_E30_M3_HEADLIGHT_REFLECTOR") {
    material.userData.vehicleRole = "headlights";
    material.emissive.set(0xe4f2ff);
    material.emissiveIntensity = 0.2;
  }
  if (name === "BMW_E30_M3_WINDOWS") {
    material.userData.vehicleRole = "glass";
    material.metalness = 0;
    material.roughness = 0.08;
    material.depthWrite = false;
  }
  if (
    name === "BMW_E30_M3_LENS" &&
    material instanceof T.MeshPhysicalMaterial
  ) {
    // Thin textured cover over actual reflector geometry. Alpha glazing avoids
    // rendering the entire city again for a screen-space transmission pass.
    material.transmission = 0;
    material.metalness = 0;
    material.opacity = 0.75;
    material.roughness = 0.2;
    material.clearcoatRoughness = 0.2;
    material.depthWrite = false;
  }
  return material;
}
