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
    assert.ok(ix.length / 3 < (suffix ? 240000 : 780000));
    assert.ok(ix.length / 3 > (suffix ? 150000 : 600000));
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
    }
    assert.equal(opposed, 0);
    assert.equal(degenerate, 0);
    assert.ok(area > (suffix ? 16 : 24) && area < 29, `surface area ${area}`);
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
  const model = () => {
    const root = new T.Group();
    const g = new T.BoxGeometry(1, 4, 1);
    g.translate(0, 2, 0);
    const m = new T.MeshStandardMaterial({ name: "test leaves" });
    root.add(new T.Mesh(g, m));
    return root;
  };
  const scene = new T.Scene(),
    d = DetailedTrees.fromModels(scene, [model(), model()]),
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
