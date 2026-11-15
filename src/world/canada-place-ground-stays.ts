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
    // Keep the eight-corner footing exact. Only the upper protective body rolls
    // into a rounded shoulder, following the photograph/section rather than a
    // stack of decorative bands. The quadratic roll ends tangent to the top.
    const positions: number[] = [],
      indices: number[] = [];
    const signed = anchor.localFootprint.reduce(
      (sum, x, i, p) =>
        i % 2
          ? sum
          : sum + x * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1],
      0,
    );
    const face = (a: number, b: number, c: number, d: number) => {
      if (signed > 0) indices.push(a, b, c, a, c, d);
      else indices.push(d, c, b, d, b, a);
    };
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8,
        a = anchor.perimeter[j],
        b = anchor.perimeter[k],
        n = positions.length / 3;
      positions.push(
        ...anchor.point(a[0], a[1], 7.8),
        ...anchor.point(a[0], a[1], 8.06),
        ...anchor.point(b[0], b[1], 8.06),
        ...anchor.point(b[0], b[1], 7.8),
      );
      face(n, n + 1, n + 2, n + 3);
    }
    const outline = new T.CatmullRomCurve3(
      anchor.perimeter.map(([a, o]) => new T.Vector3(a, 0, o)),
      true,
      "centripetal",
    );
    const profiles = [
      { y: 8.06, w: 1, d: 1, o: 0, round: 0 },
      { y: 9.72, w: 0.83, d: 0.41, o: -0.06, round: 1 },
    ];
    for (let j = 1; j <= 5; j++) {
      const t = j / 5,
        u = 1 - t;
      const bez = (a: number, b: number, c: number) =>
        u * u * a + 2 * u * t * b + t * t * c;
      profiles.push({
        y: bez(9.72, 10.25, 10.25),
        w: bez(0.83, 0.79, 0.6),
        d: bez(0.41, 0.36, 0.2),
        o: bez(-0.06, -0.06, -0.18),
        round: 1,
      });
    }
    const count = 24,
      start = positions.length / 3;
    for (const p of profiles)
      for (let j = 0; j < count; j++) {
        const edge = Math.floor(j / 3),
          t = (j % 3) / 3,
          a = anchor.perimeter[edge],
          b = anchor.perimeter[(edge + 1) % 8];
        const linear = new T.Vector3(
            a[0] + (b[0] - a[0]) * t,
            0,
            a[1] + (b[1] - a[1]) * t,
          ),
          rounded = outline.getPoint(j / count);
        const q = linear.lerp(rounded, p.round);
        positions.push(...anchor.point(q.x * p.w, q.z * p.d + p.o, p.y));
      }
    for (let k = 1; k < profiles.length; k++)
      for (let j = 0; j < count; j++) {
        const n = (j + 1) % count;
        face(
          start + (k - 1) * count + j,
          start + k * count + j,
          start + k * count + n,
          start + (k - 1) * count + n,
        );
      }
    const topStart = start + (profiles.length - 1) * count;
    const top = Array.from(
      { length: count },
      (_, j) =>
        new T.Vector2(
          positions[(topStart + j) * 3],
          positions[(topStart + j) * 3 + 2],
        ),
    );
    for (const tri of T.ShapeUtils.triangulateShape(top, [])) {
      const ids = tri.map((i) => topStart + i),
        a = new T.Vector3().fromArray(positions, ids[0] * 3),
        b = new T.Vector3().fromArray(positions, ids[1] * 3),
        c = new T.Vector3().fromArray(positions, ids[2] * 3);
      if (b.sub(a).cross(c.sub(a)).y < 0) [ids[1], ids[2]] = [ids[2], ids[1]];
      indices.push(...ids);
    }
    const body = new T.BufferGeometry();
    body.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    body.setIndex(indices);
    body.computeVertexNormals();
    const shoulderNormals = body.getAttribute("normal");
    for (let j = 0; j < count; j++)
      shoulderNormals.setXYZ(topStart + j, 0, 1, 0);
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
      // Keep the curved-surface UV projection local: rotating its tangent
      // around large source coordinates would sweep metres of texture.
      const p = new T.Vector3(
        positions[i] - anchor.center[0],
        positions[i + 1] - 7.8,
        positions[i + 2] - anchor.center[1],
      );
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
