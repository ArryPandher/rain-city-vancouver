import type { SceneReflectionProbe } from "./reflection-probes";

export const LOCAL_REFLECTION_RADIUS = 180;
type Position = { x: number; y: number; z: number };

/** Same strict horizontal eligibility at startup and after walking/fast travel. */
export function nextNearbyReflection(
  probes: readonly SceneReflectionProbe[],
  viewer: Position,
) {
  return probes.find(
    (p) =>
      p.dirty &&
      Math.hypot(viewer.x - p.spec.position[0], viewer.z - p.spec.position[2]) <
        LOCAL_REFLECTION_RADIUS,
  );
}
export interface StartupReflectionSummary {
  total: number;
  initiallyNearby: number;
  attempted: number;
  captured: number;
  deferredDirty: number;
}

/** Prepare only the initial local receivers. Do not move the viewer to remote
 * probes to force them eligible. Their unassigned envMap retains the scene sky.
 * Captures remain synchronous; loading-stage yields are rechecked before work. */
export async function prepareStartupReflections(options: {
  reflections: {
    readonly probes: readonly SceneReflectionProbe[];
    readonly captures: number;
  };
  viewer: () => Position;
  enabled: () => boolean;
  beforeCapture: (name: string, index: number, count: number) => Promise<void>;
  capture: (viewer: Position) => void;
}): Promise<StartupReflectionSummary> {
  const { reflections } = options;
  const initial = { ...options.viewer() };
  const initiallyNearby = reflections.probes.filter(
    (p) =>
      p.dirty &&
      Math.hypot(
        initial.x - p.spec.position[0],
        initial.z - p.spec.position[2],
      ) < LOCAL_REFLECTION_RADIUS,
  ).length;
  let captured = 0;
  const attempted = new Set<SceneReflectionProbe>();
  // Bounded even if capture callbacks invalidate a generation or the player moves.
  for (let i = 0; i < initiallyNearby; i++) {
    if (!options.enabled()) break;
    const probe = nextNearbyReflection(reflections.probes, options.viewer());
    if (!probe || attempted.has(probe)) break;
    await options.beforeCapture(probe.spec.name, i + 1, initiallyNearby);
    if (!options.enabled()) break;
    const viewer = { ...options.viewer() };
    // Do not capture an obsolete loading-stage selection after travel or an
    // intervening render prepared it already. The normal lazy path takes over.
    if (nextNearbyReflection(reflections.probes, viewer) !== probe) continue;
    attempted.add(probe);
    const before = reflections.captures;
    options.capture(viewer);
    captured += reflections.captures - before;
  }
  return {
    total: reflections.probes.length,
    initiallyNearby,
    attempted: attempted.size,
    captured,
    deferredDirty: reflections.probes.filter((p) => p.dirty).length,
  };
}
