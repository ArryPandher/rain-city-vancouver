import * as T from "three";
import {
  WaterPlanarReflections,
  WATER_PLANAR,
  waterPlanarViewerWeight,
} from "./water-planar-reflections";
import { WaterWavesComparison } from "./water-waves";

export const NORTH_HARBOUR_WATER_CAPTURE_INTERVAL_MS = 125;
type Context = ConstructorParameters<typeof WaterPlanarReflections>[0];
type Frame = {
  quality: string;
  enabled: boolean;
  allowCapture: boolean;
  now?: number;
};

/** Owns only accepted local planar+ripple+directional water. No rejected cube,
 * HDR-water or lighting comparison dependency. Off-region/quality/weather
 * teardown removes every owned shader layer and target; ordinary water returns. */
export class NorthHarbourWater {
  private planar?: WaterPlanarReflections;
  private waves?: WaterWavesComparison;
  private weather = "day";
  private disposed = false;
  private failed = false;
  private dirty = true;
  private nextCaptureAt = 0;
  private reason = "not entered";
  private lastError: string | null = null;
  private readonly onDispose = () => this.dispose();
  constructor(private readonly context: Context) {
    context.water.addEventListener("dispose", this.onDispose);
  }
  private release() {
    this.planar?.dispose();
    this.planar = undefined;
    this.waves?.dispose();
    this.waves = undefined;
    this.nextCaptureAt = 0;
    this.dirty = true;
  }
  suspend(reason = "comparison") {
    this.release();
    this.reason = reason;
  }
  invalidate(weather: string) {
    if (this.disposed) return;
    this.weather = weather;
    this.dirty = true;
    this.failed = false;
    this.lastError = null;
    this.nextCaptureAt = 0;
    if (weather !== "day") {
      this.suspend("weather");
      return;
    }
    this.planar?.invalidate(weather);
    this.waves?.setWeight(0);
  }
  update(renderer: T.WebGLRenderer, camera: T.PerspectiveCamera, frame: Frame) {
    if (this.disposed) return;
    camera.updateWorldMatrix(true, false);
    const position = new T.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const reason = !frame.enabled
      ? "disabled"
      : this.weather !== "day"
        ? "weather"
        : !["balanced", "high"].includes(frame.quality)
          ? "quality"
          : waterPlanarViewerWeight(position) <= 0
            ? "region"
            : null;
    if (reason) {
      this.suspend(reason);
      this.failed = false;
      return;
    }
    if (this.failed) return;
    if (!this.planar) {
      try {
        this.planar = new WaterPlanarReflections(this.context);
        this.planar.setDistortion(true);
        this.planar.invalidate(this.weather);
        this.waves = new WaterWavesComparison(
          this.context.water,
          WATER_PLANAR.level,
        );
        this.waves.setWeight(0);
      } catch (error) {
        this.lastError = String(error);
        this.failed = true;
        this.release();
        this.reason = "error";
        return;
      }
    }
    const now = frame.now ?? performance.now();
    const before = this.planar.diagnostics().captures;
    this.planar.update(
      renderer,
      camera,
      frame.allowCapture && (this.dirty || now >= this.nextCaptureAt),
    );
    const status = this.planar.diagnostics();
    if (status.status === "error") {
      this.lastError = status.error;
      this.failed = true;
      this.release();
      this.reason = "error";
      return;
    }
    if (status.captures > before) {
      this.nextCaptureAt = now + NORTH_HARBOUR_WATER_CAPTURE_INTERVAL_MS;
      this.dirty = false;
    }
    this.waves!.setWeight(status.cameraWeight);
    this.reason = status.active ? "active" : status.status;
  }
  withoutWater<TValue>(action: () => TValue): TValue {
    return this.planar ? this.planar.withoutWater(action) : action();
  }
  diagnostics() {
    return {
      enabled: !this.disposed,
      status: this.disposed ? "disposed" : this.reason,
      error: this.lastError,
      captureIntervalMs: NORTH_HARBOUR_WATER_CAPTURE_INTERVAL_MS,
      cadence:
        "at most8Hz ordinary movement refresh; initial/lighting invalidation immediate when capture scheduling permits; idle reuse",
      directionalNormals:
        "same local ocean and camera weight as planar reflection",
      planar: this.planar?.diagnostics() ?? null,
      retainedTextureBytes:
        this.planar?.diagnostics().retainedTextureBytes ?? 0,
      depthBudgetBytes: this.planar?.diagnostics().depthBudgetBytes ?? 0,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.context.water.removeEventListener("dispose", this.onDispose);
  }
}
