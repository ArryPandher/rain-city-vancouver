import * as T from "three";

export type StreetTreeShadowPair = {
  target: T.InstancedMesh;
  medium: T.InstancedMesh;
};
const read = (mesh: T.InstancedMesh) => ({
  geometry: mesh.geometry,
  material: mesh.material,
  customDepthMaterial: mesh.customDepthMaterial,
  customDistanceMaterial: mesh.customDistanceMaterial,
  onBeforeShadow: mesh.onBeforeShadow,
  onAfterShadow: mesh.onAfterShadow,
  boundingBox: mesh.boundingBox,
  boundingSphere: mesh.boundingSphere,
});
type Binding = ReturnType<typeof read>;
const bind = (mesh: T.InstancedMesh, state: Binding) =>
  Object.assign(mesh, state);

/** A render-local representation switch, never a second visible tree. Pairs
 * share the same normalized source space and per-instance transform. Keep the
 * target identity/visibility/cast flags so native light passes and outer shadow
 * caches retain their exact policy. Medium owns its mask, depth program and
 * callbacks; only swapping indices would sample the wrong leaf atlas. */
export class StreetTreeShadowLOD {
  private originals = new Map<T.InstancedMesh, Binding>();
  readonly state = { shadowPasses: 0, nearMeshes: 0 };

  render<R>(
    renderer: T.WebGLRenderer,
    camera: T.Camera,
    pairs: readonly StreetTreeShadowPair[],
    draw: () => R,
  ): R {
    if (!pairs.length) return draw();
    const previousOriginals = this.originals;
    this.originals = new Map(previousOriginals);
    for (const { target } of pairs)
      if (!this.originals.has(target)) this.originals.set(target, read(target));
    const originals = this.originals;
    const native = renderer.shadowMap.render;
    const policy = this;
    renderer.shadowMap.render = function (lights, scene, view) {
      const matchingView = view === camera;
      // Save current bindings per invocation: nested light/reflection renders
      // restore their caller, while the outermost invocation restores beauty.
      const saved = pairs.map(({ target }) => [target, read(target)] as const);
      try {
        for (const { target, medium } of pairs)
          bind(target, matchingView ? read(medium) : originals.get(target)!);
        if (matchingView) {
          policy.state.shadowPasses++;
          policy.state.nearMeshes = pairs.length;
        }
        return native.call(this, lights, scene, view);
      } finally {
        for (const [target, state] of saved.reverse()) bind(target, state);
      }
    };
    try {
      return draw();
    } finally {
      renderer.shadowMap.render = native;
      this.originals = previousOriginals;
    }
  }
}
