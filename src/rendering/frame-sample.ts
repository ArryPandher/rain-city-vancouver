export interface FrameSampleContext {
  viewport: { width: number; height: number; pixelRatio: number };
  preset: string;
  weather: string;
  position: [number, number, number];
}
export interface FrameSampleResult {
  valid: boolean;
  reason?: string;
  targetSeconds: number;
  elapsedSeconds: number;
  frames: number;
  meanFPS: number | null;
  frameMilliseconds: {
    median: number;
    p95: number;
    p99: number;
    max: number;
  } | null;
  framesOver50ms: number;
  framesOver100ms: number;
  start: FrameSampleContext;
  end: FrameSampleContext;
}
/** Raw RAF intervals, never the capped physics delta. The first RAF primes the
 * sample so an interval beginning before the button click is not counted.
 * Percentiles use nearest-rank; elapsed includes the complete final interval. */
export class FrameSample {
  private intervals: number[] = [];
  private primed = false;
  private elapsed = 0;
  private finished = false;
  constructor(
    readonly start: FrameSampleContext,
    readonly targetSeconds = 20,
  ) {}
  add(rawSeconds: number) {
    if (this.finished) return false;
    if (!this.primed) {
      this.primed = true;
      return false;
    }
    if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) return false;
    this.intervals.push(rawSeconds * 1000);
    this.elapsed += rawSeconds;
    return this.elapsed >= this.targetSeconds;
  }
  finish(end: FrameSampleContext, reason?: string): FrameSampleResult {
    this.finished = true;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const percentile = (p: number) =>
      sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
    const n = sorted.length;
    return {
      valid: !reason && this.elapsed >= this.targetSeconds,
      ...(reason || this.elapsed < this.targetSeconds
        ? { reason: reason ?? "sample incomplete" }
        : {}),
      targetSeconds: this.targetSeconds,
      elapsedSeconds: this.elapsed,
      frames: n,
      meanFPS: n ? n / this.elapsed : null,
      frameMilliseconds: n
        ? {
            median:
              n % 2
                ? sorted[(n - 1) / 2]
                : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
            p95: percentile(0.95),
            p99: percentile(0.99),
            max: sorted[n - 1],
          }
        : null,
      framesOver50ms: sorted.filter((x) => x > 50).length,
      framesOver100ms: sorted.filter((x) => x > 100).length,
      start: this.start,
      end,
    };
  }
}
