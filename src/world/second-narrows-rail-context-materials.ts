import * as T from "three";
import type { Materials } from "./materials";
import type {
  SecondNarrowsRailContext,
  RailContextRole,
} from "./second-narrows-rail-context";

/** Existing CC0 grass/rock and joint-free mineral scans. No source photograph
 * or new texture payload is introduced for the bank's generic surface finish. */
export function createRailContextMeshes(
  context: SecondNarrowsRailContext,
  library: Pick<Materials, "texture">,
) {
  const texture = (name: string, color = false, repeat = 1) => {
    // Materials.texture already returns a consumer-owned wrapper sharing its Source.
    const map = library.texture(name, color);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(repeat);
    map.offset.set(0, 0);
    map.center.set(0, 0);
    map.rotation = 0;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.updateMatrix();
    return map;
  };
  const ground = new T.MeshStandardMaterial({
    name: "Rail context planted earth bank",
    color: 0xa5af98,
    roughness: 1,
    map: texture("aerial_grass_rock-color.jpg", true, 0.25),
    normalMap: texture("aerial_grass_rock-normal.jpg", false, 0.25),
    roughnessMap: texture("aerial_grass_rock-roughness.jpg", false, 0.25),
    normalScale: new T.Vector2(0.4, 0.4),
  });
  const ballast = new T.MeshStandardMaterial({
    name: "Rail context crushed mineral ballast",
    color: 0x86867c,
    roughness: 1,
    map: texture("landmarks/mineral-color.webp", true, 1.4),
    normalMap: texture("landmarks/mineral-normal.webp", false, 1.4),
    normalScale: new T.Vector2(0.65, 0.65),
  });
  const materials: Record<RailContextRole, T.MeshStandardMaterial> = {
    ground,
    ballast,
    steel: new T.MeshStandardMaterial({
      name: "Rail context dark steel",
      color: 0x50584e,
      roughness: 0.72,
      metalness: 0.35,
    }),
    timber: new T.MeshStandardMaterial({
      name: "Rail context timber sleepers",
      color: 0x635b4d,
      roughness: 0.95,
    }),
    concrete: new T.MeshStandardMaterial({
      name: "Rail context bearing abutment",
      color: 0x96988c,
      roughness: 0.94,
      normalMap: texture("landmarks/mineral-normal.webp", false, 1.25),
      roughnessMap: texture("landmarks/mineral-roughness.webp", false, 1.25),
      normalScale: new T.Vector2(0.22, 0.22),
    }),
  };
  for (const material of Object.values(materials)) {
    const owned = [
      material.map,
      material.normalMap,
      material.roughnessMap,
    ].filter((map): map is T.Texture => !!map);
    let disposed = false;
    material.addEventListener("dispose", () => {
      if (disposed) return;
      disposed = true;
      for (const map of owned) map.dispose();
    });
  }
  return (Object.keys(context.parts) as RailContextRole[]).map((role) => {
    const mesh = new T.Mesh(context.parts[role], materials[role]);
    mesh.name = materials[role].name;
    mesh.castShadow = role !== "ground" && role !== "ballast";
    mesh.receiveShadow = true;
    mesh.userData.allowShadow = mesh.castShadow;
    mesh.userData.railContext = true;
    mesh.userData.center = [
      context.parts[role].boundingSphere!.center.x,
      context.parts[role].boundingSphere!.center.z,
    ];
    return mesh;
  });
}
