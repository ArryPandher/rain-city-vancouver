import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { World } from "../src/world/world";
import { BRIDGES, bridgeY } from "../src/world/collision";
import {
  createIronworkersDeckGeometry,
  ironworkersGradeT,
  ironworkersPoint,
} from "../src/world/ironworkers-alignment";
import { createIronworkersPathBoundary } from "../src/world/ironworkers-path-boundary";
import { createIronworkersBridgeGeometry } from "../src/world/ironworkers-bridge";
import { registerIronworkersStaticOrigins } from "../src/world/ironworkers-static-origin";
const bridge = BRIDGES.find((b) => b.id === "ironworkers")!,
  height = (t: number) => bridgeY(bridge, t, [0, 0]);
function world() {
  const root = new T.Group(),
    sun = new T.DirectionalLight(),
    rain = new T.Group();
  rain.visible = false;
  return Object.assign(Object.create(World.prototype), {
    root,
    chunks: [],
    time: 0,
    materials: { animatedUniforms: [], beacons: [] },
    collision: { groundHeight: () => 0 },
    water: {
      uniforms: { time: { value: 0 }, sunDir: { value: new T.Vector3() } },
    },
    sun,
    rain,
    casterVolume: { update: () => {}, includes: () => false },
  }) as World;
}
function visibleRay(w: World, x: number, z: number, y: number) {
  w.root.updateMatrixWorld(true);
  return new T.Raycaster(
    new T.Vector3(x, y + 0.2, z),
    new T.Vector3(0, -1, 0),
    0,
    0.4,
  ).intersectObjects(
    w.chunks.filter((c) => c.visible),
    true,
  )[0];
}
function scene() {
  const g = new T.Group(),
    material = new T.MeshBasicMaterial({ side: T.FrontSide });
  g.add(new T.Mesh(createIronworkersDeckGeometry(height), material));
  return g;
}

test("actual static batching and visibility preserve the native shoulder floor at the bridge rather than culling it at world origin", () => {
  const x = 6790.03,
    z = -1441.31,
    y = height(ironworkersGradeT(x, z)),
    broken = world();
  broken.mergeStatic(scene());
  broken.update(0, x, z, y);
  assert.equal(
    broken.chunks[0].visible,
    false,
    "reproduce original origin culling",
  );
  assert.equal(visibleRay(broken, x, z, y), undefined);
  const fixed = world(),
    source = scene();
  registerIronworkersStaticOrigins(source);
  fixed.mergeStatic(source);
  fixed.update(0, x, z, y);
  assert.equal(fixed.chunks[0].visible, true);
  const hit = visibleRay(fixed, x, z, y);
  assert.ok(hit, "actual FrontSide deck visible from above");
  assert.ok(Math.abs(hit.point.y - y) < 0.012);
  assert.ok(Math.abs(fixed.chunks[0].userData.center[0] - 6800) < 400);
  for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1])
    for (const side of [-17.5, -12, 0, 12, 17.5]) {
      const [x, z] = ironworkersPoint(t, side),
        y = height(ironworkersGradeT(x, z));
      fixed.update(0, x, z, y);
      assert.ok(visibleRay(fixed, x, z, y), `missing deck${t}/${side}`);
    }
});

test("the new path FrontSide geometry has upward normals and top hits at actual pedestrian-route locations", () => {
  const boundary = createIronworkersPathBoundary(height, () => 0.07),
    view = boundary.createRenderGroup(
      new T.MeshBasicMaterial({ side: T.FrontSide }),
      new T.MeshBasicMaterial(),
    ),
    path = view.group.children[0] as T.Mesh;
  view.group.updateMatrixWorld(true);
  for (const route of boundary.walkingCentres)
    for (let i = 1; i < route.points.length - 1; i += 5) {
      const [x, z] = route.points[i],
        y = boundary.supportAt(x, z)!;
      assert.ok(Number.isFinite(y));
      const hit = new T.Raycaster(
        new T.Vector3(x, y + 0.2, z),
        new T.Vector3(0, -1, 0),
        0,
        0.4,
      ).intersectObject(path)[0];
      assert.ok(hit);
      assert.ok(hit.face!.normal.y > 0);
      assert.ok(Math.abs(hit.point.y - y) < 1e-5);
    }
});

test("origin registration preserves complete world geometry and restores below-deck structure culling too", () => {
  const parts = createIronworkersBridgeGeometry(bridge, height),
    group = new T.Group();
  for (const role of ["steel", "concrete"] as const)
    group.add(new T.Mesh(parts[role], new T.MeshBasicMaterial()));
  group.updateMatrixWorld(true);
  const positions = group.children.map((o) => {
    const m = o as T.Mesh,
      p = m.geometry.attributes.position;
    return Array.from({ length: p.count }, (_, i) =>
      new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld),
    );
  });
  registerIronworkersStaticOrigins(group);
  group.updateMatrixWorld(true);
  group.children.forEach((o, i) => {
    const m = o as T.Mesh,
      p = m.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const q = new T.Vector3()
        .fromBufferAttribute(p, j)
        .applyMatrix4(m.matrixWorld);
      assert.ok(q.distanceTo(positions[i][j]) < 0.001);
    }
    assert.ok(m.position.x > 6700);
  });
  const w = world();
  w.mergeStatic(group);
  w.update(0, 6790.03, -1441.31, 35.59);
  assert.ok(w.chunks.every((m) => m.visible));
});
