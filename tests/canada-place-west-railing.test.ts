import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  refineCanadaPlaceWestRailing,
  canadaPlaceWestRailFingerprint,
  CANADA_PLACE_WEST_RAIL_SOURCE,
} from "../src/world/canada-place-west-railing";
import { openCanadaPlaceEntryRail } from "../src/world/canada-place-entry-rail";
import { removeCanadaPlaceThinMasts } from "../src/world/canada-place-rigging";
import {
  CANADA_PLACE_ORIGIN,
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_ENTRY_CONNECTOR,
} from "../src/world/canada-place-deck";
import { pointInPoly } from "../src/world/data";
async function fixture() {
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
  const parts: { name: string; g: T.BufferGeometry }[] = [];
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
      parts.push({ name: pr.getMaterial()!.getName(), g });
    }
  return parts;
}

test("source-pinned augmentation preserves gate, masts, all unrelated triangles and bounded budget", async (t) => {
  const { g } = (await fixture()).find((p) => p.name === "steel")!;
  assert.equal(
    canadaPlaceWestRailFingerprint(g),
    CANADA_PLACE_WEST_RAIL_SOURCE.fingerprint,
  );
  openCanadaPlaceEntryRail(g);
  removeCanadaPlaceThinMasts(g);
  const beforeP = Array.from(g.getAttribute("position").array),
    beforeI = Array.from(g.getIndex()!.array);
  const addition = refineCanadaPlaceWestRailing(g, "steel");
  assert.ok(addition);
  assert.deepEqual(Array.from(g.getAttribute("position").array), beforeP);
  assert.deepEqual(
    Array.from(g.getIndex()!.array),
    beforeI.filter(
      (_, i) =>
        !beforeI.slice(i - (i % 3), i - (i % 3) + 3).every((id) => id < 24),
    ),
  );
  assert.equal(
    beforeI.length - g.getIndex()!.count,
    36,
    "only twelve original top-bar triangles removed",
  );
  assert.ok(addition.getIndex()!.count / 3 < 30000);
  t.diagnostic(`${addition.getIndex()!.count / 3} added triangles in one mesh`);
  assert.equal(addition.userData.noWireShadows, true);
  assert.ok(Math.abs(addition.boundingBox!.max.y-8.852)<.001,"50mm radius handrail top");
  assert.equal(refineCanadaPlaceWestRailing(g, "steel"), null);
  const p = addition.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    assert.equal(
      pointInPoly(
        p.getX(i) + CANADA_PLACE_ORIGIN[0],
        p.getZ(i) + CANADA_PLACE_ORIGIN[1],
        CANADA_PLACE_ENTRY_CONNECTOR,
      ),
      false,
      "gate remains clear",
    );
  const posts = addition.userData.sourcePostCenters as number[][];
  assert.equal(posts.length, 70);
  assert.ok(posts.every((p) => p[1] === 7.8));
  for (const post of posts) {
    let base = false;
    for (let i = 0; i < p.count; i++)
      if (
        Math.abs(p.getY(i) - 7.8) < 1e-4 &&
        Math.hypot(p.getX(i) - post[0], p.getZ(i) - post[2]) < 0.16
      ) {
        base = true;
        break;
      }
    assert.ok(base, "post base meets source deck");
  }
});
test("actual public route retains more than player radius clearance from the enriched rail", async () => {
  const { g } = (await fixture()).find((p) => p.name === "steel")!,
    addition = refineCanadaPlaceWestRailing(g, "steel")!;
  const p = addition.getAttribute("position");
  let min = Infinity;
  for (let i = 1; i < CANADA_PLACE_DECK_ROUTE.length; i++) {
    const a = CANADA_PLACE_DECK_ROUTE[i - 1],
      b = CANADA_PLACE_DECK_ROUTE[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let j = 0; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n - CANADA_PLACE_ORIGIN[0],
        z = a[1] + ((b[1] - a[1]) * j) / n - CANADA_PLACE_ORIGIN[1];
      for (let k = 0; k < p.count; k++)
        min = Math.min(min, Math.hypot(x - p.getX(k), z - p.getZ(k)));
    }
  }
  assert.ok(min > 0.4, `route clearance ${min}`);
  // The rail is a narrow strip at the source west plane, not a new wall across the promenade.
  const posts = addition.userData.sourcePostCenters as number[][],
    a = new T.Vector3(...posts[0]),
    b = new T.Vector3(...posts.at(-1)!),
    axis = b.clone().sub(a).normalize();
  for (let i = 0; i < p.count; i++) {
    const delta = new T.Vector3(p.getX(i) - a.x, 0, p.getZ(i) - a.z);
    assert.ok(Math.abs(delta.x * -axis.z + delta.z * axis.x) < 0.17);
  }
});
test("changed west component or wrong material fails closed", async () => {
  const { g } = (await fixture()).find((p) => p.name === "steel")!;
  assert.equal(refineCanadaPlaceWestRailing(g, "trim"), null);
  g.getAttribute("position").setX(40, 99);
  assert.equal(refineCanadaPlaceWestRailing(g, "steel"), null);
});
