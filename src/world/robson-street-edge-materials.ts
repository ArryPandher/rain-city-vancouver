import * as T from "three";
import type { Materials } from "./materials";
import { Batcher } from "./geometry";
import { createHoweCordovaJunctionMaterials } from "./howe-cordova-junction";
import {
  createRobsonStreetEdgeGeometry,
  type RobsonStreetEdgeSite,
} from "./robson-street-edge";

/** Reuse existing credited mineral maps. Street sidewalks have a larger slab
 * module than the garden terraces; no reference photos become runtime textures. */
export function buildRobsonStreetEdge(
  batch: Batcher,
  site: RobsonStreetEdgeSite,
  library: Pick<Materials, "texture">,
) {
  const shared = createHoweCordovaJunctionMaterials(library);
  shared.sidewalk.name = "Hornby Robson concrete sidewalk";
  shared.curb.name = "Hornby Robson formed curb and tree reveals";
  shared.gutter.name = "Hornby Robson shallow gutter";
  const materials = {
    ...shared,
    soil: new T.MeshStandardMaterial({
      name: "Hornby Robson recessed tree soil",
      color: 0x4b4030,
      roughness: 1,
    }),
  };
  const geometry = createRobsonStreetEdgeGeometry(site);
  for (const k of ["sidewalk", "curb", "gutter", "soil"] as const) {
    geometry[k].translate(0, -batch.offsetY, 0);
    batch.add(geometry[k], materials[k], -130.8, 38.5, `robson-street-${k}`);
  }
  return materials;
}
