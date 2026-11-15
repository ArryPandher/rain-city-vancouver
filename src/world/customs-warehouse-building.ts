import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { buildCustomsWarehouse } from "./customs-warehouse";
import { createCustomsWarehouseMaterials } from "./customs-warehouse-materials";
import { facadeFrame } from "./architectural-mesh";
import { applyHoweMasonryWeathering } from "./howe-masonry-weathering";
import {
  CUSTOMS_WAREHOUSE_RING,
  CUSTOMS_WAREHOUSE_SECTION,
  warehouseBays,
} from "./customs-warehouse-site";

/** Exact-building dispatch: no generic photo wall or invented retail frontage.
 * The masonry base itself closes below the shared street, so this building
 * does not need the generic concrete foundation strip.
 */
export function customsWarehouse(
  building: Building,
  batch: Batcher,
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
  groundHeight: (x: number, z: number) => number = () => batch.offsetY,
) {
  if (building.id !== "w1363485360") return false;
  const materials = createCustomsWarehouseMaterials(library);
  const facades = [0, 1].map((edge) => {
    const start = CUSTOMS_WAREHOUSE_RING[edge],
      end = CUSTOMS_WAREHOUSE_RING[edge + 1];
    const frame = facadeFrame(start, end);
    const a = frame.p(0, 0, -0.25),
      b = frame.p(frame.length, 0, -0.25);
    return {
      start,
      end,
      groundY: [groundHeight(a[0], a[2]), groundHeight(b[0], b[2])] as [
        number,
        number,
      ],
      windowEdges: warehouseBays(edge).flatMap((bay) => [
        bay.centre - bay.openingWidth / 2,
        bay.centre + bay.openingWidth / 2,
      ]),
    };
  });
  const section = CUSTOMS_WAREHOUSE_SECTION;
  for (const material of [materials.stone, materials.trim, materials.brick])
    applyHoweMasonryWeathering(material, {
      datumY: batch.offsetY,
      facades,
      sillY: [section.lower.sill, section.middle.sill, section.upper.sill],
      ledgeY: [section.stoneCap, section.corniceTop],
      maxDarkening: 0.12,
    });
  if (!buildCustomsWarehouse(batch, building, materials)) return false;
  reflections.push({
    name: "Customs Warehouse Howe Cordova windows",
    resolution: 256,
    // Just outside the mapped street corner, between the lower window bands.
    // One static capture is an approximate shared environment, not ray tracing.
    position: [441.05, batch.offsetY + 11.7, -387.1],
    materials: [materials.glass],
    intensity: { day: 0.8, night: 0.75 },
  });
  return true;
}
