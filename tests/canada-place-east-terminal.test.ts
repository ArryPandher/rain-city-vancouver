import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { solidAt, canadaPlaceWorld } from "../src/world/canada-place-deck";
import { bakeGeometry } from "../src/world/geometry";
import {
  canadaPlaceEastTerminalCompatible,
  replaceCanadaPlaceEastTerminalSource,
} from "../src/world/canada-place-east-terminal-source";
import {
  createCanadaPlaceEastTerminal,
  createCanadaPlaceEastTerminalGeometry,
  canadaPlaceEastTerminalPoint as point,
  CANADA_PLACE_EAST_TERMINAL as D,
  CANADA_PLACE_EAST_TERMINAL_LENGTH as L,
} from "../src/world/canada-place-east-terminal";
import { replacePanPacificNearPodiumSource } from "../src/world/pan-pacific-near-podium-source";
import { replacePanPacificTowerSource } from "../src/world/pan-pacific-tower-source";
import { replacePanPacificHowePodiumFaces } from "../src/world/pan-pacific-howe-podium-source";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { replaceCanadaPlaceHotelFaces } from "../src/world/canada-place-hotel-source";
import { replaceCanadaPlaceCanopyFaces } from "../src/world/canada-place-canopy";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
async function load() {
  await MeshoptDecoder.ready;
  const b = fs.readFileSync("public/models/vancouver/canada-place.glb");
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "");
  scene.updateMatrixWorld(true);
  const entries: { material: string; geometry: T.BufferGeometry }[] = [];
  scene.traverse((o) => {
    if (o instanceof T.Mesh && !Array.isArray(o.material))
      entries.push({
        material: o.material.name,
        geometry: bakeGeometry(o.geometry, o.matrixWorld),
      });
  });
  return { scene, entries };
}
const loaded = load();
const clone = async () =>
  (await loaded).entries.map((e) => ({ ...e, geometry: e.geometry.clone() }));
function otherCuts(es: Awaited<ReturnType<typeof clone>>) {
  for (const e of es) {
    for (const f of [
      replacePanPacificHowePodiumFaces,
      replaceCanadaPlaceHotelFaces,
      replaceCanadaPlaceCanopyFaces,
      replaceCanadaPlaceWestFaces,
    ])
      f(e.geometry, e.material);
  }
  assert.equal(replacePanPacificTowerSource(es), 3140);
  assert.equal(replacePanPacificNearPodiumSource(es), 70);
}
function render(es: Awaited<ReturnType<typeof clone>>) {
  const root = new T.Group();
  for (const e of es) {
    const m = new T.Mesh(
      e.geometry,
      new T.MeshBasicMaterial({ name: e.material }),
    );
    root.add(m);
  }
  root.updateMatrixWorld(true);
  return root;
}
function ray(
  root: T.Object3D,
  s: number,
  y: number,
  out: number,
  ds: number,
  dy: number,
  dout: number,
  far = 20,
) {
  const p = point(s, y, out),
    q = point(s + ds, y + dy, out + dout);
  return new T.Raycaster(p, q.sub(p).normalize(), 0, far).intersectObject(
    root,
    true,
  )[0];
}

test("original source preflight and exact22 triangle removal preserve all caps,PIER,rigging and unrelated attribute data", async () => {
  const { scene } = await loaded;
  assert.equal(canadaPlaceEastTerminalCompatible(scene), true);
  const es = await clone(),
    before = es.map((e) => ({
      attributes: Object.entries(e.geometry.attributes).map(([name, a]) => ({
        name,
        attribute: a,
        array: a.array.slice(),
      })),
      ids: Array.from(e.geometry.index!.array),
    }));
  assert.equal(replaceCanadaPlaceEastTerminalSource(es), 22);
  es.forEach((e, i) => {
    for (const a of before[i].attributes) {
      assert.equal(e.geometry.getAttribute(a.name), a.attribute);
      assert.deepEqual(a.attribute.array, a.array);
    }
    const first =
        e.material === "concrete" ? 368 : e.material === "glass" ? 604 : -1,
      count = e.material === "concrete" ? 2 : e.material === "glass" ? 20 : 0;
    const want = before[i].ids.filter(
      (_, j) =>
        first < 0 ||
        Math.floor(j / 3) < first ||
        Math.floor(j / 3) >= first + count,
    );
    assert.deepEqual(Array.from(e.geometry.index!.array), want);
  });
  assert.equal(replaceCanadaPlaceEastTerminalSource(es), 0);
});
test("after mandatory paving extraction removal commutes with every existing Canada Place cut; invalid required primitive is atomic", async () => {
  const a = await clone(),
    b = await clone();
  for (const e of [...a, ...b])
    extractCanadaPlacePaving(e.geometry, e.material);
  otherCuts(a);
  assert.equal(replaceCanadaPlaceEastTerminalSource(a), 22);
  assert.equal(replaceCanadaPlaceEastTerminalSource(b), 22);
  otherCuts(b);
  a.forEach((e, i) =>
    assert.deepEqual(e.geometry.index!.array, b[i].geometry.index!.array),
  );
  const bad = await clone(),
    glass = bad.find((e) => e.material === "glass")!;
  glass.geometry.attributes.position.setX(0, 99);
  const indices = bad.map((e) => e.geometry.index);
  assert.equal(replaceCanadaPlaceEastTerminalSource(bad), 0);
  bad.forEach((e, i) => assert.equal(e.geometry.index, indices[i]));
});
test("retained source roof and PIER support full inset assembly; new faces do not duplicate source top caps", async () => {
  const es = await clone();
  replaceCanadaPlaceEastTerminalSource(es);
  const source = render(es),
    g = createCanadaPlaceEastTerminalGeometry(),
    added = render(
      Object.entries(g).map(([material, geometry]) => ({ material, geometry })),
    );
  for (let s = 0.6; s < L - 0.6; s += 1)
    for (const out of [-0.85, -0.7, -0.3]) {
      const floor = ray(source, s, D.floor + 0.1, out, 0, -1, 0, 0.2);
      assert.ok(floor);
      assert.ok(Math.abs(floor.point.y - D.floor) < 0.005);
      const roof = ray(source, s, D.top + 0.1, out, 0, -1, 0, 0.2);
      assert.ok(roof);
      assert.ok(Math.abs(roof.point.y - D.top) < 0.005);
      const newTop = ray(added, s, D.top + 0.1, out, 0, -1, 0, 0.2);
      assert.equal(newTop, undefined, "no duplicated upward source cap");
    }
});
test("actual service bays have deep closed backs, piers and contacting floor bands, within a bounded four-batch budget", () => {
  const { group } = createCanadaPlaceEastTerminal({
    texture: () => new T.Texture(),
  });
  group.updateMatrixWorld(true);
  let triangles = 0;
  group.traverse((o) => {
    if (o instanceof T.Mesh) {
      triangles += o.geometry.index!.count / 3;
      for (const n of o.geometry.attributes.position.array)
        assert.ok(Number.isFinite(n));
    }
  });
  assert.equal(group.children.length, 4);
  assert.ok(triangles <= 5000);
  for (let i = 0; i < D.bays; i++) {
    const s = ((i + 0.5) * L) / D.bays;
    const lower = ray(group, s, 10, 2, 0, 0, -1, 4)!;
    assert.equal(
      (lower.object as T.Mesh).material instanceof T.MeshStandardMaterial,
      true,
    );
    assert.ok(Math.abs(lower.distance - 2.6) < 0.015);
    const upper = ray(group, s, 14.05, 2, 0, 0, -1, 4)!;
    assert.ok(upper.distance > 2.6 && upper.distance < 2.81);
    const slab = ray(group, s, D.serviceFloor + 0.1, -0.3, 0, -1, 0, 0.2)!;
    assert.ok(slab);
    assert.ok(Math.abs(slab.point.y - D.serviceFloor) < 1e-5);
    const pier = ray(group, (i * L) / D.bays, 10, 2, 0, 0, -1, 4)!;
    assert.ok(Math.abs(pier.distance - 1.92) < 0.01);
  }
});

test("every new exterior vertex stays inside existing SAILS collision envelope; no new public floor or route boundary", () => {
  const geometry = createCanadaPlaceEastTerminalGeometry();
  for (const g of Object.values(geometry)) {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const [x, z] = canadaPlaceWorld(p.getX(i), p.getZ(i));
      assert.equal(
        solidAt(x, z, 0, Math.max(D.floor + 0.08, p.getY(i) + 0.08)),
        true,
      );
    }
  }
  const added = render(
    Object.entries(geometry).map(([material, geometry]) => ({
      material,
      geometry,
    })),
  );
  for (let s = 2; s < L - 2; s += 2) {
    assert.equal(
      ray(added, s, D.floor + 0.1, 0.65, 0, -1, 0, 0.2),
      undefined,
      "no floor on outer public apron",
    );
    assert.equal(
      ray(added, s, 10, 0.65, 0, 1, 0, 10),
      undefined,
      "no new overhang beyond existing collision margin",
    );
  }
});
