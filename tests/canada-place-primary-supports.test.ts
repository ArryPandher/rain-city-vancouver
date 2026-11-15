import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  CANADA_PLACE_FACADE_SOURCE,
  addCanadaPlaceWestFacade,
  replaceCanadaPlaceWestFaces,
} from "../src/world/canada-place-facade";
import {
  CANADA_PLACE_CENTRAL_PRIMARY_STATIONS,
  addCanadaPlacePrimarySupports,
  CANADA_PLACE_PRIMARY_SUPPORT as cfg,
  canadaPlacePrimarySupportPoint as point,
} from "../src/world/canada-place-primary-supports";
const s = cfg.previewStation;
const outward = point(s, cfg.outward + 1, 0)
  .sub(point(s, cfg.outward, 0))
  .normalize();
const along = new T.Vector3(-outward.z, 0, outward.x);

test("joined support has section widths, finite closed surfaces and exact floor/roof contacts", () => {
  const mesh = addCanadaPlacePrimarySupports(new T.Group());
  mesh.updateMatrixWorld(true);
  const p = mesh.geometry.getAttribute("position"),
    n = mesh.geometry.getAttribute("normal"),
    ix = mesh.geometry.index!;
  assert.equal(ix.count / 3, 208);
  const edges = new Map<string, number>();
  const vertex = (i: number) => new T.Vector3().fromBufferAttribute(p, i);
  const key = (v: T.Vector3) =>
    v
      .toArray()
      .map((x) => x.toFixed(4))
      .join(",");
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
    assert.ok(
      Math.abs(new T.Vector3().fromBufferAttribute(n, i).length() - 1) < 1e-5,
    );
    assert.ok(p.getY(i) >= cfg.floorY - 1e-6 && p.getY(i) <= cfg.roofY + 1e-6);
  }
  for (let i = 0; i < ix.count; i += 3) {
    const v = [0, 1, 2].map((j) => vertex(ix.getX(i + j)));
    assert.ok(
      v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length() > 1e-7,
    );
    for (let j = 0; j < 3; j++) {
      const k = [key(v[j]), key(v[(j + 1) % 3])].sort().join(";");
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  assert.ok(
    [...edges.values()].every((n) => n === 2),
    "no open collar/shoulder joins or internal overlapping caps",
  );
  for (const [y, width] of [
    [8.2, 0.8],
    [12.9, 0.5],
    [14.75, 0.78],
    [16.8, 0.5],
    [17.55, 0.72],
  ])
    for (const d of [outward, along]) {
      const c = point(s, cfg.outward, y);
      const hit = new T.Raycaster(
        c.clone().addScaledVector(d, 1),
        d.clone().negate(),
        0,
        2,
      ).intersectObject(mesh)[0];
      assert.ok(hit);
      assert.ok(Math.abs(hit.distance - (1 - width / 2)) < 0.001);
    }
  assert.equal(mesh.material.emissive.getHex(), 0);
  assert.ok(mesh.castShadow && mesh.receiveShadow);
});

test("actual source GLB leaves primary-support volume clear and existing lining supplies floor and ceiling", async () => {
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
  const original = new T.Group(),
    integrated = new T.Group(),
    materials = new Map<string, T.MeshStandardMaterial>();
  for (const node of doc.getRoot().listNodes())
    for (const pr of node.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        pos = new Float32Array(a.getCount() * 3);
      for (let i = 0; i < a.getCount(); i++)
        pos.set(a.getElement(i, []), i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setIndex(Array.from(pr.getIndices()!.getArray()!));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      const name = pr.getMaterial()!.getName(),
        material = new T.MeshStandardMaterial({ name, side: T.DoubleSide });
      materials.set(name, material);
      original.add(new T.Mesh(g.clone(), material));
      replaceCanadaPlaceWestFaces(g, name);
      integrated.add(new T.Mesh(g, material));
    }
  original.updateMatrixWorld(true);
  addCanadaPlaceWestFacade(integrated, materials);
  integrated.updateMatrixWorld(true);
  for (const s of CANADA_PLACE_CENTRAL_PRIMARY_STATIONS) {
    const outward = point(s, cfg.outward + 1, 0)
      .sub(point(s, cfg.outward, 0))
      .normalize();
    const along = new T.Vector3(-outward.z, 0, outward.x);
    for (let y = 8.1; y < 17.5; y += 0.2)
      for (const d of [outward, along]) {
        const c = point(s, cfg.outward, y);
        assert.equal(
          new T.Raycaster(
            c.clone().addScaledVector(d, 0.5),
            d.clone().negate(),
            0,
            1,
          ).intersectObject(original, true).length,
          0,
          `original asset already occupies support volume atY${y}`,
        );
      }
    // Check actual current lining, not an invented stand-in plane.
    for (const [y, dy] of [
      [cfg.floorY + 0.2, -1],
      [cfg.roofY - 0.2, 1],
    ]) {
      const hits = new T.Raycaster(
        point(s, cfg.outward, y),
        new T.Vector3(0, dy, 0),
        0,
        0.4,
      ).intersectObject(integrated, true);
      const hit = hits.find(
        (h) => h.object.name === "canada-west-glazing-backing",
      );
      assert.ok(hit);
      assert.ok(
        hits[0].distance >= 0.19 && hits[0].distance <= 0.201,
        "only the existing roof edge may overlap bearing by at most10mm",
      );
      assert.ok(
        Math.abs(hit.distance - 0.2) < 0.001,
        `support terminates on current closed floor/roof: y${y} hit${hit.distance} ${hit.object.name}`,
      );
      assert.equal(hit.object.name, "canada-west-glazing-backing");
    }
    for (let y = 8.1; y < 17.4; y += 0.3) {
      const from = point(s, 16, y),
        target = point(s, cfg.outward, y);
      const prior = new T.Raycaster(
        from,
        target.clone().sub(from).normalize(),
        0,
        from.distanceTo(target),
      ).intersectObject(integrated, true);
      assert.ok(
        prior.length,
        "exterior remains closed ahead of structural support",
      );
      assert.ok(prior[0].distance < from.distanceTo(target) - 0.5);
    }
  }
  const candidate = addCanadaPlacePrimarySupports(new T.Group(), {
    stations: CANADA_PLACE_CENTRAL_PRIMARY_STATIONS,
  });
  assert.equal(candidate.geometry.index!.count / 3, 1040);
  assert.equal(CANADA_PLACE_CENTRAL_PRIMARY_STATIONS.length, 5);
  assert.equal(CANADA_PLACE_CENTRAL_PRIMARY_STATIONS[2], cfg.previewStation);
});

test("preview does not silently invent a primary column schedule or accept outside stations", () => {
  const root = new T.Group();
  addCanadaPlacePrimarySupports(root);
  assert.equal(root.children.length, 1);
  for (const stations of [[], [s, s], [NaN], [30], [75]])
    assert.throws(() =>
      addCanadaPlacePrimarySupports(new T.Group(), { stations }),
    );
});
