import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  fairmontParts,
  fairmontSection,
  fairmontRoof,
  fairmontFootprint,
  fairmontWorld,
  fairmontLocal,
  fairmontTowerSection,
  FAIRMONT_ID,
} from "../src/world/fairmont-site";
import { fairmontPacificRim } from "../src/world/fairmont-pacific-rim";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { pointInPoly, type CityData } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
const contains = (poly: number[][][][], x: number, z: number) =>
  poly.some(
    (p) =>
      pointInPoly(x, z, p[0].flat()) &&
      !p.slice(1).some((h) => pointInPoly(x, z, h.flat())),
  );
function fixture() {
  const b = { id: FAIRMONT_ID, pts: fairmontFootprint };
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
  } as unknown as Materials;
  batch.offsetY = 9;
  assert.equal(fairmontPacificRim(b, batch, m, collision, refs), true);
  assert.equal(batch.offsetY, 9);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { root, meshes, refs, collision };
}
test("Fairmont height sections agree with overlapping mapped building parts", () => {
  assert.equal(fairmontParts.length, 8);
  for (const y of [1, 10, 22, 60, 129, 135, 141]) {
    const section = fairmontSection(y);
    for (let x = 195.25; x < 301; x += 1.9)
      for (let z = -602.13; z < -532; z += 1.9) {
        const expected = fairmontParts
          .slice(1)
          .some(
            (p) =>
              p.minHeight <= y &&
              p.height > y &&
              pointInPoly(x, z, p.pts.flat()),
          );
        assert.equal(
          contains(section, x, z),
          expected,
          `section ${x},${z},${y}`,
        );
      }
  }
  assert.equal(fairmontSection(141).length, 0);
  assert.ok(fairmontRoof(15).length > 0);
  assert.ok(fairmontRoof(140).length > 0);
  const p = fairmontWorld(42, 19),
    q = fairmontLocal(...p);
  assert.ok(Math.hypot(q[0] - 42, q[1] - 19) < 1e-10);
});
test("Fairmont has finite complete geometry, deep rooms and the mapped 140m top", () => {
  const { meshes, refs } = fixture();
  let highest = 0,
    triangles = 0;
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
      highest = Math.max(highest, p.getY(i));
    }
  }
  assert.equal(highest, 140);
  assert.ok(triangles < 200000, `geometry budget ${triangles}`);
  assert.equal(refs.length, 3);
  assert.ok(
    refs.every(
      (r) => !pointInPoly(r.position[0], r.position[2], fairmontFootprint),
    ),
  );
  assert.ok(
    meshes.some((m) =>
      (m.material as T.Material).name.includes("recessed rooms"),
    ),
  );
  const ray = new T.Raycaster();
  // A mid-height ray across the broad east face meets both outer glass and
  // recessed room geometry, rather than only a painted opaque wall.
  const ring = fairmontTowerSection(50)[0][0];
  const i = ring.findIndex(
    (p, i) =>
      i < ring.length - 1 &&
      Math.hypot(ring[i + 1][0] - p[0], ring[i + 1][1] - p[1]) > 40,
  );
  const a = ring[i],
    b = ring[i + 1],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = 7.5 / Math.round(len / 2.35);
  const centre = new T.Vector3(
    a[0] + (b[0] - a[0]) * t,
    50,
    a[1] + (b[1] - a[1]) * t,
  );
  const outward = new T.Vector3((b[1] - a[1]) / len, 0, -(b[0] - a[0]) / len);
  ray.set(centre.addScaledVector(outward, 20), outward.negate());
  const hits = ray.intersectObjects(meshes),
    glass = hits.find(
      (h) => (h.object as T.Mesh).material instanceof T.MeshPhysicalMaterial,
    ),
    room = hits.find(
      (h) =>
        ((h.object as T.Mesh).material as T.Material).name.includes(
          "recessed rooms",
        ) && Math.abs(h.face!.normal.dot(ray.ray.direction)) > 0.95,
    );
  assert.ok(glass && room, "visible pane and backing room");
  assert.ok(
    room.distance - glass.distance > 2,
    "room must sit metres behind the outer guard/pane",
  );
});
test("Fairmont exterior pavement remains walkable and canopy columns block movement", () => {
  const { collision } = fixture();
  for (let u = 17; u <= 51; u += 0.5) {
    const [x, z] = fairmontWorld(u, -3.4);
    assert.equal(
      collision.blocked(x, z, 0.32, collision.groundHeight(x, z)),
      false,
      `canopy promenade ${u}`,
    );
  }
  const [x, z] = fairmontWorld(29, -0.3);
  assert.equal(
    collision.blocked(x, z, 0.32, collision.groundHeight(x, z)),
    true,
  );
});
