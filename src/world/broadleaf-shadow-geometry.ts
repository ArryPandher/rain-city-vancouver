import * as T from "three";

const canopyName = "Vancouver broadleaf — layered source canopy";
type Target = { mesh: T.InstancedMesh; compact: T.BufferGeometry };
type State = {
  enabled: boolean;
  eligibleMeshes: number;
  changedMeshes: number;
  submittedInstanceCapacity: number;
  sourceTriangleCapacity: number;
  compactTriangleCapacity: number;
  shadowMapInvocations: number;
};
type Scope = {
  camera: T.Camera;
  targets: Map<T.InstancedMesh, T.BufferGeometry>;
  state: State;
};
type Context = {
  native: T.WebGLRenderer["shadowMap"]["render"];
  originals: Map<T.InstancedMesh, T.BufferGeometry>;
  scopes: Scope[];
};
const contexts = new WeakMap<T.WebGLRenderer, Context>();
const empty = (enabled = false): State => ({
  enabled,
  eligibleMeshes: 0,
  changedMeshes: 0,
  submittedInstanceCapacity: 0,
  sourceTriangleCapacity: 0,
  compactTriangleCapacity: 0,
  shadowMapInvocations: 0,
});

/** Only attached source-volume crowns: never trunks, detailed-tree leaves or
 * experimental packed batches. Existing far wrappers share the live stem data. */
function target(object: T.Object3D): Target | undefined {
  if (
    !(object instanceof T.InstancedMesh) ||
    Array.isArray(object.material) ||
    object.material.name !== canopyName ||
    !object.castShadow ||
    !object.customDepthMaterial
  )
    return;
  const near = object.userData.branchNearGeometry,
    compact = object.userData.branchFarGeometry;
  if (
    !(near instanceof T.BufferGeometry) ||
    !(compact instanceof T.BufferGeometry) ||
    (object.geometry !== near && object.geometry !== compact) ||
    !near.getAttribute("sliceAxis") ||
    !compact.getAttribute("sliceAxis") ||
    !near.getAttribute("treeStemScale") ||
    near.getAttribute("treeStemScale") !== compact.getAttribute("treeStemScale")
  )
    return;
  return { mesh: object, compact };
}
const triangles = (geometry: T.BufferGeometry) =>
  Math.min(
    geometry.index?.count ?? geometry.getAttribute("position").count,
    geometry.drawRange.count,
  ) / 3;

/** Diagnostic, off unless explicitly enabled by the caller. All 22 source
 * planes, atlas/depth shaders, alpha policy and instance state stay intact;
 * only transparent crop-band tessellation is consolidated for shadow draws.
 *
 * Wrap the final synchronous renderer/composer draw, inside shadow-cache scopes.
 * Reflections normally run before this scope. Nested scoped renders (including
 * disabled probe scopes) see beauty originals and restore their caller exactly.
 * The native shadow-map hook runs before WebGLShadowMap's objects.update; an
 * object.onBeforeShadow swap would be too late to select/upload the geometry.
 */
export class BroadleafShadowGeometry {
  private lastState = empty();
  private readonly discovered = new WeakMap<T.Object3D, T.InstancedMesh[]>();
  /** Call only after adding/replacing source crown mesh objects at runtime.
   * Geometry LOD/material completion on existing meshes needs no invalidation. */
  invalidateTargets(root: T.Object3D) {
    this.discovered.delete(root);
  }
  private candidates(root: T.Object3D) {
    let meshes = this.discovered.get(root);
    if (!meshes) {
      meshes = [];
      root.traverse((object) => {
        if (object instanceof T.InstancedMesh) meshes!.push(object);
      });
      this.discovered.set(root, meshes);
    }
    return meshes;
  }
  /** Last successful OUTERMOST scope. Capacities are not draw/triangle savings:
   * frustum rejection, hidden zero-scale instances, lights and cache hits still
   * determine actual work. Use profileRender native counters for that. */
  get state(): Readonly<State> {
    return { ...this.lastState };
  }

  render<R>(
    renderer: T.WebGLRenderer,
    camera: T.Camera,
    root: T.Object3D,
    enabled: boolean,
    draw: () => R,
  ): R {
    let context = contexts.get(renderer);
    const outermost = !context;
    if (!context && !enabled) {
      const result = draw();
      this.lastState = empty();
      return result;
    }
    if (!context) {
      context = {
        native: renderer.shadowMap.render,
        originals: new Map(),
        scopes: [],
      };
      contexts.set(renderer, context);
      const shared = context;
      renderer.shadowMap.render = function (lights, scene, view) {
        const scope = shared.scopes.at(-1)!;
        const matching = view === scope.camera;
        const saved = new Map<T.InstancedMesh, T.BufferGeometry>();
        for (const [mesh, original] of shared.originals) {
          saved.set(mesh, mesh.geometry);
          mesh.geometry =
            (matching ? scope.targets.get(mesh) : undefined) ?? original;
        }
        try {
          const result = shared.native.call(this, lights, scene, view);
          if (matching) scope.state.shadowMapInvocations++;
          return result;
        } finally {
          for (const [mesh, geometry] of saved) mesh.geometry = geometry;
        }
      };
    }
    const previousOriginals = new Map(context.originals);
    const entryBindings = new Map<T.InstancedMesh, T.BufferGeometry>();
    for (const [mesh, original] of context.originals) {
      entryBindings.set(mesh, mesh.geometry);
      mesh.geometry = original;
    }
    const scope: Scope = { camera, targets: new Map(), state: empty(enabled) };
    context.scopes.push(scope);
    try {
      if (enabled)
        for (const object of this.candidates(root)) {
          const candidate = target(object);
          if (!candidate) continue;
          let attached = false,
            visible = true;
          for (let p: T.Object3D | null = object; p; p = p.parent) {
            visible &&= p.visible;
            if (p === root) attached = true;
          }
          if (!attached || !visible) continue;
          const { mesh, compact } = candidate;
          if (!context!.originals.has(mesh))
            context!.originals.set(mesh, mesh.geometry);
          scope.targets.set(mesh, compact);
          scope.state.eligibleMeshes++;
          scope.state.changedMeshes += Number(mesh.geometry !== compact);
          scope.state.submittedInstanceCapacity += mesh.count;
          scope.state.sourceTriangleCapacity +=
            triangles(mesh.geometry) * mesh.count;
          scope.state.compactTriangleCapacity +=
            triangles(compact) * mesh.count;
        }
      const result = draw();
      if (outermost) this.lastState = scope.state;
      return result;
    } finally {
      for (const [mesh, original] of context.originals)
        mesh.geometry = entryBindings.get(mesh) ?? original;
      context.originals = previousOriginals;
      context.scopes.pop();
      if (outermost) {
        renderer.shadowMap.render = context.native;
        contexts.delete(renderer);
      }
    }
  }
}
