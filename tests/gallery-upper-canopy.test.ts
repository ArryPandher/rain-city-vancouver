import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  GALLERY_UPPER_CANOPY as D,
  galleryUpperCanopyRoof,
} from "../src/world/gallery-upper-canopy-data";
import {
  addGalleryUpperCanopy,
  galleryUpperCanopyFabric,
} from "../src/world/gallery-upper-canopy";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import { replaceGalleryWingFaces } from "../src/world/gallery-facade";
import {
  replaceGalleryRoofFaces,
  addGalleryRoofs,
} from "../src/world/gallery-roof";
import source from "../src/world/gallery-rear-entry-data.json";
function model() {
  const root = new T.Group(),
    chunks = addGalleryUpperCanopy(root);
  root.children[0].rotation.y = 0;
  root.updateMatrixWorld(true);
  return { root, chunks };
}
function cast(root: T.Object3D, p: number[], direction: number[], far = 10) {
  return new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...direction),
    0,
    far,
  ).intersectObject(root, true)[0];
}
test("six unequal stations carry five curved closed tensile bays and transparent front screen in three draws", (t) => {
  const { root, chunks } = model();
  assert.equal(chunks.length, 3);
  assert.equal(addGalleryUpperCanopy(root).length, 3);
  assert.equal(root.children.length, 1);
  const intervals = D.stations.slice(1).map((s, i) => s - D.stations[i]);
  assert.ok(Math.max(...intervals) - Math.min(...intervals) > 0.8);
  assert.ok(
    galleryUpperCanopyRoof(0, 0.5) > galleryUpperCanopyRoof(0, 0) + 0.3,
  );
  assert.ok(
    galleryUpperCanopyRoof(0, 0.5) - galleryUpperCanopyRoof(0.5, 0.5) > 0.07,
    "fabric sags between curved supporting frames",
  );
  let triangles = 0;
  for (const m of chunks) {
    triangles += m.geometry.index!.count / 3;
    const p = m.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
  }
  assert.ok(triangles < 5000, `${triangles} canopy triangles`);
  t.diagnostic(`${triangles} triangles / ${chunks.length} draws`);
  const glass = chunks.find((m) => (m.material as T.Material).transparent)!;
  assert.equal(glass.castShadow, false);
  assert.equal((glass.material as T.Material).depthWrite, false);
  assert.equal((glass.material as T.Material).forceSinglePass, true);
  assert.ok((glass.material as T.MeshStandardMaterial).opacity < 0.2);
  for (let i = 1; i < D.stations.length; i++) {
    const u = (D.stations[i] + D.stations[i - 1]) / 2,
      v = (D.front + D.back) / 2;
    const above = cast(root, [u, 18, v], [0, -1, 0])!,
      below = cast(root, [u, 15.5, v], [0, 1, 0])!;
    assert.ok(above.face!.normal.y > 0.9);
    assert.ok(
      below.face!.normal.y < -0.9,
      "physical curved underside faces ordinary arrival",
    );
    assert.ok(
      Math.abs(above.point.y - below.point.y - D.fabricThickness) < 1e-5,
    );
  }
});
test("fabric edges close and smooth normals follow curved surface instead of a flat awning", () => {
  const g = galleryUpperCanopyFabric(D.stations[1], D.stations[2]);
  const p = g.getAttribute("position"),
    n = g.getAttribute("normal"),
    ix = g.index!,
    edges = new Map<string, number>();
  const key = (i: number) =>
    [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e5)).join(",");
  let sloped = 0;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5);
    if (Math.abs(n.getY(i)) > 0.8 && Math.abs(n.getZ(i)) > 0.1) sloped++;
  }
  assert.ok(sloped > 30);
  for (let i = 0; i < ix.count; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = key(ix.getX(i + j)),
        b = key(ix.getX(i + ((j + 1) % 3)));
      assert.notEqual(a, b);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(k, (edges.get(k) ?? 0) + (a < b ? 1 : -1));
    }
  for (const [k, v] of edges)
    assert.equal(v, 0, `closed oriented fabric edge ${k}`);
  const { chunks } = model();
  for (const m of chunks.filter(
    (m) => !(m.material as T.Material).transparent,
  )) {
    const p = m.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      assert.ok(p.getX(i) > 7.5 && p.getX(i) < 19.2);
      assert.ok(p.getZ(i) > 17.8 && p.getZ(i) < 23.02);
      assert.ok(p.getY(i) >= D.base - 1e-5 && p.getY(i) < 17);
    }
  }
  assert.ok(
    D.base > 3.28 + 1.52 + 4.3 + 25 / 34,
    "roof structure outside ordinary terrace jump/camera reach",
  );
});
test("actual cap supports canopy and all retained roofs/walls leave its full volume clear", async (t) => {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(source.source);
  const root = new T.Group(),
    sourceMeshes: T.Mesh[] = [],
    materials = new Map<string, T.MeshStandardMaterial>(),
    cap = new T.Group();
  let capFound = 0;
  const triples = [
    [5500, 5501, 5498],
    [5500, 5498, 5496],
    [5503, 5500, 5496],
    [5503, 5496, 5491],
    [5503, 5491, 5505],
  ].map((a) => a.join(","));
  for (const node of doc.getRoot().listNodes())
    for (const pr of node.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        p = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        p.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.BufferAttribute(p, 3),
      );
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      const name = pr.getMaterial()!.getName();
      repairGalleryRearEntry(g, name);
      replaceGalleryWingFaces(g, name);
      replaceGalleryRoofFaces(g, name);
      g.rotateY(source.angle);
      g.computeVertexNormals();
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide }));
      materials.set(name, new T.MeshStandardMaterial({ name }));
      root.add(m);
      sourceMeshes.push(m);
      if (name === "stone") {
        const indices: number[] = [];
        for (let i = 0; i < g.index!.count; i += 3) {
          const ids = [
            g.index!.getX(i),
            g.index!.getX(i + 1),
            g.index!.getX(i + 2),
          ];
          if (triples.includes(ids.join(","))) {
            indices.push(...ids);
            capFound++;
          }
        }
        cap.add(
          new T.Mesh(g.clone().setIndex(indices), new T.MeshBasicMaterial()),
        );
      }
    }
  assert.equal(capFound, 5);
  cap.updateMatrixWorld(true);
  const before = sourceMeshes.map((m) => ({
    p: Array.from(m.geometry.getAttribute("position").array),
    ix: Array.from(m.geometry.index!.array),
  }));
  // Include actual retained upper source and the independently reconstructed
  // copper roofs/stone eaves. A cap hit alone does not prove exterior space.
  const roofChunks = addGalleryRoofs(root, materials);
  if (roofChunks.length) roofChunks[0].parent!.rotation.y = 0;
  root.updateMatrixWorld(true);
  const obstacles = new T.Group();
  for (const m of [...sourceMeshes, ...roofChunks]) {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld),
      p = g.getAttribute("position"),
      ix = g.index!,
      keep: number[] = [];
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
      const x = ids.map((j) => p.getX(j)),
        y = ids.map((j) => p.getY(j)),
        z = ids.map((j) => p.getZ(j));
      if (
        Math.max(...y) <= D.base + 0.001 ||
        Math.max(...x) < D.minU - 0.13 ||
        Math.min(...x) > D.maxU + 0.13 ||
        Math.max(...z) < D.back - 0.08 ||
        Math.min(...z) > D.front + 0.08
      )
        continue;
      keep.push(...ids);
    }
    if (keep.length)
      obstacles.add(
        new T.Mesh(
          g.setIndex(keep),
          new T.MeshBasicMaterial({ side: T.DoubleSide }),
        ),
      );
    else g.dispose();
  }
  obstacles.updateMatrixWorld(true);
  const added = addGalleryUpperCanopy(root);
  sourceMeshes.forEach((m, i) => {
    assert.deepEqual(
      Array.from(m.geometry.getAttribute("position").array),
      before[i].p,
    );
    assert.deepEqual(Array.from(m.geometry.index!.array), before[i].ix);
  });
  for (const u of D.stations)
    for (const v of [D.frontPost, D.backPost])
      for (const du of [-0.12, 0, 0.12])
        for (const dv of [-0.12, 0, 0.12]) {
          const h = cast(cap, [u + du, D.base + 0.1, v + dv], [0, -1, 0], 0.2)!;
          assert.ok(
            h && h.face!.normal.y > 0.999,
            `cap foot u${u + du}/v${v + dv}`,
          );
          assert.ok(Math.abs(h.point.y - D.base) < 1e-6);
        }
  // Entire projected geometry is within actual retained cap; this catches a
  // floating overhang as well as unsupported feet without a bounding-box shortcut.
  const checked = new Set<string>();
  const clearAbove = (u: number, v: number) => {
    const key = `${u.toFixed(4)},${v.toFixed(4)}`;
    if (checked.has(key)) return;
    checked.add(key);
    const obstruction = cast(obstacles, [u, D.base + 0.002, v], [0, 1, 0], 30);
    assert.equal(
      obstruction,
      undefined,
      `retained wall/roof above canopy footprint at ${key}: ${obstruction?.point.toArray()}`,
    );
  };
  for (let u = D.minU; u <= D.maxU; u += 0.25)
    for (let v = D.back; v <= D.front; v += 0.25) clearAbove(u, v);
  for (const m of added) {
    const p = m.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const h = cast(
        cap,
        [p.getX(i), D.base + 0.1, p.getZ(i)],
        [0, -1, 0],
        0.2,
      );
      assert.ok(h, "actual cap beneath every authored vertex");
      clearAbove(p.getX(i), p.getZ(i));
    }
  }
  t.diagnostic(
    `${checked.size} distinct full-height clearance columns; ${obstacles.children.reduce((sum, m) => sum + (m as T.Mesh).geometry.index!.count / 3, 0)} retained broadphase triangles`,
  );
});
