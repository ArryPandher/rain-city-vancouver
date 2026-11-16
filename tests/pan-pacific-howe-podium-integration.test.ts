import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import { createPanPacificHowePodium } from "../src/world/pan-pacific-howe-podium-install";
import { panPacificHowePodiumPoint as at } from "../src/world/pan-pacific-howe-podium";
import {
  panPacificHowePodiumCompatible,
  replacePanPacificHowePodiumFaces,
} from "../src/world/pan-pacific-howe-podium-source";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import { replaceCanadaPlaceHotelFaces } from "../src/world/canada-place-hotel-source";
import { replaceCanadaPlaceCanopyFaces } from "../src/world/canada-place-canopy";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
import {
  CANADA_PLACE_ORIGIN,
  supportedDeck,
} from "../src/world/canada-place-deck";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";

async function fixture() {
  await MeshoptDecoder.ready;
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb");
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  assert.equal(panPacificHowePodiumCompatible(gltf.scene), true);
  const root = new T.Group();
  gltf.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const name = (object.material as T.Material).name;
    const geometry = bakeGeometry(object.geometry, object.matrixWorld);
    const paving = extractCanadaPlacePaving(geometry, name);
    if (paving)
      root.add(
        Object.assign(new T.Mesh(paving, object.material), {
          name: "retained-paving",
        }),
      );
    replacePanPacificHowePodiumFaces(geometry, name);
    replaceCanadaPlaceHotelFaces(geometry, name);
    replaceCanadaPlaceCanopyFaces(geometry, name);
    replaceCanadaPlaceWestFaces(geometry, name);
    root.add(
      Object.assign(new T.Mesh(geometry, object.material), {
        name: `retained-${name}`,
      }),
    );
  });
  const podium = createPanPacificHowePodium({ texture: () => new T.Texture() });
  root.add(podium.group);
  root.updateMatrixWorld(true);
  return { root, podium };
}
const ready = fixture();
test("validated podium admits the camera only through its actual lower void", () => {
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
  const collision = new CollisionWorld(data);
  const caps = canadaPlaceCapabilities(true, true, true, true, true);
  for (const u of [0.55, 0.65, 0.75]) {
    const p = at(u, 9.5, -0.5);
    p.x += CANADA_PLACE_ORIGIN[0];
    p.z += CANADA_PLACE_ORIGIN[1];
    p.y += 0.08;
    collision.setCanadaPlaceCapabilities(
      canadaPlaceCapabilities(true, true, true, true, false),
    );
    assert.equal(
      collision.cameraBlocked(p.x, p.z, 0.12, p.y),
      true,
      "old hotel envelope remains without validated replacement",
    );
    collision.setCanadaPlaceCapabilities(caps);
    assert.equal(
      collision.cameraBlocked(p.x, p.z, 0.12, p.y),
      false,
      "clear camera sphere must reach the visible recess",
    );
    assert.equal(
      collision.blocked(p.x, p.z, 0.4, 7.88),
      true,
      "camera clearance must not open a walking route",
    );
    assert.equal(supportedDeck(p.x, p.z, 0.4, caps), false);
    const slab = at(u, 10.72, -1.8);
    assert.equal(
      collision.cameraBlocked(
        slab.x + CANADA_PLACE_ORIGIN[0],
        slab.z + CANADA_PLACE_ORIGIN[1],
        0.12,
        slab.y + 0.08,
      ),
      true,
      "gallery slab stays solid",
    );
  }
});
test("integrated original source exposes the replacement glazing and closed recess", async () => {
  const { root } = await ready;
  const cases = [
    [0.31, 9.7, "lower"],
    [0.148, 16.1, "middle"],
    [0.51, 19.1, "middle"],
    [0.61, 21.1, "upper"],
    [0.7, 23.1, "upper"],
  ] as const;
  for (const [u, y, tier] of cases) {
    const from = at(u, y, 4, tier),
      target = at(u, y, -4, tier);
    const ray = new T.Raycaster(from, target.sub(from).normalize(), 0, 9);
    const hits = ray.intersectObject(root, true);
    assert.equal(
      hits[0]?.object.name,
      "pan-pacific-howe-podium-glass",
      `${u}/${y}/${tier}: retained source hides new glass`,
    );
    const backing = hits.find(
      (h) => h.object.name === "pan-pacific-howe-podium-backing",
    );
    assert.ok(
      backing && backing.distance - hits[0].distance > 0.39,
      "real closed cavity behind glass",
    );
  }
});
test("retained source floor and bounded optical groups survive installation", async () => {
  const { root, podium } = await ready;
  const glass = podium.group.children.find(
    (o) => o.name === "pan-pacific-howe-podium-glass",
  ) as T.Mesh;
  assert.equal(podium.group.children.length, 5);
  assert.ok(Array.isArray(glass.material));
  assert.equal(glass.geometry.groups.length, 2);
  assert.equal(glass.castShadow, false);
  for (const u of [0.11, 0.31, 0.43, 0.61, 0.78, 0.92]) {
    const from = at(u, 10.3, -0.82);
    const hit = new T.Raycaster(
      from,
      new T.Vector3(0, -1, 0),
      0,
      4,
    ).intersectObject(root, true)[0];
    assert.ok(hit, "source floor missing");
    assert.ok(
      Math.abs(hit.point.y - 7.7989358902) < 0.002,
      `floor changed at ${u}: ${hit.point.y}`,
    );
    assert.ok(hit.object.name.startsWith("retained-"));
  }
  assert.equal(
    new T.Raycaster(
      podium.capture,
      new T.Vector3(0, 1, 0),
      0,
      0.2,
    ).intersectObject(root, true).length,
    0,
    "capture inside overhead geometry",
  );
});
