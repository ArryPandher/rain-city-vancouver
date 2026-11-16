import * as T from "three";

// A pending Source owns the consumers that must be marked uploadable on load.
// Texture.clone() preserves this subclass, including downstream facade clones.
const waiting = new WeakMap<T.Source<unknown>, Set<T.Texture>>();
class SharedImageTexture extends T.Texture {
  override set needsUpdate(value: boolean) {
    if (value && this.image === null) {
      waiting.get(this.source)?.add(this);
      return;
    }
    super.needsUpdate = value;
  }
  override dispose() {
    waiting.get(this.source)?.delete(this);
    super.dispose();
  }
}
function publish(source: T.Source<unknown>) {
  const consumers = waiting.get(source);
  waiting.delete(source);
  for (const texture of consumers ?? []) texture.needsUpdate = true;
}

/** URL-owned static image sources with consumer-owned texture settings.
 * Canonical holders are never returned or rendered. Texture.copy/clone shares
 * Three's Source, so even a consumer's clone made before load sees the eventual
 * image and Source version. Pending clones defer their upload version until
 * completion; failed clones remain unready rather than warning every frame.
 * No image copying or global loader cache is needed.
 */
export class SharedTextureSources {
  private readonly sources = new Map<string, T.Texture>();
  private readonly failedURLs = new Set<string>();
  private requests = 0;
  private sourceLoads = 0;

  constructor(private readonly loader: Pick<T.TextureLoader, "load">) {}

  /** Allocation/request counters only, not GPU residency or network traffic.
   * Load attempts include failures; currentURLs includes pending valid records. */
  get stats() {
    const pendingURLs = [...this.sources]
      .filter(([, t]) => t.image === null)
      .map(([url]) => url);
    return {
      requests: this.requests,
      sourceLoads: this.sourceLoads,
      currentURLs: this.sources.size,
      readyCount: this.sources.size - pendingURLs.length,
      pendingURLs,
      failedURLs: [...this.failedURLs],
    } as const;
  }

  texture(url: string): T.Texture {
    this.requests++;
    const cached = this.sources.get(url);
    if (cached) return new SharedImageTexture().copy(cached);

    this.sourceLoads++;
    let failed = false;
    let canonical: T.Texture | undefined;
    this.failedURLs.delete(url);
    try {
      canonical = this.loader.load(
        url,
        (loaded) => {
          publish(loaded.source);
          if (!canonical || this.sources.get(url) === loaded)
            this.failedURLs.delete(url);
        },
        undefined,
        () => {
          failed = true;
          if (canonical) waiting.delete(canonical.source);
          // Late/repeated errors from older requests cannot alter a retry.
          if (!canonical || this.sources.get(url) === canonical) {
            this.failedURLs.add(url);
            this.sources.delete(url);
          }
        },
      );
    } catch (error) {
      this.failedURLs.add(url);
      throw error;
    }
    // Also handle a loader that reports failure synchronously before returning.
    if (!failed) {
      this.sources.set(url, canonical);
      if (canonical.image === null) waiting.set(canonical.source, new Set());
    }
    return new SharedImageTexture().copy(canonical);
  }
}
