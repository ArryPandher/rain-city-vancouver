import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { DetailedTrees, type TreeInstance } from "../src/world/detailed-trees";
import {
  selectStreetTrees,
  streetTreeDistance,
} from "../src/world/street-tree-lod";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

for (const suffix of ["", "-medium"])
  test(`street leaves${suffix} have valid winding, normals, UVs and nondegenerate source surfaces`, async () => {
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(`public/models/vancouver-street-tree${suffix}.glb`);
    const leaf = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .find((p) => p.getMaterial()?.getName().includes("leaves"))!;
    const p = leaf.getAttribute("POSITION")!.getArray()!,
      n = leaf.getAttribute("NORMAL")!.getArray()!,
      uv = leaf.getAttribute("TEXCOORD_0")!,
      ix = leaf.getIndices()!.getArray()!;
    assert.equal(n.length, p.length);
    assert.equal(uv.getCount(), p.length / 3);
    assert.ok(ix.length / 3 < (suffix ? 100000 : 780000));
    assert.ok(ix.length / 3 > (suffix ? 50000 : 600000));
    const material = leaf.getMaterial()!;
    const mask = suffix
      ? await sharp(material.getBaseColorTexture()!.getImage()!)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
      : null;
    const tex = uv.getArray()!;
    assert.ok(tex.every(Number.isFinite));
    let visibleArea = 0;
    let opposed = 0,
      degenerate = 0,
      area = 0;
    for (let i = 0; i < ix.length; i += 3) {
      const [a, b, c] = [ix[i] * 3, ix[i + 1] * 3, ix[i + 2] * 3],
        ab = new T.Vector3(
          p[b] - p[a],
          p[b + 1] - p[a + 1],
          p[b + 2] - p[a + 2],
        ),
        ac = new T.Vector3(
          p[c] - p[a],
          p[c + 1] - p[a + 1],
          p[c + 2] - p[a + 2],
        ),
        normal = new T.Vector3(
          n[a] + n[b] + n[c],
          n[a + 1] + n[b + 1] + n[c + 1],
          n[a + 2] + n[b + 2] + n[c + 2],
        ),
        cross = ab.cross(ac),
        len = cross.length();
      if (len < 1e-12) degenerate++;
      if (cross.dot(normal) < -1e-12) opposed++;
      area += len / 2;
      if (mask) {
        let covered = 0;
        // Equal-area deterministic samples include the transparent part of each
        // card. Raw rectangular area would incorrectly count it as foliage.
        for (let sample = 0; sample < 64; sample++) {
          const root = Math.sqrt((sample + 0.5) / 64),
            v = (sample * 0.61803398875) % 1;
          const weights = [1 - root, root * (1 - v), root * v];
          const u = weights.reduce(
            (sum, w, k) => sum + w * tex[ix[i + k] * 2],
            0,
          );
          const t = weights.reduce(
            (sum, w, k) => sum + w * tex[ix[i + k] * 2 + 1],
            0,
          );
          const x = Math.max(
            0,
            Math.min(mask.info.width - 1, Math.floor(u * mask.info.width)),
          );
          const y = Math.max(
            0,
            Math.min(mask.info.height - 1, Math.floor(t * mask.info.height)),
          );
          if (
            mask.data[(y * mask.info.width + x) * 4 + 3] / 255 >=
            material.getAlphaCutoff()
          )
            covered++;
        }
        visibleArea += ((len / 2) * covered) / 64;
      }
    }
    assert.equal(opposed, 0);
    assert.equal(degenerate, 0);
    if (suffix) {
      assert.equal(material.getAlphaMode(), "MASK");
      assert.equal(material.getAlphaCutoff(), 0.18);
      assert.equal(mask!.info.channels, 4);
      assert.ok(
        visibleArea > 24 && visibleArea < 29,
        `masked surface area ${visibleArea}; raw ${area}`,
      );
      const alpha = mask!.data.filter((_, i) => i % 4 === 3);
      assert.ok(alpha.some((a) => a === 0) && alpha.some((a) => a === 255));
    } else assert.ok(area > 24 && area < 29, `surface area ${area}`);
    for (let i = 0; i < p.length; i += 3) {
      assert.ok([p[i], p[i + 1], p[i + 2]].every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(n[i], n[i + 1], n[i + 2]) - 1) < 0.002);
    }
  });
function samples() {
  const geo = new T.BoxGeometry(),
    mat = new T.MeshStandardMaterial(),
    crown = new T.InstancedMesh(geo, mat, 40),
    trunk = new T.InstancedMesh(geo, mat, 40);
  return Array.from({ length: 40 }, (_, i) => {
    const matrix = new T.Matrix4().makeTranslation(i * 3, 5, 0);
    crown.setMatrixAt(i, matrix);
    trunk.setMatrixAt(i, matrix);
    return {
      x: i * 3,
      y: 0,
      z: 0,
      height: 20,
      width: 9,
      diameter: 0.3,
      rotation: i * 0.1,
      crown,
      crownIndex: i,
      crownMatrix: matrix.clone(),
      trunk,
      trunkIndex: i,
      trunkMatrix: matrix.clone(),
    } as TreeInstance;
  });
}
test("street tree detail respects budgets, canopy elevation and hysteresis", () => {
  const s = samples();
  let selected = selectStreetTrees(s, 0, 0, 0, 24, new Set());
  assert.equal(selected.length, 24);
  assert.equal(selected.filter((p) => p.near).length, 8);
  const tree = s[0];
  assert.equal(streetTreeDistance(tree, 0, 0, 15), 0);
  assert.equal(streetTreeDistance(tree, 0, 0, 120), 100);
  assert.equal(
    selectStreetTrees([tree], 30, 0, 15, 24, new Set()).at(0)!.near,
    false,
  );
  assert.equal(
    selectStreetTrees([tree], 30, 0, 15, 24, new Set([tree])).at(0)!.near,
    true,
  );
  assert.equal(
    selectStreetTrees([tree], 36, 0, 15, 24, new Set([tree])).at(0)!.near,
    false,
  );
  assert.equal(selectStreetTrees(s, 0, 0, 0, 0, new Set()).length, 0);
});
test("street tree slots share vertex data, keep independent culling and restore distant trees", () => {
  const model = (alphaTest: number) => {
    const root = new T.Group();
    const g = new T.BoxGeometry(1, 4, 1);
    g.translate(0, 2, 0);
    const m = new T.MeshStandardMaterial({ name: "test leaves", alphaTest });
    root.add(new T.Mesh(g, m));
    return root;
  };
  const scene = new T.Scene(),
    d = DetailedTrees.fromModels(scene, [model(0), model(0.18)]),
    s = samples();
  d.samples = s;
  d.update(0, 0, 0);
  assert.deepEqual(d.lodState, { near: 8, medium: 16 });
  const slots = (d as any).slots;
  assert.equal(slots.filter((s: any) => s.group.visible).length, 24);
  const a = slots[0].levels[0][0] as T.InstancedMesh,
    b = slots[1].levels[0][0] as T.InstancedMesh;
  assert.equal(
    a.geometry.getAttribute("position"),
    b.geometry.getAttribute("position"),
  );
  assert.notEqual(
    a.geometry.getAttribute("treeStemScale"),
    b.geometry.getAttribute("treeStemScale"),
  );
  assert.equal(a.frustumCulled, true);
  assert.ok(a.boundingSphere);
  assert.ok(a.customDepthMaterial);
  const medium = slots[0].levels[1][0] as T.InstancedMesh;
  assert.equal((medium.material as T.MeshStandardMaterial).alphaTest, 0.18);
  assert.equal(
    (medium.customDepthMaterial as T.MeshDepthMaterial).alphaTest,
    0.18,
  );
  assert.equal((a.material as T.MeshStandardMaterial).alphaTest, 0.45);
  medium.customDepthMaterial!.alphaTest = 0.5;
  (medium.onBeforeShadow as Function)(
    null,
    null,
    null,
    null,
    medium.geometry,
    medium.customDepthMaterial,
    null,
  );
  assert.equal(medium.customDepthMaterial!.alphaTest, 0.18);
  d.budget = 0;
  d.update(0, 0, 0);
  assert.deepEqual(d.lodState, { near: 0, medium: 0 });
  assert.ok(slots.every((s: any) => !s.group.visible));
  const m = new T.Matrix4();
  for (const t of s) {
    t.crown.getMatrixAt(t.crownIndex, m);
    assert.deepEqual(m.elements, t.crownMatrix.elements);
  }
  d.budget = 24;
  d.update(0, 0, 200);
  assert.deepEqual(d.lodState, { near: 0, medium: 0 });
});

test("screen-size transition restores source canopy and trunk before hiding the detailed slot", () => {
  const root = new T.Group();
  const geometry = new T.BoxGeometry(1, 4, 1);
  geometry.translate(0, 2, 0);
  root.add(
    new T.Mesh(geometry, new T.MeshStandardMaterial({ name: "test leaves" })),
  );
  const detail = DetailedTrees.fromModels(new T.Scene(), [root, root.clone()]);
  const tree = samples()[0];
  tree.height = 8;
  detail.samples = [tree];
  const camera = new T.PerspectiveCamera(60);
  detail.update(20, 0, 0, camera);
  assert.equal(detail.lodState.near + detail.lodState.medium, 1);
  const matrix = new T.Matrix4();
  tree.crown.getMatrixAt(tree.crownIndex, matrix);
  assert.equal(matrix.determinant(), 0);
  detail.update(80, 0, 0, camera);
  assert.deepEqual(detail.lodState, { near: 0, medium: 0 });
  tree.crown.getMatrixAt(tree.crownIndex, matrix);
  assert.deepEqual(matrix.elements, tree.crownMatrix.elements);
  tree.trunk.getMatrixAt(tree.trunkIndex, matrix);
  assert.deepEqual(matrix.elements, tree.trunkMatrix.elements);
  camera.fov = 20;
  camera.updateProjectionMatrix();
  detail.update(80, 0, 0, camera);
  assert.equal(
    detail.lodState.near + detail.lodState.medium,
    1,
    "zoom restores resolvable leaves without moving",
  );
  tree.crown.getMatrixAt(tree.crownIndex, matrix);
  assert.equal(matrix.determinant(), 0);
});

test("visible street canopies take priority over nearer trees behind the camera", () => {
  const s = samples().slice(0, 2);
  s[0].x = -25;
  s[1].x = 50;
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 10, 0);
  camera.lookAt(60, 10, 0);
  camera.updateMatrixWorld(true);
  const f = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const selected = selectStreetTrees(s, 0, 0, 10, 1, new Set(), f);
  assert.equal(selected[0].tree, s[1]);
  camera.lookAt(-60, 10, 0);
  camera.updateMatrixWorld(true);
  f.setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(selectStreetTrees(s, 0, 0, 10, 1, new Set(), f)[0].tree, s[0]);
});

test("masked medium tree retains the complete near trunk and branches", async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const docs = await Promise.all(
    ["", "-medium"].map((s) =>
      io.read(`public/models/vancouver-street-tree${s}.glb`),
    ),
  );
  const woody = docs.map((d) =>
    d
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .filter((p) => !p.getMaterial()!.getName().includes("leaves")),
  );
  assert.ok(woody[0].length > 0);
  assert.equal(woody[0].length, woody[1].length);
  for (const near of woody[0]) {
    const medium = woody[1].find(
      (p) => p.getMaterial()!.getName() === near.getMaterial()!.getName(),
    )!;
    assert.ok(medium);
    assert.deepEqual(
      medium.getIndices()!.getArray(),
      near.getIndices()!.getArray(),
    );
    for (const name of near.listSemantics())
      assert.deepEqual(
        medium.getAttribute(name)!.getArray(),
        near.getAttribute(name)!.getArray(),
      );
  }
  const transforms = docs.map((d) =>
    d
      .getRoot()
      .listNodes()
      .map((n) => ({ name: n.getName(), matrix: n.getMatrix() })),
  );
  assert.deepEqual(transforms[0], transforms[1]);
});
