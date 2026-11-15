import { openCanadaPlaceEntryRail } from "../src/world/canada-place-entry-rail";
import { removeCanadaPlaceThinMasts } from "../src/world/canada-place-rigging";
import railData from "../src/world/canada-place-entry-rail-data.json";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { geo, KX, ORIGIN, pointInPoly } from "../src/world/data";
import {
  CANADA_PLACE_DECK_Y as Y,
  CANADA_PLACE_ORIGIN as origin,
  CANADA_PLACE_DECK_ROUTE as route,
  CANADA_PLACE_SOLID_MASSES as masses,
  CANADA_PLACE_ENTRY_CONNECTOR as connector,
  CANADA_PLACE_DECK_COLLIDER_IDS as ids,
  canadaPlaceWorld,
  supportedDeck,
  solidAt,
  inCanadaPlacePier,
  inCanadaPlaceEntryConnector,
} from "../src/world/canada-place-deck";

async function sourceScene(open = true) {
  const file = "public/models/vancouver/canada-place.glb";
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    "1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe",
  );
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(file);
  const root = new T.Group();
  root.position.set(origin[0], 0.08, origin[1]);
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        p = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        p.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      if (open && pr.getMaterial()!.getName() === "steel") {
        const before = Array.from(g.getAttribute("position").array),
          old = Array.from(g.getIndex()!.array);
        assert.ok(openCanadaPlaceEntryRail(g));
        assert.equal(
          openCanadaPlaceEntryRail(g),
          false,
          "source guard prevents repeated edits",
        );
        const after = g.getAttribute("position");
        for (let i = 0; i < after.count; i++)
          if (i < 5592 || i > 5615)
            assert.deepEqual(
              [after.getX(i), after.getY(i), after.getZ(i)],
              before.slice(i * 3, i * 3 + 3),
            );
        const expected = [];
        for (let i = 0; i < old.length; i += 3)
          if (!old.slice(i, i + 3).every((id) => id >= 5616 && id <= 5663))
            expected.push(...old.slice(i, i + 3));
        assert.deepEqual(
          Array.from(g.getIndex()!.array),
          expected,
          "only two post boxes removed",
        );
      }
      root.add(
        new T.Mesh(
          g,
          new T.MeshBasicMaterial({ name: pr.getMaterial()!.getName() }),
        ),
      );
    }
  root.updateMatrixWorld(true);
  return root;
}
function top(root: T.Object3D, x: number, z: number) {
  return new T.Raycaster(
    new T.Vector3(x, Y + 2, z),
    new T.Vector3(0, -1, 0),
    0,
    3,
  ).intersectObject(root, true)[0];
}
test("public route and eligible grid points sit on actual committed GLB top, not water or roof guesses", async (t) => {
  const root = await sourceScene();
  let checked = 0;
  const verify = (x: number, z: number) => {
    const hit = top(root, x, z);
    assert.ok(hit, `missing source support ${x},${z}`);
    assert.ok(
      Math.abs(hit.point.y - Y) < 0.015,
      `source top ${hit.point.y} differs at ${x},${z}`,
    );
    assert.ok(hit.face!.normal.y > 0.99, "top-facing physical surface");
    checked++;
  };
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let j = 0; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n;
      assert.ok(
        supportedDeck(x, z, 0.4),
        `route has no .4m clearance ${x},${z}`,
      );
      verify(x, z);
    }
  }
  for (let x = origin[0] - 250; x < origin[0] + 65; x += 5)
    for (let z = origin[1] - 95; z < origin[1] + 105; z += 5)
      if (supportedDeck(x, z, 0.4)) verify(x, z);
  t.diagnostic(`${checked} actual GLB support rays`);
});
test("closed masses, private roofs, shoreline and approach exterior never become broad water exemptions", () => {
  for (const p of masses) {
    const x =
        p.filter((_, i) => !(i % 2)).reduce((a, b) => a + b, 0) /
        (p.length / 2),
      z = p.filter((_, i) => i % 2).reduce((a, b) => a + b, 0) / (p.length / 2);
    assert.ok(solidAt(x, z));
    assert.equal(supportedDeck(x, z), false);
  }
  for (const p of [
    [-250, 76],
    [-220, 55],
    [0, -80],
    [230, -105],
    [100, -20],
  ])
    assert.equal(
      supportedDeck(...canadaPlaceWorld(...(p as [number, number])), 0.4),
      false,
    );
  assert.equal(
    supportedDeck(430, -523, 0.4),
    false,
    "connector outside source pier needs approach support",
  );
  assert.ok(pointInPoly(430, -523, connector));
  assert.ok(pointInPoly(...route[0], connector));
  assert.equal(supportedDeck(NaN, 0), false);
  assert.equal(supportedDeck(...route[0], -1), false);
  assert.equal(
    supportedDeck(...route[0], 20),
    false,
    "large radius must not overhang edge",
  );
});
test("only mapped Canada Place site colliders overlap the validated route", (t) => {
  const d = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8"));
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const buildings = d.buildings.map((b: any) => ({
    ...b,
    pts: b.pts.map((v: number, i: number) => v / 2 - (i % 2 ? oz : ox)),
  }));
  const overlaps = new Set<string>();
  for (let i = 1; i < route.length; i++)
    for (let j = 0; j <= 30; j++) {
      const x = route[i - 1][0] + ((route[i][0] - route[i - 1][0]) * j) / 30,
        z = route[i - 1][1] + ((route[i][1] - route[i - 1][1]) * j) / 30;
      for (const b of buildings)
        if (pointInPoly(x, z, b.pts)) {
          overlaps.add(b.id);
          assert.ok(ids.has(b.id), `unrelated collider ${b.id}`);
        }
    }
  t.diagnostic(`Mapped route overlaps: ${[...overlaps].join(", ")}`);
  assert.ok(overlaps.has("w223635729"));
  assert.deepEqual([...ids].sort(), ["w223635729"]);
});

test("entry seam is continuously supported with .4m clearance without waiving other pier edges", async () => {
  const root = await sourceScene();
  let onSource = 0,
    onApproach = 0;
  for (let z = -523; z >= -541; z -= 0.1) {
    assert.ok(inCanadaPlaceEntryConnector(430, z, 0.4));
    if (inCanadaPlacePier(430, z)) {
      assert.ok(supportedDeck(430, z, 0.4), `entry exclusion gap at ${z}`);
      const hit = top(root, 430, z);
      assert.ok(hit && Math.abs(hit.point.y - Y) < 0.015);
      onSource++;
    } else {
      assert.equal(supportedDeck(430, z, 0.4), false);
      onApproach++;
    }
    // Every footprint ring sample has either actual source support or explicit
    // connector support to be supplied by the approach renderer, never open sea.
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = 430 + Math.cos(a) * 0.4,
        zz = z + Math.sin(a) * 0.4;
      assert.ok(inCanadaPlaceEntryConnector(x, zz));
      assert.equal(solidAt(x, zz), false);
      if (inCanadaPlacePier(x, zz)) {
        const hit = top(root, x, zz);
        assert.ok(
          hit && Math.abs(hit.point.y - Y) < 0.015,
          `edge sample ${x},${zz}: ${hit?.point.y} ${(hit?.object as T.Mesh)?.material instanceof T.Material ? ((hit?.object as T.Mesh).material as T.Material).name : "none"}`,
        );
      }
    }
  }
  assert.ok(onSource > 0 && onApproach > 0);
  // Same pier boundary away from the backed opening stays excluded.
  assert.equal(supportedDeck(...canadaPlaceWorld(-230, 85), 0.4), false);
});

test("entry rail correction removes source obstruction, retains closed rail outside entry and composes with mast repair", async () => {
  const original = await sourceScene(false),
    opened = await sourceScene();
  const before = top(original, 430.4, -530.9),
    after = top(opened, 430.4, -530.9);
  assert.equal(
    ((before!.object as T.Mesh).material as T.Material).name,
    "steel",
  );
  assert.ok(before!.point.y > Y + 0.8);
  assert.ok(after && Math.abs(after.point.y - Y) < 0.015);
  // Outside the connector, this same source top rail must remain visible/solid.
  const localX = 423 - origin[0];
  const c = railData.components[0];
  const z =
    (c.min[2] + c.max[2]) / 2 +
    (localX - (c.min[0] + c.max[0]) / 2) * railData.railSlope +
    origin[1];
  const retained = top(opened, 423, z);
  assert.ok(retained && retained.point.y > Y + 0.8);
  const steel = original.children.find(
    (o) => ((o as T.Mesh).material as T.Material).name === "steel",
  ) as T.Mesh;
  assert.equal(removeCanadaPlaceThinMasts(steel.geometry), 120);
  assert.ok(openCanadaPlaceEntryRail(steel.geometry));
  // The new cap at x=425 faces the opened entry; no open-ended top-rail tube.
  const capY = (c.min[1] + c.max[1]) / 2 + 0.08;
  const capZ =
    (c.min[2] + c.max[2]) / 2 +
    (425 - origin[0] - (c.min[0] + c.max[0]) / 2) * railData.railSlope +
    origin[1];
  const ray = new T.Raycaster(
    new T.Vector3(426, capY, capZ),
    new T.Vector3(-1, 0, 0),
    0,
    2,
  );
  const hit = ray.intersectObject(opened, true)[0];
  assert.ok(hit && Math.abs(hit.point.x - 425) < 0.005);
  assert.equal(((hit.object as T.Mesh).material as T.Material).name, "steel");
});
