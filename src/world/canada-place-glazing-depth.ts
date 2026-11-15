import * as T from "three";
import data from "./canada-place-concourse-data.json";
import {
  canadaPlaceRoofOutwardAt,
  canadaPlaceSolidBayAt,
  canadaPlaceUpperFasciaAt,
} from "./canada-place-concourse-layout";
export type GlazingPoint = [number, number, number];
export const CANADA_PLACE_GLAZING_DEPTH = 0.1;
export const CANADA_PLACE_LINING_INSET = 0.025;
export const CANADA_PLACE_PALE_REBATE_DEPTH = 0.1;
/** Exterior-visible closed concourse volume; no furnished or accessible interior.
 * Existing source envelope bounds the lining; pane rebates remain shallow. */
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
    // Source back wall and underside of promenade roof replace the former
    // artificial curved sheet immediately behind every pane.
    const inset = CANADA_PLACE_LINING_INSET;
    const point = (i: number, out: number, y: number) => {
      const st = data.stations[i];
      return new T.Vector3(st.x + st.nx * out, y, st.z + st.nz * out);
    };
    for (let i = 1; i < data.stations.length; i++) {
      const a = data.stations[i - 1],
        b = data.stations[i];
      const mid = (a.s + b.s) / 2;
      const floorOutward = canadaPlaceSolidBayAt(mid)
        ? data.solidBayOutward
        : data.groundOutward;
      const inward = new T.Vector3(a.nx + b.nx, 0, a.nz + b.nz).normalize();
      this.quad(
        [
          point(i - 1, inset, 7.8 + inset),
          point(i, inset, 7.8 + inset),
          point(i, inset, 17.65 - inset),
          point(i - 1, inset, 17.65 - inset),
        ],
        inward,
        0x7d847f,
      );
      if (canadaPlaceUpperFasciaAt(mid)) {
        const edge = data.profile[17][0];
        this.quad(
          [
            point(i - 1, edge * a.scale - inset, data.profile[17][1]),
            point(i, edge * b.scale - inset, data.profile[17][1]),
            point(i, edge * b.scale - inset, 17.65 - inset),
            point(i - 1, edge * a.scale - inset, 17.65 - inset),
          ],
          inward.clone().negate(),
          0x969b94,
        );
      }
      const roof = canadaPlaceRoofOutwardAt(mid);
      this.quad(
        [
          point(i - 1, inset, 17.65 - inset),
          point(i, inset, 17.65 - inset),
          point(i, roof * b.scale - inset, 17.65 - inset),
          point(i - 1, roof * a.scale - inset, 17.65 - inset),
        ],
        new T.Vector3(0, -1, 0),
        0x969b94,
      );
      this.quad(
        [
          point(i - 1, inset, 7.8 + inset),
          point(i, inset, 7.8 + inset),
          point(i, floorOutward * b.scale - inset, 7.8 + inset),
          point(i - 1, floorOutward * a.scale - inset, 7.8 + inset),
        ],
        new T.Vector3(0, 1, 0),
        0x777c76,
      );
    }
    // Close both longitudinal ends with the SAME stepped envelope. These are
    // inside faces of existing end walls, not new invented room partitions.
    for (const i of [0, data.stations.length - 1]) {
      const st = data.stations[i],
        fascia = canadaPlaceUpperFasciaAt(st.s);
      const profile = data.profile.map(
        ([out, y], k) =>
          new T.Vector2(
            (k === 0
              ? data.groundOutward
              : fascia && k >= 18 && k <= 25
                ? data.profile[17][0]
                : out) * st.scale,
            y,
          ),
      );
      const cap = profile.map((p) => point(i, p.x, p.y));
      const along = new T.Vector3(-st.nz, 0, st.nx).multiplyScalar(
        i === 0 ? 1 : -1,
      );
      cap.forEach((p) => p.addScaledVector(along, inset));
      for (const triangle of T.ShapeUtils.triangulateShape(profile, [])) {
        const v = triangle.map((k) => cap[k]);
        this.quad([v[0], v[1], v[2], v[2]], along, 0x7d847f);
      }
    }

    // Interior faces of the source-profile solid transitions. Keep them on the
    // glazed-volume side so the exterior wall remains first from the public recess.
    for (const [a, b] of data.solidBays) {
      for (const boundary of [a, b]) {
        const i = data.stations.findIndex(
          (st) => Math.abs(st.s - boundary) < 1e-7,
        );
        const st = data.stations[i];
        const fascia = canadaPlaceUpperFasciaAt(
          boundary + (boundary === a ? -0.001 : 0.001),
        );
        const shape = [
          [data.groundOutward, 7.8],
          [data.groundOutward, data.groundGlassHeadY],
          ...data.profile
            .slice(1, 26)
            .map(([out, y], j) => [
              Math.max(
                fascia && j + 1 >= 18 ? data.profile[17][0] : out,
                data.solidBayOutward,
              ),
              y,
            ]),
          [0, 17.65],
          [0, 7.8],
        ].map(([out, y]) => new T.Vector2(out * st.scale, y));
        const intoSolid = new T.Vector3(-st.nz, 0, st.nx).multiplyScalar(
          boundary === a ? 1 : -1,
        );
        const vertices = shape.map((v) =>
          point(i, v.x, v.y).addScaledVector(intoSolid, -inset),
        );
        for (const triangle of T.ShapeUtils.triangulateShape(shape, [])) {
          const v = triangle.map((k) => vertices[k]);
          this.quad(
            [v[0], v[1], v[2], v[2]],
            intoSolid.clone().negate(),
            0x7d847f,
          );
        }
      }
      // Behind the existing .28m-deep opaque circular infill; never mask it
      // from outside. No new hole or imitation window is introduced here.
      for (let i = 1; i < data.stations.length; i++) {
        const l = data.stations[i - 1],
          r = data.stations[i];
        if ((l.s + r.s) / 2 <= a || (l.s + r.s) / 2 >= b) continue;
        this.quad(
          [
            point(i - 1, data.solidBayOutward * l.scale - 0.32, 7.8 + inset),
            point(i, data.solidBayOutward * r.scale - 0.32, 7.8 + inset),
            point(i, data.solidBayOutward * r.scale - 0.32, 17.65 - inset),
            point(i - 1, data.solidBayOutward * l.scale - 0.32, 17.65 - inset),
          ],
          new T.Vector3(-l.nx - r.nx, 0, -l.nz - r.nz),
          0x7d847f,
        );
      }
    }

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
