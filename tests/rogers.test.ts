import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  rogersParts,
  rogersSection,
  rogersRoof,
  rogersWorld,
  rogersFootprint,
  ROGERS_ID,
  ROGERS_BASE,
  ROGERS_POOL,
  ROGERS_LIGHT,
} from "../src/world/rogers-site";
import { rogersTower } from "../src/world/rogers-tower";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { pointInPoly, type CityData, type Point } from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
const contains = (multi: number[][][][], x: number, z: number) =>
  multi.some(
    (p) =>
      pointInPoly(x, z, p[0].flat()) &&
      !p.slice(1).some((h) => pointInPoly(x, z, h.flat())),
  );
function fixture() {
  const b = { id: ROGERS_ID, pts: rogersFootprint };
  const collision = new CollisionWorld({
    buildings: [b],
    roads: [],
    areas: [],
    ocean: [],
  } as unknown as CityData);
  const root = new T.Group(),
    batch = new Batcher(root),
    refs: ReflectionProbeSpec[] = [];
  const m = {
    texture: () => new T.Texture(),
    neonMaterials: [],
    animatedUniforms: [],
  } as unknown as Materials;
  batch.offsetY = 7;
  assert.equal(rogersTower(b, batch, m, collision, refs), true);
  assert.equal(batch.offsetY, 7);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { root, meshes, refs, collision, m };
}
test("Rogers stepped masses retain mapped height tags and interpreted storey-only wings", () => {
  assert.equal(rogersParts.length, 7);
  for (const y of [1, 16, 32, 45, 90, 145, 150]) {
    const section = rogersSection(y);
    for (let x = 104.23; x < 189; x += 2.11)
      for (let z = -630.19; z < -565; z += 2.13)
        assert.equal(
          contains(section, x, z),
          rogersParts
            .slice(1)
            .some((p) => p.height > y && pointInPoly(x, z, p.pts.flat())),
          `${x},${z},${y}`,
        );
  }
  assert.equal(rogersParts.find((p) => p.id === "w91998107")!.height, 142);
  assert.equal(rogersParts.find((p) => p.id === "w361502266")!.height, 149);
  assert.ok(rogersRoof(37.2).length > 0);
  assert.ok(rogersRoof(149).length > 0);
});
test("Rogers geometry is finite, reaches its mapped crown and has distinct scenic lobby and water materials", () => {
  const { meshes, refs, m } = fixture();
  let triangles = 0,
    top = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    triangles += mesh.geometry.getIndex()!.count / 3;
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
        ].every(Number.isFinite),
      );
      top = Math.max(top, p.getY(i));
    }
  }
  assert.ok(top >= ROGERS_BASE + 149 && top < ROGERS_BASE + 149.3);
  assert.ok(triangles < 200000, `triangles ${triangles}`);
  assert.equal(refs.length, 4);
  assert.equal(m.animatedUniforms.length, 1);
  for (let h = 10; h < 142; h += 3) {
    for (const dx of [-0.09, 0.09])
      for (const dz of [-0.09, 0.09])
        assert.equal(
          contains(
            rogersSection(h),
            ROGERS_LIGHT[0] + dx,
            ROGERS_LIGHT[1] + dz,
          ),
          false,
          "Light Art shaft buried in facade at " + h,
        );
  }
  for (const name of [
    "clear lobby glazing",
    "lobby leather seating",
    "reflecting pool",
    "water-feature mist",
  ])
    assert.ok(
      meshes.some((m) => (m.material as T.Material).name.endsWith(name)),
      name,
    );
  for (const p of refs)
    assert.equal(
      contains(
        rogersSection(p.position[1] - ROGERS_BASE),
        p.position[0],
        p.position[2],
      ),
      false,
      p.name + " inside building",
    );
});
test("Rogers residential panes have physical depth to the back of their rooms", () => {
  const { meshes } = fixture(),
    ring = rogersSection(100)[0][0];
  const i = ring.findIndex(
    (p, i) =>
      i < ring.length - 1 &&
      Math.hypot(ring[i + 1][0] - p[0], ring[i + 1][1] - p[1]) > 25,
  );
  const frame = facadeFrame(ring[i] as Point, ring[i + 1] as Point),
    count = Math.round(frame.length / 2.35),
    centre = frame.p((6.5 * frame.length) / count, 105.8);
  const out = new T.Vector3(frame.outward[0], 0, frame.outward[1]);
  const ray = new T.Raycaster(
    new T.Vector3(...centre).addScaledVector(out, 20),
    out.negate(),
  );
  const hits = ray.intersectObjects(meshes),
    glass = hits.find((h) =>
      ((h.object as T.Mesh).material as T.Material).name.includes(
        "silver-blue glass",
      ),
    ),
    room = hits.find(
      (h) =>
        ((h.object as T.Mesh).material as T.Material).name.includes(
          "recessed room",
        ) && Math.abs(h.face!.normal.dot(ray.ray.direction)) > 0.95,
    );
  assert.ok(glass && room);
  assert.ok(
    room.distance - glass.distance > 2.9 &&
      room.distance - glass.distance < 3.3,
  );
});
test("Rogers public perimeter stays clear while the water basin blocks entry", () => {
  const { collision } = fixture();
  for (const route of [
    [
      [0, -22],
      [62, -22],
    ],
    [
      [74, -19],
      [80, 25],
    ],
    [
      [0, 50],
      [76, 24],
    ],
  ] as Point[][]) {
    const [a, b] = route,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= l; t += 0.5) {
      const p = rogersWorld(
        a[0] + ((b[0] - a[0]) * t) / l,
        a[1] + ((b[1] - a[1]) * t) / l,
      );
      assert.equal(
        collision.blocked(...p, 0.32, collision.groundHeight(...p)),
        false,
        `route ${p}`,
      );
    }
  }
  const a = ROGERS_POOL[0],
    b = ROGERS_POOL[1],
    p: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  assert.equal(
    collision.blocked(...p, 0.32, collision.groundHeight(...p)),
    true,
  );
});
