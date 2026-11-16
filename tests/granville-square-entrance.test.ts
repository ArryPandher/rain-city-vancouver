import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import polygonClipping from "polygon-clipping";
import {
  createGranvilleSquareEntranceSite,
  createGranvilleSquareEntranceGeometry,
  createGranvilleSquareCanopyGlass,
  GRANVILLE_SQUARE_ENTRANCE as D,
} from "../src/world/granville-square-entrance";
import { KX, ORIGIN } from "../src/world/data";
const ground = (x: number, z: number) =>
    6.93 + (x - 560) * 0.008 + (z + 430) * 0.013,
  site = createGranvilleSquareEntranceSite(ground),
  geometry = createGranvilleSquareEntranceGeometry(site),
  steel = new T.Mesh(geometry.frame, new T.MeshStandardMaterial()),
  glassMaterial = createGranvilleSquareCanopyGlass(),
  glass = new T.Mesh(geometry.glass, glassMaterial);
steel.updateMatrixWorld();
glass.updateMatrixWorld();

test("three source bay canopies retain real overhead structure and a bounded two-role geometry cost", () => {
  assert.equal(site.roofs.length, 3);
  assert.equal(site.posts.length, 6);
  assert.equal(geometry.frame.index!.count / 3, 396);
  assert.equal(geometry.glass.index!.count / 3, 6);
  assert.equal(glassMaterial.forceSinglePass, true);
  assert.equal(glassMaterial.side, T.DoubleSide);
  assert.equal(glassMaterial.transmission, 0);
  assert.equal(glassMaterial.userData.castShadow, false);
  for (const roof of site.roofs) {
    assert.ok(roof.right - roof.left > 6.5 && roof.right - roof.left < 7);
    assert.ok(roof.right < 3 * D.bayWidth);
  }
  for (const post of site.posts) {
    const p = site.point(post.u, 0, post.d);
    assert.ok(Math.abs(post.low - ground(p[0], p[2]) + 0.025) < 1e-10);
    assert.ok(post.high - post.low > 3.2);
  }
});

test("rendered canopy planes match finite landing support and leave the ground route unchanged", () => {
  for (const roof of site.roofs)
    for (let a = 1; a < 8; a++)
      for (let b = 1; b < 8; b++) {
        const u = roof.left + ((roof.right - roof.left) * a) / 8,
          d = roof.front + ((roof.back - roof.front) * b) / 8,
          [x, , z] = site.point(u, 0, d),
          y = site.roofY(d),
          floor = ground(x, z),
          hits = new T.Raycaster(
            new T.Vector3(x, y + 1, z),
            new T.Vector3(0, -1, 0),
            0,
            2,
          ).intersectObject(glass);
        assert.equal(hits.length, 1);
        assert.ok(Math.abs(hits[0].point.y - site.support(x, z, y)!) < 0.00003);
        assert.ok(hits[0].face!.normal.y > 0.99);
        assert.equal(site.support(x, z, floor), undefined);
        assert.equal(site.support(x, z), undefined);
        assert.equal(site.blocked(x, z, 0.15, floor), false);
        assert.equal(
          site.blocked(x, z, 0.15, y - 0.3),
          true,
          "jumping body must not penetrate roof",
        );
        assert.equal(
          site.blocked(x, z, 0.15, y),
          false,
          "landed actor remains above roof",
        );
        assert.equal(
          site.blocked(x, z, 0.15, y, true),
          true,
          "camera sphere intersects pane",
        );
        assert.equal(site.blocked(x, z, 0.15, y + 0.3, true), false);
      }
  for (const post of site.posts) {
    const [x, , z] = site.point(post.u, 0, post.d),
      floor = ground(x, z);
    assert.equal(site.blocked(x, z, 0.3, floor), true);
    assert.equal(site.blocked(x, z, 0.15, post.high + 0.4, true), false);
    const hit = new T.Raycaster(
      new T.Vector3(x, post.high + 1, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(steel);
    assert.ok(hit.length);
  }
  const [x, , z] = site.point(D.bayWidth * 1.5, 0, -D.projection - 1);
  assert.equal(site.blocked(x, z, 0.4, ground(x, z)), false);
  assert.equal(site.support(x, z, 100), undefined);
});

test("every canopy mesh triangle stays outside separately owned mapped buildings", () => {
  const data = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const neighbors = data.buildings.filter((b: any) =>
    ["w116527978", "w208599553", "w138256216"].includes(b.id),
  );
  assert.equal(neighbors.length, 3);
  for (const g of [geometry.frame, geometry.glass]) {
    const p = g.getAttribute("position"),
      ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const tri = [0, 1, 2].map(
        (k) =>
          [p.getX(ix.getX(i + k)), p.getZ(ix.getX(i + k))] as [number, number],
      );
      const area = Math.abs(
        (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) -
          (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1]),
      );
      if (area < 1e-7) continue;
      tri.push(tri[0]);
      for (const neighbor of neighbors) {
        const flat = neighbor.pts.map(
            (v: number, j: number) => v / 2 - (j % 2 ? oz : ox),
          ),
          ring: [number, number][] = flat
            .filter((_: number, j: number) => j % 2 === 0)
            .map((_: number, j: number) => [flat[j * 2], flat[j * 2 + 1]]);
        ring.push(ring[0]);
        assert.deepEqual(
          polygonClipping.intersection([tri], [ring]),
          [],
          neighbor.id,
        );
      }
    }
  }
});
