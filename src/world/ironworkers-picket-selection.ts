import * as T from "three";

export const IRONWORKERS_PICKET_PIXELS = {
  enterFiltered: 3,
  returnPhysical: 3.5,
  protectedMetres: 10,
} as const;

export function filteredPicket(
  pixels: number,
  distanceToSurface: number,
  previous: boolean,
) {
  return (
    distanceToSurface > IRONWORKERS_PICKET_PIXELS.protectedMetres &&
    pixels <
      (previous
        ? IRONWORKERS_PICKET_PIXELS.returnPhysical
        : IRONWORKERS_PICKET_PIXELS.enterFiltered)
  );
}

/** Fixed-capacity complementary sets. Original full-domain spheres remain valid
 * for every subset; do not recalculate smaller bounds that could cull a returning
 * near member before its render-time selection. No per-member frame allocation. */
export class IronworkersPicketSelection {
  private readonly physical: Float32Array;
  private readonly filtered: Float32Array;
  private readonly flags: Uint8Array;
  private readonly next: Uint8Array;
  private readonly captureHistory: Uint8Array;
  private readonly histories = new WeakMap<T.Camera, Uint8Array>();
  private readonly view = new T.Matrix4();
  private readonly clip = new T.Matrix4();
  private readonly cameraPosition = new T.Vector3();
  private readonly p = new T.Vector3();
  private readonly a = new T.Vector3();
  private readonly b = new T.Vector3();
  private readonly sphere = new T.Sphere();
  readonly stats = { checkedBars: 0, uploads: 0, near: 0, far: 0 };
  constructor(
    readonly near: T.InstancedMesh,
    readonly far: T.InstancedMesh,
    readonly pitch: number,
  ) {
    this.physical = near.instanceMatrix.array.slice() as Float32Array;
    this.filtered = far.instanceMatrix.array.slice() as Float32Array;
    this.flags = new Uint8Array(near.count);
    this.next = new Uint8Array(near.count);
    this.captureHistory = new Uint8Array(near.count);
    far.count = 0;
    near.instanceMatrix.setUsage(T.DynamicDrawUsage);
    far.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  update(camera: T.Camera, viewport: T.Vector4) {
    this.stats.checkedBars = 0;
    this.stats.uploads = 0;
    let history =
      camera.parent instanceof T.CubeCamera
        ? this.captureHistory
        : this.histories.get(camera);
    if (camera.parent instanceof T.CubeCamera) this.captureHistory.fill(0);
    if (!history)
      this.histories.set(camera, (history = new Uint8Array(this.flags.length)));
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    this.view.multiplyMatrices(
      camera.matrixWorldInverse,
      this.near.matrixWorld,
    );
    this.clip.multiplyMatrices(camera.projectionMatrix, this.view);
    this.sphere.copy(this.near.boundingSphere!).applyMatrix4(this.view);
    const c = this.sphere.center,
      r = this.sphere.radius,
      w = -c.z,
      minW = w - r - this.pitch / 2,
      focal = Math.max(
        (Math.abs(camera.projectionMatrix.elements[0]) * viewport.z) / 2,
        (Math.abs(camera.projectionMatrix.elements[5]) * viewport.w) / 2,
      );
    // Conservative perspective Jacobian bound for any bar tangent in this sphere.
    // It intentionally overestimates at grazing; only unquestionably far cells skip.
    const bound =
      minW > 0
        ? (this.pitch *
            focal *
            Math.SQRT2 *
            (w + r + Math.abs(c.x) + Math.abs(c.y) + 2 * r)) /
          (minW * minW)
        : Infinity;
    const allFar =
      !(camera as T.OrthographicCamera).isOrthographicCamera &&
      (w + r < 0 || bound < IRONWORKERS_PICKET_PIXELS.enterFiltered) &&
      c.length() - r > IRONWORKERS_PICKET_PIXELS.protectedMetres;
    const matrix = this.filtered,
      world = this.near.matrixWorld;
    let nearCount = 0,
      changed = false;
    for (let i = 0; i < this.flags.length; i++) {
      let value = 1;
      if (!allFar) {
        this.stats.checkedBars++;
        const k = i * 16,
          x = matrix[k + 12],
          y = matrix[k + 13],
          z = matrix[k + 14];
        this.a
          .set(
            x - matrix[k] * 0.5,
            y - matrix[k + 1] * 0.5,
            z - matrix[k + 2] * 0.5,
          )
          .applyMatrix4(this.clip);
        this.b
          .set(
            x + matrix[k] * 0.5,
            y + matrix[k + 1] * 0.5,
            z + matrix[k + 2] * 0.5,
          )
          .applyMatrix4(this.clip);
        const pixels = Math.hypot(
          ((this.a.x - this.b.x) * viewport.z) / 2,
          ((this.a.y - this.b.y) * viewport.w) / 2,
        );
        this.p.set(x, y, z).applyMatrix4(world);
        // Enclose the actual rectangular bar, including its height, for the
        // protected range. This is conservative near the top/bottom of a bar.
        const radius =
          0.5 * Math.hypot(matrix[k + 4], matrix[k + 5], matrix[k + 6]) + 0.033;
        value = filteredPicket(
          pixels,
          this.p.distanceTo(this.cameraPosition) - radius,
          !!history[i],
        )
          ? 1
          : 0;
      }
      this.next[i] = value;
      history[i] = value;
      changed ||= value !== this.flags[i];
      if (!value) nearCount++;
    }
    if (changed) {
      let a = 0,
        b = 0;
      const physical = this.near.instanceMatrix.array,
        filtered = this.far.instanceMatrix.array;
      for (let i = 0; i < this.flags.length; i++) {
        const output = this.next[i] ? filtered : physical,
          offset = (this.next[i] ? b++ : a++) * 16;
        const input = this.next[i] ? this.filtered : this.physical;
        for (let j = 0; j < 16; j++) output[offset + j] = input[i * 16 + j];
      }
      this.flags.set(this.next);
      this.near.instanceMatrix.needsUpdate = true;
      this.far.instanceMatrix.needsUpdate = true;
      this.stats.uploads = 2;
    }
    this.near.count = nearCount;
    this.far.count = this.flags.length - nearCount;
    this.stats.near = this.near.count;
    this.stats.far = this.far.count;
  }
}

type SceneSelection = (camera: T.Camera, viewport: T.Vector4) => void;
const sceneSelections = new WeakMap<
  T.Scene,
  {
    original: T.Scene["onBeforeRender"];
    before: T.Scene["onBeforeRender"];
    callbacks: Set<SceneSelection>;
  }
>();
function registerScene(scene: T.Scene, update: SceneSelection) {
  let record = sceneSelections.get(scene);
  if (!record) {
    const original = scene.onBeforeRender,
      callbacks = new Set<SceneSelection>(),
      viewport = new T.Vector4();
    const before: T.Scene["onBeforeRender"] = function (
      this: T.Scene,
      ...args: Parameters<T.Scene["onBeforeRender"]>
    ) {
      original.apply(this, args);
      const [renderer, , camera] = args;
      renderer.getCurrentViewport(viewport);
      for (const callback of callbacks) callback(camera, viewport);
    };
    record = { original, before, callbacks };
    sceneSelections.set(scene, record);
    scene.onBeforeRender = before;
  }
  record.callbacks.add(update);
  return () => {
    record!.callbacks.delete(update);
    if (!record!.callbacks.size) {
      if (scene.onBeforeRender === record!.before)
        scene.onBeforeRender = record!.original;
      sceneSelections.delete(scene);
    }
  };
}

/** Actual Scene callback runs before projection, buffer upload and shadows.
 * Group/ancestor added events find the scene; they are not render callbacks.
 * Removal/disposal unregisters only this fence and preserves other callbacks. */
export function installIronworkersPicketSelection(
  group: T.Group,
  selectors: IronworkersPicketSelection[],
) {
  const watched = new Set<T.Object3D>();
  let scene: T.Scene | undefined, unregister: (() => void) | undefined;
  const update: SceneSelection = (camera, viewport) => {
    for (const selector of selectors) selector.update(camera, viewport);
  };
  const refresh = () => {
    let found: T.Scene | undefined;
    for (let node: T.Object3D | null = group; node; node = node.parent) {
      if (!watched.has(node)) {
        watched.add(node);
        node.addEventListener("added", refresh);
        node.addEventListener("removed", refresh);
      }
      if (node instanceof T.Scene) found = node;
    }
    if (found === scene) return;
    unregister?.();
    scene = found;
    unregister = scene ? registerScene(scene, update) : undefined;
  };
  refresh();
  return () => {
    unregister?.();
    unregister = undefined;
    for (const node of watched) {
      node.removeEventListener("added", refresh);
      node.removeEventListener("removed", refresh);
    }
    watched.clear();
  };
}
