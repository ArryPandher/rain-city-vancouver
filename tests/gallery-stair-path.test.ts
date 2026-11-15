import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  clipGalleryStairPath,
  galleryRearStepHeight,
  GALLERY_REAR_STEPS,
} from "../src/world/gallery-rear-entry";
import { geo, roadWidth, type Road } from "../src/world/data";
import { ribbon } from "../src/world/geometry";
import source from "../src/world/gallery-rear-entry-data.json";
const [ox, oz] = geo(
  ...([GALLERY_REAR_STEPS.origin[1], GALLERY_REAR_STEPS.origin[0]] as [
    number,
    number,
  ]),
);
const world = (u: number, v: number): [number, number] => [
  ox + Math.cos(source.angle) * u - Math.sin(source.angle) * v,
  oz + Math.sin(source.angle) * u + Math.cos(source.angle) * v,
];
const height = (x: number, z: number) => galleryRearStepHeight(x, z) ?? 0;
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const ray = (u: number, v: number) => {
  const [x, z] = world(u, v);
  return new T.Raycaster(new T.Vector3(x, 10, z), new T.Vector3(0, -1, 0));
};
test("clipping a stair-crossing ribbon preserves both approaches without leaving a sloped overlay", () => {
  const v = GALLERY_REAR_STEPS.startV;
  const original = ribbon(
    [...world(-1.9, 20), ...world(-1.9, v + 1), ...world(-1.9, 40)],
    2,
    0.15,
    height,
  );
  const clipped = clipGalleryStairPath(original, height, 0.15),
    mesh = new T.Mesh(clipped, material);
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < 12; i++)
    assert.equal(
      ray(-1.9, v + (i + 0.5) * 0.35).intersectObject(mesh).length,
      0,
      "custom treads remain visible",
    );
  for (const sample of [21, 30, 35, 39]) {
    const hits = ray(-1.9, sample).intersectObject(mesh);
    assert.ok(
      hits.length > 0,
      "the mapped path remains outside the stair rectangle",
    );
    assert.ok(
      Math.abs(hits[0].point.y - 0.15) < 1e-6,
      "approach has no floating endpoint ramp",
    );
  }
  const far = ribbon([0, 0, 10, 0], 2, 0.15);
  assert.equal(
    clipGalleryStairPath(far, height, 0.15),
    far,
    "unrelated paths are returned unchanged",
  );
});
test("actual mapped footways leave every repaired gallery tread free of generic overlays", () => {
  const roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads as Road[];
  const near = roads.filter(
    (r) =>
      ["footway", "path", "pedestrian", "steps"].includes(r.kind) &&
      Math.min(...r.pts.filter((_, i) => i % 2 === 0)) < -30 &&
      Math.max(...r.pts.filter((_, i) => i % 2 === 0)) > -80 &&
      Math.min(...r.pts.filter((_, i) => i % 2 === 1)) < 60 &&
      Math.max(...r.pts.filter((_, i) => i % 2 === 1)) > 0,
  );
  assert.ok(near.length > 0);
  let affected = 0;
  const meshes = near.map((r) => {
    const g = ribbon(r.pts, roadWidth(r), r.walkway ? 0.15 : 0.07, height),
      clipped = clipGalleryStairPath(g, height, r.walkway ? 0.15 : 0.07);
    if (clipped !== g) affected++;
    const m = new T.Mesh(clipped, material);
    m.updateMatrixWorld(true);
    return m;
  });
  assert.ok(
    affected > 0,
    "exercise the actual path crossing rather than an empty fixture",
  );
  for (let i = 0; i < 12; i++)
    for (const u of [-6, -1.9, 2])
      assert.equal(
        ray(u, GALLERY_REAR_STEPS.startV + (i + 0.5) * 0.35).intersectObjects(
          meshes,
        ).length,
        0,
      );
});
