import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { SharedTextureSources } from "../src/world/shared-texture-sources";
import { Materials, BASE } from "../src/world/materials";

function delayedLoader() {
  const requests: {
    url: string;
    canonical: T.Texture;
    finish: (image: HTMLImageElement) => void;
    fail: () => void;
  }[] = [];
  const loader = {
    load(url, onLoad, _onProgress, onError) {
      const canonical = new T.Texture<HTMLImageElement>();
      requests.push({
        url,
        canonical,
        finish(image) {
          // Actual TextureLoader completion semantics: mutate the existing
          // Source through Texture.image, then mark it ready for upload.
          canonical.image = image;
          canonical.needsUpdate = true;
          onLoad?.(canonical);
        },
        fail: () => onError?.(new Error("image load failed")),
      });
      return canonical;
    },
  } satisfies Pick<T.TextureLoader, "load">;
  return { loader, requests };
}

test("pending consumers and arbitrary further clones see the loaded image through one Source", () => {
  const { loader, requests } = delayedLoader();
  const cache = new SharedTextureSources(loader);
  const first = cache.texture("/textures/stone.webp"),
    nested = first.clone().clone(),
    second = cache.texture("/textures/stone.webp");
  assert.equal(requests.length, 1);
  assert.equal(first.image, null);
  assert.notEqual(
    first,
    requests[0].canonical,
    "the holder is never a rendered consumer",
  );
  assert.notEqual(second, first);
  assert.equal(first.source, nested.source);
  assert.equal(first.source, second.source);
  const before = first.source.version;
  const image = { width: 512, height: 512, complete: true } as HTMLImageElement;
  requests[0].finish(image);
  for (const t of [
    first,
    nested,
    second,
    cache.texture("/textures/stone.webp"),
  ]) {
    assert.equal(t.image, image);
    assert.equal(t.source, requests[0].canonical.source);
    assert.ok(
      t.version > 0,
      "consumer is eligible for its first renderer upload",
    );
    assert.ok(
      t.source.version > before,
      "late completion updates the shared source",
    );
  }
  assert.equal(requests.length, 1);
});

test("Materials keeps color interpretation and sampler/UV transforms independent", () => {
  const { loader, requests } = delayedLoader();
  // Skip procedural canvas construction; exercise the real texture method.
  const m = Object.create(Materials.prototype) as Materials;
  m.loader = loader as T.TextureLoader;
  const color = m.texture("same.webp", true),
    data = m.texture("same.webp");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${BASE}textures/same.webp`);
  assert.equal(color.source, data.source);
  assert.equal(color.colorSpace, T.SRGBColorSpace);
  assert.equal(data.colorSpace, T.NoColorSpace);
  color.repeat.set(0.5, 2);
  color.offset.set(0.2, 0.3);
  color.center.set(0.5, 0.5);
  color.rotation = 0.3;
  color.wrapS = T.ClampToEdgeWrapping;
  color.anisotropy = 2;
  color.flipY = false;
  color.updateMatrix();
  assert.deepEqual(data.repeat.toArray(), [1, 1]);
  assert.deepEqual(data.offset.toArray(), [0, 0]);
  assert.deepEqual(data.center.toArray(), [0, 0]);
  assert.equal(data.rotation, 0);
  assert.equal(data.wrapS, T.RepeatWrapping);
  assert.equal(data.anisotropy, 8);
  assert.equal(data.flipY, true);
  const third = m.texture("same.webp", true);
  assert.deepEqual(third.repeat.toArray(), [1, 1]);
  assert.equal(third.wrapS, T.RepeatWrapping);
  assert.equal(requests[0].canonical.colorSpace, T.NoColorSpace);
  assert.equal(requests[0].canonical.wrapS, T.ClampToEdgeWrapping);
  m.texture("other.webp");
  assert.equal(requests.length, 2, "different resolved URLs remain distinct");
});

test("consumer disposal leaves siblings, pending load and cached source usable", () => {
  const { loader, requests } = delayedLoader();
  const cache = new SharedTextureSources(loader);
  const a = cache.texture("stone"),
    b = cache.texture("stone");
  let canonicalDisposals = 0,
    siblingDisposals = 0;
  requests[0].canonical.addEventListener("dispose", () => canonicalDisposals++);
  b.addEventListener("dispose", () => siblingDisposals++);
  a.dispose();
  const image = { width: 1, height: 1, complete: true } as HTMLImageElement;
  requests[0].finish(image);
  const c = cache.texture("stone");
  assert.equal(c.source, b.source);
  assert.equal(c.image, image);
  assert.equal(requests.length, 1);
  assert.equal(canonicalDisposals, 0);
  assert.equal(siblingDisposals, 0);
});

test("failed request is evicted and late old errors cannot evict a successful retry", () => {
  const { loader, requests } = delayedLoader();
  const cache = new SharedTextureSources(loader);
  const failed = cache.texture("stone");
  requests[0].fail();
  const retry = cache.texture("stone");
  assert.equal(requests.length, 2);
  assert.notEqual(failed.source, retry.source);
  requests[1].finish({
    width: 1,
    height: 1,
    complete: true,
  } as HTMLImageElement);
  requests[0].fail();
  assert.equal(cache.texture("stone").source, retry.source);
  assert.equal(requests.length, 2);
  assert.equal(
    failed.image,
    null,
    "existing failed consumers do not silently acquire another source",
  );
});

test("synchronous failure and separate cache owners never retain or cross-share a bad record", () => {
  let calls = 0;
  const cache = new SharedTextureSources({
    load(_url, _onLoad, _progress, onError) {
      calls++;
      onError?.(new Error("synchronous failure"));
      return new T.Texture<HTMLImageElement>();
    },
  });
  assert.notEqual(cache.texture("bad").source, cache.texture("bad").source);
  assert.equal(calls, 2);
  assert.deepEqual(cache.stats, {
    requests: 2,
    sourceLoads: 2,
    currentURLs: 0,
  });
  const { loader, requests } = delayedLoader();
  const a = new SharedTextureSources(loader),
    b = new SharedTextureSources(loader);
  assert.notEqual(a.texture("same").source, b.texture("same").source);
  assert.equal(
    requests.length,
    2,
    "cache lifetime belongs to one Materials owner",
  );
});

test("statistics are snapshots of requests, attempted loads and currently retained URL records", () => {
  const { loader, requests } = delayedLoader();
  const m = Object.create(Materials.prototype) as Materials;
  m.loader = loader as T.TextureLoader;
  const empty = m.textureSourceStats();
  assert.deepEqual(empty, { requests: 0, sourceLoads: 0, currentURLs: 0 });
  m.texture("a");
  m.texture("a", true);
  m.texture("b");
  assert.deepEqual(m.textureSourceStats(), {
    requests: 3,
    sourceLoads: 2,
    currentURLs: 2,
  });
  requests[0].fail();
  assert.deepEqual(m.textureSourceStats(), {
    requests: 3,
    sourceLoads: 2,
    currentURLs: 1,
  });
  m.texture("a");
  requests[0].fail();
  requests[2].finish({
    width: 1,
    height: 1,
    complete: true,
  } as HTMLImageElement);
  const complete = m.textureSourceStats();
  assert.deepEqual(complete, { requests: 4, sourceLoads: 3, currentURLs: 2 });
  assert.notEqual(
    complete,
    m.textureSourceStats(),
    "inspection cannot mutate cache counters",
  );
  assert.deepEqual(empty, { requests: 0, sourceLoads: 0, currentURLs: 0 });
  const throwing = new SharedTextureSources({
    load() {
      throw new Error("loader threw");
    },
  });
  assert.throws(() => throwing.texture("bad"), /loader threw/);
  assert.deepEqual(throwing.stats, {
    requests: 1,
    sourceLoads: 1,
    currentURLs: 0,
  });
});
