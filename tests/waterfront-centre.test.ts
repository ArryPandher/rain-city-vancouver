import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  buildWaterfrontCentre,
  type WaterfrontCentreMaterials,
} from "../src/world/waterfront-centre";
import {
  WATERFRONT_CENTRE_RING as ring,
  WATERFRONT_CENTRE_HEIGHT as H,
  waterfrontTowerRing,
  waterfrontLevel,
} from "../src/world/waterfront-centre-site";
import { KX, ORIGIN, pointInPoly, segmentPoint } from "../src/world/data";
function fixture() {
  const root = new T.Group(),
    batch = new Batcher(root);
  const mats = Object.fromEntries(
    [
      "glass",
      "stone",
      "spandrel",
      "metal",
      "dark",
      "roof",
      "soil",
      "foliage",
    ].map((name) => [name, new T.MeshStandardMaterial({ name })]),
  ) as unknown as WaterfrontCentreMaterials;
  batch.offsetY = 0;
  assert.equal(
    buildWaterfrontCentre(batch, { id: "w143683980", pts: ring.flat() }, mats),
    true,
  );
  assert.equal(batch.offsetY, 0);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { root, meshes, mats };
}
const f = fixture();
function ray(from: T.Vector3, to: T.Vector3) {
  return new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to) + 0.01,
  ).intersectObject(f.root, true);
}
test("Waterfront source ID, mapped street envelope and22-floor height anchors remain exact", () => {
  const batch = new Batcher(new T.Group());
  assert.equal(
    buildWaterfrontCentre(
      batch,
      { id: "w363651936", pts: ring.flat() },
      f.mats,
    ),
    false,
  );
  assert.equal(batch.groups.size, 0);
  const data = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    b = data.buildings.find((b: any) => b.id === "w143683980");
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const actual = b.pts.map((v: number, i: number) => v / 2 - (i % 2 ? oz : ox));
  assert.ok(
    actual.every((v: number, i: number) => Math.abs(v - ring.flat()[i]) < 1e-6),
  );
  assert.equal(waterfrontLevel(22), H);
  assert.equal(waterfrontLevel(1), 5.5);
  assert.equal(H, 91.75);
  const tower = waterfrontTowerRing();
  assert.ok(tower.length > 25);
  assert.ok(tower.every((p) => pointInPoly(...p, ring.flat())));
  assert.ok(
    tower.slice(7).every((p) => p[0] < 328 && p[1] > -528),
    "curve remains at Burrard/Cordova not Canada Place",
  );
});
test("complete material batches are finite, correctly wound and height bounded with metric stone UVs", () => {
  let count = 0,
    max = -Infinity,
    min = Infinity;
  for (const mesh of f.meshes) {
    const g = mesh.geometry,
      p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      uv = g.getAttribute("uv"),
      ix = g.index!;
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
        ].every(Number.isFinite),
      );
      max = Math.max(max, p.getY(i));
      min = Math.min(min, p.getY(i));
    }
    for (let i = 0; i < ix.count; i += 3) {
      const a = ix.getX(i),
        b = ix.getX(i + 1),
        c = ix.getX(i + 2),
        v = new T.Vector3()
          .fromBufferAttribute(p, b)
          .sub(new T.Vector3().fromBufferAttribute(p, a))
          .cross(
            new T.Vector3()
              .fromBufferAttribute(p, c)
              .sub(new T.Vector3().fromBufferAttribute(p, a)),
          );
      if (v.lengthSq() > 1e-12)
        assert.ok(
          v.dot(new T.Vector3().fromBufferAttribute(n, a)) >= -1e-6,
          "rendered face winding agrees with normal",
        );
    }
    count += ix.count / 3;
    if ((mesh.material as T.Material).name === "stone")
      assert.ok(
        Array.from(uv.array).some((v) => Math.abs(v) > 3),
        "mineral surface UVs retain metre scale",
      );
  }
  assert.ok(Math.abs(min) < 1e-6);
  assert.ok(Math.abs(max - H) < 0.001);
  assert.ok(f.meshes.length <= 8);
  assert.ok(count < 35000);
  console.log({ triangles: count, batches: f.meshes.length });
});
test("tower and square skirt windows present two distinct supported exterior systems", () => {
  const tower = waterfrontTowerRing();
  for (const i of [0, 1, 2, 3, 4, 5, 10, 19]) {
    const face = facadeFrame(tower[i], tower[(i + 1) % tower.length]),
      u = face.length * 0.43;
    const hits = ray(
      new T.Vector3(...face.p(u, 64, -3)),
      new T.Vector3(...face.p(u, 64, 0.2)),
    );
    assert.ok(hits.length, `tower face${i} closed`);
    assert.ok(
      ["glass", "metal", "spandrel"].includes(
        ((hits[0].object as T.Mesh).material as T.Material).name,
      ),
    );
  }
  const face = facadeFrame(ring[1], ring[2]),
    cols = Math.round(face.length / 4.6),
    u = (face.length / cols) * 0.5,
    y = (waterfrontLevel(2) + waterfrontLevel(3)) / 2;
  const hits = ray(
    new T.Vector3(...face.p(u, y, -2)),
    new T.Vector3(...face.p(u, y, 0.8)),
  );
  assert.ok(hits.length);
  assert.equal(
    ((hits[0].object as T.Mesh).material as T.Material).name,
    "glass",
  );
  assert.ok(
    Math.abs(hits[0].distance - 2.43) < 0.02,
    "square window is recessed430mm, not a flat applied card",
  );
  // Lateral ray from inside the recess must meet a substantial jamb.
  const jamb = ray(
    new T.Vector3(...face.p(u, y, 0.2)),
    new T.Vector3(...face.p(0.3, y, 0.2)),
  );
  assert.ok(
    jamb.some(
      (h) => ((h.object as T.Mesh).material as T.Material).name === "stone",
    ),
  );
});
test("mapped collision perimeter has actual closed foundation and roof is supported", () => {
  for (let i = 0; i < ring.length; i++) {
    const face = facadeFrame(ring[i], ring[(i + 1) % ring.length]);
    const h = ray(
      new T.Vector3(...face.p(face.length * 0.43, 0.4, -0.5)),
      new T.Vector3(...face.p(face.length * 0.43, 0.4, 0.3)),
    );
    assert.ok(h.length);
    assert.equal(
      ((h[0].object as T.Mesh).material as T.Material).name,
      "stone",
    );
  }
  const h = ray(
    new T.Vector3(347, H + 2, -515),
    new T.Vector3(347, H - 1, -515),
  );
  assert.ok(h.length && Math.abs(h[0].point.y - H) < 0.001);
});

test("rounded ground glazing is visible before its recessed opaque backing", () => {
  const t = waterfrontTowerRing();
  let glass = 0;
  for (const i of [8, 11, 15, 18, 22, 25]) {
    const face = facadeFrame(t[i], t[i + 1]);
    const h = ray(
      new T.Vector3(...face.p(face.length * 0.6, 3, -1)),
      new T.Vector3(...face.p(face.length * 0.6, 3, 1)),
    );
    assert.ok(h.length);
    const name = ((h[0].object as T.Mesh).material as T.Material).name;
    assert.ok(
      name === "glass" || name === "stone",
      "backing cannot obscure the ground glazing",
    );
    if (name === "glass") {
      glass++;
      assert.ok(Math.abs(h[0].distance - 1.75) < 0.01);
    }
  }
  assert.ok(
    glass >= 4,
    "widely spaced columns leave the rounded lobby visibly glazed",
  );
});
test("ground columns use sparse physical spacing independent of rounded tessellation", () => {
  const stone = f.meshes.find(
      (m) => (m.material as T.Material).name === "stone",
    )!,
    g = stone.geometry,
    p = g.getAttribute("position"),
    n = g.getAttribute("normal"),
    ix = g.index!;
  const centers: T.Vector3[] = [];
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (!ids.every((j) => Math.abs(p.getY(j) - 5.5) < 0.001 && n.getY(j) > 0.9))
      continue;
    const c = ids
      .reduce(
        (v, j) => v.add(new T.Vector3().fromBufferAttribute(p, j)),
        new T.Vector3(),
      )
      .multiplyScalar(1 / 3);
    if (c.x >= 328 || c.z <= -528) continue;
    if (!centers.some((q) => q.distanceTo(c) < 0.5)) centers.push(c);
  }
  assert.ok(
    centers.length >= 3 && centers.length <= 6,
    `rounded column count${centers.length}`,
  );
  for (let i = 0; i < centers.length; i++)
    for (let j = i + 1; j < centers.length; j++)
      assert.ok(
        centers[i].distanceTo(centers[j]) > 4.5,
        "no pillar on each glass facet",
      );
});

test("foundation cap UVs preserve the same metre scale as mineral walls", () => {
  const g = f.meshes.find(
      (m) => (m.material as T.Material).name === "stone",
    )!.geometry,
    p = g.getAttribute("position"),
    n = g.getAttribute("normal"),
    uv = g.getAttribute("uv");
  let checked = 0;
  for (let i = 0; i < p.count; i++)
    if (Math.abs(p.getY(i) - 0.85) < 0.001 && n.getY(i) > 0.99) {
      assert.ok(Math.abs(uv.getX(i) - p.getX(i)) < 0.001);
      assert.ok(Math.abs(uv.getY(i) - p.getZ(i)) < 0.001);
      checked++;
    }
  assert.ok(checked >= 10, "actual source-footprint cap inspected");
});
