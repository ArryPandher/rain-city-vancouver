import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import { Batcher, ribbon } from "../src/world/geometry";
import { addGalleryEntryStairs } from "../src/world/gallery-entry-stairs";
import {
  GALLERY_REAR_STEPS as S,
  GALLERY_STAIR_SURFACES as surfaces,
  galleryStairBackV,
  GALLERY_RETAINED_CAP_Y,
} from "../src/world/gallery-entry-stairs-data";
import { galleryStairWorld } from "../src/world/gallery-stair-framing-data";
import {
  galleryRearStepHeight,
  clipGalleryStairPath,
} from "../src/world/gallery-rear-entry";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
import { robsonWalkingArrival } from "../src/game/robson-walking-arrival";
import { shortenChaseBoom } from "../src/game/chase-camera";

function assembly() {
  const root = new T.Group(),
    batch = new Batcher(root, 512),
    builder = new ArchitecturalMesh(batch, 0, 0);
  addGalleryEntryStairs(builder, new T.MeshBasicMaterial());
  builder.finish();
  const chunks = batch.finish();
  root.updateMatrixWorld(true);
  return { root, chunks };
}
const ray = (root: T.Object3D, p: number[], d: number[]) =>
  new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...d),
    0,
    20,
  ).intersectObject(root, true)[0];

test("two flights and broad intermediate landing have closed upward treads and outward risers", () => {
  const { root, chunks } = assembly();
  assert.equal(chunks.length, 1);
  assert.equal(surfaces.filter((s) => s.kind === "tread").length, 24);
  assert.ok(S.rise > 0.13 && S.rise < 0.14);
  assert.ok(S.endV - S.startV > 9.9);
  for (const [i, s] of surfaces.entries()) {
    const u = (S.minU + S.maxU) / 2,
      v = Math.max((s.minV + s.maxV) / 2, galleryStairBackV(S.minU) + 0.03);
    const hit = ray(root, [u, 5, v], [0, -1, 0])!;
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y - s.y) < 1e-5);
    assert.ok(hit.face!.normal.y > 0.999);
    const below = surfaces[i + 1]?.y ?? -S.datum;
    if (s.y - below > 0.01) {
      const riser = ray(
        root,
        [u, (s.y + below) / 2, s.maxV + 0.05],
        [0, 0, -1],
      )!;
      assert.ok(Math.abs(riser.point.z - s.maxV) < 1e-5);
      assert.ok(riser.face!.normal.z > 0.999);
      assert.ok(Math.abs(s.y - below - S.rise) < 1e-9);
    }
    for (const side of [-1, 1]) {
      const edge = side < 0 ? S.minU : S.maxU;
      const hit = ray(
        root,
        [edge + side, (s.y - S.datum) / 2, v],
        [-side, 0, 0],
      )!;
      assert.ok(Math.abs(hit.point.x - edge) < 1e-5);
      assert.ok(hit.face!.normal.x * side > 0.999);
    }
    const base = ray(root, [u, -1, v], [0, 1, 0])!;
    assert.ok(Math.abs(base.point.y + S.datum) < 1e-5);
    assert.ok(base.face!.normal.y < -0.999);
  }
  const p = chunks[0].geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
});

test("every new profile boundary matches walking height and perpendicular path clips without height feedback", () => {
  const { root } = assembly();
  for (const s of surfaces)
    for (const v of [s.minV + 0.001, (s.minV + s.maxV) / 2, s.maxV - 0.001]) {
      for (const u of [S.minU + 0.05, (S.minU + S.maxU) / 2, S.maxU - 0.05]) {
        const [x, z] = galleryStairWorld(u, v);
        if (v < galleryStairBackV(u)) {
          assert.equal(
            ray(root, [u, 5, v], [0, -1, 0]),
            undefined,
            "retained foundation cap receives no new overlay",
          );
          assert.equal(
            galleryRearStepHeight(x, z),
            GALLERY_RETAINED_CAP_Y + S.datum,
          );
          continue;
        }
        const hit = ray(root, [u, 5, v], [0, -1, 0])!;
        assert.ok(
          Math.abs(galleryRearStepHeight(x, z)! - (hit.point.y + S.datum)) <
            1e-5,
        );
      }
    }
  for (const v of [
    surfaces[1].minV + 0.1,
    surfaces.find((s) => s.kind === "landing" && s.index === 1)!.minV + 0.4,
    S.endV - 0.2,
  ]) {
    const pts = [
      ...galleryStairWorld(S.minU - 3, v),
      ...galleryStairWorld(S.maxU + 3, v),
    ];
    const height = (x: number, z: number) => galleryRearStepHeight(x, z) ?? 0;
    const clipped = clipGalleryStairPath(
      ribbon(pts, 1, 0.15, height),
      height,
      0.15,
    );
    const mesh = new T.Mesh(clipped, new T.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    for (const u of [S.minU - 1, S.maxU + 1]) {
      const [x, z] = galleryStairWorld(u, v),
        hit = ray(mesh, [x, 5, z], [0, -1, 0])!;
      assert.ok(hit);
      assert.ok(
        Math.abs(hit.point.y - 0.15) < 1e-5,
        "perpendicular approach stays on original ground",
      );
    }
    const [x, z] = galleryStairWorld((S.minU + S.maxU) / 2, v);
    assert.equal(
      ray(mesh, [x, 5, z], [0, -1, 0]),
      undefined,
      "no generic ribbon caps treads/landing",
    );
  }
  for (const [u, v] of [
    [S.minU - 0.02, S.startV + 2],
    [S.maxU + 0.02, S.endV - 2],
    [(S.minU + S.maxU) / 2, S.endV + 0.02],
  ])
    assert.equal(galleryRearStepHeight(...galleryStairWorld(u, v)), undefined);
});

test("full city ordinary ascent, normal chase camera and map arrival remain clear", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    try {
      return new Response(
        fs.readFileSync(`public/${String(url).replace(/^\//, "")}`),
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  let data;
  try {
    data = await loadCity();
  } finally {
    globalThis.fetch = fetch;
  }
  const world = new CollisionWorld(data);
  assert.ok(robsonWalkingArrival("robson", true, world));
  const u = (S.minU + S.maxU) / 2;
  let previous = galleryStairWorld(u, S.endV + 0.3),
    y = world.walkingHeight(...previous);
  for (let v = S.endV + 0.22; v > S.startV + 0.8; v -= 0.08) {
    const p = galleryStairWorld(u, v),
      nextY = world.walkingHeight(...p, y);
    assert.ok(
      nextY - y <= 0.14 && nextY >= y - 1e-8,
      "ordinary small step, no jump required",
    );
    const move = world.move(
      ...previous,
      p[0] - previous[0],
      p[1] - previous[1],
      0.36,
      y,
    );
    assert.equal(move.hit, false);
    assert.ok(Math.hypot(move.x - p[0], move.z - p[1]) < 1e-6);
    assert.equal(world.blocked(...p, 0.36, nextY), false);
    const focus = new T.Vector3(p[0], nextY + 1.52, p[1]),
      behind = galleryStairWorld(u, v + 4.3);
    const camera = new T.Vector3(behind[0], nextY + 2.07, behind[1]);
    assert.equal(
      shortenChaseBoom(focus, camera, (p) =>
        world.cameraBlocked(p.x, p.z, 0.25, p.y),
      ),
      1,
    );
    previous = p;
    y = nextY;
  }
  const closed = galleryStairWorld(u, S.startV - 0.4);
  assert.equal(
    world.blocked(...closed, 0.36, 3.28),
    true,
    "building remains closed",
  );
});
