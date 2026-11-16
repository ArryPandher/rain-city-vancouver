import * as T from "three";

/** Source-specific exterior subset of car-traffic.glb, not a replacement wheel.
 * At the existing 240m entry threshold a .7m wheel is about1.6px tall at
 * 670px/62deg. Retain original tyre side/tread, Rim2 spokes and brake discs;
 * omit dense Rim1 inner detail and calipers. Body silhouette remains intact.
 * Only a hierarchy clone is edited; geometry/material/image objects are shared
 * read-only until the normal car builder bakes the registered near frame. */
export function trafficCarExteriorSource(source: T.Group) {
  const result = source.clone(true),
    remove: T.Object3D[] = [];
  result.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    let interior = false,
      wheel = false;
    for (let node: T.Object3D | null = object; node; node = node.parent) {
      interior ||=
        /^Interior/.test(node.name) ||
        /^BodyHood(Interior|Under)/.test(node.name);
      wheel ||= /^Wheel(Front|Rear)[LR]$/.test(node.name);
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (
      interior ||
      (wheel && materials.every((m) => m.name === "Rim1" || m.name === "Brake"))
    )
      remove.push(object);
  });
  remove.forEach((object) => object.removeFromParent());
  return result;
}
