import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { World } from "../src/world/world";
import { CollisionWorld } from "../src/world/collision";
import { Materials } from "../src/world/materials";
import { Batcher, flatPolygon } from "../src/world/geometry";
import { KX, ORIGIN, roadWidth, type CityData } from "../src/world/data";
import { robsonSquare } from "../src/world/robson-square";
import { ROBSON_GARDEN_ID } from "../src/world/robson-site";
import {
  ROBSON_RINK_EXTERIOR as D,
  ROBSON_RINK_OPENINGS,
  robsonDomeXZ,
  robsonDomeRing,
  robsonRinkOpeningAt,
} from "../src/world/robson-rink-exterior-data";
import { clipRobsonRinkOpenings } from "../src/world/robson-rink-openings";
import { createRobsonRinkContact } from "../src/world/robson-rink-contact";
import { createRobsonRinkExteriorGeometry } from "../src/world/robson-rink-exterior";
import {
  createRobsonRinkMaterials,
  createRobsonRinkExteriorMeshes,
} from "../src/world/robson-rink-materials";

function sourceFixture() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  const near = (pts: number[]) =>
    Math.max(...pts.filter((_, i) => i % 2 === 0)) > -230 &&
    Math.min(...pts.filter((_, i) => i % 2 === 0)) < -20 &&
    Math.max(...pts.filter((_, i) => i % 2)) > 20 &&
    Math.min(...pts.filter((_, i) => i % 2)) < 180;
  data.buildings = data.buildings.filter((b) => near(b.pts));
  data.areas = data.areas.filter((a) => near(a.pts));
  data.ocean = [];
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads.filter((r: { pts: number[] }) => near(r.pts));
  const materials = Object.create(Materials.prototype) as Materials;
  materials.texture = () => new T.Texture();
  for (const name of [
    "grass",
    "concrete",
    "asphalt",
    "stone",
    "yellow",
  ] as const)
    materials[name] = new T.MeshStandardMaterial({ name });
  const collision = new CollisionWorld(data);
  const world = () =>
    Object.assign(Object.create(World.prototype), {
      root: new T.Group(),
      chunks: [],
      data,
      materials,
      collision,
      facadeMultiDraw: false,
      forestHabitat: {
        woodland: data.areas.filter((a) => a.kind === "forest"),
      },
      stats: { roads: 0 },
      weather: "day",
    }) as World;
  return { data, materials, collision, world };
}
function down(objects: T.Object3D[], x: number, z: number, y = 10) {
  objects.forEach((o) => o.updateMatrixWorld(true));
  return new T.Raycaster(
    new T.Vector3(x, y, z),
    new T.Vector3(0, -1, 0),
  ).intersectObjects(objects, true)[0];
}

test("actual World terrain and custom garden expose both closed well floors; outside support and roads stay unchanged", () => {
  const f = sourceFixture(),
    contact = f.collision.robsonRink!;
  assert.ok(contact);
  assert.ok(f.data.areas.length > 0);
  f.collision.robsonRink = undefined;
  const before = f.world();
  before.terrain();
  const oldRoads = f.world();
  oldRoads.roads();
  f.collision.robsonRink = contact;
  const after = f.world();
  after.terrain();
  const newRoads = f.world();
  newRoads.roads();
  const batch = new Batcher(after.root);
  robsonSquare(
    f.data.buildings.find((b) => b.id === ROBSON_GARDEN_ID)!,
    batch,
    f.materials,
  );
  batch.finish();
  const groundOnly = [...after.root.children];
  const parts = createRobsonRinkExteriorGeometry();
  const solid = new T.Mesh(parts.concrete, f.materials.concrete);
  after.root.add(solid);
  for (const dome of D.domes)
    for (const a of [-0.6, 0, 0.6])
      for (const b of [-0.4, 0, 0.4]) {
        const [x, z] = robsonDomeXZ(dome, a * dome.radii[0], b * dome.radii[1]);
        assert.ok(
          down(before.root.children, x, z),
          "old city layers covered the future well",
        );
        assert.equal(
          down(groundOnly, x, z),
          undefined,
          "no grass, city base, area or garden cap remains",
        );
        assert.ok(
          Math.abs(down(after.root.children, x, z)!.point.y - D.rinkY) < 1e-5,
        );
      }
  // Exact near-edge rays outside each polygon retain their previous Y.
  for (const dome of D.domes)
    for (const [x, z] of robsonDomeRing(dome, D.openingMargin + 0.025)) {
      const old = down(before.root.children, x, z),
        current = down(groundOnly.slice(0, before.root.children.length), x, z);
      assert.ok(old && current);
      assert.ok(Math.abs(old.point.y - current.point.y) < 1e-5);
    }
  let samples = 0;
  for (const road of f.data.roads)
    for (let i = 2; i < road.pts.length; i += 2) {
      const a = road.pts.slice(i - 2, i),
        b = road.pts.slice(i, i + 2),
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!length) continue;
      for (let j = 0; j <= Math.ceil(length); j++)
        for (const side of [-0.5, 0, 0.5]) {
          const t = j / Math.ceil(length),
            width = roadWidth(road) * side;
          const x = a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / length) * width,
            z = a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / length) * width;
          assert.equal(contact.support(x, z, 0), undefined);
          const current = f.collision.walkingHeight(x, z, 0);
          f.collision.robsonRink = undefined;
          const old = f.collision.walkingHeight(x, z, 0);
          f.collision.robsonRink = contact;
          assert.equal(current, old);
          samples++;
        }
    }
  assert.ok(samples > 1000);
  const roadPositions = (w: World) =>
    w.chunks.map((m) => Array.from(m.geometry.getAttribute("position").array));
  assert.deepEqual(
    roadPositions(newRoads),
    roadPositions(oldRoads),
    "actual World.roads output is unchanged, including upper crossing",
  );
  for (const role of ["concrete", "steel", "glass"] as const)
    parts[role].dispose();
});

test("clip preserves affine sloped support and UVs outside exact holes", () => {
  const source = flatPolygon(
    [-150, 35, -30, 35, -30, 150, -150, 150],
    [],
    0,
    4,
  );
  const p = source.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    p.setY(i, p.getX(i) * 0.02 + p.getZ(i) * 0.01);
  source.computeVertexNormals();
  const old = source.clone();
  const clipped = clipRobsonRinkOpenings(source);
  assert.notEqual(clipped, source);
  for (const [x, z] of [
    [-140, 45],
    [-35, 140],
    [-120, 80],
    [-60, 105],
  ]) {
    assert.equal(robsonRinkOpeningAt(x, z), undefined);
    const a = down([new T.Mesh(old, new T.MeshBasicMaterial())], x, z),
      b = down([new T.Mesh(clipped, new T.MeshBasicMaterial())], x, z);
    assert.ok(a && b);
    assert.ok(a.point.distanceTo(b.point) < 2e-5);
    assert.ok(a.uv!.distanceTo(b.uv!) < 2e-5);
  }
  const distant = flatPolygon([100, 100, 110, 100, 110, 110, 100, 110]);
  assert.equal(clipRobsonRinkOpenings(distant), distant);
});

test("roof landing matches visible facets and finite guards stop the actual jump envelope", () => {
  const contact = createRobsonRinkContact(),
    parts = createRobsonRinkExteriorGeometry();
  const glass = new T.Mesh(parts.glass, new T.MeshBasicMaterial());
  for (const dome of D.domes)
    for (const a of [-0.6, -0.2, 0.2, 0.6]) {
      const [x, z] = robsonDomeXZ(
        dome,
        a * dome.radii[0],
        dome.radii[1] * 0.23,
      );
      const rendered = down([glass], x, z)!.point.y,
        top = contact.roof(x, z)!;
      assert.ok(Math.abs(top - rendered) < 1e-6);
      let y = 5,
        velocity = 0;
      for (let i = 0; i < 180; i++) {
        const support = contact.support(x, z, y)!;
        velocity -= 17 / 60;
        y = Math.max(support, y + velocity / 60);
        if (y <= support) velocity = 0;
      }
      assert.ok(
        Math.abs(y - rendered) < 1e-6,
        "fall lands on real pane rather than phasing to well floor",
      );
      assert.equal(contact.blocked(x, z, 0.2, rendered, true), true);
      assert.equal(
        contact.blocked(x, z, 0.2, rendered + 3, true),
        false,
        "camera roof collider is finite",
      );
    }
  for (const dome of D.domes) {
    const point = robsonDomeRing(
      dome,
      D.openingMargin + D.wallThickness / 2,
    )[0];
    // main.ts jumps at5m/s under17m/s² gravity: feet never clear the guard.
    for (let t = 0; t <= (5 / 17) * 2; t += 1 / 60)
      assert.equal(
        contact.blocked(
          ...point,
          0.36,
          Math.max(D.streetY, D.streetY + 5 * t - 8.5 * t * t),
        ),
        true,
      );
    assert.equal(
      contact.blocked(...point, 0.36, D.rimY + D.guardHeight + 2),
      false,
    );
  }
  assert.ok(
    D.rinkY + 5 ** 2 / 34 + 1.8 < D.roofLow,
    "jump from closed well floor cannot reach glass underside",
  );
  assert.equal(contact.support(0, 0, 0), undefined);
  for (const role of ["concrete", "steel", "glass"] as const)
    parts[role].dispose();
});

test("independent licensed samplers and ordered glass pair need no capture or refraction", () => {
  const map = new T.Texture(),
    normal = new T.Texture(),
    snapshots = [map.repeat.toArray(), normal.repeat.toArray()];
  const library = {
    texture: (name: string) => (name.includes("normal") ? normal : map),
  };
  const m = createRobsonRinkMaterials(library as any);
  assert.notEqual(m.concrete.map, map);
  assert.notEqual(m.concrete.normalMap, normal);
  assert.deepEqual([map.repeat.toArray(), normal.repeat.toArray()], snapshots);
  assert.equal(
    m.glassPair.reflection.ior,
    m.glassPair.attenuation.uniforms.sheetIor.value,
  );
  assert.equal(m.glassPair.reflection.transmission, 0);
  let disposed = 0;
  m.concrete.map!.addEventListener("dispose", () => disposed++);
  m.concrete.normalMap!.addEventListener("dispose", () => disposed++);
  m.concrete.dispose();
  m.concrete.dispose();
  assert.equal(disposed, 2);
  const meshes = createRobsonRinkExteriorMeshes(library as any),
    glass = meshes[2];
  assert.equal(meshes.length, 3);
  assert.equal(glass.geometry.groups.length, 2);
  assert.equal(glass.castShadow, false);
  assert.equal((glass.material as T.Material[]).length, 2);
});
