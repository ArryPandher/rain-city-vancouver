import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import { Batcher } from "./geometry";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import entry from "./gallery-rear-entry-data.json";
import {
  GALLERY_UPPER_CANOPY as D,
  galleryUpperCanopyRoof,
  galleryUpperCanopyRoofGradient,
} from "./gallery-upper-canopy-data";

/** Thin closed tensioned skin, with analytical roof normals and flat edge caps. */
export function galleryUpperCanopyFabric(a: number, b: number) {
  const p: number[] = [],
    n: number[] = [],
    uv: number[] = [],
    ix: number[] = [];
  const ns = 4,
    nt = 10,
    layer = (ns + 1) * (nt + 1);
  for (let side = 0; side < 2; side++)
    for (let i = 0; i <= ns; i++)
      for (let j = 0; j <= nt; j++) {
        const s = i / ns,
          t = j / nt,
          [du, dv] = galleryUpperCanopyRoofGradient(s, t, b - a);
        p.push(
          a + (b - a) * s,
          galleryUpperCanopyRoof(s, t) - side * D.fabricThickness,
          D.front + (D.back - D.front) * t,
        );
        const normal = new T.Vector3(-du, 1, -dv)
          .normalize()
          .multiplyScalar(side === 0 ? 1 : -1);
        n.push(...normal.toArray());
        uv.push((b - a) * s, (D.front - D.back) * t);
      }
  for (let i = 0; i < ns; i++)
    for (let j = 0; j < nt; j++) {
      const a = i * (nt + 1) + j,
        b = a + nt + 1,
        c = b + 1,
        d = a + 1;
      ix.push(a, b, c, a, c, d); // +u crossed with -v points upward
      ix.push(a + layer, c + layer, b + layer, a + layer, d + layer, c + layer);
    }
  const edge = (a: number, b: number) => {
    const start = p.length / 3;
    const points = [a, b, b + layer, a + layer].map(
      (i) => new T.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]),
    );
    const normal = points[1]
      .clone()
      .sub(points[0])
      .cross(points[2].clone().sub(points[0]))
      .normalize();
    for (let i = 0; i < 4; i++) {
      p.push(...points[i].toArray());
      n.push(...normal.toArray());
      uv.push(
        i === 1 || i === 2 ? points[0].distanceTo(points[1]) : 0,
        i >= 2 ? D.fabricThickness : 0,
      );
    }
    ix.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  // Reverse the top boundary's order for outward edge faces.
  for (let i = 0; i < ns; i++) {
    edge((i + 1) * (nt + 1), i * (nt + 1));
    edge(i * (nt + 1) + nt, (i + 1) * (nt + 1) + nt);
  }
  for (let j = 0; j < nt; j++) {
    edge(j, j + 1);
    edge(ns * (nt + 1) + j + 1, ns * (nt + 1) + j);
  }
  return new T.BufferGeometry()
    .setAttribute("position", new T.Float32BufferAttribute(p, 3))
    .setAttribute("normal", new T.Float32BufferAttribute(n, 3))
    .setAttribute("uv", new T.Float32BufferAttribute(uv, 2))
    .setIndex(ix);
}

/** Existing Gallery source gate owns installation. No cap/source cuts and no
 * rooftop access: this sits on the verified retained13.149218m upper roof. */
export function addGalleryUpperCanopy(parent: T.Object3D): T.Mesh[] {
  const existing = parent.getObjectByName("Gallery upper east tensile canopy");
  if (existing)
    return existing.children.filter((o): o is T.Mesh => o instanceof T.Mesh);
  const group = new T.Group();
  group.name = "Gallery upper east tensile canopy";
  group.rotation.y = -entry.angle;
  parent.add(group);
  const steel = new T.MeshStandardMaterial({
    name: "Gallery upper canopy dark blue steel",
    color: 0x253747,
    roughness: 0.66,
    metalness: 0.45,
  });
  let fabric: T.Material | undefined;
  parent.traverse((o) => {
    if (o instanceof T.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m.name === "Gallery bistro off-white canvas") fabric = m;
  });
  fabric ??= new T.MeshStandardMaterial({
    name: "Gallery upper canopy warm fabric",
    color: 0xdedbd0,
    roughness: 0.95,
    metalness: 0,
  });
  const glass = new T.MeshStandardMaterial({
    name: "Gallery upper canopy clear windscreen",
    color: 0xcbd5d1,
    roughness: 0.2,
    metalness: 0.05,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: T.DoubleSide,
  });
  glass.forceSinglePass = true;
  const batch = new Batcher(group, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const beam = (a: Vertex3, b: Vertex3, w = 0.045, depth = w) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      v = end.clone().sub(start);
    const g = new T.BoxGeometry(w, v.length(), depth);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        v.normalize(),
      ),
    );
    mesh.add(
      g.translate(...start.add(end).multiplyScalar(0.5).toArray()),
      steel,
    );
  };
  const roof = (u: number, t: number, lower = false): Vertex3 => [
    u,
    galleryUpperCanopyRoof(0, t) - 0.045 - (lower ? 0.35 : 0),
    D.front + (D.back - D.front) * t,
  ];
  for (const u of D.stations) {
    for (const v of [D.frontPost, D.backPost]) {
      const t = (v - D.front) / (D.back - D.front),
        head = galleryUpperCanopyRoof(0, t) - 0.05;
      mesh.box([u, D.base + 0.018, v], D.footWidth, 0.036, D.footWidth, steel);
      beam([u, D.base + 0.036, v], [u, head, v], D.postWidth, D.postWidth);
    }
    for (const height of [D.glassBottom, D.glassTop])
      beam(
        [u, D.base + height, D.frontPost],
        [u, D.base + height, D.glassV],
        0.035,
        0.035,
      );
    // Curved top/bottom chords and alternating diagonal web form a real truss.
    for (let j = 0; j < 8; j++) {
      const a = j / 8,
        b = (j + 1) / 8;
      beam(roof(u, a), roof(u, b), 0.055, 0.055);
      beam(roof(u, a, true), roof(u, b, true), 0.045, 0.045);
      beam(roof(u, a, j % 2 === 0), roof(u, b, j % 2 !== 0), 0.03, 0.03);
    }
    // Curved knee below the public cantilever, visibly joining post to beam.
    const curve = new T.QuadraticBezierCurve3(
      new T.Vector3(u, D.base + 2.15, D.frontPost),
      new T.Vector3(u, D.base + 2.9, D.frontPost + 0.04),
      new T.Vector3(...roof(u, 0, true)),
    );
    for (let j = 0; j < 6; j++)
      beam(
        curve.getPoint(j / 6).toArray(),
        curve.getPoint((j + 1) / 6).toArray(),
        0.045,
        0.045,
      );
  }
  for (let i = 1; i < D.stations.length; i++) {
    const a = D.stations[i - 1],
      b = D.stations[i];
    mesh.add(galleryUpperCanopyFabric(a, b), fabric);
    for (const t of [0, 1])
      beam(roof(a, t, true), roof(b, t, true), 0.045, 0.045);
    // The front windscreen is below the open upper truss, not a closed room.
    const l = a + 0.075,
      r = b - 0.075,
      bottom = D.base + D.glassBottom,
      top = D.base + D.glassTop;
    mesh.quad(
      glass,
      [l, bottom, D.glassV],
      [r, bottom, D.glassV],
      [r, top, D.glassV],
      [l, top, D.glassV],
    );
    for (const y of [bottom, top])
      beam([a, y, D.glassV], [b, y, D.glassV], 0.035, 0.035);
    for (const u of [l, (a + b) / 2, r])
      beam([u, bottom, D.glassV], [u, top, D.glassV], 0.03, 0.03);
  }
  mesh.finish();
  const chunks = batch.finish();
  for (const m of chunks) {
    m.name = (m.material as T.Material).name;
    if (m.material === steel) landmarkSurfaceUV(m.geometry, [1, 1]);
    m.castShadow = m.material !== glass;
    m.receiveShadow = true;
  }
  return chunks;
}
