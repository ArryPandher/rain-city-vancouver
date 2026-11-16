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
import { removeOriginalGalleryStairs } from "../src/world/gallery-entry-stairs";
import entry from "../src/world/gallery-rear-entry-data.json";
import {
  galleryStairLocal,
  galleryStairWorld,
} from "../src/world/gallery-stair-framing-data";
import {
  GALLERY_WEST_TERRACE as D,
  galleryWestTerraceBoxes,
} from "../src/world/gallery-west-terrace-data";
import { galleryWestTerraceBlocked as blocked } from "../src/world/gallery-west-terrace-contact";
import {
  addGalleryWestTerrace,
  galleryWestBoxGeometry,
  galleryWestConiferGeometry,
} from "../src/world/gallery-west-terrace";

const ray = (root: T.Object3D, p: number[], d: number[], far = 100) =>
  new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...d),
    0,
    far,
  ).intersectObject(root, true)[0];
function assembly(world = false) {
  const root = new T.Group(),
    batch = new Batcher(root, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const stone = new T.MeshStandardMaterial({ name: "stone" }),
    metal = new T.MeshStandardMaterial({ name: "metal" }),
    glass = new T.MeshStandardMaterial({ name: "glass" });
  addGalleryWestTerrace(mesh, stone, metal, glass);
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
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const attr = primitive.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(attr.getArray()!, 3, attr.getNormalized()),
        positions = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        positions.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry(),
        name = primitive.getMaterial()!.getName();
      g.setAttribute("position", new T.BufferAttribute(positions, 3));
      g.setIndex(new T.BufferAttribute(primitive.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      repairGalleryRearEntry(g, name);
      removeOriginalGalleryStairs(g, name);
      g.rotateY(entry.angle);
      root.add(
        new T.Mesh(g, new T.MeshBasicMaterial({ name, side: T.DoubleSide })),
      );
    }
  root.updateMatrixWorld(true);
  return root;
}
const sourcePromise = decodedSource();

test("actual decoded retained cap supports the complete planted strip; no duplicate new floor or source mutation", async () => {
  assert.equal(
    createHash("sha256").update(fs.readFileSync(entry.source)).digest("hex"),
    entry.sha256,
  );
  const source = await sourcePromise,
    before = source.children.map((o) => {
      const g = (o as T.Mesh).geometry;
      return [
        Array.from(g.getAttribute("position").array),
        Array.from(g.index!.array),
      ];
    });
  const { root } = assembly();
  for (let i = 0; i <= 74; i++)
    for (let j = 0; j <= 9; j++) {
      const u = D.minU + ((D.maxU - D.minU) * i) / 74,
        v = D.rearV + ((D.frontV - D.rearV) * j) / 9;
      const h = ray(source, [u, D.capY + 0.03, v], [0, -1, 0], 0.1);
      assert.ok(h, `cap missing ${u},${v}`);
      assert.ok(Math.abs(h.point.y - D.capY) < 1e-5);
    }
  // A ray from between source cap and planter is blocked only by the retained cap.
  for (const u of [-26, -24, -20, -17, -13, -10]) {
    assert.equal(
      ray(root, [u, D.capY + 0.001, 26], [0, -1, 0], 0.0015),
      undefined,
    );
    assert.ok(ray(source, [u, D.capY + 0.001, 26], [0, -1, 0], 0.0015));
  }
  for (const mesh of root.children as T.Mesh[]) {
    const g = mesh.geometry,
      p = g.getAttribute("position"),
      ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
      if (!ids.every((j) => Math.abs(p.getY(j) - D.capY) < 1e-5)) continue;
      const a = new T.Vector3().fromBufferAttribute(p, ids[0]),
        b = new T.Vector3().fromBufferAttribute(p, ids[1]),
        c = new T.Vector3().fromBufferAttribute(p, ids[2]);
      assert.ok(
        b.sub(a).cross(c.sub(a)).y <= 0,
        "new upward face duplicates preserved cap",
      );
    }
  }
  assert.deepEqual(
    source.children.map((o) => {
      const g = (o as T.Mesh).geometry;
      return [
        Array.from(g.getAttribute("position").array),
        Array.from(g.index!.array),
      ];
    }),
    before,
  );
});

test("source lower void remains recessed between finite columns with closed glass, returns and attached soffit", async () => {
  const source = await sourcePromise,
    { root } = assembly();
  for (const u of [-25, -24, -20, -18, -14, -12]) {
    assert.equal(
      ray(source, [u, 1.5, 29], [0, 0, -1], 5),
      undefined,
      "source has no near blind wall",
    );
    const h = ray(root, [u, 1.5, 29], [0, 0, -1], 5)!;
    assert.ok(h);
    assert.equal(
      (h.object as T.Mesh<T.BufferGeometry, T.Material>).material.name,
      "glass",
    );
    assert.ok(Math.abs(h.point.z - (D.rearV + 0.1)) < 1e-5);
    assert.ok(h.face!.normal.z > 0.99);
    assert.equal(
      blocked(u, 26, 0.25, 1.5 + D.datum, true),
      false,
      "recess is not a new solid blind wall",
    );
  }
  for (const u of D.piers) {
    const h = ray(root, [u, 1, 29], [0, 0, -1], 5)!;
    assert.ok(Math.abs(h.point.z - 28.15) < 1e-5);
    assert.equal(blocked(u, 27.8, 0.25, 1 + D.datum, true), true);
  }
  const soffit = ray(root, [-24, 2, 26], [0, 1, 0], 2)!;
  assert.ok(Math.abs(soffit.point.y - D.ceilingBottom) < 1e-5);
  assert.ok(soffit.face!.normal.y < -0.99);
  const beam = ray(root, [-24, 2.7, 29], [0, 0, -1], 2)!;
  assert.ok(Math.abs(beam.point.z - D.frontV) < 1e-5);
  const glassRear = ray(root, [-24, 1.5, 23], [0, 0, 1], 2)!;
  assert.ok(Math.abs(glassRear.point.z - D.rearV) < 1e-5);
  assert.ok(glassRear.face!.normal.z < -0.99);
  for (const b of galleryWestTerraceBoxes().filter((b) => b.openTop))
    assert.equal(b.top, D.capY);
});

test("five opaque connected narrow crowns are planted in retained cap trough and face outward", async () => {
  const source = await sourcePromise;
  assert.equal(D.trees.length, 5);
  assert.equal(
    Math.max(...D.trees.map((t) => t.height)),
    D.trees.at(-1)!.height,
  );
  for (let k = 0; k < D.trees.length; k++) {
    const t = D.trees[k],
      g = galleryWestConiferGeometry(k),
      p = g.getAttribute("position"),
      ix = g.index!,
      edges = new Map<string, number>();
    assert.ok(ray(source, [t.u, 4, t.v], [0, -1, 0], 1));
    assert.ok(
      g.boundingBox!.min.y > D.capY &&
        g.boundingBox!.min.y < D.capY + D.planterHeight,
      "root buried in planted trough",
    );
    assert.ok(
      Math.abs(g.boundingBox!.max.y - g.boundingBox!.min.y - t.height) < 1e-5,
    );
    assert.ok(g.boundingBox!.max.x - g.boundingBox!.min.x < 1.2 * t.width);
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
      const a = new T.Vector3().fromBufferAttribute(p, ids[0]),
        b = new T.Vector3().fromBufferAttribute(p, ids[1]),
        c = new T.Vector3().fromBufferAttribute(p, ids[2]);
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(normal.length() > 1e-9);
      if (i < 28 * 12 * 6) {
        const centre = a
          .clone()
          .add(b)
          .add(c)
          .multiplyScalar(1 / 3);
        assert.ok(
          normal.dot(new T.Vector3(centre.x - t.u, 0, centre.z - t.v)) > 0,
          "outward crown face",
        );
      }
      for (let j = 0; j < 3; j++) {
        const a = ids[j],
          b = ids[(j + 1) % 3],
          key = `${Math.min(a, b)},${Math.max(a, b)}`;
        edges.set(key, (edges.get(key) ?? 0) + (a < b ? 1 : -1));
      }
    }
    assert.ok(
      [...edges.values()].every((n) => n === 0),
      "closed oriented crown",
    );
    const m = new T.Mesh(g, new T.MeshBasicMaterial());
    m.updateMatrixWorld(true);
    assert.ok(
      ray(m, [t.u, 20, t.v], [0, -1, 0], 20),
      "front-side canopy visible from above",
    );
  }
});

test("actual transformed render and finite contacts agree for hard members, with high camera clearance", () => {
  const { root } = assembly(true);
  for (const b of galleryWestTerraceBoxes()) {
    const u = (b.minU + b.maxU) / 2,
      v = (b.minV + b.maxV) / 2,
      y = (b.bottom + b.top) / 2 + D.datum;
    assert.equal(blocked(u, v, 0.04, y, true), true, `physical ${b.role}`);
    assert.equal(
      blocked(u, v, 0.25, 20, true),
      false,
      "no infinitely high wall",
    );
    const isolated = new T.Mesh(
      galleryWestBoxGeometry(b),
      new T.MeshBasicMaterial(),
    );
    isolated.updateMatrixWorld(true);
    assert.ok(
      ray(isolated, [u, (b.bottom + b.top) / 2, b.maxV + 1], [0, 0, -1], 2),
    );
  }
  for (const u of D.piers) {
    const [x, z] = galleryStairWorld(u, 27.8),
      h = ray(root, [x, -1, z], [0, 1, 0], 3)!;
    assert.ok(h);
    assert.ok(
      Math.abs(h.point.y) < 1e-5,
      "physical pier foot meets unchanged world ground",
    );
  }
});

test("camera sphere clears a beam corner outside its finite radius", () => {
  // Above the outer beam corner: both component gaps are below the radius,
  // but their Euclidean distance is greater. No expanded rectangular wall.
  assert.equal(
    blocked(D.minU - 0.2, D.frontV + 0.2, 0.25, 2.8 + D.datum, true),
    false,
  );
  assert.equal(
    blocked(D.minU - 0.15, D.frontV + 0.15, 0.25, 2.8 + D.datum, true),
    true,
  );
  assert.equal(
    blocked(-24, D.frontV + 0.2, 0.25, D.beamBottom - 0.2 + D.datum, true),
    false,
  );
  assert.equal(
    blocked(-24, D.frontV + 0.15, 0.25, D.beamBottom - 0.15 + D.datum, true),
    true,
  );
});

test("actual public footway widths and central arrival remain clear without changing source roads or trees", () => {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  );
  for (const id of ["w263530524", "w749560067"]) {
    const r = data.roads.find((r: { id: string }) => r.id === id);
    assert.ok(r);
    for (let i = 2; i < r.pts.length; i += 2) {
      const ax = r.pts[i - 2],
        az = r.pts[i - 1],
        dx = r.pts[i] - ax,
        dz = r.pts[i + 1] - az,
        len = Math.hypot(dx, dz);
      for (let j = 0; j <= Math.ceil(len / 0.4); j++)
        for (const side of [-1, 0, 1]) {
          const f = j / Math.ceil(len / 0.4),
            [u, v] = galleryStairLocal(
              ax + dx * f - (((dz / len) * r.width) / 2) * side,
              az + dz * f + (((dx / len) * r.width) / 2) * side,
            );
          assert.equal(blocked(u, v, 0.36, 0, false), false, `${id} corridor`);
          assert.equal(blocked(u, v, 0.25, 1.52, true), false);
        }
    }
  }
  for (let v = 23.7; v < 54; v += 0.2)
    for (const u of [-7, 0, 2.8])
      assert.equal(blocked(u, v, 0.36, 0, false), false, "main stair/arrival");
  // Invalid inputs never create an unbounded obstacle.
  assert.equal(blocked(NaN, 27, 0.36, 0, false), false);
  assert.equal(blocked(-20, 27, -1, 0, false), false);
});

test("bounded static geometry reuses stone/metal/glass plus one opaque foliage batch", () => {
  const { chunks } = assembly();
  assert.equal(chunks.length, 4);
  const triangles = chunks.reduce((n, m) => n + m.geometry.index!.count / 3, 0);
  assert.ok(triangles < 5500, `${triangles} triangles`);
  const foliage = chunks.find((m) =>
    (m.material as T.Material).name.startsWith("Gallery west"),
  )!;
  assert.ok(foliage);
  assert.equal((foliage.material as T.MeshStandardMaterial).transparent, false);
  assert.equal((foliage.material as T.MeshStandardMaterial).map, null);
  assert.ok(foliage.geometry.getAttribute("color"));
  for (const m of chunks)
    for (const a of Object.values(m.geometry.attributes))
      assert.ok(Array.from(a.array).every(Number.isFinite));
});
