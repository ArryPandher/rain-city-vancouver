import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import { Batcher } from "./geometry";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import source from "./gallery-rear-entry-data.json";
export const GALLERY_ROOFS = [
  { id: 361964117, minX: 6.909, maxX: 28.249, minZ: -11.6, maxZ: 0.528 },
  { id: 361964119, minX: -32.475, maxX: -11.21, minZ: -12.192, maxZ: 0.282 },
];
/** Original asset counts, before rear-entry/facade repair. */
export function galleryRoofCompatible(root: T.Object3D) {
  const expected: Record<string, [number, number]> = {
    stone: [19388, 52020],
    copper: [3177, 5952],
  };
  let ok = true;
  const found = new Set<string>();
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const e = expected[(o.material as T.Material).name];
    if (!e) return;
    const name = (o.material as T.Material).name;
    if (
      found.has(name) ||
      o.geometry.getAttribute("position").count !== e[0] ||
      o.geometry.index?.count !== e[1]
    )
      ok = false;
    found.add(name);
  });
  return ok && found.size === 2;
}
function local(x: number, z: number) {
  const c = Math.cos(source.angle),
    s = Math.sin(source.angle);
  return [c * x + s * z, -s * x + c * z];
}
/** Select only the original four copper slopes and four stone gable-end
 * triangles. Lower13.15–14m source plinths and all entry parts remain intact. */
export function replaceGalleryRoofFaces(g: T.BufferGeometry, name: string) {
  if (name !== "copper" && name !== "stone") return 0;
  const p = g.getAttribute("position"),
    ix = g.index!,
    kept: number[] = [];
  let removed = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)],
      v = ids.map((j) => {
        const [x, z] = local(p.getX(j), p.getZ(j));
        return { x, y: p.getY(j), z };
      });
    const selected = GALLERY_ROOFS.some((r) => {
      const mid = (r.minZ + r.maxZ) / 2,
        half = (r.maxZ - r.minZ) / 2;
      if (
        !v.every(
          (q) =>
            q.x >= r.minX - 0.006 &&
            q.x <= r.maxX + 0.006 &&
            q.z >= r.minZ - 0.006 &&
            q.z <= r.maxZ + 0.006 &&
            q.y >= 13.994 &&
            q.y <= 18.006,
        )
      )
        return false;
      if (name === "stone")
        return (
          [r.minX, r.maxX].some((x) =>
            v.every((q) => Math.abs(q.x - x) < 0.006),
          ) && v.some((q) => q.y > 17.99)
        );
      return [-1, 1].some((side) =>
        v.every(
          (q) =>
            side * (q.z - mid) >= -0.006 &&
            Math.abs(q.y - (18 - (4 * Math.abs(q.z - mid)) / half)) < 0.01,
        ),
      );
    });
    if (selected) removed++;
    else kept.push(...ids);
  }
  if (removed) g.setIndex(kept);
  return removed;
}
export function addGalleryRoofs(
  parent: T.Object3D,
  materials: Map<string, T.MeshStandardMaterial>,
) {
  const stone = materials.get("stone"),
    copper = materials.get("wing-copper") ?? materials.get("copper"),
    glass = materials.get("glass");
  if (!stone || !copper || !glass) return [];
  const root = new T.Group();
  root.name = "Gallery raised cross-wing clerestories";
  root.rotation.y = -source.angle;
  parent.add(root);
  const batch = new Batcher(root, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0),
    sash = new T.MeshStandardMaterial({
      name: "Gallery roof dark sash",
      color: 0x393c38,
      roughness: 0.72,
      metalness: 0.1,
    });
  const q = (m: T.Material, p: Vertex3[], normal: Vertex3) => {
    const a = new T.Vector3(...p[0]);
    if (
      new T.Vector3(...p[1])
        .sub(a)
        .cross(new T.Vector3(...p[2]).sub(a))
        .dot(new T.Vector3(...normal)) < 0
    )
      p = [p[0], p[3], p[2], p[1]];
    mesh.quad(m, p[0], p[1], p[2], p[3]);
  };
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: T.Material,
  ) {
    mesh.box([x, y, z], w, h, d, m);
  }
  for (const r of GALLERY_ROOFS) {
    const width = r.maxX - r.minX,
      depth = r.maxZ - r.minZ,
      cx = (r.minX + r.maxX) / 2,
      cz = (r.minZ + r.maxZ) / 2;
    // The retained source14m plinth carries the complete new closed upper band.
    box(cx, 14.12, cz, width, 0.24, depth, stone);
    box(cx, 15.75, cz, width + 0.16, 0.2, depth + 0.16, stone);
    box(cx, 15.91, cz, width + 0.46, 0.12, depth + 0.46, stone);
    box(cx, 16.015, cz, width + 0.7, 0.09, depth + 0.7, stone);
    for (const side of [-1, 1]) {
      const z = side < 0 ? r.minZ : r.maxZ,
        back = z - side * 0.42,
        plane = z - side * 0.36,
        n: Vertex3 = [0, 0, side];
      // Single closed backing behind each clerestory, not pane-sized room boxes.
      q(
        sash,
        [
          [r.minX, 14.24, back],
          [r.maxX, 14.24, back],
          [r.maxX, 15.65, back],
          [r.minX, 15.65, back],
        ],
        n,
      );
      const count = 6;
      for (let i = 0; i < count; i++) {
        const a = r.minX + (i * width) / count,
          b = r.minX + ((i + 1) * width) / count,
          l = a + 0.28,
          rr = b - 0.28;
        box(a + 0.14, 14.945, z, 0.28, 1.41, 0.24, stone);
        box(b - 0.14, 14.945, z, 0.28, 1.41, 0.24, stone);
        q(
          glass,
          [
            [l, 14.3, plane],
            [rr, 14.3, plane],
            [rr, 15.59, plane],
            [l, 15.59, plane],
          ],
          n,
        );
        for (const x of [l, rr])
          box(x, 14.945, plane + side * 0.025, 0.065, 1.35, 0.055, sash);
        box(
          (l + rr) / 2,
          14.945,
          plane + side * 0.025,
          0.055,
          1.35,
          0.055,
          sash,
        );
        for (const y of [14.3, 14.94, 15.59])
          box(
            (l + rr) / 2,
            y,
            plane + side * 0.025,
            rr - l,
            0.055,
            0.055,
            sash,
          );
        q(
          stone,
          [
            [l, 14.24, z],
            [l, 14.24, back],
            [l, 15.65, back],
            [l, 15.65, z],
          ],
          [1, 0, 0],
        );
        q(
          stone,
          [
            [rr, 14.24, z],
            [rr, 14.24, back],
            [rr, 15.65, back],
            [rr, 15.65, z],
          ],
          [-1, 0, 0],
        );
      }
      q(
        stone,
        [
          [r.minX, 14.24, z],
          [r.maxX, 14.24, z],
          [r.maxX, 14.24, back],
          [r.minX, 14.24, back],
        ],
        [0, 1, 0],
      );
      q(
        stone,
        [
          [r.minX, 15.65, z],
          [r.maxX, 15.65, z],
          [r.maxX, 15.65, back],
          [r.minX, 15.65, back],
        ],
        [0, -1, 0],
      );
    }
    for (const x of [r.minX, r.maxX])
      box(x, 14.945, cz, 0.28, 1.41, depth, stone);
    const min = r.minZ - 0.35,
      max = r.maxZ + 0.35;
    q(
      copper,
      [
        [r.minX - 0.35, 16.06, min],
        [r.maxX + 0.35, 16.06, min],
        [r.maxX + 0.35, 18, cz],
        [r.minX - 0.35, 18, cz],
      ],
      [0, 1, -1],
    );
    q(
      copper,
      [
        [r.minX - 0.35, 18, cz],
        [r.maxX + 0.35, 18, cz],
        [r.maxX + 0.35, 16.06, max],
        [r.minX - 0.35, 16.06, max],
      ],
      [0, 1, 1],
    );
    for (const x of [r.minX - 0.35, r.maxX + 0.35]) {
      const g = new T.BufferGeometry();
      const p: Vertex3[] = [
        [x, 16.06, min],
        [x, 18, cz],
        [x, 16.06, max],
      ];
      if (x < cx) p.reverse();
      g.setAttribute("position", new T.Float32BufferAttribute(p.flat(), 3));
      g.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 1, 1, 2, 0], 2));
      g.setIndex([0, 1, 2]);
      g.computeVertexNormals();
      mesh.add(g, stone);
    }
    // Copper standing seams follow the actual shallow slopes, not floating strips.
    for (let x = r.minX; x <= r.maxX; x += 0.72)
      for (const z of [min, max])
        mesh.beam([x, 16.075, z], [x, 17.98, cz], 0.018, copper, 5);
  }
  // Rear wing entablature joins the protected central entry at u7.15; do not
  // stack a new band across its original translated cornice or pediment.
  for (const [a, b] of [
    [
      [7.15, 23.181 + ((19.452 - 7.15) * (23.62 - 23.181)) / (19.452 - 0.413)],
      [19.452, 23.181],
    ],
    [
      [-32.449, 23.818],
      [-28.102, 23.869],
    ],
  ]) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      angle = -Math.atan2(dz, dx),
      nx = -dz / len,
      nz = dx / len;
    for (const [y, h, d] of [
      [13.17, 0.16, 0.32],
      [13.39, 0.28, 0.58],
      [13.64, 0.22, 0.84],
    ])
      mesh.box(
        [
          (a[0] + b[0]) / 2 + nx * (d / 2 - 0.06),
          y,
          (a[1] + b[1]) / 2 + nz * (d / 2 - 0.06),
        ],
        len,
        h,
        d,
        stone,
        angle,
      );
  }
  mesh.finish();
  const chunks = batch.finish();
  for (const chunk of chunks) {
    landmarkSurfaceUV(chunk.geometry, [1, 1]);
    chunk.name = root.name;
  }
  return chunks;
}
