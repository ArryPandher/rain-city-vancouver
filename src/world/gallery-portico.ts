import * as T from "three";
import { ArchitecturalMesh } from "./architectural-mesh";
import {
  GALLERY_PORTICO as D,
  GALLERY_PORTICO_SHAFT_PROFILE,
  galleryPorticoSourceTriangle,
} from "./gallery-portico-data";
import entry from "./gallery-rear-entry-data.json";

/** Exact source-index replacement after the existing rear-entry translation.
 * Changed counts/coordinates fail closed; original vertex buffers never change. */
export function removeOriginalGalleryPortico(
  g: T.BufferGeometry,
  material: string,
) {
  if (material !== "trim") return 0;
  const p = g.getAttribute("position"),
    ix = g.index;
  if (p.count !== D.sourceTrimPositions || ix?.count !== D.sourceTrimIndices)
    return 0;
  const c = Math.cos(entry.angle),
    s = Math.sin(entry.angle);
  for (const [first, last] of D.replacedTrimRanges)
    for (let i = first; i <= last; i++) {
      const u = c * p.getX(i) + s * p.getZ(i),
        v = -s * p.getX(i) + c * p.getZ(i);
      const centre = first === 1162 ? D.shaftU[0] : D.shaftU[4];
      if (
        Math.abs(u - centre) > 0.63 ||
        v < 22.92 ||
        v > 24.08 ||
        p.getY(i) < 3.419 ||
        p.getY(i) > 13.903
      )
        return 0;
    }
  const keep: number[] = [];
  let removed = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (galleryPorticoSourceTriangle(ids)) removed++;
    else keep.push(...ids);
  }
  if (removed !== D.sourceTrianglesRemoved) return 0;
  g.setIndex(keep);
  return removed;
}

/** Coarse, closed Ionic construction: tapered shaft, echinus, rolled volutes
 * and a stepped abacus. Scrolls face the public rear, not the source's back. */
export function addGalleryPortico(mesh: ArchitecturalMesh, stone: T.Material) {
  for (let i = 0; i < D.shaftU.length; i++) {
    const u = D.shaftU[i],
      v = D.shaftV;
    // Original outer bases remain; only the three missing interior plinths are new.
    if (i > 0 && i < D.shaftU.length - 1)
      mesh.add(
        new T.CylinderGeometry(0.554, 0.554, D.baseTop - 3.2, 24).translate(
          u,
          (3.2 + D.baseTop) / 2,
          v,
        ),
        stone,
      );
    mesh.add(
      new T.LatheGeometry(
        GALLERY_PORTICO_SHAFT_PROFILE.map(([r, y]) => new T.Vector2(r, y)),
        24,
      ).translate(u, 0, v),
      stone,
    );
    for (const [y, radius, angle] of [
      [D.baseTop - 0.002, 0.554, Math.PI / 2],
      [11.6, 0.43, -Math.PI / 2],
    ])
      mesh.add(
        new T.CircleGeometry(radius, 24).rotateX(angle).translate(u, y, v),
        stone,
      );
    // The tapered cushion joins the shaft to the wide horizontal Ionic head.
    mesh.add(
      new T.CylinderGeometry(0.53, 0.4, 0.18, 24).translate(u, 11.63, v),
      stone,
    );
    mesh.box([u, 11.83, v], 1.04, 0.22, 0.91, stone);
    mesh.box([u, 11.975, v], D.capitalWidth, 0.15, D.capitalDepth, stone);
    for (const side of [-1, 1]) {
      const x = u + side * D.scrollOffset,
        y = D.scrollCentreY;
      // Rolled stone barrel supplies a solid side and back to each front spiral.
      mesh.add(
        new T.CylinderGeometry(D.scrollRadius, D.scrollRadius, 0.87, 24)
          .rotateX(Math.PI / 2)
          .translate(x, y, v),
        stone,
      );
      const path: T.Vector3[] = [];
      for (let j = 0; j <= 28; j++) {
        const t = j / 28,
          angle = -Math.PI / 2 + t * Math.PI * 3.1;
        const r = 0.2 * (1 - t) + 0.022 * t;
        path.push(
          new T.Vector3(
            x + side * Math.cos(angle) * r,
            y + Math.sin(angle) * r,
            v + 0.445,
          ),
        );
      }
      const curve = new T.CatmullRomCurve3(path);
      const tube = new T.TubeGeometry(curve, 28, 0.025, 6, false);
      const points = tube.getAttribute("position"),
        caps: number[] = [];
      for (const endIndex of [0, 28]) {
        const tangent = curve
          .getTangentAt(endIndex / 28)
          .multiplyScalar(endIndex === 0 ? -1 : 1);
        const centre = new T.Vector3();
        for (let j = 0; j < 6; j++)
          centre.add(
            new T.Vector3().fromBufferAttribute(points, endIndex * 7 + j),
          );
        centre.multiplyScalar(1 / 6);
        for (let j = 0; j < 6; j++) {
          let a = new T.Vector3().fromBufferAttribute(points, endIndex * 7 + j);
          let b = new T.Vector3().fromBufferAttribute(
            points,
            endIndex * 7 + j + 1,
          );
          if (
            a.clone().sub(centre).cross(b.clone().sub(centre)).dot(tangent) < 0
          )
            [a, b] = [b, a];
          caps.push(...centre.toArray(), ...a.toArray(), ...b.toArray());
        }
      }
      mesh.add(tube, stone);
      const cap = new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(caps, 3),
      );
      cap.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          new Float32Array((caps.length / 3) * 2),
          2,
        ),
      );
      cap.computeVertexNormals();
      mesh.add(cap, stone);
    }
  }
}
