import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { buildingHeight, footprintArea } from "../src/world/building-profile";
import {
  centroid,
  ungeo,
  geo,
  KX,
  ORIGIN,
  pointInPoly,
  type Building,
} from "../src/world/data";
import {
  NORTH_SHORE_URBAN as source,
  createNorthShoreUrbanHorizon,
  createNorthShoreUrbanSilhouette,
  preflightNorthShoreUrban,
} from "../src/world/north-shore-urban-horizon";

const eastern: Building[] = JSON.parse(
  fs.readFileSync(source.source, "utf8"),
).buildings;
const base = JSON.parse(fs.readFileSync(source.baseSource, "utf8"));
const ox = (ORIGIN.lon - base.meta.bbox[1]) * KX;
const oz = (base.meta.bbox[2] - ORIGIN.lat) * 110540;
const buildings: Building[] = base.buildings;
for (const b of buildings)
  b.pts = b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
const baseIds = new Set(buildings.map((b) => b.id));
const eastEdge = geo(49.2695, -123.0945)[0];
const northEdge = geo(49.3175, -123.164)[1];
const southEdge = geo(49.2695, -123.0945)[1];
buildings.push(
  ...eastern.filter((b) => {
    const [x, z] = centroid(b.pts);
    return (
      !baseIds.has(b.id) && (x > eastEdge || z < northEdge || z > southEdge)
    );
  }),
);
const metadata = JSON.parse(
  fs.readFileSync(source.metadataSource, "utf8"),
).buildings;
for (const b of buildings) {
  const attrs = metadata[b.id];
  if (attrs) {
    const levels = b.levels ?? attrs.levels;
    Object.assign(b, attrs, { levels });
  }
}

test("actual source selects exactly44 tall North Shore footprints and rejects altered source atomically", () => {
  const roi = source.selection;
  const selected = buildings.filter((b) => {
    const [lat, lon] = ungeo(...centroid(b.pts));
    return (
      lon >= roi.west &&
      lon <= roi.east &&
      lat >= roi.south &&
      lat <= roi.north &&
      buildingHeight(b) >= roi.minimumHeight
    );
  });
  assert.equal(selected.length, 44);
  assert.deepEqual(
    selected.map((b) => b.id).sort(),
    source.buildings.map((b) => b.id).sort(),
  );
  assert.ok(preflightNorthShoreUrban(buildings));
  const before = JSON.stringify(selected);
  assert.ok(createNorthShoreUrbanHorizon(selected));
  assert.equal(JSON.stringify(selected), before);
  for (const mutation of [
    "missing",
    "duplicate",
    "ring",
    "levels",
    "height",
    "kind",
  ]) {
    const copy = structuredClone(selected);
    if (mutation === "missing") copy.pop();
    if (mutation === "duplicate") copy.push(copy[0]);
    if (mutation === "ring") copy[0].pts[0] += 0.01;
    if (mutation === "levels") copy[0].levels = (copy[0].levels ?? 0) + 1;
    if (mutation === "height") copy[0].height = 80;
    if (mutation === "kind") copy[0].kind = "warehouse";
    const unchanged = JSON.stringify(copy);
    assert.equal(createNorthShoreUrbanHorizon(copy), undefined, mutation);
    assert.equal(JSON.stringify(copy), unchanged);
  }
});

test("all actual roofs face the sky and every source perimeter wall faces outward at unchanged datum", () => {
  const material = new T.MeshBasicMaterial({ side: T.FrontSide });
  let roofRays = 0,
    wallRays = 0;
  for (const b of source.buildings) {
    const geometry = createNorthShoreUrbanSilhouette(b.pts, b.height);
    const mesh = new T.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const p = geometry.getAttribute("position"),
      normal = geometry.getAttribute("normal");
    assert.equal(geometry.boundingBox!.min.y, 0);
    assert.ok(Math.abs(geometry.boundingBox!.max.y - b.height) < 0.00001);
    let roofArea = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, i);
      const c = new T.Vector3().fromBufferAttribute(p, i + 1);
      const d = new T.Vector3().fromBufferAttribute(p, i + 2);
      const centre = a
        .clone()
        .add(c)
        .add(d)
        .multiplyScalar(1 / 3);
      const n = new T.Vector3().fromBufferAttribute(normal, i);
      if (Math.abs(centre.y - b.height) < 0.00001) {
        assert.ok(n.y > 0.999, `${b.id} upward roof`);
        roofArea += c.clone().sub(a).cross(d.clone().sub(a)).length() / 2;
        const hit = new T.Raycaster(
          centre.clone().add(new T.Vector3(0, 2, 0)),
          new T.Vector3(0, -1, 0),
          0,
          3,
        ).intersectObject(mesh)[0];
        assert.ok(hit && Math.abs(hit.point.y - b.height) < 0.00001, b.id);
        roofRays++;
      } else if (centre.y > 0.00001) {
        const outside = centre.clone().addScaledVector(n, 0.05);
        assert.equal(
          pointInPoly(outside.x, outside.z, b.pts),
          false,
          `${b.id} outward normal`,
        );
        const hit = new T.Raycaster(
          centre.clone().addScaledVector(n, 0.05),
          n.clone().negate(),
          0,
          0.1,
        ).intersectObject(mesh)[0];
        assert.ok(
          hit && Math.abs(hit.distance - 0.05) < 0.001,
          `${b.id} front-sided wall`,
        );
        wallRays++;
      } else assert.ok(n.y < -0.999, `${b.id} underside`);
    }
    assert.ok(
      Math.abs(roofArea - footprintArea(b.pts)) < 0.04,
      `${b.id} complete exact roof footprint`,
    );
    geometry.dispose();
  }
  assert.ok(roofRays > 300 && wallRays > 900);
  material.dispose();
});

test("distant cells exactly complement source culling at recorded cameras and the boundary, with no shadows", () => {
  const horizon = createNorthShoreUrbanHorizon(buildings)!;
  assert.equal(horizon.stats.buildings, 44);
  assert.equal(horizon.stats.cells, 18);
  assert.ok(horizon.stats.triangles < 2000);
  assert.ok(horizon.stats.geometryBytes < 150_000);
  assert.equal(horizon.stats.datum, 0);
  assert.ok(horizon.group.children.every((m) => !m.visible));
  for (const [x, z] of [
    [-123, -720.98],
    [644.7, -622.34],
    [6802.98, -1671.89],
  ]) {
    horizon.update(x, z);
    for (const mesh of horizon.group.children) {
      const [cx, cz] = mesh.userData.center;
      assert.equal(mesh.visible, !(Math.hypot(cx - x, cz - z) < 2900));
      assert.equal(
        mesh.visible,
        true,
        "all44 recorded skyline candidates were culled",
      );
      assert.equal(mesh.castShadow, false);
      assert.equal(mesh.receiveShadow, false);
    }
  }
  for (const mesh of horizon.group.children) {
    const [cx, cz] = mesh.userData.center;
    for (const distance of [0, 1400, 2899.999, 2900, 2900.001, 8000]) {
      horizon.update(cx + distance, cz);
      assert.equal(mesh.visible, distance >= 2900);
    }
  }
  horizon.update(NaN, 0);
  assert.ok(horizon.group.children.every((m) => !m.visible));
  const material = (horizon.group.children[0] as T.Mesh)
    .material as T.MeshStandardMaterial;
  assert.equal(material.map, null);
  assert.equal(material.fog, true);
  assert.equal(material.transparent, false);
});
