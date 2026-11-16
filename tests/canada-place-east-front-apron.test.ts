import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, pointInPoly, type CityData } from "../src/world/data";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import {
  CANADA_PLACE_EAST_FRONT_APRON as apron,
  CANADA_PLACE_ORIGIN as origin,
  CANADA_PLACE_DECK_Y as deckY,
  supportedDeck,
  solidAt,
  canadaPlaceWorld,
  CANADA_PLACE_EAST_FRONT_RAIL as rail,
  canadaPlaceEastFrontRailAt,
} from "../src/world/canada-place-deck";
import source from "../src/world/canada-place-deck-data.json";
import { panPacificHowePodiumCompatible } from "../src/world/pan-pacific-howe-podium-source";

async function floorScene() {
  await MeshoptDecoder.ready;
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb");
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  assert.ok(panPacificHowePodiumCompatible(gltf.scene));
  const root = new T.Group();
  root.position.set(origin[0], 0.08, origin[1]);
  gltf.scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    root.add(
      new T.Mesh(
        bakeGeometry(o.geometry, o.matrixWorld),
        new T.MeshBasicMaterial({ side: T.DoubleSide, name: o.material.name }),
      ),
    );
  });
  root.updateMatrixWorld(true);
  return root;
}
function city() {
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
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return data;
}
const caps = canadaPlaceCapabilities(true, true, true, true, true);

test("new apron eligibility and actor perimeter sit on actual original PIER floor", async (t) => {
  const root = await floorScene();
  let rays = 0,
    centers = 0;
  const floor = (x: number, z: number) => {
    const hit = new T.Raycaster(
      new T.Vector3(x, 8.15, z),
      new T.Vector3(0, -1, 0),
      0,
      1,
    ).intersectObject(root, true)[0];
    assert.ok(hit, `missing source floor ${x},${z}`);
    assert.ok(
      Math.abs(hit.point.y - 7.8789358902) < 0.00001,
      `wrong physical floor ${x},${z}`,
    );
    assert.ok(hit.face!.normal.y > 0.99);
    rays++;
  };
  const verify = (x: number, z: number) => {
    if (!pointInPoly(x, z, apron) || !supportedDeck(x, z, 0.36, caps)) return;
    floor(x, z);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4)
      floor(x + Math.cos(angle) * 0.36, z + Math.sin(angle) * 0.36);
    centers++;
  };
  assert.equal(supportedDeck(517.33, -491.45, 0.36, caps), true);
  verify(517.33, -491.45);
  for (let x = origin[0] - 154; x < origin[0] - 107; x += 2)
    for (let z = origin[1] + 94; z < origin[1] + 133; z += 2) verify(x, z);
  // Trace both sides of every apron boundary; only accepted centers need floor.
  for (let i = 0; i < apron.length; i += 2) {
    const j = (i + 2) % apron.length,
      dx = apron[j] - apron[i],
      dz = apron[j + 1] - apron[i + 1];
    const length = Math.hypot(dx, dz),
      n = Math.ceil(length);
    for (let k = 0; k <= n; k++)
      for (const offset of [-0.4, 0.4, -0.8, 0.8])
        verify(
          apron[i] + (dx * k) / n - (dz / length) * offset,
          apron[i + 1] + (dz * k) / n + (dx / length) * offset,
        );
  }
  assert.ok(centers > 100);
  t.diagnostic(`${centers} accepted centers / ${rays} actual PIER floor rays`);
});

test("native bug point stands on deck; a nearby .36m actor arrival crosses a real legal step", () => {
  const collision = new CollisionWorld(city());
  collision.setCanadaPlaceCapabilities(caps);
  assert.equal(collision.walkingHeight(517.33, -491.45), deckY);
  assert.equal(collision.blocked(517.33, -491.45, 0.36, deckY), false);
  assert.ok(
    Math.abs(collision.walkingHeight(513.86, -483.35) - 7.5749925) < 1e-8,
  );
  const route = [
    [513.86, -483.35],
    [516, -490],
    [516, -492],
    [517.33, -491.45],
  ];
  let previous = route[0],
    previousY = collision.walkingHeight(...(previous as [number, number])),
    maxStep = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1);
    for (let j = 1; j <= n; j++) {
      const p = [
        a[0] + ((b[0] - a[0]) * j) / n,
        a[1] + ((b[1] - a[1]) * j) / n,
      ];
      const moved = collision.move(
        previous[0],
        previous[1],
        p[0] - previous[0],
        p[1] - previous[1],
        0.36,
        previousY,
      );
      assert.equal(moved.hit, false, `arrival blocked at ${p}`);
      assert.ok(Math.hypot(moved.x - p[0], moved.z - p[1]) < 1e-8);
      const y = collision.walkingHeight(p[0], p[1], previousY);
      maxStep = Math.max(maxStep, y - previousY);
      previous = p;
      previousY = y;
    }
  }
  assert.ok(maxStep <= 0.45, `actual source lip ${maxStep}`);
  assert.equal(previousY, deckY);
  collision.setCanadaPlaceCapabilities(canadaPlaceCapabilities());
  assert.ok(
    Math.abs(collision.walkingHeight(517.33, -491.45) - 7.36905) < 1e-8,
    "failed source load never creates invisible deck support",
  );
});

test("support stays bounded outside HOTEL and never crosses the source rail or pier edge", async () => {
  for (const local of [
    [-130, 103],
    [-125, 101],
    [-120, 99],
    [-90, 83],
  ]) {
    const p = canadaPlaceWorld(...(local as [number, number]));
    assert.equal(solidAt(...p, 0.36, deckY, caps), true);
    assert.equal(
      supportedDeck(...p, 0.36, caps),
      false,
      "private HOTEL remains closed",
    );
  }
  for (const local of [
    [-130, 138],
    [-125, 135],
    [-100, 95],
    [0, -80],
    [230, -105],
  ])
    assert.equal(
      supportedDeck(
        ...canadaPlaceWorld(...(local as [number, number])),
        0.36,
        caps,
      ),
      false,
    );
  assert.equal(
    supportedDeck(517.33, -491.45, 0.36, canadaPlaceCapabilities()),
    false,
  );
  // PIER edge25→26 is the long, source-railed east edge. The complete actor
  // circle must stay inside it, preserving the rim/rail collision boundary.
  const a = source.pier[25],
    b = source.pier[26],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  const midpoint = canadaPlaceWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const collision = new CollisionWorld(city());
  collision.setCanadaPlaceCapabilities(caps);
  for (const signedOffset of [-0.2, 0, 0.2]) {
    const x = midpoint[0] - (dz / len) * signedOffset,
      z = midpoint[1] + (dx / len) * signedOffset;
    assert.equal(
      supportedDeck(x, z, 0.36, caps),
      false,
      "no source-edge overhang",
    );
    assert.equal(
      collision.blocked(x, z, 0.36, deckY),
      true,
      "rail edge remains blocked",
    );
  }
});

test("bounded rail collision matches actual steel and leaves the short front entry open", async () => {
  const root = await floorScene();
  const dx = rail.b[0] - rail.a[0],
    dz = rail.b[1] - rail.a[1],
    length = Math.hypot(dx, dz);
  const nx = dz / length,
    nz = -dx / length;
  for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const x = rail.a[0] + dx * u,
      z = rail.a[1] + dz * u;
    const hit = new T.Raycaster(
      new T.Vector3(x + nx * 0.5, 8.88, z + nz * 0.5),
      new T.Vector3(-nx, 0, -nz),
      0,
      1,
    ).intersectObject(root, true)[0];
    assert.ok(hit, `actual steel top rail missing at ${u}`);
    assert.equal(
      (hit.object as T.Mesh<T.BufferGeometry, T.Material>).material.name,
      "steel",
    );
    assert.equal(canadaPlaceEastFrontRailAt(x, z, 0.36, deckY), true);
    assert.equal(
      canadaPlaceEastFrontRailAt(x, z, 0.25, rail.top + 0.26, true),
      false,
      "camera fully above actual rail remains free",
    );
    assert.equal(canadaPlaceEastFrontRailAt(x, z, 0.25, rail.top, true), true);
    assert.equal(
      canadaPlaceEastFrontRailAt(x, z, 0.36, 5),
      false,
      "not an infinite wall",
    );
  }
  let steelVertices = 0,
    maximumOutward = 0,
    minimumY = Infinity,
    maximumY = -Infinity;
  for (const object of root.children) {
    const mesh = object as T.Mesh<T.BufferGeometry, T.Material>;
    if (mesh.material.name !== "steel") continue;
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3()
        .fromBufferAttribute(p, i)
        .applyMatrix4(mesh.matrixWorld);
      const along = ((v.x - rail.a[0]) * dx + (v.z - rail.a[1]) * dz) / length;
      const outward = (v.x - rail.a[0]) * nx + (v.z - rail.a[1]) * nz;
      if (
        along < -0.1 ||
        along > length + 0.1 ||
        Math.abs(outward) > 0.12 ||
        v.y < 7 ||
        v.y > 10
      )
        continue;
      minimumY = Math.min(minimumY, v.y);
      maximumY = Math.max(maximumY, v.y);
      maximumOutward = Math.max(maximumOutward, Math.abs(outward));
      steelVertices++;
    }
  }
  assert.ok(steelVertices > 20);
  assert.ok(
    minimumY >= rail.bottom && maximumY <= rail.top,
    `decoded rail height: ${minimumY}..${maximumY}`,
  );
  assert.ok(Math.abs(maximumOutward - 0.07922757691816752) < 1e-7);
  assert.ok(
    maximumOutward <= rail.halfWidth,
    `decoded steel: half-width=${maximumOutward}, y=${minimumY}..${maximumY}`,
  );
  // Midpoint of the actual short unrailed edge26→27 is the front entry.
  const entry = canadaPlaceWorld(
    (source.pier[26][0] + source.pier[27][0]) / 2,
    (source.pier[26][1] + source.pier[27][1]) / 2,
  );
  assert.equal(canadaPlaceEastFrontRailAt(...entry, 0.36, deckY), false);
  assert.equal(canadaPlaceEastFrontRailAt(517.33, -491.45, 0.36, deckY), false);
});
