import * as T from "three";

export type DoorFrontagePoint = (
  station: number,
  y: number,
  outward: number,
) => T.Vector3;
export const CANADA_DOOR_FRONTAGE = {
  base: 7.97,
  head: 10.75,
  transom: 10.12,
  glassDepth: -0.1,
  frameFront: 0.04,
};
/** Original exterior interpretation: divisions are estimated, not surveyed exits. */
export function canadaPlaceDoorBays(length: number) {
  const count = Math.round(length / 3.55);
  return Array.from({ length: count }, (_, i) => ({
    l: (length * i) / count,
    r: (length * (i + 1)) / count,
  }));
}
export function addCanadaPlaceDoorFrontage(
  root: T.Group,
  materials: { glass: T.MeshStandardMaterial; frame: T.MeshStandardMaterial },
  point: DoorFrontagePoint,
  stationBreaks: number[],
): T.Mesh[] {
  const glass = materials.glass.clone();
  glass.name = "canada-west-door-glass";
  glass.userData.castShadow = false;
  // Three.js clone omits shader hooks; preserve any caller's calibrated response.
  glass.onBeforeCompile = materials.glass.onBeforeCompile;
  glass.customProgramCacheKey = materials.glass.customProgramCacheKey;
  const frame = materials.frame.clone();
  frame.name = "canada-west-door-frame";
  frame.color.setHex(0xb6c4ba);
  frame.roughness = 0.46;
  frame.metalness = 0.22;
  const gasket = new T.MeshStandardMaterial({
    name: "canada-west-door-gasket",
    color: 0x25332f,
    roughness: 0.8,
    metalness: 0,
  });
  const batches = new Map<
    T.Material,
    { p: number[]; ix: number[]; uv: number[] }
  >();
  function quad(
    material: T.Material,
    vertices: T.Vector3[],
    normal: T.Vector3,
    uvs: number[][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ) {
    if (
      vertices[1]
        .clone()
        .sub(vertices[0])
        .cross(vertices[2].clone().sub(vertices[0]))
        .dot(normal) < 0
    ) {
      vertices = [vertices[0], vertices[3], vertices[2], vertices[1]];
      uvs = [uvs[0], uvs[3], uvs[2], uvs[1]];
    }
    let data = batches.get(material);
    if (!data) batches.set(material, (data = { p: [], ix: [], uv: [] }));
    const n = data.p.length / 3;
    data.p.push(...vertices.flatMap((v) => v.toArray()));
    data.uv.push(...uvs.flat());
    data.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const outward = (s: number) =>
    point(s, 9, 1)
      .sub(point(s, 9, 0))
      .normalize();
  const along = (s: number) =>
    point(Math.min(stationBreaks.at(-1)!, s + 0.005), 9, 0)
      .sub(point(Math.max(0, s - 0.005), 9, 0))
      .normalize();
  function ribbon(
    material: T.Material,
    l: number,
    r: number,
    b: number,
    t: number,
    front: number,
    back?: number,
  ) {
    const cuts = [
      l,
      ...stationBreaks.filter((s) => s > l + 1e-6 && s < r - 1e-6),
      r,
    ];
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        c = cuts[i],
        n = outward((a + c) / 2);
      quad(
        material,
        [
          point(a, b, front),
          point(c, b, front),
          point(c, t, front),
          point(a, t, front),
        ],
        n,
        [
          [(a - l) / (r - l), 0],
          [(c - l) / (r - l), 0],
          [(c - l) / (r - l), 1],
          [(a - l) / (r - l), 1],
        ],
      );
      if (back !== undefined) {
        quad(
          material,
          [
            point(a, b, back),
            point(a, t, back),
            point(c, t, back),
            point(c, b, back),
          ],
          n.clone().negate(),
        );
        quad(
          material,
          [
            point(a, t, front),
            point(c, t, front),
            point(c, t, back),
            point(a, t, back),
          ],
          new T.Vector3(0, 1, 0),
        );
        quad(
          material,
          [
            point(a, b, front),
            point(a, b, back),
            point(c, b, back),
            point(c, b, front),
          ],
          new T.Vector3(0, -1, 0),
        );
      }
    }
    if (back !== undefined) {
      quad(
        material,
        [
          point(l, b, front),
          point(l, t, front),
          point(l, t, back),
          point(l, b, back),
        ],
        along(l).negate(),
      );
      quad(
        material,
        [
          point(r, b, front),
          point(r, b, back),
          point(r, t, back),
          point(r, t, front),
        ],
        along(r),
      );
    }
  }
  const { base, head, transom, glassDepth, frameFront } = CANADA_DOOR_FRONTAGE;
  for (const bay of canadaPlaceDoorBays(stationBreaks.at(-1)!)) {
    const w = bay.r - bay.l,
      mid = (bay.l + bay.r) / 2;
    const xs = [bay.l, bay.l + w * 0.18, mid, bay.r - w * 0.18, bay.r];
    const ys = [base, transom, head];
    // Four lights: fixed sidelights, paired closed leaves, and separate transoms.
    for (let j = 1; j < xs.length; j++)
      for (let k = 1; k < ys.length; k++) {
        const l = xs[j - 1] + 0.04,
          r = xs[j] - 0.04,
          b = ys[k - 1] + 0.04,
          t = ys[k] - 0.04;
        ribbon(glass, l, r, b, t, glassDepth);
        // A shallow closed exterior well supplies parallax behind calibrated glass.
        // No room content or passable interior is created.
        const wellBack = glassDepth - 0.4;
        ribbon(gasket, l, r, b, t, wellBack);
        const cuts = [l, ...stationBreaks.filter((s) => s > l && s < r), r];
        for (let q = 1; q < cuts.length; q++) {
          const a = cuts[q - 1],
            c = cuts[q];
          quad(
            gasket,
            [
              point(a, b, glassDepth),
              point(c, b, glassDepth),
              point(c, b, wellBack),
              point(a, b, wellBack),
            ],
            new T.Vector3(0, 1, 0),
          );
          quad(
            gasket,
            [
              point(a, t, glassDepth),
              point(a, t, wellBack),
              point(c, t, wellBack),
              point(c, t, glassDepth),
            ],
            new T.Vector3(0, -1, 0),
          );
        }
        quad(
          gasket,
          [
            point(l, b, glassDepth),
            point(l, b, wellBack),
            point(l, t, wellBack),
            point(l, t, glassDepth),
          ],
          along(l),
        );
        quad(
          gasket,
          [
            point(r, b, glassDepth),
            point(r, t, glassDepth),
            point(r, t, wellBack),
            point(r, b, wellBack),
          ],
          along(r).negate(),
        );
        for (const [a, c] of [
          [l, l + 0.016],
          [r - 0.016, r],
        ])
          ribbon(gasket, a, c, b, t, -0.075, -0.105);
        for (const [a, c] of [
          [b, b + 0.016],
          [t - 0.016, t],
        ])
          ribbon(gasket, l + 0.016, r - 0.016, a, c, -0.075, -0.105);
      }
    for (let j = 0; j < xs.length; j++) {
      // Shared module boundary is owned by the following bay; no doubled frames.
      if (j === xs.length - 1 && bay.r < stationBreaks.at(-1)! - 0.001)
        continue;
      ribbon(
        frame,
        Math.max(0, xs[j] - 0.04),
        Math.min(stationBreaks.at(-1)!, xs[j] + 0.04),
        base,
        head,
        frameFront,
        -0.12,
      );
    }
    for (const y of ys)
      ribbon(
        frame,
        bay.l + 0.04,
        bay.r - 0.04,
        Math.max(base, y - 0.04),
        Math.min(head, y + 0.04),
        frameFront,
        -0.12,
      );
    // Low metal thresholds and physically mounted pulls; all inside footprint allowance.
    ribbon(
      frame,
      xs[1] + 0.04,
      xs[3] - 0.04,
      base + 0.008,
      base + 0.03,
      0.05,
      -0.14,
    );
    for (const s of [mid - 0.14, mid + 0.14]) {
      ribbon(frame, s - 0.012, s + 0.012, 8.78, 9.23, 0.1, 0.072);
      for (const y of [8.83, 9.18])
        ribbon(
          frame,
          s - 0.016,
          s + 0.016,
          y - 0.015,
          y + 0.015,
          0.072,
          glassDepth,
        );
    }
  }
  return [...batches].map(([material, data]) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(data.p, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(data.uv, 2));
    geometry.setIndex(data.ix);
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = material.name;
    mesh.castShadow = material !== glass;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
}
