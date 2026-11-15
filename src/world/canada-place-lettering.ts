import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import data from "./canada-place-concourse-data.json";
import { canadaPlaceConcoursePoint } from "./canada-place-facade";
/** Original hand-authored sans-serif outlines, not a bundled or traced font.
 * Separated words follow independently identified west fascia bays. Sizes and
 * exact mounting stations remain estimates from the registered photographs. */
export const CANADA_PLACE_LETTERING = [
  { text: "PLACE", center: 54, width: 7.4 },
  { text: "CANADA", center: 94.5, width: 8.4 },
];
export const CANADA_PLACE_LETTERING_BASE = 15.58;
export const CANADA_PLACE_LETTERING_HEIGHT = 1.74;
const outlines: Record<string, number[][]> = {
  C: [
    [0.68, 1],
    [0.14, 1],
    [0, 0.85],
    [0, 0.15],
    [0.14, 0],
    [0.68, 0],
    [0.68, 0.17],
    [0.21, 0.17],
    [0.17, 0.22],
    [0.17, 0.78],
    [0.21, 0.83],
    [0.68, 0.83],
  ],
  A: [
    [0, 0],
    [0.22, 1],
    [0.48, 1],
    [0.7, 0],
    [0.52, 0],
    [0.47, 0.25],
    [0.23, 0.25],
    [0.18, 0],
  ],
  N: [
    [0, 0],
    [0, 1],
    [0.18, 1],
    [0.52, 0.3],
    [0.52, 1],
    [0.69, 1],
    [0.69, 0],
    [0.51, 0],
    [0.17, 0.7],
    [0.17, 0],
  ],
  D: [
    [0, 0],
    [0, 1],
    [0.43, 1],
    [0.64, 0.85],
    [0.7, 0.65],
    [0.7, 0.35],
    [0.64, 0.15],
    [0.43, 0],
  ],
  P: [
    [0, 0],
    [0, 1],
    [0.49, 1],
    [0.68, 0.85],
    [0.68, 0.58],
    [0.49, 0.43],
    [0.18, 0.43],
    [0.18, 0],
  ],
  L: [
    [0, 0],
    [0, 1],
    [0.18, 1],
    [0.18, 0.17],
    [0.64, 0.17],
    [0.64, 0],
  ],
  E: [
    [0, 0],
    [0, 1],
    [0.64, 1],
    [0.64, 0.83],
    [0.18, 0.83],
    [0.18, 0.58],
    [0.57, 0.58],
    [0.57, 0.42],
    [0.18, 0.42],
    [0.18, 0.17],
    [0.64, 0.17],
    [0.64, 0],
  ],
};
const holes: Record<string, number[][]> = {
  A: [
    [0.265, 0.42],
    [0.35, 0.83],
    [0.435, 0.42],
  ],
  D: [
    [0.18, 0.18],
    [0.39, 0.18],
    [0.5, 0.27],
    [0.53, 0.39],
    [0.53, 0.61],
    [0.5, 0.73],
    [0.39, 0.82],
    [0.18, 0.82],
  ],
  P: [
    [0.18, 0.6],
    [0.43, 0.6],
    [0.51, 0.66],
    [0.51, 0.77],
    [0.43, 0.83],
    [0.18, 0.83],
  ],
};
function scaleAt(s: number) {
  let i = 1;
  while (i < data.stations.length - 1 && data.stations[i].s < s) i++;
  const a = data.stations[i - 1],
    b = data.stations[i],
    t = (s - a.s) / (b.s - a.s);
  return a.scale + (b.scale - a.scale) * t;
}
export function canadaPlaceLetteringMount(s: number, y: number, depth = 0) {
  return canadaPlaceConcoursePoint(
    s,
    data.profile[17][0] * scaleAt(s) + 0.065 + depth,
    y,
  );
}
export function addCanadaPlaceLettering(parent: T.Object3D) {
  const geometries: T.BufferGeometry[] = [];
  for (const word of CANADA_PLACE_LETTERING) {
    const widths = [...word.text].map((ch) =>
        Math.max(...outlines[ch].map((p) => p[0])),
      ),
      total = widths.reduce((a, b) => a + b, 0) + 0.19 * (widths.length - 1),
      factor = word.width / total;
    let cursor = word.center + word.width / 2;
    for (let i = 0; i < word.text.length; i++) {
      const ch = word.text[i],
        shape = new T.Shape(outlines[ch].map(([x, y]) => new T.Vector2(x, y)));
      if (holes[ch])
        shape.holes.push(
          new T.Path(holes[ch].map(([x, y]) => new T.Vector2(x, y))),
        );
      const g = new T.ExtrudeGeometry(shape, {
          depth: 0.1,
          bevelEnabled: true,
          bevelThickness: 0.008,
          bevelSize: 0.008,
          bevelSegments: 1,
          steps: 1,
          curveSegments: 1,
        }),
        p = g.getAttribute("position");
      // Each original glyph follows the actual changing wall plane, avoiding the
      // floating ends of a single flat word across the tapered northern fascia.
      for (let j = 0; j < p.count; j++) {
        const q = canadaPlaceLetteringMount(
          cursor - p.getX(j) * factor,
          CANADA_PLACE_LETTERING_BASE +
            p.getY(j) * CANADA_PLACE_LETTERING_HEIGHT,
          p.getZ(j),
        );
        p.setXYZ(j, q.x, q.y, q.z);
      }
      // Looking from the west, north is screen-left: text runs from higher
      // to lower station. This also preserves the glyph's right-handed basis.
      g.setIndex(Array.from({ length: p.count }, (_, j) => j));
      g.computeVertexNormals();
      geometries.push(g.toNonIndexed());
      g.dispose();
      for (const [x, y] of ch === "A"
        ? [
            [0.1, 0.15],
            [0.215, 0.75],
          ]
        : [
            [0.08, 0.3],
            [0.08, 0.72],
          ]) {
        const s = cursor - x * factor,
          h = CANADA_PLACE_LETTERING_BASE + y * CANADA_PLACE_LETTERING_HEIGHT;
        const a = canadaPlaceLetteringMount(s, h, -0.064),
          b = canadaPlaceLetteringMount(s, h, -0.004),
          v = b.clone().sub(a);
        const stud = new T.CylinderGeometry(0.025, 0.025, v.length(), 6);
        stud.applyQuaternion(
          new T.Quaternion().setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            v.normalize(),
          ),
        );
        stud.translate(...a.add(b).multiplyScalar(0.5).toArray());
        geometries.push(stud.toNonIndexed());
        stud.dispose();
      }
      cursor -= (widths[i] + 0.19) * factor;
    }
  }
  const geometry = mergeGeometries(geometries, false)!;
  geometries.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  const material = new T.MeshStandardMaterial({
    name: "Canada Place raised identity letters",
    color: 0x29312e,
    roughness: 0.46,
    metalness: 0.32,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Canada Place separated raised lettering";
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
