import * as T from "three";
export type GlazingPoint = [number, number, number];
export const CANADA_PLACE_GLAZING_DEPTH = 0.4;
export const CANADA_PLACE_PALE_REBATE_DEPTH = 0.1;
/** Closed shallow structural cavities, not accessible or furnished interiors.
 * Offset is an authored estimate; original exterior pane vertices stay intact. */
export class CanadaPlaceGlazingDepth {
  private p: number[] = [];
  private ix: number[] = [];
  private colors: number[] = [];
  private reveals = new Set<string>();
  addPane(
    front: GlazingPoint[],
    normals: GlazingPoint[],
    closeLower: boolean,
    closeUpper: boolean,
  ) {
    const f = front.map((p) => new T.Vector3(...p));
    const back = f.map((p, i) =>
      p
        .clone()
        .addScaledVector(
          new T.Vector3(...normals[i]).normalize(),
          -CANADA_PLACE_GLAZING_DEPTH,
        ),
    );
    const normal = normals
      .reduce((v, n) => v.add(new T.Vector3(...n)), new T.Vector3())
      .normalize();
    this.quad(back, normal, 0x56615c);
    // Reveals at each longitudinal structural bay; curve-internal tessellation
    // introduces no additional crossbars or horizontal opaque strips.
    const center = f
      .reduce((v, p) => v.add(p), new T.Vector3())
      .multiplyScalar(0.25);
    for (const [a, b] of [
      [0, 3],
      [1, 2],
      ...(closeLower ? [[0, 1]] : []),
      ...(closeUpper ? [[3, 2]] : []),
    ]) {
      const direction = f[a]
        .clone()
        .add(f[b])
        .multiplyScalar(0.5)
        .sub(center)
        .normalize();
      const vertices = [f[a], f[b], back[b], back[a]];
      const key = vertices
        .map((v) =>
          v
            .toArray()
            .map((n) => n.toFixed(7))
            .join(","),
        )
        .sort()
        .join(";");
      if (!this.reveals.has(key)) {
        this.reveals.add(key);
        const fraction =
          CANADA_PLACE_PALE_REBATE_DEPTH / CANADA_PLACE_GLAZING_DEPTH;
        const rebateA = f[a].clone().lerp(back[a], fraction),
          rebateB = f[b].clone().lerp(back[b], fraction);
        this.quad([f[a], f[b], rebateB, rebateA], direction, 0xa3afa0);
        this.quad([rebateA, rebateB, back[b], back[a]], direction, 0x56615c);
      }
    }
  }
  private quad(v: T.Vector3[], normal: T.Vector3, color: number) {
    if (v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).dot(normal) < 0)
      v = [v[0], v[3], v[2], v[1]];
    const n = this.p.length / 3,
      c = new T.Color(color);
    for (const p of v) {
      this.p.push(...p.toArray());
      this.colors.push(c.r, c.g, c.b);
    }
    this.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  finish(parent: T.Object3D) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    geometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(this.colors, 3),
    );
    geometry.setIndex(this.ix);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new T.MeshStandardMaterial({
      name: "Canada Place recessed glazing structure",
      vertexColors: true,
      roughness: 0.86,
      metalness: 0,
      side: T.DoubleSide,
    });
    const mesh = new T.Mesh(geometry, material);
    mesh.name = "canada-west-glazing-backing";
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}
