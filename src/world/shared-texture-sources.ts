import * as T from "three";

/** URL-owned static image sources with consumer-owned texture settings.
 * Canonical holders are never returned or rendered. Texture.copy/clone shares
 * Three's Source, so even a consumer's clone made before load sees the eventual
 * image and Source version. No image copying or global loader cache is needed.
 */
export class SharedTextureSources {
  private readonly sources = new Map<string, T.Texture>();
  private requests = 0;
  private sourceLoads = 0;

  constructor(private readonly loader: Pick<T.TextureLoader, "load">) {}

  /** Allocation/request counters only, not GPU residency or network traffic.
   * Load attempts include failures; currentURLs includes pending valid records. */
  get stats() {
    return {
      requests: this.requests,
      sourceLoads: this.sourceLoads,
      currentURLs: this.sources.size,
    } as const;
  }

  texture(url: string): T.Texture {
    this.requests++;
    const cached = this.sources.get(url);
    if (cached) return cached.clone();

    this.sourceLoads++;
    let failed = false;
    let canonical: T.Texture | undefined;
    canonical = this.loader.load(url, undefined, undefined, () => {
      failed = true;
      // A late/repeated failure from an older request must not evict a retry.
      if (this.sources.get(url) === canonical) this.sources.delete(url);
    });
    // Also handle a loader that reports failure synchronously before returning.
    if (!failed) this.sources.set(url, canonical);
    return canonical.clone();
  }
}
