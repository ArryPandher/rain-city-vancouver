/** Yield between asset installs / CPU batches so the existing city can render. */
export const yieldDetailFrame = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 16));
export type DetailKind = "street" | "forest";
export type DetailState = {
  state: "waiting" | "loading" | "ready" | "failed";
  milliseconds?: number;
};
/** One optional detail job at a time. Forest assets are demand-loaded near Stanley;
 * every fallback and collision is already installed before this queue runs. */
export class TreeDetailStream {
  readonly status: Record<DetailKind, DetailState> = {
    street: { state: "waiting" },
    forest: { state: "waiting" },
  };
  private busy = false;
  constructor(
    private tasks: Record<DetailKind, () => Promise<void>>,
    private failed: (kind: DetailKind, error: unknown) => void = () => {},
  ) {}
  update(x: number, z: number) {
    if (this.busy) return;
    const nearForest = x > -3180 && x < -430 && z > -3790 && z < -1030;
    const kind: DetailKind | undefined =
      nearForest && this.status.forest.state === "waiting"
        ? "forest"
        : this.status.street.state === "waiting"
          ? "street"
          : undefined;
    if (!kind) return;
    this.busy = true;
    this.status[kind] = { state: "loading" };
    const started = performance.now();
    void yieldDetailFrame()
      .then(() => this.tasks[kind]())
      .then(
        () => {
          this.status[kind] = {
            state: "ready",
            milliseconds: performance.now() - started,
          };
        },
        (error) => {
          this.status[kind] = {
            state: "failed",
            milliseconds: performance.now() - started,
          };
          this.failed(kind, error);
        },
      )
      .finally(() => {
        this.busy = false;
      });
  }
}
