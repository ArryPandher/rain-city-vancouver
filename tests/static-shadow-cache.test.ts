import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { StaticShadowCache } from "../src/rendering/static-shadow-cache";

test("unchanged paused frames reuse shadows; movement, world and gameplay invalidate them", () => {
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: false },
  } as T.WebGLRenderer;
  const cache = new StaticShadowCache(),
    camera = new T.PerspectiveCamera();
  const frames: boolean[] = [];
  const render = (revision: string, active = false) =>
    cache.render(renderer, camera, revision, active, () =>
      frames.push(renderer.shadowMap.autoUpdate),
    );
  render("0/day/balanced");
  render("0/day/balanced");
  camera.position.x = 1;
  camera.updateMatrixWorld();
  render("0/day/balanced");
  render("0/day/balanced");
  render("1/day/balanced");
  render("1/night/balanced");
  render("1/night/high");
  render("1/night/high", true);
  render("1/night/high", true);
  assert.deepEqual(frames, [
    true,
    false,
    true,
    false,
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  renderer.shadowMap.needsUpdate = true;
  cache.render(renderer, camera, "1/night/high", false, () => {
    assert.equal(renderer.shadowMap.autoUpdate, false);
    assert.equal(renderer.shadowMap.needsUpdate, true);
  });
});

test("failed rendering restores renderer state and does not cache an unfinished map", () => {
  const renderer = {
    shadowMap: { autoUpdate: false, needsUpdate: false },
  } as T.WebGLRenderer;
  const cache = new StaticShadowCache(),
    camera = new T.PerspectiveCamera();
  assert.throws(
    () =>
      cache.render(renderer, camera, "first", false, () => {
        throw new Error("draw failed");
      }),
    /draw failed/,
  );
  assert.equal(renderer.shadowMap.autoUpdate, false);
  cache.render(renderer, camera, "first", false, () =>
    assert.equal(renderer.shadowMap.autoUpdate, true),
  );
  assert.equal(renderer.shadowMap.autoUpdate, false);
});
