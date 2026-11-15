import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  broadleafVolumeGeometry,
  installBroadleafVolumes,
  broadleafShape,
  activeTreeBounds,
  updateBroadleafDistance,
} from "../src/world/broadleaf-volume";
import { DetailedTrees, type TreeInstance } from "../src/world/detailed-trees";
import data from "../src/world/broadleaf-volume-data.json";

test("hidden zero-scale trees do not inflate distant group bounds toward the origin", () => {
  const mesh = new T.InstancedMesh(
    new T.BoxGeometry(2, 10, 2),
    new T.MeshStandardMaterial(),
    2,
  );
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(1000, 5, -800));
  mesh.setMatrixAt(1, new T.Matrix4().makeScale(0, 0, 0));
  mesh.computeBoundingSphere();
  assert.ok(mesh.boundingSphere!.radius > 500);
  activeTreeBounds(mesh);
  assert.ok(mesh.boundingSphere!.radius < 6);
  assert.deepEqual(mesh.boundingSphere!.center.toArray(), [1000, 5, -800]);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 5, 0);
  camera.lookAt(0, 5, -100);
  camera.updateMatrixWorld(true);
  const f = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(f.intersectsObject(mesh), false);
});

test("layered broadleaf geometry covers three source views with finite cropped atlas coordinates", () => {
  const g = broadleafVolumeGeometry(),
    p = g.getAttribute("position"),
    uv = g.getAttribute("uv"),
    axis = g.getAttribute("sliceAxis");
  assert.ok(g.index!.count / 3 < 1500);
  assert.deepEqual(new Set(Array.from(axis.array)), new Set([0, 1, 2]));
  for (let i = 0; i < p.count; i++) {
    assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
    assert.ok(
      uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1,
    );
    assert.ok(p.getY(i) > -0.06 && p.getY(i) < 1.06);
  }
  assert.equal(data.cuts.length, 24);
  assert.ok(g.boundingSphere!.radius < 1);
  assert.ok(g.boundingBox!.max.y > 0.97);
});

for (const suffix of ["", "-distant"])
  test(`low-detail woody model${suffix} keeps source root and continuous mesh surfaces`, async () => {
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(`public/models/vancouver-street-tree-branches${suffix}.glb`);
    let triangles = 0,
      minY = Infinity,
      maxY = -Infinity;
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        assert.ok(!prim.getMaterial()!.getName().includes("leaves"));
        const positions = prim.getAttribute("POSITION")!.getArray()!,
          ix = prim.getIndices()!.getArray()!;
        triangles += ix.length / 3;
        for (let i = 0; i < positions.length; i += 3) {
          assert.ok(
            [positions[i], positions[i + 1], positions[i + 2]].every(
              Number.isFinite,
            ),
          );
          minY = Math.min(minY, positions[i + 1]);
          maxY = Math.max(maxY, positions[i + 1]);
        }
        for (const index of ix) assert.ok(index < positions.length / 3);
      }
    assert.ok(
      triangles > (suffix ? 200 : 500) && triangles < (suffix ? 500 : 2500),
    );
    assert.ok(Math.abs(minY + data.rootOffset) < 0.002);
    assert.ok(maxY > data.height * 0.8);
  });

test("volume installation preserves mapped dimensions and shares buffers; close-detail exit restores leaves and branches", () => {
  const samples: TreeInstance[] = Array.from({ length: 2 }, (_, i) => {
    const crown = new T.InstancedMesh(
        new T.BoxGeometry(),
        new T.MeshStandardMaterial(),
        1,
      ),
      trunk = new T.InstancedMesh(
        new T.BoxGeometry(),
        new T.MeshStandardMaterial(),
        2,
      );
    trunk.setMatrixAt(1, new T.Matrix4().makeScale(0, 0, 0));
    return {
      x: i * 8,
      y: 2,
      z: 0,
      height: 10 + i * 2,
      width: 7,
      diameter: 0.24 + i * 0.12,
      sourceId: 700 + i,
      form: "broad",
      rotation: i * 0.5,
      crown,
      crownIndex: 0,
      crownMatrix: new T.Matrix4(),
      trunk,
      trunkIndex: 0,
      trunkMatrix: new T.Matrix4(),
    };
  });
  const saved = samples.map((t) => [
    t.x,
    t.y,
    t.z,
    t.height,
    t.width,
    t.diameter,
    t.sourceId,
  ]);
  const wood = new T.BoxGeometry(0.1, 1, 0.1);
  wood.translate(0, 0.5, 0);
  wood.computeBoundingSphere();
  const material = new T.MeshStandardMaterial(),
    depth = new T.MeshDepthMaterial();
  installBroadleafVolumes(samples, {
    material,
    depth,
    branches: {
      geometry: wood,
      distantGeometry: wood,
      materials: [material],
      depth,
    },
  });
  for (const [i, t] of samples.entries()) {
    assert.deepEqual(
      [t.x, t.y, t.z, t.height, t.width, t.diameter, t.sourceId],
      saved[i],
    );
    const pos = new T.Vector3(),
      scale = new T.Vector3();
    t.crownMatrix.decompose(pos, new T.Quaternion(), scale);
    assert.deepEqual(pos.toArray(), [t.x, t.y, t.z]);
    assert.ok(Math.abs(scale.y - t.height) < 1e-8);
    assert.ok(Math.abs(scale.x * broadleafShape.width - t.width) < 1e-8);
    assert.deepEqual(t.trunkMatrix.elements, t.crownMatrix.elements);
    const untouched = new T.Matrix4();
    t.trunk.getMatrixAt(1, untouched);
    assert.equal(untouched.determinant(), 0);
  }
  assert.equal(
    samples[0].crown.geometry.getAttribute("position"),
    samples[1].crown.geometry.getAttribute("position"),
  );
  assert.equal(
    samples[0].trunk.geometry.getAttribute("position"),
    samples[1].trunk.geometry.getAttribute("position"),
  );
  assert.notEqual(
    samples[0].trunk.geometry.getAttribute("treeStemScale"),
    samples[1].trunk.geometry.getAttribute("treeStemScale"),
  );
  const trunk = samples[0].trunk,
    high = trunk.geometry;
  updateBroadleafDistance(trunk, 650);
  const low = trunk.geometry;
  assert.notEqual(low, high);
  assert.equal(
    low.getAttribute("treeStemScale"),
    high.getAttribute("treeStemScale"),
  );
  updateBroadleafDistance(trunk, 280);
  assert.equal(trunk.geometry, low);
  updateBroadleafDistance(trunk, 240);
  assert.equal(trunk.geometry, high);
  const model = () => {
    const g = new T.Group();
    const geo = new T.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    g.add(new T.Mesh(geo, new T.MeshStandardMaterial()));
    return g;
  };
  const d = DetailedTrees.fromModels(new T.Scene(), [model(), model()]);
  d.samples = samples;
  d.update(0, 0, 5);
  d.budget = 0;
  d.update(0, 0, 5);
  for (const t of samples)
    for (const [mesh, index, expected] of [
      [t.crown, t.crownIndex, t.crownMatrix],
      [t.trunk, t.trunkIndex, t.trunkMatrix],
    ] as const) {
      const actual = new T.Matrix4();
      mesh.getMatrixAt(index, actual);
      actual.elements.forEach((n, i) =>
        assert.ok(Math.abs(n - expected.elements[i]) < 1e-5),
      );
    }
});

test("distant canopy retains all source slice extents/UV ranges with at most48 triangles", () => {
  const near = broadleafVolumeGeometry(),
    far = broadleafVolumeGeometry(true);
  assert.ok(far.index!.count / 3 <= 48);
  assert.ok(far.index!.count < near.index!.count / 10);
  assert.ok(near.boundingBox!.min.distanceTo(far.boundingBox!.min) < 1e-6);
  assert.ok(near.boundingBox!.max.distanceTo(far.boundingBox!.max) < 1e-6);
  for (const name of ["position", "normal", "uv", "sliceAxis"])
    assert.ok(Array.from(far.getAttribute(name).array).every(Number.isFinite));
  const uv = far.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1);
    assert.ok(uv.getY(i) >= 0 && uv.getY(i) <= 1);
  }
  near.dispose();
  far.dispose();
});

test("merged slice rectangles reveal no new opaque pixels outside original crop bands", async () => {
  const sharp = (await import("sharp")).default;
  const { data: rgba, info } = await sharp(
    "public/textures/broadleaf/color.webp",
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 4096);
  assert.equal(info.height, 1536);
  let newlyCovered = 0,
    maxAlpha = 0;
  for (let slice = 0; slice < 24; slice++) {
    const bands = data.cuts[slice];
    if (!bands.length) continue;
    const left = Math.min(...bands.map((b) => b[0])),
      right = Math.max(...bands.map((b) => b[2]));
    const top = Math.min(...bands.map((b) => b[1])),
      bottom = Math.max(...bands.map((b) => b[3]));
    for (let y = top; y < bottom; y++) {
      const band = bands.find((b) => y >= b[1] && y < b[3]);
      for (let x = left; x < right; x++) {
        if (band && x >= band[0] && x < band[2]) continue;
        const alpha =
          rgba[
            ((Math.floor(slice / 8) * 512 + y) * 4096 + (slice % 8) * 512 + x) *
              4 +
              3
          ];
        maxAlpha = Math.max(maxAlpha, alpha);
        newlyCovered++;
      }
    }
  }
  assert.ok(newlyCovered > 0);
  // Source bake's crop threshold is4/255; the renderer/shadow cutoff is.18.
  assert.ok(maxAlpha <= 4, `new coverage max alpha ${maxAlpha}`);
});

test("distant fallback switches conservatively outside the full192m cell", () => {
  const high = new T.BoxGeometry(),
    low = new T.BoxGeometry();
  const mesh = new T.Mesh(high);
  mesh.userData.branchNearGeometry = high;
  mesh.userData.branchFarGeometry = low;
  mesh.userData.treeCellRadius = Math.SQRT2 * 96;
  updateBroadleafDistance(mesh, 350);
  assert.equal(mesh.geometry, high);
  updateBroadleafDistance(mesh, 380);
  assert.equal(mesh.geometry, low);
  updateBroadleafDistance(mesh, 340);
  assert.equal(mesh.geometry, low);
  updateBroadleafDistance(mesh, 320);
  assert.equal(mesh.geometry, high);
});
