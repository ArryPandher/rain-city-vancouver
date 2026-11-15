import { staticBatchMemoryProfile } from "../world/static-chunk-batch";
import * as T from "three";

type Counts = {
  calls: number;
  triangles: number;
  lines: number;
  points: number;
};
export type DrawAttribution = Counts & {
  pass: "beauty" | "shadow";
  object: string;
  material: string;
  instances: number;
  distance: number;
};
const counts = (r: T.WebGLRenderer): Counts => ({
  calls: r.info.render.calls,
  triangles: r.info.render.triangles,
  lines: r.info.render.lines,
  points: r.info.render.points,
});
const empty = (): Counts => ({ calls: 0, triangles: 0, lines: 0, points: 0 });
function materialLabel(m: T.Material) {
  const map = (m as T.MeshStandardMaterial).map;
  const image = map?.image as { src?: string } | undefined;
  return (
    m.name ||
    map?.name ||
    image?.src?.split("/").slice(-2).join("/") ||
    `${m.type} ${m.uuid.slice(0, 8)}`
  );
}

/** One explicitly requested frame, using actual renderer counters around draws.
 * Leaves visibility, materials, shadow/reflection settings and hooks unchanged.
 * Not a GPU timing measurement. Postprocessing is reported as unattributed.
 */
export function profileRender(
  renderer: T.WebGLRenderer,
  scene: T.Scene,
  camera: T.Camera,
  draw: () => void,
) {
  const restore: (() => void)[] = [],
    rows = new Map<string, DrawAttribution>();
  const started = performance.now(),
    position = new T.Vector3();
  scene.traverse((object) => {
    if (
      !(
        object instanceof T.Mesh ||
        object instanceof T.Line ||
        object instanceof T.Points
      )
    )
      return;
    const before = object.onBeforeRender,
      after = object.onAfterRender,
      beforeShadow = object.onBeforeShadow,
      afterShadow = object.onAfterShadow;
    let beauty = empty(),
      shadow = empty();
    const record = (
      pass: "beauty" | "shadow",
      start: Counts,
      material: T.Material,
    ) => {
      const now = counts(renderer),
        key = `${pass}/${object.id}/${materialLabel(material)}`;
      let row = rows.get(key);
      if (!row) {
        object.getWorldPosition(position);
        // Batched geometry is often in absolute world coordinates; its bounding
        // sphere gives the useful distance rather than the object's zero origin.
        const sphere =
          object instanceof T.InstancedMesh
            ? object.boundingSphere
            : object.geometry.boundingSphere;
        if (sphere)
          position.copy(sphere.center).applyMatrix4(object.matrixWorld);
        row = {
          ...empty(),
          pass,
          object: object.name || `${object.type} #${object.id}`,
          material: materialLabel(material),
          instances: object instanceof T.InstancedMesh ? object.count : 1,
          distance: Math.round(position.distanceTo(camera.position)),
        };
        rows.set(key, row);
      }
      for (const field of ["calls", "triangles", "lines", "points"] as const)
        row[field] += Math.max(0, now[field] - start[field]);
    };
    object.onBeforeRender = function (...args) {
      before.apply(this, args);
      beauty = counts(renderer);
    };
    object.onAfterRender = function (...args) {
      record("beauty", beauty, args[4]);
      after.apply(this, args);
    };
    object.onBeforeShadow = function (...args) {
      beforeShadow.apply(this, args);
      shadow = counts(renderer);
    };
    object.onAfterShadow = function (...args) {
      const material = Array.isArray(object.material)
        ? object.material[
            (args[6] as unknown as { materialIndex?: number } | null)
              ?.materialIndex ?? 0
          ]
        : object.material;
      record("shadow", shadow, material);
      afterShadow.apply(this, args);
    };
    restore.push(() => {
      object.onBeforeRender = before;
      object.onAfterRender = after;
      object.onBeforeShadow = beforeShadow;
      object.onAfterShadow = afterShadow;
    });
  });
  try {
    draw();
    const totals = { beauty: empty(), shadow: empty() },
      materials = new Map<
        string,
        Counts & { pass: string; material: string }
      >();
    for (const row of rows.values()) {
      const key = `${row.pass}/${row.material}`;
      let group = materials.get(key);
      if (!group)
        materials.set(
          key,
          (group = { ...empty(), pass: row.pass, material: row.material }),
        );
      for (const field of ["calls", "triangles", "lines", "points"] as const) {
        totals[row.pass][field] += row[field];
        group[field] += row[field];
      }
    }
    const fallbackTreeMemory = new Set<object>();
    const fallbackTreeBatches: { name: string; pass: object }[] = [];
    scene.traverse((object) => {
      if (!object.userData.fallbackTreeMemory) return;
      fallbackTreeMemory.add(object.userData.fallbackTreeMemory);
      fallbackTreeBatches.push({
        name: object.name,
        pass: { ...object.userData.fallbackTreePass },
      });
    });
    return {
      staticBatchMemory: staticBatchMemoryProfile(scene),
      fallbackTreeMemory: [...fallbackTreeMemory],
      fallbackTreeBatches,
      capabilities: {
        multiDraw: renderer.extensions.has("WEBGL_multi_draw"),
      },
      submissionMs: Math.round((performance.now() - started) * 10) / 10,
      note: "One diagnostic frame; CPU submission includes instrumentation. Triangle/call counts are actual draws, not GPU timings. Reflection draws before a renderer counter reset may appear in attribution but not final frame counters.",
      frame: counts(renderer),
      totals,
      // Keep low-call materials measurable after batching moves them below
      // both top-list cutoffs. This is emitted only for a requested profile.
      materials: [...materials.values()],
      topMaterials: [...materials.values()]
        .sort((a, b) => b.triangles - a.triangles)
        .slice(0, 30),
      topMaterialsByCalls: [...materials.values()]
        .sort((a, b) => b.calls - a.calls || b.triangles - a.triangles)
        .slice(0, 60),
      topObjects: [...rows.values()]
        .sort((a, b) => b.triangles - a.triangles)
        .slice(0, 40),
    };
  } finally {
    for (const reset of restore) reset();
  }
}
