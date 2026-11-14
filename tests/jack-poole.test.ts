import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  JACK_FLIGHTS,
  JACK_RAMPS,
  JACK_LEVEL,
  JACK_SEAWALL,
  JACK_POOL,
  JACK_CAULDRON,
  JACK_ORCA,
  CACTUS_ROOF,
  jackGroundHeight,
  jackSurface,
  jackContains,
} from "../src/world/jack-poole-site";
import { buildJackPoole, jackPieces } from "../src/world/jack-poole";
import type { Materials } from "../src/world/materials";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, segmentPoint, type CityData } from "../src/world/data";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
function fixture() {
  const d = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const cv = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  d.buildings = d.buildings
    .filter((b) => ["w89118744", "w85240507"].includes(b.id))
    .map((b) => ({ ...b, pts: cv(b.pts) }));
  d.roads = [];
  d.ocean = [];
  d.areas = d.areas.map((a) => ({ ...a, pts: cv(a.pts) }));
  const collision = new CollisionWorld(d),
    root = new T.Group(),
    m = {
      pbr: () => new T.MeshStandardMaterial(),
      texture: () => new T.Texture(),
      grass: new T.MeshStandardMaterial(),
      neonMaterials: [],
    } as unknown as Materials,
    refs: ReflectionProbeSpec[] = [];
  const meshes = buildJackPoole(root, d, m, collision, refs);
  root.updateMatrixWorld(true);
  return { collision, root, meshes, refs };
}
test("plaza has connected interpreted levels with mapped step counts and gentle long ramps", () => {
  assert.equal(
    jackGroundHeight(JACK_CAULDRON[0], JACK_CAULDRON[1]),
    JACK_LEVEL,
  );
  assert.equal(jackGroundHeight(JACK_ORCA[0], JACK_ORCA[1]), JACK_LEVEL);
  assert.equal(jackGroundHeight(400, -700), undefined);
  for (const s of [...JACK_FLIGHTS, ...JACK_RAMPS]) {
    assert.ok(s.a && s.b);
    let previous = s.height(...s.a);
    for (let i = 0; i <= 100; i++) {
      const x = s.a[0] + ((s.b[0] - s.a[0]) * i) / 100,
        z = s.a[1] + ((s.b[1] - s.a[1]) * i) / 100;
      assert.ok(jackContains(x, z), s.id + " outside site");
      const y = s.height(x, z);
      assert.ok(Number.isFinite(y));
      if (i && s.kind === "stair") assert.ok(Math.abs(y - previous) < 0.5);
      previous = y;
    }
    if (s.kind === "ramp")
      assert.ok(
        Math.abs(s.high! - s.low!) /
          Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) <
          0.075,
      );
  }
  assert.equal(
    JACK_FLIGHTS.filter((s) => s.id.startsWith("w159354908")).reduce(
      (a, b) => a + b.steps!,
      0,
    ),
    36,
  );
  assert.equal(
    JACK_FLIGHTS.filter((s) => s.id.startsWith("w223634905")).reduce(
      (a, b) => a + b.steps!,
      0,
    ),
    34,
  );
});
test("visible tread centres share ground heights and solid pool/roof boundaries retain access", () => {
  const { meshes, collision } = fixture(),
    ray = new T.Raycaster();
  const surfaces = meshes.filter(
    (m) => (m.material as T.Material).name === "Jack Poole — plaza paving",
  );
  for (const f of JACK_FLIGHTS)
    for (let i = 0; i < f.steps!; i++) {
      const t = (i + 0.5) / f.steps!,
        x = f.a![0] + (f.b![0] - f.a![0]) * t,
        z = f.a![1] + (f.b![1] - f.a![1]) * t,
        y = f.height(x, z);
      assert.ok(
        Math.abs(collision.groundHeight(x, z) - y) < 0.001,
        f.id + " collision priority",
      );
      ray.set(new T.Vector3(x, 40, z), new T.Vector3(0, -1, 0));
      const hit = ray
        .intersectObjects(surfaces)
        .find((h) => Math.abs(h.point.y - y) < 0.002);
      assert.ok(hit, `${f.id} tread ${i} missing`);
    }
  const edge = [
    (JACK_POOL[0] + JACK_POOL[2]) / 2,
    (JACK_POOL[1] + JACK_POOL[3]) / 2,
  ];
  assert.equal(collision.blocked(edge[0], edge[1], 0.4, JACK_LEVEL), true);
  const roof = [145, -735];
  assert.equal(collision.groundHeight(roof[0], roof[1]), CACTUS_ROOF);
  assert.equal(collision.blocked(roof[0], roof[1], 0.3, CACTUS_ROOF), false);
  assert.equal(collision.blocked(roof[0], roof[1], 0.3, JACK_LEVEL), true);
});
test("site geometry is finite and the cauldron has the referenced ten metre scale", () => {
  const { meshes, refs } = fixture();
  let triangles = 0,
    glassTop = -Infinity,
    glassBottom = Infinity;
  for (const m of meshes) {
    const p = m.geometry.getAttribute("position"),
      n = m.geometry.getAttribute("normal");
    triangles += m.geometry.getIndex()!.count / 3;
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
      if (
        (m.material as T.Material).name ===
        "Olympic cauldron — frosted crystalline glass"
      ) {
        glassTop = Math.max(glassTop, p.getY(i));
        glassBottom = Math.min(glassBottom, p.getY(i));
      }
    }
  }
  assert.ok(triangles < 300000, `triangle count ${triangles}`);
  assert.ok(glassTop - JACK_LEVEL > 10 && glassTop - JACK_LEVEL < 10.8);
  assert.ok(glassBottom > JACK_LEVEL - 0.5);
  assert.equal(refs.length, 1);
  assert.ok(jackPieces().length > JACK_FLIGHTS.length);
});

test("stair and ramp centre lines stay clear through both landings", () => {
  const { collision } = fixture();
  const issues: string[] = [];
  for (const s of [...JACK_FLIGHTS, ...JACK_RAMPS]) {
    const a = s.a!,
      b = s.b!,
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let previous = collision.groundHeight(a[0], a[1]);
    let blocked = false;
    for (let d = 0.1; d < length + 0.5; d += 0.1) {
      const x = a[0] + ((b[0] - a[0]) * d) / length,
        z = a[1] + ((b[1] - a[1]) * d) / length,
        y = collision.groundHeight(x, z);
      if (collision.blocked(x, z, 0.32, previous) && !blocked) {
        issues.push(`${s.id} blocked at ${d.toFixed(2)}m y ${y}`);
        blocked = true;
      }
      if (Math.abs(y - previous) >= 0.5)
        issues.push(`${s.id} jump ${previous} to ${y} at ${d.toFixed(2)}m`);
      previous = y;
    }
  }
  assert.deepEqual(issues, []);
});
