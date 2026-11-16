import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { buildPacificCoast } from "./pacific-coast";
import { buildPacificCoastApron } from "./pacific-coast-apron";
import type { PacificCoastApronSite } from "./pacific-coast-apron-site";
import { createPacificCoastMaterials } from "./pacific-coast-materials";
import { facadeFrame } from "./architectural-mesh";
import { applyHoweMasonryWeathering } from "./howe-masonry-weathering";
import {
  PACIFIC_COAST_RING,
  PACIFIC_COAST_SECTION,
  pacificCoastBays,
} from "./pacific-coast-site";

/** The 325 Howe replacement owns its complete facade and below-grade base. */
export function pacificCoast(
  building: Building,
  batch: Batcher,
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
  groundHeight: (x: number, z: number) => number = () => batch.offsetY,
  apron?: PacificCoastApronSite,
) {
  if (building.id !== "w143683962") return false;
  const materials = createPacificCoastMaterials(library);
  const facades = [0, 1].map((edge) => {
    const start = PACIFIC_COAST_RING[edge],
      end = PACIFIC_COAST_RING[edge + 1];
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
      windowEdges: pacificCoastBays(edge).flatMap((bay) => [
        bay.left,
        bay.right,
      ]),
    };
  });
  for (const material of [
    materials.stone,
    materials.base,
    materials.trim,
    materials.brick,
  ])
    applyHoweMasonryWeathering(material, {
      datumY: batch.offsetY,
      facades,
      sillY: [0.3, 0.7, ...PACIFIC_COAST_SECTION.rows.map((row) => row.sill)],
      ledgeY: [PACIFIC_COAST_SECTION.beltTop, PACIFIC_COAST_SECTION.parapet],
      maxDarkening: 0.14,
    });
  if (!buildPacificCoast(batch, building, materials)) return false;
  if (apron) buildPacificCoastApron(batch, apron, materials);
  reflections.push({
    name: "325 Howe Cordova paired windows",
    resolution: 256,
    // Outside the street corner; a shared static environment approximation.
    position: [431.2, batch.offsetY + 10.8, -398.8],
    materials: [materials.glass],
    intensity: { day: 0.8, night: 0.75 },
  });
  return true;
}
