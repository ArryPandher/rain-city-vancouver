import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  waterPlanarRippleUV,
  WATER_PLANAR_DISTORTION as D,
} from "../src/world/water-planar-distortion";
import { waterWaveSample } from "../src/world/water-waves";

function projection() {
  const camera = new T.PerspectiveCamera(62, 1.4, 0.1, 24000);
  camera.position.set(680, -10.38, -690);
  camera.up.set(0, -1, 0);
  camera.lookAt(700, 0, -900);
  camera.updateMatrixWorld(true);
  return new T.Matrix4()
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(camera.projectionMatrix)
    .multiply(camera.matrixWorldInverse);
}
const eye = new T.Vector3(-0.1, 0.2, 0.97).normalize();
test("flat normals preserve exact planar lookup and normal-driven angular projection rotates with the camera", () => {
  const m = projection(),
    base = new T.Vector2(0.42, 0.36),
    up = new T.Vector3(0, 1, 0);
  assert.deepEqual(waterPlanarRippleUV(base, m, eye, up), base);
  const n = new T.Vector3(0.08, 1, -0.05).normalize(),
    uv = waterPlanarRippleUV(base, m, eye, n);
  assert.ok(uv.distanceTo(base) > 1e-4);
  for (const angle of [-2.1, -0.8, 0.5, 1.7]) {
    const rotation = new T.Matrix4().makeRotationY(angle);
    const rotated = waterPlanarRippleUV(
      base,
      m.clone().multiply(rotation.clone().invert()),
      eye.clone().transformDirection(rotation),
      n.clone().transformDirection(rotation),
    );
    assert.ok(
      rotated.distanceTo(uv) < 1e-12,
      "world normal axes must not be assigned directly to screen UV axes",
    );
  }
  const translated = m
    .clone()
    .multiply(new T.Matrix4().makeTranslation(1000, -99, 500));
  assert.ok(
    waterPlanarRippleUV(base, translated, eye, n).distanceTo(uv) < 1e-12,
    "direction samples use homogeneous w=0",
  );
});

test("all capture edges fall back to original planar sample; extreme normals never sample outside target or exceed bound", () => {
  const m = projection();
  for (const x of [0, 0.5 / 512, 0.01, 0.3, 0.7, 0.99, 1 - 0.5 / 512, 1])
    for (const y of [0, 0.5 / 512, 0.02, 0.5, 0.98, 1 - 0.5 / 512, 1]) {
      const base = new T.Vector2(x, y);
      for (let angle = -Math.PI; angle <= Math.PI; angle += 0.1) {
        const n = new T.Vector3(
          Math.sin(angle),
          Math.cos(angle),
          0.2,
        ).normalize();
        const uv = waterPlanarRippleUV(base, m, eye, n);
        assert.ok(Number.isFinite(uv.x + uv.y));
        assert.ok(uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1);
        assert.ok(uv.distanceTo(base) * D.resolution <= D.maxTexels + 1e-10);
        if (Math.min(x, y, 1 - x, 1 - y) <= 0.5 / 512)
          assert.ok(uv.distanceTo(base) < 1e-12);
      }
    }
  const normal = new T.Vector3(0.1, 1, 0.06).normalize();
  let previous = waterPlanarRippleUV(new T.Vector2(0, 0.5), m, eye, normal);
  for (let x = 0.00001; x <= 0.02; x += 0.00001) {
    const uv = waterPlanarRippleUV(new T.Vector2(x, 0.5), m, eye, normal);
    assert.ok(
      uv.distanceTo(previous) < 0.0001,
      "edge blend must not jump to another radiance source",
    );
    previous = uv;
  }
});

test("existing analytic filtered field yields continuous UV motion, resolves to flat at distant pixel footprints and adds no second grid", () => {
  const m = projection(),
    base = new T.Vector2(0.5, 0.5);
  const sample = (time: number, footprint = 0) =>
    waterPlanarRippleUV(
      base,
      m,
      eye,
      waterWaveSample(712, -850, time, [footprint, 0], [0, footprint]).normal,
    );
  const points = Array.from({ length: 100 }, (_, i) => sample(i * 0.01));
  assert.ok(points.some((p) => p.distanceTo(base) > 0.001));
  for (let i = 1; i < points.length; i++)
    assert.ok(points[i].distanceTo(points[i - 1]) < 0.002);
  assert.ok(
    sample(1, 100).distanceTo(base) < 1e-12,
    "unresolved crests return to the same planar reflection, not sky/fallback colour",
  );
});

test("facets pointing below the captured mean plane retain undistorted radiance rather than sampling HDR ground", () => {
  const m = projection(),
    base = new T.Vector2(0.5, 0.5),
    normal = new T.Vector3(0, 0.7, -0.7).normalize();
  assert.ok(eye.clone().negate().reflect(normal).y < 0);
  assert.deepEqual(waterPlanarRippleUV(base, m, eye, normal), base);
});
