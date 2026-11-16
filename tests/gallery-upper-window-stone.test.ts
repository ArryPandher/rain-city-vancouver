import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  GALLERY_UPPER_WINDOW_STONE as D,
  galleryUpperWindowStoneParts,
  galleryWindowStoneProfile,
  galleryUpperWindowStoneCameraBlocked as blocked,
} from "../src/world/gallery-upper-window-stone";
import { addGalleryFacade } from "../src/world/gallery-facade";
import { galleryStairFramingBlocked } from "../src/world/gallery-stair-framing-contact";
import { galleryStairWorld } from "../src/world/gallery-stair-framing-data";
import { shortenChaseBoom } from "../src/game/chase-camera";

const dx = D.facadeB[0] - D.facadeA[0],
  dz = D.facadeB[1] - D.facadeA[1];
const length = Math.hypot(dx, dz),
  tx = dx / length,
  tz = dz / length;
const at = (along: number, y: number, depth: number) =>
  new T.Vector3(
    D.facadeA[0] + tx * along - tz * depth,
    y,
    D.facadeA[1] + tz * along + tx * depth,
  );
const parts = galleryUpperWindowStoneParts();
const material = new T.MeshBasicMaterial();
function mesh(p: (typeof parts)[number]) {
  const m = new T.Mesh(
    galleryWindowStoneProfile(p.left, p.right, p.bottom, p.profile),
    material,
  );
  m.updateMatrixWorld();
  return m;
}

test("four source-visible sills have closed outward profiles, real drips and eight curved brackets within the portico return", () => {
  assert.equal(parts.filter((p) => p.profile === D.sillProfile).length, 4);
  assert.equal(parts.filter((p) => p.profile === D.bracketProfile).length, 8);
  assert.equal(parts.filter((p) => p.profile === D.courseProfile).length, 5);
  let triangles = 0;
  for (const part of parts) {
    const m = mesh(part),
      p = m.geometry.getAttribute("position"),
      n = m.geometry.getAttribute("normal");
    const ix = m.geometry.index;
    const edges = new Map<string, number>();
    for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
      const points = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + j) : i + j),
      );
      assert.ok(
        points[1]
          .clone()
          .sub(points[0])
          .cross(points[2].clone().sub(points[0]))
          .length() > 1e-8,
      );
      for (let j = 0; j < 3; j++) {
        const key = [points[j], points[(j + 1) % 3]]
          .map((v) =>
            v
              .toArray()
              .map((a) => a.toFixed(5))
              .join(","),
          )
          .sort()
          .join("/");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      triangles++;
    }
    assert.ok(
      [...edges.values()].every((count) => count === 2),
      "each profile includes both end caps and all side faces",
    );
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
        ].every(Number.isFinite),
      );
      const local = at(p.getX(i), p.getY(i), p.getZ(i));
      assert.ok(
        local.x >= D.porticoEast - 1e-5,
        "no new profile pierces central banners",
      );
      assert.ok(local.y >= 9.06 - 1e-5 && local.y <= 9.534 + 1e-5);
      assert.ok(p.getZ(i) >= -0.29001 && p.getZ(i) <= 0.02501);
      assert.equal(
        blocked(local.x, local.z, local.y + 0.08, 0.002),
        true,
        "every rendered vertex has finite matching camera contact",
      );
    }
    const mid = (part.left + part.right) / 2;
    // Both extrusion end caps face outward even on an oblique registered facade.
    const h =
      part.bottom +
      (part.profile === D.sillProfile
        ? -0.08
        : part.profile === D.bracketProfile
          ? -0.23
          : -0.08);
    for (const [side, normal] of [
      [part.left, -1],
      [part.right, 1],
    ]) {
      const hit = new T.Raycaster(
        new T.Vector3(side + normal, h, -0.01),
        new T.Vector3(-normal, 0, 0),
        0,
        2,
      ).intersectObject(m)[0];
      assert.ok(hit);
      assert.ok(hit.face!.normal.x * normal > 0.99);
    }
    if (part.profile === D.sillProfile) {
      const hit = new T.Raycaster(
        new T.Vector3(mid, part.bottom - 0.08, -1),
        new T.Vector3(0, 0, 1),
        0,
        2,
      ).intersectObject(m)[0];
      assert.ok(hit && Math.abs(hit.point.z + 0.29) < 1e-6);
      assert.ok(hit.face!.normal.z < -0.99);
      const drip = at(mid, part.bottom - 0.137, -0.244);
      assert.equal(
        blocked(drip.x, drip.z, drip.y + 0.08, 0.002),
        false,
        "real recessed underside drip void",
      );
    }
    m.geometry.dispose();
  }
  assert.ok(triangles < 650, `${triangles} bounded added triangles`);
});

test("sphere contact shortens a reachable jump-height camera without changing standing/body routes", () => {
  const part = parts.find((p) => p.profile === D.bracketProfile)!;
  const along = (part.left + part.right) / 2;
  for (let y = 0; y <= 8.7; y += 0.1) {
    const p = at(along, y, -0.12);
    assert.equal(blocked(p.x, p.z, y, 0.25), false);
  }
  const convert = (p: T.Vector3) => {
    const [x, z] = galleryStairWorld(p.x, p.z);
    return new T.Vector3(x, p.y, z);
  };
  const focus = convert(at(along, 5.53, -4.1));
  const desired = convert(at(along, 9.32, -0.13));
  assert.equal(
    galleryStairFramingBlocked(desired.x, desired.z, 0.25, desired.y, true),
    true,
  );
  const fraction = shortenChaseBoom(focus, desired, (p) =>
    galleryStairFramingBlocked(p.x, p.z, 0.25, p.y, true),
  );
  assert.ok(fraction > 0.7 && fraction < 1);
  assert.equal(
    galleryStairFramingBlocked(desired.x, desired.z, 0.25, desired.y, true),
    false,
  );
  const high = convert(at(along, 10.2, -0.2));
  assert.equal(
    galleryStairFramingBlocked(high.x, high.z, 0.25, high.y, true),
    false,
    "contact has a finite top",
  );
});

test("actual Gallery factory retains bounded material batches and places the four exposed upper-window assemblies", () => {
  const parent = new T.Group();
  const materials = new Map(
    ["stone", "foundation", "glass"].map((name) => [
      name,
      new T.MeshStandardMaterial({ name }),
    ]),
  );
  const chunks = addGalleryFacade(parent, materials);
  assert.ok(chunks.length <= 12, "whole Gallery uses bounded material batches");
  let triangles = 0;
  for (const m of chunks) triangles += m.geometry.index!.count / 3;
  assert.ok(triangles < 60000, "whole Gallery includes Hooper and bounded hedge detail");
  const stone = chunks.find((m) => m.material === materials.get("stone"))!;
  const p = stone.geometry.getAttribute("position");
  // Batcher stores facade-local coordinates; the enclosing source group owns rotation.
  for (const part of parts.filter((p) => p.profile === D.sillProfile)) {
    const centre = at((part.left + part.right) / 2, part.bottom - 0.08, -1);
    const direction = new T.Vector3(-tz, 0, tx);
    const probe = new T.Mesh(stone.geometry, material);
    probe.updateMatrixWorld();
    const hit = new T.Raycaster(centre, direction, 0, 2).intersectObject(
      probe,
    )[0];
    assert.ok(hit);
    assert.ok(Math.abs(hit.distance - 0.71) < 0.00002);
  }
  assert.ok(p.count > 0);
  for (const m of chunks) m.geometry.dispose();
});
