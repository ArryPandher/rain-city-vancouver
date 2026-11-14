import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  harbourTowers,
  harbourTowerSection,
  harbourTowerLevels,
} from "../src/world/harbour-towers-site";
import { harbourGreenTower } from "../src/world/harbour-towers";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { pointInPoly, type CityData, centroid } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
import { facadeFrame } from "../src/world/architectural-mesh";
function fixture() {
  const buildings = harbourTowers.map((b) => ({
    id: b.id,
    pts: b.parts[0].pts.flat(),
  }));
  const collision = new CollisionWorld({
    buildings,
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
  for (const b of buildings) {
    assert.equal(harbourGreenTower(b, batch, m, collision, refs), true);
    assert.equal(batch.offsetY, 7);
  }
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { root, meshes, refs, collision };
}
test("Harbour Green upper sections match mapped parts and preserve podiums and developer heights", () => {
  assert.deepEqual(
    harbourTowers.map((b) => b.height),
    [80, 105, 116],
  );
  assert.deepEqual(
    harbourTowers.map((b) => b.podium),
    [10, 12, 15],
  );
  for (const b of harbourTowers) {
    assert.equal(Math.max(...b.parts.map((p) => p.height)), b.height);
    assert.equal(harbourTowerSection(b, b.height + 0.1).length, 0);
    const [cx, cz] = centroid(b.parts[0].pts.flat());
    for (const h of [2, b.podium + 0.1, b.height * 0.7, b.height - 1]) {
      const section = harbourTowerSection(b, h);
      for (let x = cx - 45; x < cx + 45; x += 2.13)
        for (let z = cz - 45; z < cz + 45; z += 2.19) {
          const expected = b.parts.some(
            (p, i) =>
              (i === 0 ? h < b.podium : h >= p.minHeight) &&
              h < p.height &&
              pointInPoly(x, z, p.pts.flat()),
          );
          const actual = section.some(
            (poly) =>
              pointInPoly(x, z, poly[0].flat()) &&
              !poly.slice(1).some((h) => pointInPoly(x, z, h.flat())),
          );
          assert.equal(actual, expected, `${b.name} ${h} ${x} ${z}`);
        }
    }
    const levels = harbourTowerLevels(b);
    assert.equal(levels.at(-1), b.height);
    for (const p of b.parts) assert.ok(levels.includes(p.height));
  }
});
test("Three distinct Harbour Green exteriors have finite geometry, shallow window depth and budgeted meshes", () => {
  const { meshes, refs, collision } = fixture();
  let triangles = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    triangles += mesh.geometry.getIndex()!.count / 3;
    for (let i = 0; i < p.count; i++)
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
  }
  assert.ok(triangles < 300000, `triangles ${triangles}`);
  assert.equal(refs.length, 6);
  for (const b of harbourTowers) {
    const own = meshes.filter((m) =>
      (m.material as T.Material).name.startsWith(b.name),
    );
    const base = collision.groundHeight(...centroid(b.parts[0].pts.flat()));
    let top = 0;
    for (const mesh of own) {
      const p = mesh.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) top = Math.max(top, p.getY(i));
    }
    assert.ok(
      top >= base + b.height && top < base + b.height + 0.3,
      `${b.name} top ${top}`,
    );
    assert.ok(
      own.some((m) =>
        (m.material as T.Material).name.includes("balcony guard glass"),
      ),
    );
    const ring = harbourTowerSection(b, 40)[0][0];
    const i = ring.findIndex(
      (p, i) =>
        i < ring.length - 1 &&
        Math.hypot(ring[i + 1][0] - p[0], ring[i + 1][1] - p[1]) > 8,
    );
    const f = facadeFrame(ring[i], ring[i + 1]);
    let found = false;
    // Cast across multiple panes to avoid an intentional mullion or lowered blind.
    for (let s = 0.6; s < f.length; s += 0.47) {
      const ray = new T.Raycaster(
        new T.Vector3(...f.p(s, base + 40.8, -10)),
        new T.Vector3(-f.outward[0], 0, -f.outward[1]),
      );
      const hits = ray.intersectObjects(own),
        glass = hits.find(
          (h) =>
            (h.object as T.Mesh).material instanceof T.MeshPhysicalMaterial &&
            !((h.object as T.Mesh).material as T.Material).name.includes(
              "guard",
            ),
        );
      const back = hits.find(
        (h) =>
          ((h.object as T.Mesh).material as T.Material).name.includes(
            "window depth",
          ) && Math.abs(h.face!.normal.dot(ray.ray.direction)) > 0.95,
      );
      if (
        glass &&
        back &&
        Math.abs(back.distance - glass.distance - 1.1) < 0.03
      ) {
        found = true;
        break;
      }
    }
    assert.ok(found, `${b.name} missing physical pane depth`);
  }
});
test("Harbour Green tower collision follows podiums and leaves the park-side public perimeter clear", () => {
  const { collision } = fixture();
  for (const b of harbourTowers) {
    const pts = b.parts[0].pts;
    const centre = centroid(pts.flat());
    assert.ok(
      collision.blocked(...centre, 0.3, collision.groundHeight(...centre)),
    );
    for (let i = 0; i < pts.length; i++) {
      const f = facadeFrame(pts[i], pts[(i + 1) % pts.length]);
      if (f.length < 4) continue;
      const p = f.p(f.length / 2, 0, -1.2);
      if (
        harbourTowers.some((other) =>
          pointInPoly(p[0], p[2], other.parts[0].pts.flat()),
        )
      )
        continue;
      assert.equal(
        collision.blocked(p[0], p[2], 0.3, collision.groundHeight(p[0], p[2])),
        false,
        `${b.name} ${p}`,
      );
    }
  }
});
