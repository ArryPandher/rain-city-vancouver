import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { buildHarbourGreen } from "../src/world/harbour-green";
import {
  HARBOUR_BOUNDARY,
  HARBOUR_FLIGHTS,
  HARBOUR_POOL_LEVEL,
  harbourGroundHeight,
  harbourContains,
  harbourFlightHeight,
  harbourPaths,
  fountainWorld,
} from "../src/world/harbour-green-site";
import { JACK_BOUNDARY, jackGroundHeight } from "../src/world/jack-poole-site";
import { CollisionWorld } from "../src/world/collision";
import type { CityData } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
const data = {
  buildings: [],
  roads: [],
  areas: [{ kind: "park", name: "Harbour Green Park", pts: HARBOUR_BOUNDARY }],
  ocean: [],
} as unknown as CityData;
const root = new T.Group(),
  collision = new CollisionWorld(data),
  refs: ReflectionProbeSpec[] = [];
const m = {
  texture: () => new T.Texture(),
  asphalt: new T.MeshStandardMaterial(),
  neonMaterials: [],
  animatedUniforms: [],
} as unknown as Materials;
const meshes = buildHarbourGreen(root, data, m, collision, refs);
root.updateMatrixWorld(true);
const surfaces = meshes.filter((m) =>
  /maintained grass|grey waterfront pavers|granite fountain paving|pale cut stone|garden earth/.test(
    (m.material as T.Material).name,
  ),
);
test("Harbour Green keeps the mapped 27 central risers and six three-step shore flights, with visible tread heights matching collision", () => {
  assert.equal(
    HARBOUR_FLIGHTS.filter((f) => f.id.startsWith("w48271068")).reduce(
      (n, f) => n + f.steps,
      0,
    ),
    27,
  );
  assert.equal(
    HARBOUR_FLIGHTS.filter(
      (f) => !f.id.startsWith("w48271068") && f.steps === 3,
    ).length,
    6,
  );
  const ray = new T.Raycaster();
  for (const f of HARBOUR_FLIGHTS)
    for (let i = 0; i < f.steps; i++) {
      const t = (i + 0.5) / f.steps,
        x = f.a[0] + (f.b[0] - f.a[0]) * t,
        z = f.a[1] + (f.b[1] - f.a[1]) * t,
        y = harbourFlightHeight(f, x, z);
      assert.ok(Math.abs(collision.groundHeight(x, z) - y) < 0.001, f.id);
      ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0));
      assert.ok(
        ray
          .intersectObjects(surfaces)
          .some((hit) => Math.abs(hit.point.y - y - 0.018) < 0.003),
        `${f.id} tread ${i}`,
      );
    }
});
test("Harbour Green surface has no holes, subterranean patches or non-finite geometry", () => {
  for (const mesh of meshes)
    for (const name of ["position", "normal"]) {
      const a = mesh.geometry.getAttribute(name);
      for (const v of a.array) assert.ok(Number.isFinite(v));
    }
  const ray = new T.Raycaster();
  let samples = 0;
  for (let x = -280; x < 40; x += 9.37)
    for (let z = -917; z < -685; z += 9.43) {
      if (!harbourContains(x, z)) continue;
      const y = collision.groundHeight(x, z);
      ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0));
      const hit = ray
        .intersectObjects(surfaces)
        .find((hit) => Math.abs(hit.point.y - y) < 0.1);
      assert.ok(hit, `surface at ${x},${z},${y}`);
      samples++;
    }
  assert.ok(samples > 400);
});
test("fountain water stays walkable, stone piers are solid, and all four central-stair approaches remain open", () => {
  const p = fountainWorld(7, 10);
  assert.equal(collision.groundHeight(...p), HARBOUR_POOL_LEVEL);
  assert.equal(collision.water(...p), false);
  assert.equal(collision.blocked(...p, 0.32, HARBOUR_POOL_LEVEL), false);
  assert.equal(
    collision.blocked(...fountainWorld(-0.85, 7.2), 0.32, HARBOUR_POOL_LEVEL),
    true,
  );
  for (const id of ["w1104112434", "w1105669953", "w85240508"]) {
    const p = harbourPaths.find((p) => p.id === id)!;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i],
        b = p.pts[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let previous = collision.groundHeight(...a);
      for (let d = 0.1; d <= len; d += 0.1) {
        const x = a[0] + ((b[0] - a[0]) * d) / len,
          z = a[1] + ((b[1] - a[1]) * d) / len,
          y = collision.groundHeight(x, z);
        assert.equal(
          collision.blocked(x, z, 0.32, previous),
          false,
          `${id} blocked ${x},${z}`,
        );
        assert.ok(
          Math.abs(y - previous) < 0.3,
          `${id} height jump ${y - previous}`,
        );
        previous = y;
      }
    }
  }
  assert.equal(refs.length, 1);
  assert.equal(m.animatedUniforms.length, 1);
  const jets = root.getObjectByName("Harbour Green fountain jets") as T.Points;
  assert.equal(jets.geometry.getAttribute("position").count, 9120);
  for (const key of ["velocity", "life", "phase"])
    for (const v of jets.geometry.getAttribute(key).array)
      assert.ok(Number.isFinite(v));
});
test("the Harbour Green / Jack Poole seam has no abrupt step", () => {
  let samples = 0;
  for (let i = 0; i < JACK_BOUNDARY.length; i += 2) {
    const j = (i + 2) % JACK_BOUNDARY.length,
      dx = JACK_BOUNDARY[j] - JACK_BOUNDARY[i],
      dz = JACK_BOUNDARY[j + 1] - JACK_BOUNDARY[i + 1],
      len = Math.hypot(dx, dz);
    for (let d = 0.1; d < len; d += 0.7) {
      const x = JACK_BOUNDARY[i] + (dx * d) / len,
        z = JACK_BOUNDARY[i + 1] + (dz * d) / len;
      const a: [number, number] = [
          x + (dz / len) * 0.03,
          z - (dx / len) * 0.03,
        ],
        b: [number, number] = [x - (dz / len) * 0.03, z + (dx / len) * 0.03];
      for (const [p, q] of [
        [a, b],
        [b, a],
      ]) {
        const h = harbourGroundHeight(...p),
          k = jackGroundHeight(...q);
        if (h === undefined || k === undefined) continue;
        assert.ok(Math.abs(h - k) < 0.1, `${p}: ${h} vs ${k}`);
        samples++;
      }
    }
  }
  assert.ok(samples > 100);
});
