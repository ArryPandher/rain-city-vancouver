import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import { addGalleryStairFraming } from "../src/world/gallery-stair-framing";
import {
  GALLERY_STAIR_FRAMING as D,
  galleryStairWorld,
  galleryStairRails,
} from "../src/world/gallery-stair-framing-data";
import {
  galleryStairFramingBlocked as blocked,
  galleryStairFramingHeight as height,
} from "../src/world/gallery-stair-framing-contact";
import {
  GALLERY_REAR_STEPS as S,
  galleryRearStepHeight,
} from "../src/world/gallery-rear-entry";
import entry from "../src/world/gallery-rear-entry-data.json";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
import { robsonWalkingArrival } from "../src/game/robson-walking-arrival";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import {
  addGalleryEntryStairs,
  removeOriginalGalleryStairs,
} from "../src/world/gallery-entry-stairs";
import {
  GALLERY_STAIR_SURFACES,
  galleryStairBackV,
} from "../src/world/gallery-entry-stairs-data";

function assembly(world = false) {
  const root = new T.Group(),
    batch = new Batcher(root, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const stone = new T.MeshStandardMaterial(),
    rail = new T.MeshStandardMaterial();
  addGalleryStairFraming(mesh, stone, rail);
  mesh.finish();
  const chunks = batch.finish();
  if (world) {
    const [x, z] = galleryStairWorld(0, 0);
    root.position.set(x, D.datum, z);
    root.rotation.y = -entry.angle;
  }
  root.updateMatrixWorld(true);
  return { root, chunks };
}
const ray = (root: T.Object3D, p: number[], d: number[], far = 20) =>
  new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...d),
    0,
    far,
  ).intersectObject(root, true)[0];

test("retained gallery foundation closes terrace backs and shared stair geometry supports rail feet", async () => {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(entry.source);
  const root = new T.Group();
  for (const node of doc.getRoot().listNodes())
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (primitive.getMaterial()!.getName() !== "foundation") continue;
      const attr = primitive.getAttribute("POSITION")!;
      const raw = new T.BufferAttribute(
        attr.getArray()!,
        3,
        attr.getNormalized(),
      );
      const positions = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        positions.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(positions, 3));
      g.setIndex(new T.BufferAttribute(primitive.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      repairGalleryRearEntry(g, "foundation");
      removeOriginalGalleryStairs(g, "foundation");
      g.rotateY(entry.angle); // inspect common authored u/y/v frame
      root.add(new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide })));
    }
  const batch = new Batcher(root, 512),
    builder = new ArchitecturalMesh(batch, 0, 0);
  addGalleryEntryStairs(builder, new T.MeshBasicMaterial());
  builder.finish();
  batch.finish();
  root.updateMatrixWorld(true);
  for (const t of D.terraces)
    for (const f of [0.1, 0.5, 0.9]) {
      const u = t.minU + (t.maxU - t.minU) * f;
      const hit = ray(root, [u, 2.9, D.minV + 1], [0, 0, -1], 2);
      assert.ok(hit, `foundation behind terrace at u${u}`);
      assert.ok(
        hit.point.z > D.minV + 0.01,
        `bounded overlap ${hit.point.z - D.minV}`,
      );
    }
  for (const { a, b } of galleryStairRails().filter(
    (r) => r.a[0] > S.minU && r.a[0] < S.maxU,
  )) {
    if (a[0] !== b[0] || a[2] !== b[2]) continue;
    const hit = ray(root, [a[0], D.top + 0.1, a[2]], [0, -1, 0], 5)!;
    assert.ok(hit);
    assert.ok(
      Math.abs(hit.point.y - (a[1] + 0.025)) < 0.006,
      "rail feet penetrate shared authored tread25mm",
    );
  }
});

test("closed terrace walls have visible top, bottom, end and side faces in two reused material batches", () => {
  const { root, chunks } = assembly();
  assert.equal(chunks.length, 2);
  for (const t of D.terraces) {
    const u = (t.minU + t.maxU) / 2,
      v = (D.minV + D.maxV) / 2;
    const top = ray(root, [u, 5, v], [0, -1, 0])!;
    assert.ok(Math.abs(top.point.y - D.top) < 1e-5);
    assert.ok(top.face!.normal.y > 0.999);
    const bottom = ray(root, [u, -1, v], [0, 1, 0])!;
    assert.ok(Math.abs(bottom.point.y - D.bottom) < 1e-5);
    assert.ok(bottom.face!.normal.y < -0.999);
    const front = ray(root, [u, 1, D.maxV + 1], [0, 0, -1])!;
    assert.ok(Math.abs(front.point.z - (D.maxV - 0.015)) < 1e-5);
    assert.ok(front.face!.normal.z > 0.999);
    for (const side of [-1, 1]) {
      const edge = side < 0 ? t.minU + 0.03 : t.maxU - 0.03;
      const hit = ray(root, [edge + side, 1, v], [-side, 0, 0], 1.1)!;
      assert.ok(Math.abs(hit.point.x - edge) < 1e-5);
      assert.ok(hit.face!.normal.x * side > 0.999);
    }
  }
  let triangles = 0;
  for (const { geometry: g } of chunks) {
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      ix = g.index!;
    triangles += ix.count / 3;
    const edges = new Map<string, number>();
    const key = (i: number) =>
      [p.getX(i), p.getY(i), p.getZ(i)]
        .map((x) => Math.round(x * 1e5))
        .join(",");
    for (let i = 0; i < p.count; i++)
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5,
      );
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = key(ix.getX(i + j)),
          b = key(ix.getX(i + ((j + 1) % 3)));
        if (a === b) continue;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(k, (edges.get(k) ?? 0) + (a < b ? 1 : -1));
      }
    assert.ok(
      [...edges.values()].every((n) => n === 0),
      "all physical solids have paired oriented boundary edges",
    );
  }
  assert.ok(triangles <= 2200, `${triangles} added triangles`);
});

test("matching finite contacts preserve tread width, ground approach and overhead camera clearance", () => {
  const { root } = assembly(true);
  for (const t of D.terraces)
    for (
      let v = Math.max(
        D.minV + 0.3,
        galleryStairBackV((t.minU + t.maxU) / 2) + 0.1,
      );
      v < D.maxV - 0.2;
      v += 0.25
    ) {
      const [x, z] = galleryStairWorld((t.minU + t.maxU) / 2, v);
      const hit = ray(root, [x, 8, z], [0, -1, 0])!;
      assert.ok(Math.abs(height(x, z, 4)! - hit.point.y) < 1e-5);
      assert.equal(
        height(x, z, 0),
        undefined,
        "cannot snap ground actor onto terrace",
      );
      assert.equal(blocked(x, z, 0.36, 0, false), true);
      assert.equal(blocked(x, z, 0.25, 1.5, true), true);
      assert.equal(blocked(x, z, 0.25, 6, true), false, "finite camera height");
    }
  for (let v = S.startV; v < S.endV + 0.8; v += 0.07) {
    const [x, z] = galleryStairWorld((S.minU + S.maxU) / 2, v);
    const y = galleryRearStepHeight(x, z) ?? 0;
    assert.equal(
      blocked(x, z, 0.36, y, false),
      false,
      "central ascent preserved",
    );
    assert.equal(blocked(x, z, 0.25, y + 1.52, true), false);
    assert.equal(height(x, z, y), undefined, "existing treads own support");
    assert.equal(
      ray(root, [x, 8, z], [0, -1, 0]),
      undefined,
      "no new cap over old stair",
    );
  }
  for (const { a, b } of galleryStairRails()) {
    const [x, z] = galleryStairWorld((a[0] + b[0]) / 2, (a[2] + b[2]) / 2);
    const y = (a[1] + b[1]) / 2 + D.datum;
    assert.equal(
      blocked(x, z, 0.01, y, true),
      true,
      "every visible rail has camera contact",
    );
    assert.equal(blocked(x, z, 0.01, y + 10, true), false);
  }
});

test("actual full-city arrival and central stair remain safe; new terraces touch existing ground", async () => {
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
  const collision = new CollisionWorld(data);
  assert.ok(robsonWalkingArrival("robson", true, collision));
  for (const t of D.terraces) {
    const [x, z] = galleryStairWorld((t.minU + t.maxU) / 2, D.maxV - 0.3);
    assert.equal(
      collision.walkingHeight(x, z, 0),
      0,
      "underlying public ground stays y0",
    );
    assert.equal(D.bottom + D.datum, 0, "new wall bottom touches ground");
    assert.equal(collision.blocked(x, z, 0.36, 0), true);
    assert.equal(collision.cameraBlocked(x, z, 0.25, 1.5), true);
    assert.equal(collision.height(x, z, 4), D.top + D.datum);
  }
  for (const [i, surface] of GALLERY_STAIR_SURFACES.entries()) {
    const [x, z] = galleryStairWorld(
      (S.minU + S.maxU) / 2,
      (surface.minV + surface.maxV) / 2,
    );
    const y = galleryRearStepHeight(x, z)!;
    assert.ok(Math.abs(collision.walkingHeight(x, z, y) - y) < 1e-8);
    const after = collision.blocked(x, z, 0.36, y);
    collision.gallery = false; // disable only Gallery-specific contact gates
    const before = collision.blocked(x, z, 0.36, y);
    collision.gallery = true;
    assert.equal(
      after,
      before,
      `existing facade closure unchanged at tread${i}`,
    );
    if (i >= 2) assert.equal(after, false, `exposed ascent clear at tread${i}`);
  }
});
