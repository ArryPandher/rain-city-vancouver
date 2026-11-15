import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { profileRender } from "../src/rendering/render-profile";
function fixture() {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const material = new T.MeshStandardMaterial({ name: "Measured canopy" });
  const mesh = new T.InstancedMesh(new T.BoxGeometry(), material, 4);
  mesh.name = "Near tree";
  mesh.computeBoundingSphere();
  scene.add(mesh);
  const renderer = {
    extensions: { has: () => false },
    info: { render: { calls: 0, triangles: 0, lines: 0, points: 0 } },
  } as unknown as T.WebGLRenderer;
  return { scene, camera, material, mesh, renderer };
}
test("attributes actual beauty and shadow submissions including instancing and multiple draws", () => {
  const { scene, camera, material, mesh, renderer } = fixture();
  const before = mesh.onBeforeRender,
    after = mesh.onAfterRender,
    bounds = mesh.boundingSphere!.clone();
  let shadowCallback = 0;
  mesh.onBeforeShadow = () => {
    shadowCallback++;
  };
  const shadowHook = mesh.onBeforeShadow;
  const result = profileRender(renderer, scene, camera, () => {
    mesh.onBeforeShadow(
      renderer,
      mesh as unknown as T.Scene,
      camera,
      camera,
      mesh.geometry,
      material,
      null as never,
    );
    renderer.info.render.calls += 1;
    renderer.info.render.triangles += 48;
    mesh.onAfterShadow(
      renderer,
      mesh as unknown as T.Scene,
      camera,
      camera,
      mesh.geometry,
      material,
      null as never,
    );
    mesh.onBeforeRender(
      renderer,
      scene,
      camera,
      mesh.geometry,
      material,
      null as never,
    );
    renderer.info.render.calls += 2;
    renderer.info.render.triangles += 96;
    mesh.onAfterRender(
      renderer,
      scene,
      camera,
      mesh.geometry,
      material,
      null as never,
    );
    renderer.info.render.calls += 3;
    renderer.info.render.triangles += 6; // fullscreen passes
  });
  assert.equal(result.totals.shadow.triangles, 48);
  assert.equal(result.totals.beauty.triangles, 96);
  assert.equal(result.totals.beauty.calls, 2);
  assert.equal(result.frame.triangles, 150);
  assert.equal(result.topObjects[0].instances, 4);
  assert.equal(shadowCallback, 1);
  assert.equal(mesh.onBeforeRender, before);
  assert.equal(mesh.onAfterRender, after);
  assert.equal(mesh.onBeforeShadow, shadowHook);
  assert.ok(mesh.boundingSphere!.equals(bounds));
  assert.equal(mesh.visible, true);
});
test("failed diagnostic rendering restores every installed hook", () => {
  const { scene, camera, mesh, renderer } = fixture();
  const hooks = [
    mesh.onBeforeRender,
    mesh.onAfterRender,
    mesh.onBeforeShadow,
    mesh.onAfterShadow,
  ];
  assert.throws(
    () =>
      profileRender(renderer, scene, camera, () => {
        throw new Error("draw failed");
      }),
    /draw failed/,
  );
  assert.deepEqual(
    [
      mesh.onBeforeRender,
      mesh.onAfterRender,
      mesh.onBeforeShadow,
      mesh.onAfterShadow,
    ],
    hooks,
  );
});
