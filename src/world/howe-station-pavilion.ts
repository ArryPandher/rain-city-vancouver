import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import type { Batcher } from "./geometry";
import type { Point } from "./data";
import type { HoweStationPavilionMaterials } from "./howe-station-pavilion-materials";

export interface HoweStationPavilionSpec {
  /** World x/z at the FRONT ROOF END centre, not the inboard mapped stair node. */
  origin: Point;
  /** Horizontal direction from front gable toward descending stairs; normalized here. */
  axis: Point;
  length: number;
  width: number;
  /** World elevation. All other vertical dimensions below are relative to it. */
  landingHeight: number;
  /** World ground finish elevation, used only for exterior base closure. */
  groundHeight?: (x: number, z: number) => number;
  stairStart?: number;
  stairDrop?: number;
  springHeight?: number;
  roofRise?: number;
}

/** Geometry proportions are explicit photo-fit estimates; source registration,
 * street datum and stair drop belong to the caller. No underground route. */
export function howeStationPavilionLayout(spec: HoweStationPavilionSpec) {
  const { origin, length, width, landingHeight } = spec;
  const magnitude = Math.hypot(...spec.axis);
  const stairStart = spec.stairStart ?? 2.6,
    stairDrop = spec.stairDrop ?? 3.4,
    springHeight = spec.springHeight ?? 2.65,
    roofRise = spec.roofRise ?? width * 0.28;
  if (
    ![
      ...origin,
      ...spec.axis,
      length,
      width,
      landingHeight,
      stairStart,
      stairDrop,
      springHeight,
      roofRise,
    ].every(Number.isFinite) ||
    magnitude < 1e-6 ||
    width < 2 ||
    length < 5 ||
    length > 30 ||
    width > 10 ||
    stairStart < 0.6 ||
    stairStart >= length - 1 ||
    stairDrop <= 0 ||
    stairDrop > 8 ||
    springHeight < 2 ||
    roofRise < 0.4
  )
    throw new Error("Invalid Howe station pavilion dimensions");
  const axis: Point = [spec.axis[0] / magnitude, spec.axis[1] / magnitude],
    right: Point = [axis[1], -axis[0]],
    radius = width / 2,
    inner = radius - 0.23,
    baseTop = 0.48,
    bottom = -stairDrop - 0.18,
    stairWidth = width - 0.9,
    steps = Math.ceil(stairDrop / 0.17),
    run = Math.min(steps * 0.31, length - stairStart - 0.45),
    tread = run / steps,
    riser = stairDrop / steps,
    ribs = Math.max(3, Math.round(length / 0.95)),
    p = (v: number, y: number, u: number): Vertex3 => [
      origin[0] + right[0] * v + axis[0] * u,
      landingHeight + y,
      origin[1] + right[1] * v + axis[1] * u,
    ],
    polygon = (half: number, start: number, end: number): Point[] =>
      [
        [-half, start],
        [half, start],
        [half, end],
        [-half, end],
      ].map(([v, u]) => {
        const q = p(v, 0, u);
        return [q[0], q[2]];
      }),
    ground = (v: number, u: number) => {
      const q = p(v, 0, u);
      const y =
        (spec.groundHeight?.(q[0], q[2]) ?? landingHeight) -
        landingHeight -
        0.025;
      if (!Number.isFinite(y) || y >= baseTop - 0.025)
        throw new Error(
          "Pavilion landing/base must clear its supplied ground finish",
        );
      return y;
    };
  if (tread < 0.24)
    throw new Error("Stair drop does not fit the available pavilion run");
  return {
    ...spec,
    axis,
    right,
    radius,
    inner,
    baseTop,
    bottom,
    stairStart,
    stairDrop,
    stairWidth,
    steps,
    run,
    tread,
    riser,
    ribs,
    springHeight,
    roofRise,
    p,
    ground,
    footprint: polygon(radius + 0.05, -0.05, length + 0.05),
    /** Root must exclude pavement from this polygon to reveal the stairs. */
    excavation: polygon(inner, stairStart, length - 0.23),
    /** Pavilion owns its landing as well as its open well: no coplanar paving. */
    surfaceCutout: polygon(inner, 0, length - 0.23),
    landing: polygon(inner, 0, stairStart),
    /** Front glass is visually and physically closed until lower support is verified. */
    closedEntry: [polygon(inner, 0, 0.1)[0], polygon(inner, 0, 0.1)[1]] as [
      Point,
      Point,
    ],
    minY: landingHeight + bottom,
    maxY: landingHeight + springHeight + roofRise + 0.045,
    closedToGameplay: true as const,
  };
}
export type HoweStationPavilionLayout = ReturnType<
  typeof howeStationPavilionLayout
>;

/** Complete exterior kit in seven material groups. Convex, outward-only glazing
 * provides one stable dielectric layer from outside; no opaque glass backing,
 * double-alpha blend, transmission render, or stacked coplanar panes. The closed
 * stairwell is visual only. All world elevations survive nonzero Batcher datums. */
export function buildHoweStationPavilion(
  batch: Batcher,
  spec: HoweStationPavilionSpec,
  m: HoweStationPavilionMaterials,
) {
  const s = howeStationPavilionLayout(spec),
    mesh = new ArchitecturalMesh(batch, ...s.origin),
    yaw = Math.atan2(s.axis[0], s.axis[1]),
    p = (v: number, y: number, u: number): Vertex3 => {
      const q = s.p(v, y, u);
      q[1] -= batch.offsetY;
      return q;
    },
    normal = (n: Vertex3): Vertex3 => [
      s.right[0] * n[0] + s.axis[0] * n[2],
      n[1],
      s.right[1] * n[0] + s.axis[1] * n[2],
    ];
  const quad = (material: T.Material, points: Vertex3[], outward: Vertex3) => {
    const n = new T.Vector3(...normal(outward));
    const world = points.map(([v, y, u]) => p(v, y, u));
    const cross = new T.Vector3(...world[1])
      .sub(new T.Vector3(...world[0]))
      .cross(new T.Vector3(...world[2]).sub(new T.Vector3(...world[0])));
    if (cross.dot(n) < 0) [world[1], world[3]] = [world[3], world[1]];
    const w = new T.Vector3(...world[0]).distanceTo(new T.Vector3(...world[1])),
      h = new T.Vector3(...world[0]).distanceTo(new T.Vector3(...world[3]));
    mesh.quad(material, world[0], world[1], world[2], world[3], [
      0,
      0,
      w,
      0,
      w,
      h,
      0,
      h,
    ]);
  };
  const box = (
    v: number,
    y: number,
    u: number,
    w: number,
    h: number,
    d: number,
    material: T.Material,
  ) => mesh.box(p(v, y, u), w, h, d, material, yaw);
  const beam = (a: Vertex3, b: Vertex3, radius = 0.025) =>
    mesh.beam(p(...a), p(...b), radius, m.metal, 10);
  const horizontal = (
    v0: number,
    v1: number,
    u0: number,
    u1: number,
    y: number,
    material: T.Material,
    up = true,
  ) =>
    quad(
      material,
      [
        [v0, y, u0],
        [v1, y, u0],
        [v1, y, u1],
        [v0, y, u1],
      ],
      [0, up ? 1 : -1, 0],
    );

  // Photo-fit coping section: a narrow recessed bed joint distinguishes the
  // cap from the low mineral wall. This replaces the face, never overlays it.
  const baseFace = (a: Point, b: Point, outward: Point) => {
    const ga = s.ground(...a),
      gb = s.ground(...b),
      low = s.baseTop - 0.078,
      high = low + 0.012,
      inset = (q: Point): Point => [
        q[0] - outward[0] * 0.008,
        q[1] - outward[1] * 0.008,
      ],
      ai = inset(a),
      bi = inset(b),
      at = (q: Point, y: number): Vertex3 => [q[0], y, q[1]],
      n: Vertex3 = [outward[0], 0, outward[1]];
    if (Math.max(ga, gb) >= low) {
      quad(
        m.stone,
        [at(a, ga), at(b, gb), at(b, s.baseTop), at(a, s.baseTop)],
        n,
      );
      return;
    }
    quad(m.stone, [at(a, ga), at(b, gb), at(b, low), at(a, low)], n);
    quad(m.lining, [at(ai, low), at(bi, low), at(bi, high), at(ai, high)], n);
    quad(
      m.stone,
      [at(a, low), at(b, low), at(bi, low), at(ai, low)],
      [0, 1, 0],
    );
    quad(
      m.stone,
      [at(a, high), at(b, high), at(bi, high), at(ai, high)],
      [0, -1, 0],
    );
    quad(
      m.stone,
      [at(a, high), at(b, high), at(b, s.baseTop), at(a, s.baseTop)],
      n,
    );
  };

  // Outer base meets the supplied ground; inner faces close the actual well.
  // Split the long edges so grade curvature cannot leave a floating straight base.
  const baseSides = Math.ceil(s.length / 0.5);
  for (const side of [-1, 1]) {
    const v = side * s.radius,
      inner = side * s.inner;
    for (let i = 0; i < baseSides; i++) {
      const a = (s.length * i) / baseSides,
        b = (s.length * (i + 1)) / baseSides;
      baseFace([v, a], [v, b], [side, 0]);
      horizontal(
        Math.min(v, inner),
        Math.max(v, inner),
        a,
        b,
        s.baseTop,
        m.stone,
      );
      quad(
        m.lining,
        [
          [inner, s.bottom, a],
          [inner, s.bottom, b],
          [inner, s.baseTop, b],
          [inner, s.baseTop, a],
        ],
        [-side, 0, 0],
      );
    }
  }
  for (const [u, inward] of [
    [0, 1],
    [s.length, -1],
  ]) {
    const entranceHalf = s.stairWidth / 2;
    const spans =
      u === 0
        ? [
            [-s.radius, -entranceHalf],
            [entranceHalf, s.radius],
          ]
        : [[-s.radius, s.radius]];
    for (const [a, b] of spans) {
      baseFace([a, u], [b, u], [0, -inward]);
      horizontal(
        a,
        b,
        u === 0 ? 0 : s.length - 0.23,
        u === 0 ? 0.23 : s.length,
        s.baseTop,
        m.stone,
      );
    }
    const innerU = u === 0 ? 0.23 : s.length - 0.23;
    quad(
      m.lining,
      [
        [-s.inner, s.bottom, innerU],
        [s.inner, s.bottom, innerU],
        [s.inner, u === 0 ? 0 : s.baseTop, innerU],
        [-s.inner, u === 0 ? 0 : s.baseTop, innerU],
      ],
      [0, 0, inward],
    );
  }
  horizontal(-s.inner, s.inner, 0, s.stairStart, 0, m.stone);
  horizontal(-s.inner, s.inner, 0, s.length, s.bottom, m.lining, false);

  // Real tread/riser geometry and a sealed lower landing; no ramp texture.
  for (let step = 0; step < s.steps; step++) {
    const front = s.stairStart + step * s.tread,
      back = front + s.tread,
      top = -(step + 1) * s.riser,
      previous = -step * s.riser;
    horizontal(-s.stairWidth / 2, s.stairWidth / 2, front, back, top, m.stone);
    quad(
      m.lining,
      [
        [-s.stairWidth / 2, top, front],
        [s.stairWidth / 2, top, front],
        [s.stairWidth / 2, previous, front],
        [-s.stairWidth / 2, previous, front],
      ],
      [0, 0, -1],
    );
  }
  horizontal(
    -s.inner,
    s.inner,
    s.stairStart + s.run,
    s.length - 0.23,
    -s.stairDrop,
    m.stone,
  );
  for (const side of [-1, 1]) {
    const v = (side * s.stairWidth) / 2;
    quad(
      m.lining,
      [
        [v, s.bottom, s.stairStart],
        [v, s.bottom, s.stairStart + s.run],
        [v, -s.stairDrop, s.stairStart + s.run],
        [v, 0, s.stairStart],
      ],
      [-side, 0, 0],
    );
    quad(
      m.stone,
      [
        [v, 0, s.stairStart],
        [side * s.inner, 0, s.stairStart],
        [side * s.inner, -s.stairDrop, s.stairStart + s.run],
        [v, -s.stairDrop, s.stairStart + s.run],
      ],
      [0, 1, 0],
    );
    const railV = v - side * 0.16;
    beam([railV, 0.94, 0.45], [railV, 0.94, s.stairStart]);
    beam(
      [railV, 0.94, s.stairStart],
      [railV, 0.94 - s.stairDrop, s.stairStart + s.run],
    );
    beam(
      [railV, 0.94 - s.stairDrop, s.stairStart + s.run],
      [railV, 0.94 - s.stairDrop, s.length - 0.35],
    );
    for (let step = 0; step < s.steps; step += 4) {
      const u = s.stairStart + (step + 0.5) * s.tread,
        floor = -(step + 1) * s.riser,
        top = 0.94 - (step + 0.5) * s.riser;
      beam([railV, floor - 0.02, u], [railV, top, u], 0.022);
    }
  }

  // The photograph resolves a strong perimeter arch and finer intermediate
  // glazing caps. Keep the approximate bay spacing; section sizes are photo-fit
  // estimates. Every silver section remains a capped, closed solid.
  const segments = 24;
  for (let rib = 0; rib <= s.ribs; rib++) {
    const u = (s.length * rib) / s.ribs,
      end = rib === 0 || rib === s.ribs,
      thickness = end ? 0.045 : 0.0275,
      depth = end ? 0.08 : 0.045,
      sealHalf = depth / 2 + 0.01,
      sealStart = Math.max(0, u - sealHalf),
      sealEnd = Math.min(s.length, u + sealHalf);
    const shape = new T.Shape();
    for (let j = 0; j <= segments; j++) {
      const angle = (Math.PI * j) / segments,
        v = -(s.radius + thickness) * Math.cos(angle),
        y = s.springHeight + (s.roofRise + thickness) * Math.sin(angle);
      if (!j) shape.moveTo(v, y);
      else shape.lineTo(v, y);
    }
    for (let j = segments; j >= 0; j--) {
      const angle = (Math.PI * j) / segments;
      shape.lineTo(
        -(s.radius - thickness) * Math.cos(angle),
        s.springHeight + (s.roofRise - thickness) * Math.sin(angle),
      );
    }
    shape.closePath();
    const arch = new T.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      steps: 1,
    });
    arch.translate(0, 0, u - depth / 2);
    arch.rotateY(yaw);
    arch.translate(s.origin[0], s.landingHeight - batch.offsetY, s.origin[1]);
    mesh.add(arch, m.metal);
    for (const side of [-1, 1])
      box(
        side * s.radius,
        (s.baseTop + s.springHeight) / 2,
        u,
        thickness * 2,
        s.springHeight - s.baseTop + 0.025,
        depth,
        m.metal,
      );
    // The gasket is a thin seat under the pressure cap, exposed only at the
    // pane edges. Its4mm separation avoids coplanar glass/opaque depth fighting.
    for (const side of [-1, 1])
      quad(
        m.gasket,
        [
          [side * (s.radius + 0.004), s.baseTop, sealStart],
          [side * (s.radius + 0.004), s.baseTop, sealEnd],
          [side * (s.radius + 0.004), s.springHeight, sealEnd],
          [side * (s.radius + 0.004), s.springHeight, sealStart],
        ],
        [side, 0, 0],
      );
    for (let j = 0; j < segments; j++) {
      const a = (Math.PI * j) / segments,
        b = (Math.PI * (j + 1)) / segments,
        point = (angle: number, along: number): Vertex3 => [
          -(s.radius + 0.004) * Math.cos(angle),
          s.springHeight + (s.roofRise + 0.004) * Math.sin(angle),
          along,
        ];
      quad(
        m.gasket,
        [
          point(a, sealStart),
          point(b, sealStart),
          point(b, sealEnd),
          point(a, sealEnd),
        ],
        [
          -Math.cos((a + b) / 2) / s.radius,
          Math.sin((a + b) / 2) / s.roofRise,
          0,
        ],
      );
    }
  }
  // Three fine straight roof bars. The two spring-line members already belong
  // to the side head rails; duplicating them made the former grid read heavier.
  for (const angle of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
    const v = -s.radius * Math.cos(angle),
      y = s.springHeight + s.roofRise * Math.sin(angle),
      normal = new T.Vector2(
        -Math.cos(angle) / s.radius,
        Math.sin(angle) / s.roofRise,
      ).normalize(),
      tangent = new T.Vector2(normal.y, -normal.x),
      point = (across: number, out: number, u: number): Vertex3 => [
        v + tangent.x * across + normal.x * out,
        y + tangent.y * across + normal.y * out,
        u,
      ];
    for (const side of [-1, 1]) {
      quad(
        m.metal,
        [
          point(-0.018, side * 0.016, 0),
          point(0.018, side * 0.016, 0),
          point(0.018, side * 0.016, s.length),
          point(-0.018, side * 0.016, s.length),
        ],
        [normal.x * side, normal.y * side, 0],
      );
      quad(
        m.metal,
        [
          point(side * 0.018, -0.016, 0),
          point(side * 0.018, 0.016, 0),
          point(side * 0.018, 0.016, s.length),
          point(side * 0.018, -0.016, s.length),
        ],
        [tangent.x * side, tangent.y * side, 0],
      );
    }
    for (const u of [0, s.length])
      quad(
        m.metal,
        [
          point(-0.018, -0.016, u),
          point(0.018, -0.016, u),
          point(0.018, 0.016, u),
          point(-0.018, 0.016, u),
        ],
        [0, 0, u === 0 ? -1 : 1],
      );
    quad(
      m.gasket,
      [
        point(-0.028, 0.004, 0),
        point(0.028, 0.004, 0),
        point(0.028, 0.004, s.length),
        point(-0.028, 0.004, s.length),
      ],
      [normal.x, normal.y, 0],
    );
  }
  for (const side of [-1, 1]) {
    for (const [y, width, height] of [
      [s.baseTop + 0.025, 0.055, 0.04],
      [1.35, 0.04, 0.035],
      [s.springHeight - 0.028, 0.065, 0.055],
    ]) {
      box(side * s.radius, y, s.length / 2, width, height, s.length, m.metal);
      quad(
        m.gasket,
        [
          [side * (s.radius + 0.004), y - height / 2 - 0.01, 0],
          [side * (s.radius + 0.004), y - height / 2 - 0.01, s.length],
          [side * (s.radius + 0.004), y + height / 2 + 0.01, s.length],
          [side * (s.radius + 0.004), y + height / 2 + 0.01, 0],
        ],
        [side, 0, 0],
      );
    }
    quad(
      m.glass,
      [
        [side * s.radius, s.baseTop, 0],
        [side * s.radius, s.baseTop, s.length],
        [side * s.radius, s.springHeight, s.length],
        [side * s.radius, s.springHeight, 0],
      ],
      [side, 0, 0],
    );
  }
  // Shared arch vertices and analytic ellipse normals keep reflections smooth
  // across the geometric strips. UVs use actual accumulated arc metres.
  const roofPositions: number[] = [],
    roofNormals: number[] = [],
    roofUV: number[] = [],
    roofIndices: number[] = [];
  let arc = 0,
    previous: Point | undefined;
  for (let j = 0; j <= segments; j++) {
    const angle = (Math.PI * j) / segments,
      v = -s.radius * Math.cos(angle),
      y = s.springHeight + s.roofRise * Math.sin(angle),
      n = new T.Vector3(
        ...normal([
          v / (s.radius * s.radius),
          (y - s.springHeight) / (s.roofRise * s.roofRise),
          0,
        ]),
      ).normalize();
    if (previous) arc += Math.hypot(v - previous[0], y - previous[1]);
    previous = [v, y];
    for (const u of [0, s.length]) {
      roofPositions.push(...p(v, y, u));
      roofNormals.push(n.x, n.y, n.z);
      roofUV.push(arc, u);
    }
    if (j < segments) {
      const a = j * 2;
      roofIndices.push(a, a + 3, a + 2, a, a + 1, a + 3);
    }
  }
  const roof = new T.BufferGeometry();
  roof.setAttribute("position", new T.Float32BufferAttribute(roofPositions, 3));
  roof.setAttribute("normal", new T.Float32BufferAttribute(roofNormals, 3));
  roof.setAttribute("uv", new T.Float32BufferAttribute(roofUV, 2));
  roof.setIndex(roofIndices);
  mesh.add(roof, m.glass);
  for (const [u, front] of [
    [0, -1],
    [s.length, 1],
  ]) {
    quad(
      m.glass,
      [
        [-s.radius, s.baseTop, u],
        [s.radius, s.baseTop, u],
        [s.radius, s.springHeight, u],
        [-s.radius, s.springHeight, u],
      ],
      [0, 0, front],
    );
    const gable = new T.Shape();
    gable.moveTo(-s.radius, s.springHeight);
    for (let j = 0; j <= segments; j++) {
      const angle = (Math.PI * j) / segments;
      gable.lineTo(
        -s.radius * Math.cos(angle),
        s.springHeight + s.roofRise * Math.sin(angle),
      );
    }
    gable.closePath();
    const geometry = new T.ShapeGeometry(gable);
    if (front < 0) {
      const index = geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const second = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, second);
      }
      geometry.computeVertexNormals();
    }
    geometry.translate(0, 0, u);
    geometry.rotateY(yaw);
    geometry.translate(
      s.origin[0],
      s.landingHeight - batch.offsetY,
      s.origin[1],
    );
    mesh.add(geometry, m.glass);
    box(0, s.springHeight, u, s.width, 0.075, 0.08, m.metal);
    for (const v of [-s.stairWidth / 2, 0, s.stairWidth / 2]) {
      box(
        v,
        (s.springHeight + s.baseTop) / 2,
        u,
        0.06,
        s.springHeight - s.baseTop,
        0.08,
        m.metal,
      );
      // Continue the existing gable members into the curved head, as visible
      // in the source. This does not introduce an inferred door-leaf pattern.
      const head =
        s.springHeight +
        (s.roofRise - 0.045) * Math.sqrt(1 - (v / (s.radius - 0.045)) ** 2) +
        0.015;
      box(
        v,
        (s.springHeight + head) / 2,
        u,
        0.045,
        head - s.springHeight,
        0.08,
        m.metal,
      );
      quad(
        m.gasket,
        [
          [v - 0.04, s.baseTop, u + front * 0.004],
          [v + 0.04, s.baseTop, u + front * 0.004],
          [v + 0.04, head, u + front * 0.004],
          [v - 0.04, head, u + front * 0.004],
        ],
        [0, 0, front],
      );
    }
  }
  // Closed glazed entrance screen and two source-visible blue T blades.
  quad(
    m.glass,
    [
      [-s.stairWidth / 2, 0, 0],
      [s.stairWidth / 2, 0, 0],
      [s.stairWidth / 2, s.baseTop, 0],
      [-s.stairWidth / 2, s.baseTop, 0],
    ],
    [0, 0, -1],
  );
  box(0, 0.035, 0, s.stairWidth, 0.07, 0.08, m.metal);
  for (const side of [-1, 1]) {
    const v = side * (s.radius - 0.3);
    box(v, 1.42, 0.065, 0.34, 1.27, 0.06, m.signBlue);
    box(v, 1.81, 0.029, 0.2, 0.045, 0.008, m.signWhite);
    box(v, 1.73, 0.029, 0.047, 0.17, 0.008, m.signWhite);
  }
  mesh.finish();
  return s;
}
