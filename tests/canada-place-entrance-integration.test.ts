import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  addCanadaPlaceCanopy,
  canadaPlaceCanopyCompatible,
  replaceCanadaPlaceCanopyFaces,
  canadaPlaceCanopyPoint as at,
} from "../src/world/canada-place-canopy";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import {
  CANADA_PLACE_ORIGIN,
  solidAt,
  supportedDeck,
} from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_ENTRANCE as entry,
  canadaPlaceEntrancePoint,
} from "../src/world/canada-place-entrance-data";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
const caps = canadaPlaceCapabilities(true, true, true, true);
function collision() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540,
    convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const c = new CollisionWorld(data);
  c.setCanadaPlaceCapabilities(caps);
  return c;
}
function world(u: number, out: number) {
  const p = canadaPlaceEntrancePoint(u, out);
  return [
    p[0] + CANADA_PLACE_ORIGIN[0],
    p[1] + CANADA_PLACE_ORIGIN[1],
  ] as const;
}
async function scene() {
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb"),
    gltf = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "",
      );
  assert.equal(canadaPlaceCanopyCompatible(gltf.scene), true);
  const root = new T.Group(),
    mats = new Map<string, T.MeshStandardMaterial>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const material = o.material as T.MeshStandardMaterial,
      name = material.name,
      g = bakeGeometry(o.geometry, o.matrixWorld),
      paving = extractCanadaPlacePaving(g, name);
    if (paving) root.add(new T.Mesh(paving, material));
    assert.equal(
      replaceCanadaPlaceCanopyFaces(g, name),
      ({ concrete: 2, glass: 24, trim: 156 } as Record<string, number>)[name] ??
        0,
    );
    mats.set(name, material);
    const mesh = new T.Mesh(g, material);
    mesh.name = `retained-${name}`;
    root.add(mesh);
  });
  addCanadaPlaceCanopy(root, mats);
  root.updateMatrixWorld(true);
  return root;
}
function ray(root: T.Object3D, a: T.Vector3, b: T.Vector3) {
  return new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b) + 0.01,
  ).intersectObject(root, true)[0];
}

test("visible lower recess and overhead roof have different finite collision boundaries", () => {
  const c = collision();
  for (const u of [
    entry.start + 0.1,
    entry.start + 1,
    (entry.start + entry.end) / 2,
    entry.end - 1,
  ]) {
    const front = world(u, 2.61),
      recess = world(u, 2.75),
      under = world(u, 3.75);
    assert.equal(
      solidAt(...front, 0, 7.88, caps),
      true,
      "closed glass/trim contact",
    );
    assert.equal(
      solidAt(...recess, 0, 7.88, caps),
      false,
      "visible floor no longer phantom blocked",
    );
    assert.equal(supportedDeck(...recess, 0, caps), true);
    assert.equal(
      c.blocked(...under, 0.4, 7.88),
      false,
      "ground actor beneath roof remains free",
    );
    assert.equal(
      c.cameraBlocked(...under, 0.18, 9.68),
      false,
      "standing head sphere below roof",
    );
    assert.equal(
      c.cameraBlocked(...under, 0.1, 10.5),
      true,
      "camera cannot enter overhead frame/glass",
    );
    assert.equal(
      solidAt(...under, 0, 11, caps),
      false,
      "overhang is not an infinite vertical wall",
    );
  }
});
test("actual source plus replacement exposes lower frontage without an old sill shelf", async () => {
  const root = await scene();
  for (const u of [entry.start + 0.7, entry.start + 2.2, entry.end - 0.7]) {
    const floor = ray(root, at(u, 9, 2.85), at(u, 7.6, 2.85));
    assert.ok(floor);
    assert.ok(
      Math.abs(floor.point.y - 7.8) < 1e-5,
      `old8.65 floor remains at${floor.point.y}`,
    );
    const front = ray(root, at(u, 9.3, 3.5), at(u, 9.3, 2.25));
    assert.ok(front);
    const local = front.point.clone().sub(at(u, 9.3, 0)),
      normal = at(0, 0, 1).sub(at(0, 0, 0));
    assert.ok(
      local.dot(normal) < 2.67,
      `old exterior pane/plinth hides recess: ${front.object.name}`,
    );
    const roof = ray(root, at(u, 9.8, 3.7), at(u, 10.8, 3.7));
    assert.ok(roof);
    assert.ok(
      roof.point.y - 7.8 > 2.5,
      "roof underside has standing clearance",
    );
    assert.ok(
      roof.point.y < 10.6,
      "actual overhead surface exists at intended lower canopy",
    );
  }
});
