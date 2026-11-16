type StartupStage = {
  name: string;
  startedMs: number;
  endedMs?: number;
  invocationMs?: number;
  error?: string;
};

/** Sequential wall-clock stages, not GPU timings. Inter-stage UI yields and
 * asset waits belong to the named stage; invocationMs isolates synchronous work. */
export class StartupTimings {
  readonly startedAt = new Date().toISOString();
  private readonly origin: number;
  private stages: StartupStage[] = [];
  private finished = false;
  constructor(private readonly now = () => performance.now()) {
    this.origin = now();
  }
  begin(name: string) {
    if (this.finished) return;
    const at = this.now() - this.origin;
    const previous = this.stages.at(-1);
    if (previous) previous.endedMs = at;
    this.stages.push({ name, startedMs: at });
  }
  invocation(milliseconds: number) {
    const current = this.stages.at(-1);
    if (current && !this.finished) current.invocationMs = milliseconds;
  }
  finish(error?: unknown) {
    if (this.finished) return;
    const current = this.stages.at(-1);
    if (current) {
      current.endedMs = this.now() - this.origin;
      if (error !== undefined) current.error = String(error);
    }
    this.finished = true;
  }
  snapshot() {
    const at = this.now() - this.origin;
    return {
      startedAt: this.startedAt,
      note: "Sequential wall-clock stages include asset waits and UI yields; invocationMs is synchronous call time. These are not GPU timings.",
      complete: this.finished && !this.stages.at(-1)?.error,
      status: this.finished
        ? this.stages.at(-1)?.error
          ? "failed"
          : "ready"
        : "loading",
      stages: this.stages.map((stage) => ({
        ...stage,
        durationMs: (stage.endedMs ?? at) - stage.startedMs,
      })),
    };
  }
  text() {
    const snapshot = this.snapshot();
    return [
      `Started ${this.startedAt}`,
      "Stage times include waits/yields; not GPU timings.",
      "Updated at stage boundaries; blocked JavaScript cannot refresh this text.",
      ...snapshot.stages.map(
        (s) =>
          `+${(s.startedMs / 1000).toFixed(1)}s  ${s.name}: ${(s.durationMs / 1000).toFixed(2)}s${s.endedMs === undefined ? " (active)" : ""}${s.invocationMs === undefined ? "" : `; call ${(s.invocationMs / 1000).toFixed(2)}s`}${s.error ? `; FAILED: ${s.error}` : ""}`,
      ),
    ].join("\n");
  }
}
