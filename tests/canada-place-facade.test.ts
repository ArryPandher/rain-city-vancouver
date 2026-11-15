import { pointInPoly, segmentPoint } from "../src/world/data";
import { CANADA_PLACE_PIER } from "../src/world/canada-place-deck";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_ORIGIN,
} from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_FACADE_SOURCE,
  CANADA_PLACE_WEST_FACES,
  CANADA_PLACE_CONCOURSE_PROFILE,
  CANADA_PLACE_CONCOURSE_STATIONS,
  CANADA_PLACE_CONCOURSE_FOOTPRINTS,
  CANADA_PLACE_CONCOURSE_GROUND_FOOTPRINTS,
  canadaPlaceConcoursePoint,
  canadaPlaceFacadeCompatible,
  replaceCanadaPlaceWestFaces,
  addCanadaPlaceWestFacade,
} from "../src/world/canada-place-facade";
async function scene() {
  await MeshoptDecoder.ready;
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(CANADA_PLACE_FACADE_SOURCE.file))
      .digest("hex"),
    CANADA_PLACE_FACADE_SOURCE.sha256,
  );
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(CANADA_PLACE_FACADE_SOURCE.file);
  const root = new T.Group(),
    original = new T.Group(),
    materials = new Map<string, T.MeshStandardMaterial>(),
    removed: Record<string, number> = {};
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        pos = new Float32Array(a.getCount() * 3);
      for (let i = 0; i < a.getCount(); i++)
        pos.set(a.getElement(i, []), i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setIndex(Array.from(pr.getIndices()!.getArray()!));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      const name = pr.getMaterial()!.getName(),
        mat = new T.MeshStandardMaterial({ name });
      materials.set(name, mat);
      original.add(new T.Mesh(g.clone(), mat));
      const vertices = Array.from(g.getAttribute("position").array),
        indices = Array.from(g.getIndex()!.array);
      const paving = extractCanadaPlacePaving(g, name);
      if (name === "concrete")
        assert.ok(paving, "paving extraction succeeds before facade removal");
      if (paving) {
        const mesh = new T.Mesh(paving, mat);
        mesh.name = "paving";
        root.add(mesh);
      }
      removed[name] = replaceCanadaPlaceWestFaces(g, name);
      assert.deepEqual(
        Array.from(g.getAttribute("position").array),
        vertices,
        "never move original deck/hotel/sail vertices",
      );
      if (!["concrete", "glass", "trim"].includes(name))
        assert.deepEqual(
          Array.from(g.getIndex()!.array),
          indices,
          `retain every ${name} triangle`,
        );
      // Kept triangle indices must remain an ordered subsequence, no re-winding,
      // generated replacement indices, or changes to unrelated source primitives.
      let cursor = 0;
      const next = Array.from(g.getIndex()!.array);
      for (let i = 0; i < next.length; i += 3) {
        while (
          cursor < indices.length &&
          !next.slice(i, i + 3).every((v, j) => v === indices[cursor + j])
        )
          cursor += 3;
        assert.ok(cursor < indices.length);
        cursor += 3;
      }
      root.add(new T.Mesh(g, mat));
    }
  assert.equal(canadaPlaceFacadeCompatible(original), true);
  const snapshots = [...materials].map(([name, m]) => [
    name,
    m.color.getHex(),
    m.roughness,
    m.metalness,
    m.transparent,
    m.opacity,
  ]);
  const additions = addCanadaPlaceWestFacade(root, materials);
  assert.deepEqual(
    [...materials].map(([name, m]) => [
      name,
      m.color.getHex(),
      m.roughness,
      m.metalness,
      m.transparent,
      m.opacity,
    ]),
    snapshots,
    "facade never mutates shared Canada materials",
  );
  root.updateMatrixWorld(true);
  original.updateMatrixWorld(true);
  return { root, original, removed, additions };
}
const fixture = scene();
function ray(root: T.Object3D, from: T.Vector3, to: T.Vector3) {
  return new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to) + 0.015,
  ).intersectObject(root, true)[0];
}
test("source-pinned replacement is limited to reviewed west podium surfaces and eight shared material batches", async (t) => {
  const { removed, additions, original } = await fixture;
  assert.equal(removed.concrete, 10);
  assert.equal(removed.glass, 100);
  assert.equal(removed.trim, 480);
  assert.equal(additions.length, 8);
  t.diagnostic(
    `${additions.reduce((s, m) => s + m.geometry.getIndex()!.count / 3, 0)} facade triangles`,
  );
  assert.ok(
    additions.reduce((s, m) => s + m.geometry.getIndex()!.count / 3, 0) < 64000,
  );
  for (const m of additions) {
    assert.equal(
      (m.material as T.Material).side,
      m.name === "canada-west-glazing-backing" ? T.DoubleSide : T.FrontSide,
    );
    assert.equal(
      (m.material as T.Material).transparent,
      m.name === "canada-west-glass",
    );
    for (const v of m.geometry.getAttribute("position").array)
      assert.ok(Number.isFinite(v));
  }
  const mesh = original.children.find(
    (o) =>
      (o as T.Mesh).material instanceof T.Material &&
      (o as T.Mesh<T.BufferGeometry, T.Material>).material.name === "glass",
  ) as T.Mesh;
  const originalIndex = mesh.geometry.getIndex();
  mesh.geometry.setIndex([0, 1, 2]);
  assert.equal(canadaPlaceFacadeCompatible(original), false);
  mesh.geometry.setIndex(originalIndex);
});
test("three curved glass tiers follow the section with real changes in surface normal", async () => {
  const { root } = await fixture,
    stations = CANADA_PLACE_CONCOURSE_STATIONS;
  const i = Math.floor(stations.length / 2),
    s = (stations[i].s + stations[i + 1].s) / 2;
  const profile = CANADA_PLACE_CONCOURSE_PROFILE;
  for (const k of [3, 7, 11, 15, 19, 23]) {
    const a = profile[k - 1],
      b = profile[k],
      p = canadaPlaceConcoursePoint(s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const normal = new T.Vector3(
      stations[i].nx * (b[1] - a[1]),
      a[0] - b[0],
      stations[i].nz * (b[1] - a[1]),
    ).normalize();
    const from = p.clone().addScaledVector(normal, 3),
      hit = ray(root, from, p);
    assert.ok(hit, `missing curve ${k}`);
    assert.equal(hit.object.name, "canada-west-glass");
    assert.ok(hit.point.distanceTo(p) < 0.015);
    assert.ok(hit.face!.normal.y > 0.1 && hit.face!.normal.y < 0.99);
  }
});
test("coherent closed envelope fits source pier and preserves the complete public route", async () => {
  const { additions } = await fixture,
    footprint = CANADA_PLACE_CONCOURSE_FOOTPRINTS[0];
  for (let i = 0; i < footprint.length; i += 2)
    assert.ok(
      pointInPoly(footprint[i], footprint[i + 1], CANADA_PLACE_PIER),
      "envelope must have source deck support",
    );
  for (let i = 1; i < CANADA_PLACE_DECK_ROUTE.length; i++) {
    const a = CANADA_PLACE_DECK_ROUTE[i - 1],
      b = CANADA_PLACE_DECK_ROUTE[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25);
    for (let j = 0; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n;
      assert.equal(pointInPoly(x, z, footprint), false);
      let d = Infinity;
      for (let k = 0; k < footprint.length; k += 2)
        d = Math.min(
          d,
          segmentPoint(
            x,
            z,
            footprint[k],
            footprint[k + 1],
            footprint[(k + 2) % footprint.length],
            footprint[(k + 3) % footprint.length],
          ).d,
        );
      assert.ok(d > 0.95, `route clearance ${d}`);
    }
  }
  assert.equal(additions.length, 8);
});

test("simultaneous paving extraction preserves the exact promenade walking plane", async () => {
  const { root, original } = await fixture;
  for (const [x, z] of CANADA_PLACE_DECK_ROUTE) {
    const from = new T.Vector3(
        x - CANADA_PLACE_ORIGIN[0],
        9.3,
        z - CANADA_PLACE_ORIGIN[1],
      ),
      to = from.clone().setY(7.5);
    const before = ray(original, from, to),
      after = ray(root, from, to);
    assert.ok(before && after);
    assert.equal(after.object.name, "paving");
    assert.ok(Math.abs(after.point.y - before.point.y) < 1e-7);
  }
});
test("facade preflight rejects the unrelated gallery asset", async () => {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read("public/models/vancouver/vancouver-art-gallery.glb");
  const root = new T.Group();
  for (const n of doc.getRoot().listNodes())
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(
          new Float32Array(p.getAttribute("POSITION")!.getCount() * 3),
          3,
        ),
      );
      g.setIndex(Array.from(p.getIndices()!.getArray()!));
      root.add(
        new T.Mesh(
          g,
          new T.MeshStandardMaterial({ name: p.getMaterial()!.getName() }),
        ),
      );
    }
  assert.equal(canadaPlaceFacadeCompatible(root), false);
});
test("upper glazing is one continuous central region with reduced closed end profiles", () => {
  const stations = CANADA_PLACE_CONCOURSE_STATIONS;
  assert.equal(stations[0].scale, 0.65);
  assert.ok(Math.abs(stations.at(-1)!.scale - 0.65) < 1e-8);
  assert.ok(stations.some((s) => s.scale === 1));
  for (let i = 1; i < stations.length; i++)
    assert.ok(stations[i].s > stations[i - 1].s);
});

test("mineral sill replaces the bottom glass strip without coplanar overlap", async () => {
  const { additions } = await fixture,
    stations = CANADA_PLACE_CONCOURSE_STATIONS,
    i = Math.floor(stations.length / 2),
    s = (stations[i].s + stations[i + 1].s) / 2;
  const target = canadaPlaceConcoursePoint(s, 12.4, 7.88),
    from = target.clone().add(new T.Vector3(stations[i].nx, 0, stations[i].nz));
  const glass = additions.find((m) => m.name === "canada-west-glass")!,
    wall = additions.find((m) => m.name === "canada-west-wall")!;
  assert.equal(
    ray(glass, from, target),
    undefined,
    "no glass remains behind sill",
  );
  assert.ok(ray(wall, from, target), "mineral sill closes front at deck");
});
test("glass normals join smoothly within each curve and keep tier-reset creases", async () => {
  const { additions } = await fixture,
    mesh = additions.find((m) => m.name === "canada-west-glass")!,
    p = mesh.geometry.getAttribute("position"),
    n = mesh.geometry.getAttribute("normal");
  const stations = CANADA_PLACE_CONCOURSE_STATIONS,
    i = Math.floor(stations.length / 2);
  const normalsAt = (k: number) => {
    const [out, y] = CANADA_PLACE_CONCOURSE_PROFILE[k],
      target = canadaPlaceConcoursePoint(
        stations[i].s,
        out * stations[i].scale,
        y,
      ),
      normals: T.Vector3[] = [];
    for (let j = 0; j < p.count; j++)
      if (new T.Vector3().fromBufferAttribute(p, j).distanceTo(target) < 0.0001)
        normals.push(new T.Vector3().fromBufferAttribute(n, j));
    return normals;
  };
  const smooth = normalsAt(5);
  assert.ok(smooth.length >= 4);
  for (const normal of smooth) assert.ok(normal.distanceTo(smooth[0]) < 1e-6);
  const crease = normalsAt(9);
  assert.ok(crease.some((n) => n.y > 0.99));
  assert.ok(crease.some((n) => Math.abs(n.y) < 0.01));
});

test("upright upper fascias replace curved ends and close both transition cheeks", async () => {
  const { root } = await fixture;
  const profile = CANADA_PLACE_CONCOURSE_PROFILE;
  const stations = CANADA_PLACE_CONCOURSE_STATIONS;
  for (const st of [stations[5], stations[stations.length - 6]]) {
    const out = profile[17][0] * st.scale;
    for (const y of [15.8, 17.2]) {
      const target = canadaPlaceConcoursePoint(st.s + 0.02, out, y);
      const from = target.clone().add(new T.Vector3(st.nx, 0, st.nz));
      const hit = ray(root, from, target);
      assert.ok(hit, "upright fascia is closed from promenade");
      assert.equal(hit.object.name, "canada-west-wall");
      assert.ok(
        Math.abs(hit.distance - 1) < 0.02,
        "both heights occupy an upright plane",
      );
      assert.ok(
        Math.abs(hit.face!.normal.y) < 0.01,
        "fascia is physically vertical, not recoloured curved glass",
      );
    }
  }
  for (const [boundary, direction] of [
    [22, 1],
    [stations.at(-1)!.s - 22, -1],
  ]) {
    const from = canadaPlaceConcoursePoint(
      boundary + direction * 0.5,
      9.6,
      17.1,
    );
    const to = canadaPlaceConcoursePoint(boundary - direction * 0.1, 9.6, 17.1);
    const hit = ray(root, from, to);
    assert.ok(
      hit,
      "transition return closes gap between curve and upright fascia",
    );
    assert.equal(hit.object.name, "canada-west-wall");
    assert.ok(hit.distance > 0.4 && hit.distance < 0.6);
  }
});

test("recessed ground doors and closed soffit leave real space below unchanged canopy", async () => {
  const { additions } = await fixture;
  const root = new T.Group();
  for (const mesh of additions) root.add(mesh.clone());
  root.updateMatrixWorld(true);
  const stations = CANADA_PLACE_CONCOURSE_STATIONS;
  for (const index of [
    5,
    Math.floor(stations.length / 2),
    stations.length - 6,
  ]) {
    const a = stations[index],
      b = stations[index + 1];
    const s = (a.s + b.s) / 2,
      scale = (a.scale + b.scale) / 2;
    const face = canadaPlaceConcoursePoint(s, 12.4 * scale, 9.4);
    const from = canadaPlaceConcoursePoint(s, 15 * scale, 9.4);
    const hit = ray(
      root,
      from,
      canadaPlaceConcoursePoint(s, 12.4 * scale - 0.15, 9.4),
    );
    assert.ok(hit, "door front remains closed");
    assert.ok(
      [
        "canada-west-door-glass",
        "canada-west-door-frame",
        "canada-west-door-gasket",
      ].includes(hit.object.name),
    );
    assert.ok(
      hit.point.distanceTo(face) < 0.15,
      "door plane recessed from outer curve",
    );
    const under = canadaPlaceConcoursePoint(s, 13.4 * scale, 10.2);
    const soffit = ray(root, under, under.clone().setY(10.8));
    assert.ok(soffit, "overhang has a downward-facing closed underside");
    assert.equal(soffit.object.name, "canada-west-wall");
    assert.ok(Math.abs(soffit.point.y - 10.75) < 0.0001);
    assert.ok(soffit.face!.normal.y < -0.99);
    const world = [
      under.x + CANADA_PLACE_ORIGIN[0],
      under.z + CANADA_PLACE_ORIGIN[1],
    ] as [number, number];
    assert.equal(
      pointInPoly(...world, CANADA_PLACE_CONCOURSE_GROUND_FOOTPRINTS[0]),
      false,
    );
    assert.equal(
      pointInPoly(...world, CANADA_PLACE_CONCOURSE_FOOTPRINTS[0]),
      true,
    );
  }
  for (const [index, sign] of [
    [0, -1],
    [stations.length - 1, 1],
  ]) {
    const st = stations[index];
    const toward = new T.Vector3(-st.nz * sign, 0, st.nx * sign);
    const target = canadaPlaceConcoursePoint(st.s, 11.6 * st.scale, 9.4);
    const hit = ray(root, target.clone().add(toward), target);
    assert.ok(hit, "recessed glass end remains closed");
    const open = canadaPlaceConcoursePoint(st.s, 13.4 * st.scale, 9.4);
    assert.equal(
      ray(root, open.clone().add(toward), open),
      undefined,
      "end does not close public recess with phantom glass",
    );
  }
});
test("transparent upper panes first reveal closed shallow backing from normal and oblique views", async () => {
  const { root, additions } = await fixture;
  const glass = additions.find((m) => m.name === "canada-west-glass")!,
    backing = additions.find((m) => m.name === "canada-west-glazing-backing")!;
  assert.equal((glass.material as T.Material).transparent, true);
  assert.equal((glass.material as T.Material).depthWrite, false);
  assert.equal(glass.castShadow, false);
  const opaque = additions.filter((m) => m !== glass);
  assert.ok(opaque.every((m) => !(m.material as T.Material).transparent));
  // Actual decoded GLB root remains present: if an original source wall wrongly
  // survived, this first-hit test would identify it before the new structure.
  const station =
      CANADA_PLACE_CONCOURSE_STATIONS[
        Math.floor(CANADA_PLACE_CONCOURSE_STATIONS.length / 2)
      ],
    profile = CANADA_PLACE_CONCOURSE_PROFILE;
  for (const k of [3, 6, 11, 14, 19, 22]) {
    const a = profile[k - 1],
      b = profile[k],
      p = canadaPlaceConcoursePoint(
        station.s + 0.35,
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    const normal = new T.Vector3(
      station.nx * (b[1] - a[1]),
      a[0] - b[0],
      station.nz * (b[1] - a[1]),
    ).normalize();
    const tangent = new T.Vector3(-station.nz, 0, station.nx);
    for (const angle of [-0.55, 0, 0.55]) {
      const direction = normal
          .clone()
          .negate()
          .addScaledVector(tangent, angle)
          .normalize(),
        from = p.clone().addScaledVector(normal, -0.015);
      const hits = new T.Raycaster(from, direction, 0, 1)
        .intersectObject(root, true)
        .filter((h) => h.object !== glass);
      assert.ok(hits.length, `missing closed back tier${k}`);
      assert.equal(hits[0].object, backing);
      assert.ok(hits[0].distance > 0.1 && hits[0].distance < 0.75);
    }
  }
});
