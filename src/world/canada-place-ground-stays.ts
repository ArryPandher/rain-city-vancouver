import * as T from "three";
import { Batcher } from "./geometry";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import { CANADA_PLACE_GROUND_STAYS } from "./canada-place-ground-stays-data";
/** Ground assemblies only; append to the existing source-local landmark group (+.08Y). */
export function addCanadaPlaceGroundStays(
  parent: T.Object3D,
  concreteMaterial?: T.MeshStandardMaterial,
) {
  const batch = new Batcher(parent, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const concrete =
    concreteMaterial?.clone() ??
    new T.MeshStandardMaterial({ color: 0xc2c4bd, roughness: 0.83 });
  if (concreteMaterial) {
    concrete.onBeforeCompile = concreteMaterial.onBeforeCompile;
    concrete.customProgramCacheKey = concreteMaterial.customProgramCacheKey;
  }
  concrete.name = "Canada Place ground anchor concrete";
  const dark = new T.MeshStandardMaterial({
    name: "Canada Place anchor sockets",
    color: 0x414c49,
    metalness: 0.42,
    roughness: 0.43,
  });
  const cable = new T.MeshStandardMaterial({
    name: "Canada Place ground tension cables",
    color: 0x69736f,
    metalness: 0.72,
    roughness: 0.4,
  });
  // Turned, bevelled fittings stay inside the original collision-tested cylinders.
  // Raised central pin faces are an authored mechanical approximation, not a
  // claim about the unseen fasteners in the historical reference photograph.
  const turned = (
    center: T.Vector3,
    axis: T.Vector3,
    profile: number[][],
    segments = 20,
  ) => {
    const g = new T.LatheGeometry(
      profile.map(([r, y]) => new T.Vector2(r, y)),
      segments,
    );
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        axis.clone().normalize(),
      ),
    );
    g.translate(center.x, center.y, center.z);
    mesh.add(g, dark);
  };
  const barrel = (a: Vertex3, b: Vertex3, r: number) => {
    const p = new T.Vector3(...a),
      q = new T.Vector3(...b),
      axis = q.clone().sub(p),
      half = axis.length() / 2,
      bevel = Math.min(0.024, half * 0.24);
    turned(
      p.add(q).multiplyScalar(0.5),
      axis,
      [
        [0, -half],
        [r * 0.78, -half],
        [r, -half + bevel],
        [r, half - bevel],
        [r * 0.78, half],
        [0, half],
      ],
      16,
    );
  };
  for (const anchor of CANADA_PLACE_GROUND_STAYS) {
    // Chamfered low footing transitions to an inward-leaning rounded shoulder.
    const rings = [
      { y: 7.8, w: 1, d: 1, o: 0 },
      { y: 8.06, w: 1, d: 1, o: 0 },
      { y: 9.98, w: 0.78, d: 0.31, o: -0.1 },
      { y: 10.25, w: 0.6, d: 0.2, o: -0.18 },
    ].map((r) =>
      anchor.perimeter.map(([a, o]) =>
        anchor.point(a * r.w, o * r.d + r.o, r.y),
      ),
    );
    const positions: number[] = [],
      indices: number[] = [];
    function quad(a: Vertex3, b: Vertex3, c: Vertex3, d: Vertex3) {
      const n = positions.length / 3;
      positions.push(...a, ...b, ...c, ...d);
      indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    // Perimeter runs clockwise as seen from above in XZ: reverse side order
    // based on its actual world orientation, independent of chosen tangent.
    const signed = anchor.localFootprint.reduce(
      (s, x, i, p) =>
        i % 2
          ? s
          : s + x * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1],
      0,
    );
    for (let k = 1; k < rings.length; k++)
      for (let j = 0; j < 8; j++) {
        const n = (j + 1) % 8;
        if (signed > 0)
          quad(rings[k - 1][j], rings[k][j], rings[k][n], rings[k - 1][n]);
        else quad(rings[k - 1][n], rings[k][n], rings[k][j], rings[k - 1][j]);
      }
    const top = rings.at(-1)!;
    const cap = T.ShapeUtils.triangulateShape(
      top.map((p) => new T.Vector2(p[0], p[2])),
      [],
    );
    for (const tri of cap) {
      const v = tri.map((i) => top[i]);
      const cross = new T.Vector3().crossVectors(
        new T.Vector3(...v[1]).sub(new T.Vector3(...v[0])),
        new T.Vector3(...v[2]).sub(new T.Vector3(...v[0])),
      );
      if (cross.y < 0) [v[1], v[2]] = [v[2], v[1]];
      const n = positions.length / 3;
      positions.push(...v.flat());
      indices.push(n, n + 1, n + 2);
    }
    const body = new T.BufferGeometry();
    body.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    body.setIndex(indices);
    body.computeVertexNormals();
    const normals = body.getAttribute("normal"),
      uv: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const n = new T.Vector3(
        normals.getX(i / 3),
        normals.getY(i / 3),
        normals.getZ(i / 3),
      );
      const u =
        Math.abs(n.y) > 0.98
          ? new T.Vector3(1, 0, 0)
          : new T.Vector3(n.z, 0, -n.x).normalize();
      const v = new T.Vector3().crossVectors(n, u).normalize();
      const p = new T.Vector3(positions[i], positions[i + 1], positions[i + 2]);
      uv.push(p.dot(u), p.dot(v));
    }
    body.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    mesh.add(body, concrete);
    for (const stay of anchor.stays) {
      const start = new T.Vector3(...stay.bottom),
        end = new T.Vector3(...stay.top),
        direction = end.clone().sub(start).normalize();
      const along = (d: number) =>
        start.clone().addScaledVector(direction, d).toArray() as Vertex3;
      // Transverse trunnion, clevis socket, barrel, collars and exposed rod.
      const axle = anchor.tangent;
      turned(start, new T.Vector3(axle[0], 0, axle[1]), [
        [0, -0.22],
        [0.065, -0.22],
        [0.08, -0.21],
        [0.08, -0.199],
        [0.185, -0.199],
        [0.221, -0.175],
        [0.23, -0.145],
        [0.23, 0.145],
        [0.221, 0.175],
        [0.185, 0.199],
        [0.08, 0.199],
        [0.08, 0.21],
        [0.065, 0.22],
        [0, 0.22],
      ]);
      barrel(along(-0.15), along(0.65), 0.125);
      barrel(along(0.55), along(1.48), 0.087);
      for (const d of [0.6, 1.38])
        barrel(along(d - 0.055), along(d + 0.055), 0.13);
      mesh.beam(along(1.46), stay.top, 0.038, cable, 8);
      mesh.beam(
        end.clone().addScaledVector(direction, -0.3).toArray() as Vertex3,
        stay.top,
        0.083,
        dark,
        16,
      );
      // Socket support cheek physically meets the sloped concrete shoulder.
      mesh.beam(
        anchor.point(
          (start.x - anchor.center[0]) * axle[0] +
            (start.z - anchor.center[1]) * axle[1],
          -0.55,
          9.8,
        ),
        stay.bottom,
        0.15,
        dark,
        16,
      );
    }
  }
  mesh.finish();
  const chunks = batch.finish();
  for (const c of chunks)
    c.name =
      c.material instanceof T.Material
        ? c.material.name
        : "Canada Place ground stay";
  return chunks;
}
