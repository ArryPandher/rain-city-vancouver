import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { fountainSpray, fountainWetStone } from "../src/world/harbour-fountain";
import { HARBOUR_POOL_LEVEL } from "../src/world/harbour-green-site";
import type { Materials } from "../src/world/materials";

test("every moving drop remains within its culling bounds throughout its lifetime", () => {
  const { jets, core } = fountainSpray(
    { value: 0 },
    new T.MeshStandardMaterial(),
  );
  const g = jets.geometry,
    p = g.getAttribute("position"),
    v = g.getAttribute("velocity"),
    life = g.getAttribute("life");
  const point = new T.Vector3();
  for (let i = 0; i < p.count; i++)
    for (let step = 0; step <= 20; step++) {
      const t = (life.getX(i) * step) / 20;
      point.set(
        p.getX(i) + v.getX(i) * t,
        p.getY(i) + v.getY(i) * t - 4.9 * t * t,
        p.getZ(i) + v.getZ(i) * t,
      );
      assert.ok(g.boundingBox!.containsPoint(point), `${i}/${step}`);
      assert.ok(g.boundingSphere!.containsPoint(point));
    }
  core.geometry.computeBoundingBox();
  assert.ok(core.geometry.boundingBox!.min.y > HARBOUR_POOL_LEVEL - 0.02);
  assert.ok(core.geometry.boundingBox!.max.y < HARBOUR_POOL_LEVEL + 2.3);
});

test("spray follows actual drawing-buffer projection and weather without forcing white pixels", () => {
  const water = new T.MeshStandardMaterial({ envMapIntensity: 0.28 }),
    { jets } = fountainSpray({ value: 0 }, water);
  const shader = jets.material as T.ShaderMaterial;
  const camera = new T.PerspectiveCamera(60, 1.5, 0.1, 1000);
  const renderer = {
    getDrawingBufferSize: (v: T.Vector2) => v.set(900, 600),
  } as T.WebGLRenderer;
  jets.onBeforeRender(
    renderer,
    new T.Scene(),
    camera,
    jets.geometry,
    jets.material,
    new T.Group(),
  );
  const initial = shader.uniforms.hgScale.value;
  assert.ok(Math.abs(initial - 300 * Math.sqrt(3)) < 0.01);
  assert.equal(shader.uniforms.hgLight.value, 0.28);
  water.envMapIntensity = 1.05;
  camera.fov = 30;
  camera.updateProjectionMatrix();
  jets.onBeforeRender(
    renderer,
    new T.Scene(),
    camera,
    jets.geometry,
    jets.material,
    new T.Group(),
  );
  assert.ok(shader.uniforms.hgScale.value > initial);
  assert.equal(shader.uniforms.hgLight.value, 1.05);
});

test("water film keeps real substrate textures and writes depth for ground contact", () => {
  const m = { texture: () => new T.Texture() } as unknown as Materials;
  const wet = fountainWetStone(m, { value: 0 });
  assert.ok(wet.map && wet.normalMap && wet.roughnessMap);
  assert.equal(wet.transparent, false);
  assert.equal(wet.depthWrite, true);
  assert.equal(wet.metalness, 0);
});
