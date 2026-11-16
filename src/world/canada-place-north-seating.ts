import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import {
  CANADA_PLACE_NORTH_SEATING as D,
  CANADA_PLACE_NORTH_SEAT_OUTLINE as outline,
} from "./canada-place-north-seating-data";

/** Photo-grounded sculptural pale seating, two shared opaque batches. */
export function addCanadaPlaceNorthSeating(parent: T.Object3D) {
  const shape = new T.Shape(outline.map(([u, v]) => new T.Vector2(u, -v)));
  const slab = new T.ExtrudeGeometry(shape, {
    depth: D.slab - 2 * D.bevel,
    bevelEnabled: true,
    bevelThickness: D.bevel,
    bevelSize: D.bevel,
    bevelSegments: 2,
    steps: 1,
  });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, D.height - D.slab + D.bevel, 0);
  slab.clearGroups();
  const legs: T.BufferGeometry[] = [];
  for (const [u, v] of D.legs) {
    legs.push(
      new T.CylinderGeometry(
        D.legRadius,
        D.legRadius,
        D.height - D.slab + 0.015,
        12,
      ).translate(u, (D.height - D.slab + 0.015) / 2, v),
    );
  }
  const supports = mergeGeometries(legs, false)!;
  legs.forEach((g) => g.dispose());
  const stone = new T.MeshStandardMaterial({
    name: "Canada Place pale HPC seating",
    color: 0xbfc0b5,
    roughness: 0.82,
    metalness: 0,
  });
  const steel = new T.MeshStandardMaterial({
    name: "Canada Place seating tubular supports",
    color: 0x343b3a,
    roughness: 0.48,
    metalness: 0.65,
  });
  const group = new T.Group();
  group.name = "Canada Place North Point sculptural seating";
  for (const [g, m] of [
    [slab, stone],
    [supports, steel],
  ] as const) {
    landmarkSurfaceUV(g, [1, 1]);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const mesh = new T.InstancedMesh(g, m, D.placements.length);
    mesh.name = m.name;
    D.placements.forEach((p, i) =>
      mesh.setMatrixAt(
        i,
        new T.Matrix4().compose(
          new T.Vector3(p.x, D.ground, p.z),
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), p.yaw),
          new T.Vector3(1, 1, 1),
        ),
      ),
    );
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.allowShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  parent.add(group);
  return group;
}
