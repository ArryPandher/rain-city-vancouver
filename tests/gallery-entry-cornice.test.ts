import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import {
  GALLERY_ENTRY_CORNICE as D,
  addGalleryEntryCornice,
  galleryPedimentRing,
} from "../src/world/gallery-entry-cornice";

function assembly() {
  const root = new T.Group(),
    stone = new T.MeshStandardMaterial(),
    batch = new Batcher(root, 512),
    builder = new ArchitecturalMesh(batch, 0, 0);
  addGalleryEntryCornice(builder, stone);
  builder.finish();
  const chunks = batch.finish();
  root.updateMatrixWorld(true);
  return { root, chunks };
}
function ray(root: T.Object3D, from: number[], direction: number[]) {
  return new T.Raycaster(
    new T.Vector3(...from),
    new T.Vector3(...direction).normalize(),
    0,
    4,
  ).intersectObject(root, true);
}

test("visible raking stone projects from source and leaves the tympanum open", () => {
  const { root } = assembly();
  // Midpoints of both sloping sides on the broad, forward corona surface.
  const ring = galleryPedimentRing(0.115, 24.3);
  for (const end of [0, 1]) {
    const u = (ring[end][0] + ring[2][0]) / 2,
      y = (ring[end][1] + ring[2][1]) / 2,
      hit = ray(root, [u, y, 26], [0, 0, -1])[0];
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.z - 24.3) < 0.00001);
    assert.ok(hit.face!.normal.z > 0.999, "rake faces public rear");
    assert.ok(hit.point.z - D.sourceFrontV > 0.43);
  }
  assert.equal(
    ray(root, [D.centreU, 15.1, 26], [0, 0, -1]).length,
    0,
    "original closed tympanum remains visible, not covered by a new triangle",
  );
  const centreBottom = ray(root, [D.centreU, 14.165, 26], [0, 0, -1])[0];
  assert.ok(centreBottom && Math.abs(centreBottom.point.z - 24.3) < 0.00001);
});

test("cornice and dentils create alternating physical relief, closed ends and soffit", () => {
  const { root } = assembly();
  const tooth = ray(root, [D.centreU, 13.76, 26], [0, 0, -1])[0],
    gap = ray(root, [D.centreU + D.dentilPitch / 2, 13.76, 26], [0, 0, -1])[0];
  assert.ok(tooth && gap);
  assert.ok(Math.abs(tooth.point.z - D.dentilFrontV) < 0.00001);
  assert.ok(Math.abs(gap.point.z - 24.075) < 0.00001);
  assert.ok(tooth.point.z - gap.point.z > 0.17);
  for (const side of [-1, 1]) {
    const endU = D.centreU + (side * D.corniceWidth) / 2,
      hit = ray(root, [endU + side, 13.95, 24.2], [-side, 0, 0])[0];
    assert.ok(hit && Math.abs(hit.point.x - endU) < 0.00001);
    assert.ok(hit.face!.normal.x * side > 0.999);
  }
  const underside = ray(root, [D.centreU, 11, 24.09], [0, 1, 0])[0];
  assert.ok(underside && Math.abs(underside.point.y - 12.05) < 0.00001);
  assert.ok(underside.face!.normal.y < -0.999);
  // Teeth physically intersect the frieze and upper sloping corona.
  assert.ok(D.dentilBackV < 24.075);
  const coronaUndersideAtTooth =
    13.87 + ((D.dentilFrontV - 24.24) / 0.1) * 0.06;
  assert.ok(D.dentilTop > coronaUndersideAtTooth + 0.01);
});

test("closed profile solids have paired oriented edges and preserve the source crest", (t) => {
  const { chunks } = assembly();
  assert.equal(chunks.length, 1, "uses one existing stone batch");
  const edges = new Map<string, { count: number; direction: number }>();
  let triangles = 0,
    maxY = -Infinity,
    minY = Infinity;
  const key = (
    p: T.BufferAttribute | T.InterleavedBufferAttribute,
    i: number,
  ) =>
    [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e5)).join(",");
  for (const chunk of chunks) {
    const p = chunk.geometry.getAttribute("position"),
      n = chunk.geometry.getAttribute("normal"),
      ix = chunk.geometry.getIndex()!;
    triangles += ix.count / 3;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5,
      );
      minY = Math.min(minY, p.getY(i));
      maxY = Math.max(maxY, p.getY(i));
    }
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = key(p, ix.getX(i + j)),
          b = key(p, ix.getX(i + ((j + 1) % 3))),
          sorted = a < b,
          k = sorted ? `${a}|${b}` : `${b}|${a}`,
          entry = edges.get(k) ?? { count: 0, direction: 0 };
        assert.notEqual(a, b, "nondegenerate profile edge");
        entry.count++;
        entry.direction += sorted ? 1 : -1;
        edges.set(k, entry);
      }
  }
  for (const [edge, value] of edges) {
    assert.equal(value.count, 2, `closed solid edge ${edge}`);
    assert.equal(value.direction, 0, `consistent winding ${edge}`);
  }
  assert.ok(
    Math.abs(maxY - 16.75) < 0.00001,
    "unchanged source pediment crest",
  );
  assert.ok(
    minY >= 12.0499,
    "entablature is on shared capital bearing, clear of stair/route",
  );
  assert.ok(triangles < 700);
  t.diagnostic(`${triangles} triangles, no additional material batch`);
});
