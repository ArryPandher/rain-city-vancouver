import * as T from "three";
import { Batcher } from "./geometry";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import source from "./canada-place-rigging-map.json";

export const CANADA_MASTS = source.sails.flatMap((ring, bay) =>
  [0, 1].map((side) => {
    // Exact endpoints used by the source sail p(1,v), with v=0 or1.
    const peak = ring[side === 0 ? 0 : 3],
      low = ring[side === 0 ? 1 : 2];
    const anchor = [
      low[0] + (peak[0] - low[0]) * 0.42,
      18.3,
      low[1] + (peak[1] - low[1]) * 0.42,
    ] as Vertex3;
    return {
      bay,
      side,
      base: [peak[0], 17.6, peak[1]] as Vertex3,
      tip: [peak[0], 46.35, peak[1]] as Vertex3,
      anchor,
    };
  }),
);

/** Remove just the original straight mast boxes from the merged steel primitive.
 * Rails, curved membrane-edge cables and all other landmark geometry remain.
 */
export function removeCanadaPlaceThinMasts(g: T.BufferGeometry) {
  const p = g.getAttribute("position"),
    ix = g.getIndex(),
    kept: number[] = [];
  let removed = 0;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j));
    const mast = CANADA_MASTS.some((m) =>
      ids.every(
        (j) =>
          Math.hypot(p.getX(j) - m.base[0], p.getZ(j) - m.base[2]) < 0.24 &&
          (Math.abs(p.getY(j) - 17.6) < 0.045 ||
            Math.abs(p.getY(j) - 46.35) < 0.045),
      ),
    );
    if (mast) removed++;
    else kept.push(...ids);
  }
  if (removed) g.setIndex(kept);
  return removed;
}

/** Bounded roof-only rigging in the same local coordinate frame as the GLB. */
export function addCanadaPlaceRigging(parent: T.Object3D) {
  const batch = new Batcher(parent, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const paint = new T.MeshStandardMaterial({
    name: "Canada Place painted mast shafts",
    color: 0xd5d9d2,
    roughness: 0.57,
    metalness: 0.13,
  });
  const steel = new T.MeshStandardMaterial({
    name: "Canada Place tension stays and fittings",
    color: 0x929c98,
    roughness: 0.46,
    metalness: 0.65,
  });
  for (const mast of CANADA_MASTS) {
    const height = mast.tip[1] - mast.base[1];
    const shaft = new T.CylinderGeometry(0.16, 0.32, height, 10);
    shaft.translate(mast.base[0], mast.base[1] + height / 2, mast.base[2]);
    mesh.add(shaft, paint);
    for (const [y, r, h] of [
      [17.78, 0.39, 0.36],
      [44.72, 0.25, 0.22],
      [46.17, 0.22, 0.25],
    ]) {
      const collar = new T.CylinderGeometry(r, r, h, 10);
      collar.translate(mast.base[0], y, mast.base[2]);
      mesh.add(collar, steel);
    }
    // Source edge valley is18m; its straight stay chord sits above the concave
    // membrane profile. Both ends meet physical shaft/anchor fittings.
    const top: [number, number, number] = [mast.tip[0], 46.17, mast.tip[2]];
    const direction = new T.Vector3(...mast.anchor)
      .sub(new T.Vector3(...top))
      .normalize();
    mesh.beam(top, mast.anchor, 0.052, steel, 6);
    const socketStart = new T.Vector3(...mast.anchor).addScaledVector(
      direction,
      -0.7,
    );
    mesh.beam(socketStart.toArray() as Vertex3, mast.anchor, 0.1, steel, 8);
    const pad = new T.CylinderGeometry(0.22, 0.28, 0.32, 8);
    pad.translate(mast.anchor[0], 18.14, mast.anchor[2]);
    mesh.add(pad, paint);
  }
  mesh.finish();
  const chunks = batch.finish();
  for (const c of chunks)
    c.name = "Canada Place tensile mast and stay assembly";
  return chunks;
}
