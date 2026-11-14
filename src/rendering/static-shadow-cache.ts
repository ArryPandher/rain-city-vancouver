import * as T from "three";

/** Reuse a completed shadow map only while simulation, the view and the world
 * update revision are unchanged. No geometry or shadow quality is reduced. */
export class StaticShadowCache {
  private matrix = new T.Matrix4();
  private revision: string | undefined;
  render(
    renderer: T.WebGLRenderer,
    camera: T.Camera,
    revision: string,
    dynamic: boolean,
    draw: () => void,
  ) {
    const previous = renderer.shadowMap.autoUpdate;
    const refresh =
      dynamic ||
      this.revision !== revision ||
      !this.matrix.equals(camera.matrixWorld);
    // Explicit needsUpdate requests (including reflection capture restoration)
    // continue to work even when autoUpdate is false.
    renderer.shadowMap.autoUpdate = refresh;
    try {
      draw();
      this.matrix.copy(camera.matrixWorld);
      this.revision = revision;
    } finally {
      renderer.shadowMap.autoUpdate = previous;
    }
  }
}
