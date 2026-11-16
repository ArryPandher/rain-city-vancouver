import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createIronworkersPathBoundary } from "../src/world/ironworkers-path-boundary";
import { BRIDGES, bridgeY } from "../src/world/collision";

test("path receives live contact shadows and only visible physical fence geometry casts", (t) => {
  const bridge = BRIDGES.find((b) => b.id === "ironworkers")!;
  const boundary = createIronworkersPathBoundary(
    (u) => bridgeY(bridge, u, [0, 0]),
    () => 0.07,
  );
  const top = JSON.stringify(boundary.topTriangles);
  const members = boundary.members.map((m) => m.matrix.elements.slice());
  const concrete = new T.MeshStandardMaterial({
    color: 0x92958e,
    roughness: 0.82,
  });
  const steel = new T.MeshStandardMaterial({
    color: 0xa7afac,
    roughness: 0.5,
    metalness: 0.75,
  });
  const view = boundary.createRenderGroup(concrete, steel);
  const [path, curbs, rails] = view.group.children as T.Mesh[];
  assert.equal(path.receiveShadow, true);
  assert.equal(
    path.castShadow,
    false,
    "the receiving deck adds no casting pass",
  );
  assert.equal(path.material, concrete);
  for (const m of [curbs, rails]) {
    assert.equal(m.receiveShadow, true);
    assert.equal(m.castShadow, true);
  }
  assert.equal(rails.material, steel, "steel response is not darkened");
  const lods = view.group.children.filter(
    (o): o is T.LOD => o instanceof T.LOD,
  );
  for (const lod of lods) {
    const near = lod.levels[0].object as T.Mesh;
    const far = lod.levels[1].object as T.Mesh;
    assert.equal(near.castShadow, true);
    assert.equal(near.receiveShadow, true);
    assert.equal(far.castShadow, false);
    assert.equal(far.receiveShadow, false);
  }
  view.group.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera();
  let maxCasters = 0,
    maxTriangles = 0,
    maxNearPickets = 0;
  for (const station of lods) {
    camera.position.copy(station.position);
    camera.updateMatrixWorld(true);
    for (const lod of lods) lod.update(camera);
    let casters = 0,
      triangles = 0,
      nearPickets = 0;
    view.group.traverseVisible((o) => {
      if (!(o instanceof T.Mesh) || !o.castShadow) return;
      casters++;
      const count = o instanceof T.InstancedMesh ? o.count : 1;
      triangles += (o.geometry.getIndex()!.count / 3) * count;
      if (o.parent instanceof T.LOD) nearPickets += count;
    });
    maxCasters = Math.max(maxCasters, casters);
    maxTriangles = Math.max(maxTriangles, triangles);
    maxNearPickets = Math.max(maxNearPickets, nearPickets);
  }
  assert.ok(
    maxCasters <= 23,
    "21 physical bar chunks plus two static batches bound submission",
  );
  assert.ok(
    maxNearPickets === view.stats.pickets,
    "physical fallback deliberately retains all bar geometry before light-frustum culling",
  );
  assert.ok(maxTriangles < 350000, "full physical boundary stays within its explicit triangle ceiling");
  t.diagnostic(
    JSON.stringify({
      maxCasters,
      maxTriangles,
      maxNearPickets,
      note: "sampled CPU caster upper bounds before light-frustum culling, not measured GPU draws",
    }),
  );
  assert.equal(JSON.stringify(boundary.topTriangles), top);
  assert.deepEqual(
    boundary.members.map((m) => m.matrix.elements),
    members,
  );
  assert.equal(view.stats.maxDrawCalls, 24);
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  view.group.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
});
