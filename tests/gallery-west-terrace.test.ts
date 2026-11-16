import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import { Batcher } from "../src/world/geometry";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import {
  replaceGalleryWingFaces,
  addGalleryFacade,
} from "../src/world/gallery-facade";
import entry from "../src/world/gallery-rear-entry-data.json";
import {
  galleryStairLocal,
  galleryStairWorld,
} from "../src/world/gallery-stair-framing-data";
import { GALLERY_REAR_STEPS as S } from "../src/world/gallery-entry-stairs-data";
import {
  GALLERY_WEST_TERRACE as D,
  galleryWestTerraceBoxes,
  galleryWestPoint as point,
} from "../src/world/gallery-west-terrace-data";
import { galleryWestTerraceBlocked as blocked } from "../src/world/gallery-west-terrace-contact";
import {
  addGalleryWestTerrace,
  galleryWestConiferGeometry,
} from "../src/world/gallery-west-terrace";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
import { shortenChaseBoom } from "../src/game/chase-camera";
const ray = (root: T.Object3D, p: number[], d: number[], far = 100) =>
  new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...d),
    0,
    far,
  ).intersectObject(root, true)[0];
const p3 = (a: number, y: number, b: number) => {
  const [u, v] = point(a, b);
  return [u, y, v];
};
const rayA = (root: T.Object3D, p: number[], d: number[], far = 100) =>
  ray(root, p3(p[0], p[1], p[2]), [d[2], d[1], -d[0]], far);
const blockedA = (a: number, b: number, r: number, y: number, c: boolean) =>
  blocked(...point(a, b), r, y, c);
function assembly(world = false) {
  const root = new T.Group(),
    batch = new Batcher(root, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  addGalleryWestTerrace(
    mesh,
    new T.MeshStandardMaterial({ name: "stone" }),
    new T.MeshStandardMaterial({ name: "metal" }),
    new T.MeshStandardMaterial({ name: "glass" }),
  );
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
async function decodedSource() {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
      .read(entry.source),
    root = new T.Group();
  for (const node of doc.getRoot().listNodes())
    for (const pr of node.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        positions = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        positions.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry(),
        name = pr.getMaterial()!.getName();
      g.setAttribute("position", new T.BufferAttribute(positions, 3));
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      repairGalleryRearEntry(g, name);
      replaceGalleryWingFaces(g, name);
      g.rotateY(entry.angle);
      root.add(
        new T.Mesh(g, new T.MeshBasicMaterial({ name, side: T.DoubleSide })),
      );
    }
  root.updateMatrixWorld(true);
  return root;
}
const sourcePromise = decodedSource();

test("corrected exterior strip is outside every retained source roof and wall, with its own single closed cap", async () => {
  assert.equal(
    createHash("sha256").update(fs.readFileSync(entry.source)).digest("hex"),
    entry.sha256,
  );
  const source = await sourcePromise,
    before = source.children.map((o) => {
      const g = (o as T.Mesh).geometry;
      return [
        Array.from(g.attributes.position.array),
        Array.from(g.index!.array),
      ];
    }),
    { root } = assembly();
  // Unlike the rejected audit starting at3.4m, these rays start ABOVE all roofs.
  for (let i = 0; i <= 74; i++)
    for (let j = 0; j <= 9; j++) {
      const a = D.minU + ((D.maxU - D.minU) * i) / 74,
        b = D.rearV + ((D.frontV - D.rearV) * j) / 9;
      assert.equal(
        rayA(source, [a, 60, b], [0, -1, 0], 61),
        undefined,
        `source enclosure ${a},${b}`,
      );
    }
  for (const a of [-27, -24, -20, -16, -10])
    for (const b of [25, 26, 27]) {
      const h = rayA(root, [a, D.capY + 0.02, b], [0, -1, 0], 0.1)!;
      assert.ok(h, "new supported cap");
      assert.ok(Math.abs(h.point.y - D.capY) < 1e-5);
      assert.ok(h.face!.normal.y > 0.99);
    }
  assert.ok(
    galleryWestTerraceBoxes()
      .filter((b) => b.top === D.capY)
      .every((b) => !b.openTop),
    "outside-source platform must close its own top",
  );
  assert.deepEqual(
    source.children.map((o) => {
      const g = (o as T.Mesh).geometry;
      return [
        Array.from(g.attributes.position.array),
        Array.from(g.index!.array),
      ];
    }),
    before,
  );
});

test("full retained scene rejects the old buried placement and clears all corrected crown volumes and arrival sightlines", async () => {
  const source = await sourcePromise;
  for (const t of D.trees) {
    assert.ok(
      ray(source, [t.u, 60, t.v], [0, -1, 0], 60),
      "regression: old transverse placement is inside real Hooper wing",
    );
    for (const f of [0, 0.2, 0.5, 0.8, 1])
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const [u, v] = point(
          t.u + Math.cos(a) * t.width * 0.58,
          t.v + Math.sin(a) * t.width * 0.58,
        );
        assert.equal(
          ray(source, [u, 60, v], [0, -1, 0], 61),
          undefined,
          "entire crown envelope outside source",
        );
      }
    for (const eye of [
      [0.814, 1.6, 51.3],
      [0.8, 1.6, 43],
      [0.8, 1.6, 36],
    ]) {
      const [u, v] = point(t.u, t.v),
        target = new T.Vector3(
          u,
          D.capY + D.planterHeight + t.height * 0.55,
          v,
        ),
        origin = new T.Vector3(...eye),
        delta = target.clone().sub(origin);
      assert.equal(
        ray(source, eye, delta.clone().normalize().toArray(), delta.length()),
        undefined,
        "actual source cannot hide the fitted exterior row",
      );
    }
  }
  // Added facade/stairs/canopy materials use their actual common frame too.
  const full = new T.Group();
  full.add(source.clone());
  const newParent = new T.Group();
  addGalleryFacade(
    newParent,
    new Map(
      ["stone", "foundation", "glass"].map((name) => [
        name,
        new T.MeshStandardMaterial({ name }),
      ]),
    ),
  );
  newParent.rotation.y = entry.angle;
  full.add(newParent);
  full.updateMatrixWorld(true);
  for (const t of D.trees) {
    const [u, v] = point(t.u, t.v),
      eye = new T.Vector3(0.814, 1.6, 51.3),
      target = new T.Vector3(u, D.capY + D.planterHeight + t.height * 0.6, v),
      delta = target.clone().sub(eye),
      hit = ray(
        full,
        eye.toArray(),
        delta.normalize().toArray(),
        eye.distanceTo(target),
      );
    assert.ok(hit);
    assert.match(
      ((hit.object as T.Mesh).material as T.Material).name,
      /Gallery west/,
      "first visible architectural volume belongs to planting, not retained wing",
    );
  }
});

test("recessed service front, piers and soffit remain physical after90degree registration", () => {
  const { root } = assembly();
  for (const a of [-25, -24, -20, -18, -14, -12]) {
    const h = rayA(root, [a, 1.5, 29], [0, 0, -1], 5)!;
    assert.ok(h);
    assert.equal(((h.object as T.Mesh).material as T.Material).name, "glass");
    assert.ok(Math.abs(h.point.x - (D.rearV + 0.1 - 33.15)) < 1e-5);
    assert.equal(blockedA(a, 26, 0.25, 1.5 + D.datum, true), false);
  }
  for (const a of D.piers) {
    assert.equal(blockedA(a, 27.8, 0.25, 1 + D.datum, true), true);
    const h = rayA(root, [a, -1, 27.8], [0, 1, 0], 2)!;
    assert.ok(Math.abs(h.point.y - D.bottom) < 1e-5);
    assert.equal(blockedA(a, 27.8, 0.25, 20, true), false);
  }
  const soffit = rayA(root, [-24, 2, 26], [0, 1, 0], 2)!;
  assert.ok(Math.abs(soffit.point.y - D.ceilingBottom) < 1e-5);
  assert.ok(soffit.face!.normal.y < -0.99);
});

test("five compact crowns retain closed outward geometry and root contact inside planted trough", () => {
  assert.equal(D.trees.length, 5);
  for (let k = 0; k < 5; k++) {
    const t = D.trees[k],
      g = galleryWestConiferGeometry(k, 0.68),
      p = g.attributes.position,
      ix = g.index!,
      edges = new Map<string, number>();
    assert.ok(
      g.boundingBox!.min.y > D.capY &&
        g.boundingBox!.min.y < D.capY + D.planterHeight,
    );
    assert.ok(
      Math.abs(g.boundingBox!.max.y - g.boundingBox!.min.y - t.height) < 1e-5,
    );
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
      for (let j = 0; j < 3; j++) {
        const a = ids[j],
          b = ids[(j + 1) % 3],
          key = `${Math.min(a, b)},${Math.max(a, b)}`;
        edges.set(key, (edges.get(key) ?? 0) + (a < b ? 1 : -1));
      }
    }
    assert.ok([...edges.values()].every((n) => n === 0));
  }
});

test("actual route and complete stair mouth remain clear with grounded supports and usable walking chase camera", async () => {
  const fetch = globalThis.fetch;
  let data;
  try {
    globalThis.fetch = async (input) =>
      new Response(new Uint8Array(fs.readFileSync(`public${input}`)));
    data = await loadCity();
  } finally {
    globalThis.fetch = fetch;
  }
  const c = new CollisionWorld(data),
    { root } = assembly(true);
  for (const a of D.piers) {
    const [u, v] = point(a, 27.8),
      [x, z] = galleryStairWorld(u, v),
      h = ray(root, [x, -1, z], [0, 1, 0], 2)!;
    assert.ok(Math.abs(h.point.y) < 1e-5);
    assert.ok(
      Math.abs(c.groundHeight(x, z)) < 1e-5,
      "actual prior ground matches visible pier foot",
    );
  }
  for (const id of ["w263530524", "w749560067"]) {
    const road = data.roads.find((r) => r.id === id)!;
    assert.ok(road);
    assert.ok(road.width);
    for (let i = 2; i < road.pts.length; i += 2) {
      const ax = road.pts[i - 2],
        az = road.pts[i - 1],
        dx = road.pts[i] - ax,
        dz = road.pts[i + 1] - az,
        len = Math.hypot(dx, dz),
        count = Math.ceil(len / 0.25);
      for (let j = 0; j <= count; j++)
        for (const side of [-1, 0, 1]) {
          const [u, v] = galleryStairLocal(
            ax + (dx * j) / count - (((dz / len) * road.width) / 2) * side,
            az + (dz * j) / count + (((dx / len) * road.width) / 2) * side,
          );
          assert.equal(
            blocked(u, v, 0.36, 0, false),
            false,
            `full source corridor ${id}`,
          );
        }
    }
  }
  // Entire descent width can turn in the landing gap before the new north end.
  assert.ok(34.5 - S.endV > 1.1);
  for (let u = S.minU + 0.36; u <= S.maxU - 0.36; u += 0.1) {
    const [x, z] = galleryStairWorld(u, S.endV + 0.55);
    assert.equal(blocked(u, S.endV + 0.55, 0.36, 0, false), false);
    assert.equal(
      c.blocked(x, z, 0.36, 0),
      false,
      "full stair-mouth lateral clearance",
    );
  }
  const route = [
    [0.814, 51.3],
    [0.8, 43],
    [0.8, 36],
    [0.8, 34],
    [0.8, 33.45],
  ];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1);
    let previous = galleryStairWorld(...(a as [number, number]));
    for (let j = 1; j <= count; j++) {
      const u = a[0] + ((b[0] - a[0]) * j) / count,
        v = a[1] + ((b[1] - a[1]) * j) / count,
        p = galleryStairWorld(u, v),
        y = c.walkingHeight(...p, 0);
      assert.ok(Math.abs(y) < 0.2);
      const move = c.move(
        ...previous,
        p[0] - previous[0],
        p[1] - previous[1],
        0.36,
        y,
      );
      assert.equal(move.hit, false, `ordinary arrival ${u},${v}`);
      const back = galleryStairWorld(u, v + 4.3),
        focus = new T.Vector3(p[0], y + 1.52, p[1]),
        camera = new T.Vector3(back[0], y + 2.07, back[1]);
      assert.ok(
        shortenChaseBoom(focus, camera, (q) =>
          c.cameraBlocked(q.x, q.z, 0.25, q.y),
        ) > 0.95,
      );
      previous = p;
    }
  }
});

test("registered finite camera spheres preserve corners and compact five-batch budget", () => {
  assert.equal(
    blockedA(D.minU - 0.2, D.frontV + 0.2, 0.25, 2.8 + D.datum, true),
    false,
  );
  assert.equal(
    blockedA(D.minU - 0.15, D.frontV + 0.15, 0.25, 2.8 + D.datum, true),
    true,
  );
  assert.equal(blocked(NaN, 27, 0.36, 0, false), false);
  const { chunks } = assembly();
  assert.equal(chunks.length, 5);
  assert.equal(
    chunks.reduce((n, m) => n + m.geometry.index!.count / 3, 0),
    13004,
  );
  for (const m of chunks)
    for (const a of Object.values(m.geometry.attributes))
      assert.ok(Array.from(a.array).every(Number.isFinite));
});
