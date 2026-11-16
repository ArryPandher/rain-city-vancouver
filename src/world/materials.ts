import * as T from "three";
import { seeded } from "./data";
import { SharedTextureSources } from "./shared-texture-sources";
export const BASE = import.meta.env?.BASE_URL ?? "/";
const CURTAIN_TINTS = [0xc1d6d7, 0xc2ccc1, 0xbccbd6] as const;

/** Move only the linear material tint into existing vertex color/AO values. */
export function bakeCurtainFacadeTint(
  geometry: T.BufferGeometry,
  style: number,
) {
  const colors = geometry.getAttribute("color");
  if (!colors || style < 0 || style >= CURTAIN_TINTS.length)
    throw new Error("Curtain tint requires vertex colors and a curtain style");
  const tint = new T.Color(CURTAIN_TINTS[style]);
  for (let i = 0; i < colors.count; i++)
    colors.setXYZ(
      i,
      colors.getX(i) * tint.r,
      colors.getY(i) * tint.g,
      colors.getZ(i) * tint.b,
    );
  colors.needsUpdate = true;
  return geometry;
}

export class Materials {
  animatedUniforms: { value: number }[] = [];
  beacons: {
    material: T.MeshStandardMaterial;
    light: T.PointLight;
    period: number;
  }[] = [];
  loader = new T.TextureLoader();
  private textureSources?: SharedTextureSources;
  asphalt: T.MeshStandardMaterial;
  concrete: T.MeshStandardMaterial;
  grass: T.MeshStandardMaterial;
  stone = new T.MeshStandardMaterial({ color: 0x9b9890, roughness: 0.87 });
  dark = new T.MeshStandardMaterial({
    color: 0x1d2528,
    roughness: 0.55,
    metalness: 0.45,
  });
  white = new T.MeshStandardMaterial({ color: 0xe2e2d8, roughness: 0.55 });
  chrome = new T.MeshStandardMaterial({
    color: 0xabb4b6,
    metalness: 0.85,
    roughness: 0.25,
  });
  bark = new T.MeshStandardMaterial({ color: 0x484239, roughness: 1 });
  glass = new T.MeshPhysicalMaterial({
    color: 0x74969c,
    metalness: 0.55,
    roughness: 0.12,
    clearcoat: 1,
  });
  yellow = new T.MeshStandardMaterial({ color: 0xd9bf6a, roughness: 0.6 });
  facades: T.MeshStandardMaterial[] = [];
  photoFacades: T.MeshStandardMaterial[] = [];
  neonMaterials: {
    material: T.MeshStandardMaterial;
    day: number;
    night: number;
  }[] = [];
  practicalLights: { light: T.PointLight; day: number; night: number }[] = [];
  curtainMaps?: Record<string, T.Texture>;
  private sharedCurtainFacade?: T.MeshPhysicalMaterial;
  roof = new T.MeshStandardMaterial({ color: 0x647276, roughness: 0.8 });
  constructor() {
    this.asphalt = this.pbr("asphalt_02", 0x92999b, 0.48);
    this.asphalt.normalScale.set(0.42, 0.42);
    this.asphalt.metalness = 0.12;
    this.concrete = this.pbr("concrete_pavement", 0xb4b0a7, 0.84);
    this.grass = this.pbr("aerial_grass_rock", 0x688052, 0.97);
    for (let i = 0; i < 12; i++)
      this.facades.push(i < 3 ? this.curtainFacade() : this.facade(i));
    const photos: [string, number, number][] = [
      ["palms-arches", 10, 4.5],
      ["palms-sash", 10, 3.8],
      ["vogue-heritage", 10, 13],
      ["gastown-arches", 15, 6],
      ["gastown-lofts", 16, 13],
    ];
    for (const [id, w, h] of photos) {
      const map = this.texture(`vancouver/${id}.webp`, true),
        rough = this.texture(`vancouver/${id}-roughness.webp`);
      map.repeat.set(24 / w, 51.2 / h);
      rough.repeat.copy(map.repeat);
      this.photoFacades.push(
        new T.MeshStandardMaterial({
          map,
          roughnessMap: rough,
          bumpMap: rough,
          bumpScale: 0.08,
          roughness: 0.94,
          metalness: 0.13,
          vertexColors: true,
          side: T.DoubleSide,
        }),
      );
    }
  }
  texture(name: string, color = false) {
    this.textureSources ??= new SharedTextureSources(this.loader);
    const t = this.textureSources.texture(`${BASE}textures/${name}`);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  pbr(id: string, color: number, roughness: number) {
    return new T.MeshStandardMaterial({
      color,
      map: this.texture(`${id}-color.jpg`, true),
      normalMap: this.texture(`${id}-normal.jpg`),
      roughnessMap: this.texture(`${id}-roughness.jpg`),
      roughness,
      normalScale: new T.Vector2(0.5, 0.5),
    });
  }
  facade(style: number) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 1024;
    const ctx = c.getContext("2d")!;
    const e = document.createElement("canvas");
    e.width = 512;
    e.height = 1024;
    const ec = e.getContext("2d")!;
    ec.fillStyle = "#000";
    ec.fillRect(0, 0, 512, 1024);
    const r = document.createElement("canvas");
    r.width = 512;
    r.height = 1024;
    const rc = r.getContext("2d")!;
    rc.fillStyle = "#dedede";
    rc.fillRect(0, 0, 512, 1024);
    const rand = seeded(110 + style),
      brick = style >= 8,
      curtain = style < 3;
    const bases = [
      "#435c61",
      "#748484",
      "#46565b",
      "#9caaa9",
      "#899088",
      "#a3a09a",
      "#737f83",
      "#bbb7ad",
      "#755b4d",
      "#9b9183",
      "#8e7564",
      "#aca595",
    ];
    ctx.fillStyle = bases[style];
    ctx.fillRect(0, 0, 512, 1024);
    if (brick) {
      for (let row = 0; row < 128; row++)
        for (let col = 0; col < 20; col++) {
          ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.15})`;
          ctx.fillRect(col * 28 - (row % 2) * 14, row * 8, 27, 1);
          ctx.fillStyle = "rgba(218,207,188,.07)";
          ctx.fillRect(col * 28 - (row % 2) * 14, row * 8 + 1, 1, 7);
        }
    }
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 8; col++) {
        const x = col * 64,
          y = row * 64,
          lit = rand() > 0.9;
        const margin = brick ? 12 : curtain ? 1 : style === 5 ? 20 : 7;
        ctx.fillStyle = "#171f22";
        ctx.fillRect(x + margin, y + 5, 64 - margin * 2, 51);
        const grad = ctx.createLinearGradient(x, y, x + 50, y + 58);
        grad.addColorStop(0, lit ? "#968d71" : curtain ? "#5e7b82" : "#536771");
        grad.addColorStop(
          0.5,
          lit ? "#887c62" : curtain ? "#3e555e" : "#34464e",
        );
        grad.addColorStop(1, lit ? "#4c4a3c" : "#1e2e36");
        ctx.fillStyle = grad;
        ctx.fillRect(x + margin + 2, y + 7, 60 - margin * 2, 46);
        if (rand() > 0.45) {
          ctx.fillStyle = "rgba(12,23,27,.25)";
          ctx.fillRect(x + margin + 2, y + 7, 60 - margin * 2, rand() * 32);
        }
        ctx.fillStyle = curtain ? "#788a8c" : "#a9aaa0";
        ctx.fillRect(x, y + 59, 64, curtain ? 2 : 5);
        ctx.fillStyle = "#161f25";
        ctx.fillRect(x + 31, y + 7, 1, 46);
        ctx.fillStyle = "rgba(206,223,223,.25)";
        ctx.fillRect(x + margin + 2, y + 7, 1, 46);
        rc.fillStyle = curtain ? "#404040" : "#606060";
        rc.fillRect(x + margin + 2, y + 7, 60 - margin * 2, 46);
        if (lit) {
          ec.fillStyle = ["#c4b085", "#8c927d", "#c9a476"][
            Math.floor(rand() * 3)
          ];
          ec.fillRect(x + margin + 2, y + 7, 60 - margin * 2, 46);
        }
      }
    const image = ctx.getImageData(0, 0, 512, 1024);
    for (let i = 0; i < image.data.length; i += 4) {
      let d = (rand() - 0.5) * 7;
      image.data[i] += d;
      image.data[i + 1] += d;
      image.data[i + 2] += d;
    }
    ctx.putImageData(image, 0, 0);
    const map = new T.CanvasTexture(c),
      em = new T.CanvasTexture(e),
      rough = new T.CanvasTexture(r);
    map.colorSpace = em.colorSpace = T.SRGBColorSpace;
    for (const t of [map, em, rough]) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8;
    }
    const material = new T.MeshStandardMaterial({
      map,
      roughnessMap: rough,
      bumpMap: rough,
      bumpScale: 0.035,
      emissiveMap: em,
      emissive: 0xffeac5,
      emissiveIntensity: 0.12,
      metalness: brick ? 0.05 : curtain ? 0.65 : 0.24,
      roughness: brick ? 0.95 : 0.75,
    });
    if (brick) {
      const surface = this.texture(
        style === 8 || style === 10
          ? "brick_wall_001-color.jpg"
          : "concrete_tile_facade-color.jpg",
        true,
      );
      material.onBeforeCompile = (shader) => {
        shader.uniforms.surfacePhoto = { value: surface };
        shader.fragmentShader =
          "uniform sampler2D surfacePhoto;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\nfloat masonryMask=smoothstep(.65,.85,texture2D(roughnessMap,vRoughnessMapUv).g);\nvec3 masonry=texture2D(surfacePhoto,vMapUv*vec2(8.,16.)).rgb;\ndiffuseColor.rgb*=mix(vec3(1.),masonry*1.7,masonryMask*.72);",
        );
      };
      material.customProgramCacheKey = () => "photographic-masonry-v1";
    }
    return material;
  }
  curtainFacade() {
    if (this.sharedCurtainFacade) return this.sharedCurtainFacade;
    if (!this.curtainMaps) {
      this.curtainMaps = {};
      for (const key of [
        "color",
        "normalgl",
        "roughness",
        "metalness",
        "emission",
      ]) {
        const texture = this.texture(
          `curtain-wall/${key}.webp`,
          key === "color" || key === "emission",
        );
        texture.repeat.set(24 / 22.4, 51.2 / 25.6);
        this.curtainMaps[key] = texture;
      }
    }
    const maps = this.curtainMaps;
    return (this.sharedCurtainFacade = new T.MeshPhysicalMaterial({
      name: "Detailed curtain wall",
      color: 0xffffff,
      vertexColors: true,
      map: maps.color,
      normalMap: maps.normalgl,
      normalScale: new T.Vector2(0.3, 0.3),
      roughnessMap: maps.roughness,
      metalnessMap: maps.metalness,
      roughness: 0.62,
      metalness: 0.85,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.0,
      emissiveMap: maps.emission,
      emissive: 0xfff1d8,
      emissiveIntensity: 0.02,
    }));
  }
  setNight(n: number) {
    this.facades.forEach(
      (m) =>
        (m.emissiveIntensity =
          (m.name === "Detailed curtain wall" ? 0.02 : 0.12) + n * 0.8),
    );
    for (const light of this.practicalLights)
      light.light.intensity = n > 0.5 ? light.night : light.day;
    for (const neon of this.neonMaterials)
      neon.material.emissiveIntensity = n > 0.5 ? neon.night : neon.day;
  }
}
export function label(
  text: string,
  w = 512,
  h = 128,
  color = "#f1eee2",
  bg = "#14282a",
  size = 54,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2, w - 28);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export function mesh(
  geo: T.BufferGeometry,
  mat: T.Material,
  parent: T.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(
  parent: T.Object3D,
  mat: T.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  return mesh(new T.BoxGeometry(w, h, d), mat, parent, x, y, z);
}
export function beam(
  parent: T.Object3D,
  mat: T.Material,
  a: T.Vector3,
  b: T.Vector3,
  r = 0.12,
  segments = 8,
) {
  const d = b.clone().sub(a);
  const m = mesh(
    new T.CylinderGeometry(r, r, d.length(), segments),
    mat,
    parent,
    ...a.clone().add(b).multiplyScalar(0.5).toArray(),
  );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}
