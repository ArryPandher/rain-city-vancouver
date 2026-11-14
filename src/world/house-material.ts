import * as T from "three";
import { Materials } from "./materials";
import { seeded } from "./data";
export function houseMaterial(materials: Materials, windows = true) {
  const canvas = () => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 1024;
    return c;
  };
  const color = canvas(),
    rough = canvas(),
    emission = canvas(),
    coat = canvas();
  const c = color.getContext("2d")!,
    r = rough.getContext("2d")!,
    e = emission.getContext("2d")!,
    cc = coat.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 512, 1024);
  r.fillStyle = "#eeeeee";
  r.fillRect(0, 0, 512, 1024);
  e.fillStyle = cc.fillStyle = "#000000";
  e.fillRect(0, 0, 512, 1024);
  cc.fillRect(0, 0, 512, 1024);
  const random = seeded(904);
  for (let row = 0; windows && row < 16; row++)
    for (let column = 0; column < 8; column++) {
      const x = column * 64 + 17,
        y = row * 64 + 16,
        lit = random() > 0.88;
      c.fillStyle = "#b8bcb8";
      c.fillRect(x - 1, y - 1, 32, 34);
      c.fillStyle = "#e2dfd2";
      c.fillRect(x, y, 30, 32);
      const g = c.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, lit ? "#877b60" : "#60757d");
      g.addColorStop(1, lit ? "#504c3f" : "#23323b");
      c.fillStyle = g;
      c.fillRect(x + 2, y + 2, 26, 28);
      c.fillStyle = "#d2d4cd";
      c.fillRect(x + 2, y + 15, 26, 1);
      c.fillRect(x + 14, y + 2, 1, 28);
      r.fillStyle = "#383838";
      r.fillRect(x + 2, y + 2, 26, 28);
      cc.fillStyle = "#ffffff";
      cc.fillRect(x + 2, y + 2, 26, 28);
      if (lit) {
        e.fillStyle = "#b8a073";
        e.fillRect(x + 2, y + 2, 26, 28);
      }
    }
  const texture = (canvas: HTMLCanvasElement, srgb = false) => {
    const t = new T.CanvasTexture(canvas);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    return t;
  };
  const wood = materials.texture("houses/painted-wood-color.webp", true),
    normal = materials.texture("houses/painted-wood-normal.webp"),
    woodRough = materials.texture("houses/painted-wood-roughness.webp");
  normal.repeat.set(10, 16);
  const material = new T.MeshPhysicalMaterial({
    map: texture(color, true),
    roughnessMap: texture(rough),
    normalMap: normal,
    normalScale: new T.Vector2(0.35, 0.35),
    emissiveMap: texture(emission, true),
    emissive: 0xffeac5,
    emissiveIntensity: 0.1,
    roughness: 0.92,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatMap: texture(coat),
    clearcoatRoughness: 0.12,
    vertexColors: true,
    side: T.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.houseWood = { value: wood };
    shader.uniforms.houseWoodRoughness = { value: woodRough };
    shader.fragmentShader =
      "uniform sampler2D houseWood;\nuniform sampler2D houseWoodRoughness;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
    float woodMask=smoothstep(.7,.85,texture2D(roughnessMap,vRoughnessMapUv).g);
    vec2 woodUv=vMapUv*vec2(10.,16.);
    diffuseColor.rgb*=mix(vec3(1.),texture2D(houseWood,woodUv).rgb,woodMask);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      T.ShaderChunk.normal_fragment_maps.replace(
        "mapN.xy *= normalScale;",
        "mapN.xy *= normalScale * woodMask;",
      ),
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
    roughnessFactor=mix(roughnessFactor,.55+.4*texture2D(houseWoodRoughness,woodUv).r,woodMask);`,
    );
  };
  material.customProgramCacheKey = () => "painted-house-photography-v1";
  return material;
}
