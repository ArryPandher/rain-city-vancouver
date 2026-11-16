import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import { GALLERY_PORTICO } from "./gallery-portico-data";

/** Source-local rear elevation before the gallery's single baked rotation.
 * Exact source contact, with estimated profile sections from the two cited photos. */
export const GALLERY_ENTRY_CORNICE = {
  centreU: -1.9,
  width: 18.1,
  spring: 14.05,
  rise: 2.7,
  // The repaired source face is v23.859..23.861. Back intersects it by 19mm.
  backV: 23.84,
  sourceFrontV: 23.86,
  // Normal offsets into the triangle; depth is toward the public rear (+v).
  rakeProfile: [
    [0, 24.015],
    [0.07, 24.3],
    [0.16, 24.3],
    [0.21, 24.12],
    [0.29, 24.12],
    [0.36, 23.84],
  ] as const,
  corniceWidth: 17.9,
  // [v,y] perimeter, closed by the extrusion. All visible surfaces are in
  // front of the retained source cornice's exact maximum v24.05063.
  corniceProfile: [
    [22.84, GALLERY_PORTICO.entablatureBottom],
    [24.1, GALLERY_PORTICO.entablatureBottom],
    [24.1, 12.2],
    [24.02, 12.2],
    [24.02, 12.33],
    [23.95, 12.33],
    [23.95, 12.55],
    [24.03, 12.55],
    [24.03, 12.64],
    [23.92, 12.64],
    [23.92, 13.48],
    [24.1, 13.48],
    [24.1, 13.59],
    [24.075, 13.63],
    [24.075, 13.87],
    [24.24, 13.87],
    [24.34, 13.93],
    [24.34, 14.05],
    [22.84, 14.05],
  ] as const,
  dentilCount: 39,
  dentilPitch: 0.45,
  dentilWidth: 0.23,
  dentilBottom: 13.65,
  dentilTop: 13.89,
  dentilBackV: 24.045,
  dentilFrontV: 24.25,
} as const;

/** Inset all three planes by a physical perpendicular distance, so the
 * shallow raking members have a mitred apex rather than overlapping boxes. */
export function galleryPedimentRing(inset: number, v: number): Vertex3[] {
  const d = GALLERY_ENTRY_CORNICE,
    half = d.width / 2,
    slope = d.rise / half,
    offsetY = inset * Math.hypot(1, slope),
    top = d.spring + d.rise - offsetY,
    bottom = d.spring + inset,
    innerHalf = (top - bottom) / slope;
  return [
    [d.centreU - innerHalf, bottom, v],
    [d.centreU + innerHalf, bottom, v],
    [d.centreU, top, v],
  ];
}

/** Added to the existing shared stone batch. Retained source closes the
 * tympanum; this added profile itself is closed, including its back and ends. */
export function addGalleryEntryCornice(
  mesh: ArchitecturalMesh,
  stone: T.Material,
) {
  const d = GALLERY_ENTRY_CORNICE,
    rings = [
      galleryPedimentRing(0, d.backV),
      ...d.rakeProfile.map(([inset, v]) => galleryPedimentRing(inset, v)),
    ];
  for (let layer = 1; layer < rings.length; layer++) {
    const outer = rings[layer - 1],
      inner = rings[layer];
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      mesh.quad(stone, outer[i], outer[next], inner[next], inner[i]);
    }
  }
  // Back of the annular solid. Reversed winding faces the retained source.
  const outer = rings[0],
    inner = rings[rings.length - 1];
  for (let i = 0; i < 3; i++) {
    const next = (i + 1) % 3;
    mesh.quad(stone, outer[next], outer[i], inner[i], inner[next]);
  }

  // Extrude the closed stepped y/v section along u. No separate coplanar
  // strips, exposed end gaps or per-profile materials.
  const shape = new T.Shape(
    d.corniceProfile.map(([v, y]) => new T.Vector2(-v, y)),
  );
  const cornice = new T.ExtrudeGeometry(shape, {
    depth: d.corniceWidth,
    bevelEnabled: false,
    steps: 1,
  });
  cornice.rotateY(Math.PI / 2);
  cornice.translate(d.centreU - d.corniceWidth / 2, 0, 0);
  mesh.add(cornice, stone);
  for (let i = 0; i < d.dentilCount; i++)
    mesh.box(
      [
        d.centreU + (i - (d.dentilCount - 1) / 2) * d.dentilPitch,
        (d.dentilBottom + d.dentilTop) / 2,
        (d.dentilBackV + d.dentilFrontV) / 2,
      ],
      d.dentilWidth,
      d.dentilTop - d.dentilBottom,
      d.dentilFrontV - d.dentilBackV,
      stone,
    );
}
