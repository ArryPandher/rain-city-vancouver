import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { addCanadaPlaceNorthSeating } from "../src/world/canada-place-north-seating";
import {
  CANADA_PLACE_NORTH_SEATING as D,
  CANADA_PLACE_NORTH_SEAT_OUTLINE as outline,
  CANADA_PLACE_NORTH_SEATING_APPROACH as approach,
  northSeatPoint,
  canadaPlaceNorthSeatAt,
} from "../src/world/canada-place-north-seating-data";
import { bakeGeometry } from "../src/world/geometry";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import {
  canadaPlaceWorld,
  supportedDeck,
  solidAt,
  CANADA_PLACE_DECK_ROUTE,
} from "../src/world/canada-place-deck";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
const ray = (root: T.Object3D, p: number[], d: number[], far = 20) =>
  new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(...d),
    0,
    far,
  ).intersectObject(root, true)[0];
function model() {
  const root = new T.Group();
  const group = addCanadaPlaceNorthSeating(root);
  root.updateMatrixWorld(true);
  return { root, group };
}
test("Natural Puzzle interpretation has a smooth concave pale slab, closed caps and four grounded tubular supports", () => {
  const { root, group } = model();
  assert.equal(group.children.length, 2);
  let tris = 0;
  for (const m of group.children as T.InstancedMesh[]) {
    assert.equal(m.count, 2);
    assert.ok(m.castShadow && m.receiveShadow);
    tris +=
      ((m.geometry.index?.count ?? m.geometry.getAttribute("position").count) /
        3) *
      2;
    for (const v of m.geometry.getAttribute("position").array)
      assert.ok(Number.isFinite(v));
  }
  assert.ok(tris < 3000, `${tris} triangles for pair`);
  let turns = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      c = outline[(i + 2) % outline.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0)
      turns++;
  }
  assert.ok(turns > 10, "actual lobes include broad concave necks");
  for (const p of D.placements) {
    const [x, z] = northSeatPoint(p, 0, 0),
      top = ray(root, [x, 9, z], [0, -1, 0])!;
    assert.ok(top);
    assert.ok(Math.abs(top.point.y - D.ground - D.height) < 1e-5);
    assert.ok(top.face!.normal.y > 0.99);
    const underside = ray(root, [x, D.ground + 0.1, z], [0, 1, 0])!;
    assert.ok(underside.face!.normal.y < -0.99);
    for (const [u, v] of D.legs) {
      const [a, b] = northSeatPoint(p, u, v),
        support = ray(root, [a, D.ground - 0.1, b], [0, 1, 0])!;
      assert.ok(Math.abs(support.point.y - D.ground) < 1e-5);
      const cap = ray(root, [a, 9, b], [0, -1, 0])!;
      assert.ok(
        Math.abs(cap.point.y - D.ground - D.height) < 1e-5,
        "support joins actual seat slab",
      );
    }
    const w = canadaPlaceWorld(x, z);
    assert.equal(
      canadaPlaceNorthSeatAt(...w, 0.36, D.ground + D.datum, 1.8),
      true,
    );
    assert.equal(
      canadaPlaceNorthSeatAt(...w, 0.36, D.ground + D.datum + D.height, 1.8),
      false,
      "standing on seat is clear",
    );
    assert.equal(
      canadaPlaceNorthSeatAt(...w, 0.25, 10, 0.5),
      false,
      "finite camera envelope",
    );
  }
});
test("all seat perimeter and feet meet actual unchanged PIER while terminal and hall remain excluded", async () => {
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb"),
    loaded = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "",
      );
  loaded.scene.updateMatrixWorld(true);
  let paving: T.BufferGeometry | undefined;
  loaded.scene.traverse((o) => {
    if (o instanceof T.Mesh && (o.material as T.Material).name === "concrete")
      paving =
        extractCanadaPlacePaving(
          bakeGeometry(o.geometry, o.matrixWorld),
          "concrete",
        ) ?? undefined;
  });
  assert.ok(paving);
  const deck = new T.Mesh(paving, new T.MeshBasicMaterial());
  deck.updateMatrixWorld();
  for (const p of D.placements)
    for (const [u, v] of [...outline, ...D.legs]) {
      const [x, z] = northSeatPoint(p, u, v),
        hit = ray(deck, [x, 9, z], [0, -1, 0])!;
      assert.ok(hit);
      assert.ok(Math.abs(hit.point.y - D.ground) < 1e-6);
      assert.ok(hit.face!.normal.y > 0.99);
      assert.ok(supportedDeck(...canadaPlaceWorld(x, z), 0.4));
      assert.equal(solidAt(...canadaPlaceWorld(x, z), 0.4, 7.88), false);
    }
  for (const p of [
    [100, -65],
    [120, -66],
    [72, -31],
    [91, -60],
  ])
    assert.equal(
      supportedDeck(...canadaPlaceWorld(...(p as [number, number])), 0.36),
      false,
      "retained terminal/hall closures remain",
    );
  assert.equal(
    supportedDeck(
      ...canadaPlaceWorld(74, -76),
      0.36,
      canadaPlaceCapabilities(),
    ),
    false,
    "unloaded source never creates support",
  );
});
test("actual full-city walking, bench jump landing, step off and existing promenade remain coherent", async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (url) => {
    try {
      return new Response(
        fs.readFileSync(`public/${String(url).replace(/^\//, "")}`),
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  let data;
  try {
    data = await loadCity();
  } finally {
    globalThis.fetch = old;
  }
  const c = new CollisionWorld(data);
  c.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, true, true, true));
  // Native58: a descending body could enter the narrow notch because the old
  // support tested its centre while the side blocker tested its full capsule.
  const nativeNotch: [number, number] = [718.59, -697.72];
  const seatTop = D.ground + D.datum + D.height;
  assert.equal(
    c.walkingHeight(...nativeNotch, 7.88),
    7.88,
    "ground remains unpromoted, including the historical trapped pose",
  );
  for (let direction = 0; direction < 8; direction++) {
    const angle = (direction * Math.PI) / 4,
      dx = Math.cos(angle),
      dz = Math.sin(angle);
    let body: [number, number] = [...nativeNotch],
      y = seatTop + 0.3,
      vy = 0;
    // Land vertically in the recorded notch first, rather than hiding the
    // support mismatch by steering the foot centre onto the solid slab.
    for (let step = 0; step < 100; step++) {
      const floor = c.walkingHeight(...body, y);
      vy -= 17 / 120;
      y = Math.max(floor, y + vy / 120);
      if (y <= floor) vy = 0;
    }
    assert.ok(
      Math.abs(y - seatTop) < 1e-8,
      "capsule rests on lobes instead of falling between them",
    );
    assert.equal(c.blocked(...body, 0.36, y), false);
    for (let step = 0; step < 240; step++) {
      const move = c.move(...body, (dx * 3.2) / 120, (dz * 3.2) / 120, 0.36, y);
      assert.equal(
        move.hit,
        false,
        `notch landing then walk direction${direction}`,
      );
      body = [move.x, move.z];
      const floor = c.walkingHeight(...body, y);
      vy -= 17 / 120;
      y = Math.max(floor, y + vy / 120);
      if (y <= floor) vy = 0;
      assert.equal(
        c.blocked(...body, 0.36, y),
        false,
        "descent never embeds the body in a seat edge",
      );
    }
    assert.ok(
      Math.hypot(body[0] - nativeNotch[0], body[1] - nativeNotch[1]) > 6,
    );
    assert.ok(
      Math.abs(y - 7.88) < 0.002,
      "ordinary step-off returns to original pier",
    );
  }
  // Also recover the already-recorded ground pose using ordinary Space + walk.
  let escaped: [number, number] = [...nativeNotch],
    escapeY = 7.88,
    escapeVy = 5;
  for (let step = 0; step < 240; step++) {
    const move = c.move(...escaped, -3.2 / 120, 0, 0.36, escapeY);
    escaped = [move.x, move.z];
    const floor = c.walkingHeight(...escaped, escapeY);
    escapeVy -= 17 / 120;
    escapeY = Math.max(floor, escapeY + escapeVy / 120);
    if (escapeY <= floor) escapeVy = 0;
  }
  assert.ok(
    nativeNotch[0] - escaped[0] > 5.8,
    "ordinary jump recovers historical trapped pose",
  );
  assert.equal(c.blocked(...escaped, 0.36, escapeY), false);
  const route = [
    ...CANADA_PLACE_DECK_ROUTE,
    ...approach.slice(1).map(([x, z]) => canadaPlaceWorld(x, z)),
  ];
  let samples = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= len; s += 0.1) {
      const x = a[0] + ((b[0] - a[0]) * s) / len,
        z = a[1] + ((b[1] - a[1]) * s) / len;
      assert.ok(supportedDeck(x, z, 0.36));
      assert.equal(c.blocked(x, z, 0.36, 7.88), false);
      assert.equal(c.cameraBlocked(x, z, 0.25, 9.4), false);
      assert.ok(Math.abs(c.walkingHeight(x, z, 7.88) - 7.88) < 0.002);
      samples++;
    }
  }
  assert.ok(samples > 1000);
  for (const p of D.placements) {
    const centre = canadaPlaceWorld(p.x, p.z),
      top = D.ground + D.datum + D.height;
    assert.ok(
      Math.abs(c.walkingHeight(...centre, 7.88) - 7.88) < 0.002,
      "ground query never promotes onto bench",
    );
    // Same ordinary Space impulse/gravity and movement order as main.ts.
    const start = northSeatPoint(p, -1.55, 0);
    let body = canadaPlaceWorld(...start),
      y = 7.88,
      vy = 5;
    const destination = centre;
    let landed = false;
    for (let step = 0; step < 100; step++) {
      const dx = destination[0] - body[0],
        dz = destination[1] - body[1],
        distance = Math.hypot(dx, dz),
        travel = Math.min(distance, 3.2 / 120);
      const moved = c.move(
        ...body,
        distance ? (dx / distance) * travel : 0,
        distance ? (dz / distance) * travel : 0,
        0.36,
        y,
      );
      body = [moved.x, moved.z];
      const floor = c.walkingHeight(...body, y);
      vy -= 17 / 120;
      y = Math.max(floor, y + vy / 120);
      if (y <= floor) vy = 0;
      if (
        Math.hypot(body[0] - centre[0], body[1] - centre[1]) < 0.05 &&
        Math.abs(y - top) < 1e-6 &&
        vy === 0
      ) {
        landed = true;
        break;
      }
    }
    assert.ok(
      landed,
      "actual5m/s impulse /17m/s² gravity lands on visible seat",
    );
    const elevated = 7.88 + 0.65;
    assert.equal(
      c.blocked(...centre, 0.36, elevated),
      false,
      "ordinary jump clears seat",
    );
    assert.equal(c.walkingHeight(...centre, elevated), top);
    assert.equal(c.blocked(...centre, 0.36, top), false);
    const visual = ray(model().root, [p.x, 9, p.z], [0, -1, 0])!;
    assert.ok(Math.abs(visual.point.y + D.datum - top) < 1e-5);
    const off = canadaPlaceWorld(p.x + 2, p.z);
    assert.ok(
      Math.abs(c.walkingHeight(...off, top) - 7.88) < 0.002,
      "stepping off returns to original deck",
    );
    c.setCanadaPlaceCapabilities(
      canadaPlaceCapabilities(true, true, true, false),
    );
    assert.ok(
      Math.abs(c.walkingHeight(...centre, elevated) - 7.88) < 0.002,
      "absent furniture has no phantom top",
    );
    c.setCanadaPlaceCapabilities(
      canadaPlaceCapabilities(true, true, true, true),
    );
  }
});
