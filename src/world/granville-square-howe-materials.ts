import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

/** Existing CC0 mineral maps, with metre UVs supplied by every concrete face.
 * This is an exposed-aggregate approximation, not a photographed façade atlas. */
export const GRANVILLE_HOWE_MINERAL_REPEAT_METRES = 1.6;

/** Diffuse view factor of the unobstructed rectangular window mouth. The
 * spherical-polygon edge integral is cosine weighted, unlike solid angle alone.
 * Coordinates are opening-local: x across, y up, z into the recess. */
export function granvilleHoweApertureVisibility(
  width: number,
  height: number,
  point: T.Vector3,
  normal: T.Vector3,
) {
  const corners = [
    [0, 0, 0],
    [width, 0, 0],
    [width, height, 0],
    [0, height, 0],
  ].map((p) => new T.Vector3(...p).sub(point).normalize());
  const integral = new T.Vector3();
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    const cross = new T.Vector3().crossVectors(a, b),
      length = cross.length();
    if (length > 1e-12)
      integral.addScaledVector(cross, Math.atan2(length, a.dot(b)) / length);
  }
  return T.MathUtils.clamp(
    Math.abs(integral.dot(normal)) / (2 * Math.PI),
    0,
    1,
  );
}

const AO_SIZE = 128,
  AO_TILE = 18,
  AO_SAMPLES = 16;
type CavityAtlas = {
  map: T.DataTexture;
  tiles: Map<string, [number, number]>;
};
const cavityAtlases = new WeakMap<T.Material, CavityAtlas>();

function createCavityAtlas(): CavityAtlas {
  const map = new T.DataTexture(
    new Uint8Array(AO_SIZE * AO_SIZE).fill(255),
    AO_SIZE,
    AO_SIZE,
    T.RedFormat,
  );
  map.name = "Granville Howe opening aperture visibility";
  map.channel = 1;
  map.colorSpace = T.NoColorSpace;
  map.minFilter = map.magFilter = T.LinearFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  return { map, tiles: new Map() };
}

/** UV1 atlas corners in the original reveal-quad winding. Each actual opening
 * section gets a jamb tile and a sill/head tile; the single-pixel border repeats
 * edge samples. The white texel at (0,0) is reserved for all exterior concrete.
 * No source photograph, dirt, baked sunlight or metric material UV is involved. */
export function granvilleHoweCavityUVs(
  material: T.Material,
  width: number,
  height: number,
  depth: number,
  face: "jamb" | "horizontal",
) {
  const atlas = cavityAtlases.get(material);
  if (!atlas) throw new Error("Granville Howe concrete has no cavity atlas");
  const key = [width, height, depth].map((v) => v.toFixed(6)).join("/");
  let tiles = atlas.tiles.get(key);
  if (!tiles) {
    const first = 1 + atlas.tiles.size * 2;
    if (first + 1 >= Math.floor(AO_SIZE / AO_TILE) ** 2)
      throw new Error("Granville Howe cavity atlas is full");
    tiles = [first, first + 1];
    atlas.tiles.set(key, tiles);
    for (let kind = 0; kind < 2; kind++) {
      const tile = tiles[kind],
        x = (tile % 7) * AO_TILE,
        y = Math.floor(tile / 7) * AO_TILE;
      for (let j = 0; j < AO_TILE; j++)
        for (let i = 0; i < AO_TILE; i++) {
          // Avoid coincident corner vectors at the aperture edge; use the limit
          // from just inside the opening, not an arbitrary cavity-darkening curve.
          const d =
            T.MathUtils.clamp((i - 1) / (AO_SAMPLES - 1), 0.00001, 1) * depth;
          const t = T.MathUtils.clamp(
            (j - 1) / (AO_SAMPLES - 1),
            0.00001,
            0.99999,
          );
          const point =
            kind === 0
              ? new T.Vector3(0, t * height, d)
              : new T.Vector3(t * width, 0, d);
          const normal =
            kind === 0 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
          atlas.map.image.data![(y + j) * AO_SIZE + x + i] = Math.round(
            255 * granvilleHoweApertureVisibility(width, height, point, normal),
          );
        }
    }
    atlas.map.needsUpdate = true;
  }
  const tile = tiles[face === "jamb" ? 0 : 1];
  const x = ((tile % 7) * AO_TILE + 1.5) / AO_SIZE,
    y = (Math.floor(tile / 7) * AO_TILE + 1.5) / AO_SIZE,
    size = (AO_SAMPLES - 1) / AO_SIZE;
  return face === "jamb"
    ? [x, y, x + size, y, x + size, y + size, x, y + size]
    : [x, y, x, y + size, x + size, y + size, x + size, y];
}

export function createGranvilleHoweMaterials(
  library: Pick<Materials, "texture">,
  signMap?: T.Texture,
) {
  const texture = (name: string, color: boolean) => {
    const map = library
      .texture(`canada-place-plinth/${name}.webp`, color)
      .clone();
    map.name = `Granville Square Howe mineral ${name}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.repeat.setScalar(1 / GRANVILLE_HOWE_MINERAL_REPEAT_METRES);
    map.updateMatrix();
    return map;
  };
  const cavity = createCavityAtlas();
  const concrete = new T.MeshStandardMaterial({
    name: "Granville Square Howe exposed concrete",
    color: 0xb5b1a4,
    map: texture("color", true),
    normalMap: texture("normal", false),
    roughnessMap: texture("roughness", false),
    normalScale: new T.Vector2(0.13, 0.13),
    metalness: 0,
    roughness: 0.91,
    // Three's AO path attenuates only indirect diffuse and uses its own
    // roughness-aware specular occlusion; direct sun/shadows stay untouched.
    aoMap: cavity.map,
    aoMapIntensity: 1,
  });
  cavityAtlases.set(concrete, cavity);
  return {
    concrete,
    // The photographed ribbons are dark glazed recesses, not pale metal panels.
    // Use the existing untinted dielectric slab over the unchanged dark closure:
    // IOR 1.5, roughness .12 and two interfaces, without a diffuse paint lobe or
    // clearcoat. Throughput is an exterior fit, not a measured glass specification.
    glass: createExteriorLobbyGlass(
      "Granville Square Howe recessed dielectric glazing",
      0.82,
      2,
    ),
    frame: new T.MeshStandardMaterial({
      name: "Granville Square Howe dark anodized frames and joints",
      color: 0x353b3b,
      metalness: 0.35,
      roughness: 0.48,
    }),
    sign: new T.MeshStandardMaterial({
      name: "Granville Square Howe pale sign panels",
      color: 0xb8c2c5,
      metalness: 0,
      roughness: 0.52,
    }),
    lettering: new T.MeshStandardMaterial({
      name: "Granville Square Howe identification letters",
      color: 0x373f42,
      map: signMap ?? null,
      alphaTest: 0.5,
      roughness: 0.8,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Granville Square Howe roof membrane",
      color: 0x747873,
      metalness: 0,
      roughness: 0.95,
    }),
  };
}
export type GranvilleHoweMaterials = ReturnType<
  typeof createGranvilleHoweMaterials
>;

/** Transparent typographic mask for the name visible in the source photo only.
 * Generated locally; no source photograph or downloaded runtime asset. */
export function createGranvilleHoweSignMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.font = "600 130px Arial, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("Granville", 28, 110);
  context.fillText("Square", 28, 263);
  const map = new T.CanvasTexture(canvas);
  map.name = "Granville Square source-supported name mask";
  map.colorSpace = T.SRGBColorSpace;
  return map;
}
