import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  buildTerminalCityClub,
  TERMINAL_CITY_CLUB_RING,
} from "../src/world/terminal-city-club";
import type { TerminalCityMaterials } from "../src/world/terminal-city-materials";

const materials = Object.fromEntries(
  ["glass", "spandrel", "metal", "stone", "dark", "roof"].map((name) => [
    name,
    new T.MeshStandardMaterial({ name }),
  ]),
) as unknown as TerminalCityMaterials;
const root = new T.Group(),
  batch = new Batcher(root);
buildTerminalCityClub(
  batch,
  { id: "w143683969", pts: TERMINAL_CITY_CLUB_RING.flat() },
  materials,
);
const meshes = batch.finish();
root.updateMatrixWorld(true);
const street = facadeFrame(
  TERMINAL_CITY_CLUB_RING[1],
  TERMINAL_CITY_CLUB_RING[2],
);
// Independently recorded shared158862/166939 boundary; changes in roof data
// require revisiting the photographed tier registration, not moving this test.
const pool = facadeFrame(
  [392.33702481074766, -422.43481590293993],
  [410.6040899415791, -405.18549138562753],
);
const vector = (p: [number, number, number]) => new T.Vector3(...p);
function ray(a: [number, number, number], b: [number, number, number]) {
  const from = vector(a),
    to = vector(b);
  return new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to),
  ).intersectObject(root, true);
}
const material = (hit: T.Intersection) => (hit.object as T.Mesh).material;
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 0.0003, `${a} expected ${b}`);

test("photographed parking bay has deep closed backing and physical head, jamb and sill", () => {
  const u = 20.15;
  const hits = ray(street.p(u, 2.43, -0.5), street.p(u, 2.43, 1.3));
  assert.equal(material(hits[0]), materials.dark);
  near(hits[0].distance, 1.6);
  assert.equal(
    ray(street.p(u, 2.43, 0.03), street.p(u, 2.43, 0.95)).length,
    0,
    "no flush decorative black pane conceals the recess",
  );
  for (const [a, b, axis, sign] of [
    [street.p(u, 3.6, 0.5), street.p(u, 4.0, 0.5), "y", -1],
    [street.p(u, 0.5, 0.5), street.p(u, 0.1, 0.5), "y", 1],
  ] as const) {
    const hit = ray([...a], [...b])[0];
    assert.equal(material(hit), materials.stone);
    assert.ok(hit.face!.normal[axis] * sign > 0.99);
  }
  const right = street.length - 1.0;
  const jamb = ray(
    street.p(right - 0.2, 2.4, 0.5),
    street.p(right + 0.2, 2.4, 0.5),
  )[0];
  assert.equal(material(jamb), materials.stone);
  const tangent = vector(street.p(1, 0)).sub(vector(street.p(0, 0)));
  assert.ok(jamb.face!.normal.dot(tangent) < -0.99);
  const barrier = ray(street.p(u, 1.19, -0.5), street.p(u, 1.19, 1.3))[0];
  assert.equal(material(barrier), materials.metal);
  near(barrier.distance, 1.22);
  const contact = ray(street.p(u, 0.1, -0.5), street.p(u, 0.1, 0.2))[0];
  assert.equal(
    material(contact),
    materials.stone,
    "retained collision edge remains closed below the aperture",
  );
});

test("Cordova upper opening is a continuous recessed ribbon rather than repeating stone-pier windows", () => {
  let glass = 0,
    samples = 0;
  for (let u = 1.2; u < street.length - 1.2; u += 0.29) {
    const hits = ray(street.p(u, 7.8, -0.5), street.p(u, 7.8, 0.8));
    assert.ok(hits.length);
    assert.notEqual(
      material(hits[0]),
      materials.stone,
      "no broad internal masonry piers cross the ribbon",
    );
    if (material(hits[0]) === materials.glass) {
      glass++;
      near(hits[0].distance, 1.08);
      const backing = hits.find((hit) => material(hit) === materials.dark);
      assert.ok(backing);
      near(backing.distance - hits[0].distance, 0.065);
    }
    samples++;
  }
  assert.ok(
    glass / samples > 0.88,
    "fine mullions remain subordinate to the broad opening",
  );
  for (const y of [6.65, 9.6]) {
    const inside = y === 6.65 ? y + 0.2 : y - 0.2;
    const beyond = y === 6.65 ? y - 0.2 : y + 0.2;
    const hit = ray(street.p(5.1, inside, 0.3), street.p(5.1, beyond, 0.3))[0];
    assert.equal(
      material(hit),
      materials.stone,
      "ribbon has real sill/head returns",
    );
  }
  const farGround = ray(street.p(1.6, 2.5, -0.5), street.p(1.6, 2.5, 0.7))[0];
  assert.equal(material(farGround), materials.glass);
  // The unverified farther ground module keeps its previous380mm recess.
  near(farGround.distance, 0.88);
});

test("upper glazing is on the actual setback plane and buried shared part faces are removed", () => {
  const streetOrigin = vector(street.p(0, 0));
  const outward = new T.Vector3(street.outward[0], 0, street.outward[1]);
  const middle = vector(pool.p(pool.length / 2, 0));
  assert.ok(
    -middle.clone().sub(streetOrigin).dot(outward) > 4.5,
    "glazed tier is behind the terrace, not pasted onto the street face",
  );
  let glass = 0,
    total = 0;
  for (let u = 0.6; u < pool.length - 0.6; u += 0.31) {
    const hits = ray(pool.p(u, 18.3, -0.5), pool.p(u, 18.3, 0.4));
    assert.ok(hits.length);
    assert.notEqual(material(hits[0]), materials.stone);
    if (material(hits[0]) === materials.glass) {
      glass++;
      near(hits[0].distance, 0.7);
      assert.ok(hits.some((hit) => material(hit) === materials.dark));
    }
    total++;
  }
  assert.ok(glass / total > 0.88);
  for (const y of [7.5, 10.0])
    assert.equal(
      ray(pool.p(pool.length / 2, y, -0.15), pool.p(pool.length / 2, y, 0.15))
        .length,
      0,
      "no reversed duplicate walls remain inside the occupied lower strip",
    );
  const rail = ray(street.p(0.35, 12.1, -0.5), street.p(0.35, 12.1, 0.7))[0];
  assert.equal(material(rail), materials.metal);
  assert.equal(
    ray(street.p(1.0, 12.1, -0.5), street.p(1.0, 12.1, 0.7)).length,
    0,
    "terrace guard is a thin open frame, not a new opaque wall",
  );
});

test("sill floors and roof coping have one visible owner without coplanar faces", () => {
  const cases = [
    // Downward rays avoid mullions and triangle diagonals; two positions per
    // surface distinguish an owned plane from coincident, differently UV'd caps.
    { frame: street, y: 6.65, depth: 0.23, mat: materials.stone },
    { frame: pool, y: 15.65, depth: 0.08, mat: materials.metal },
    // The surveyed roof keeps its inward strip; trim owns only the projection.
    { frame: street, y: 11.53, depth: 0.08, mat: materials.roof },
    { frame: pool, y: 21.95, depth: 0.08, mat: materials.glass },
    { frame: street, y: 11.53, depth: -0.06, mat: materials.stone },
    { frame: pool, y: 21.95, depth: -0.04, mat: materials.metal },
  ];
  for (const { frame, y, depth, mat } of cases) {
    for (const u of [5.123, 13.271]) {
      const hits = ray(frame.p(u, y + 0.1, depth), frame.p(u, y - 0.1, depth));
      const surfaceHits = hits.filter(
        (hit) => Math.abs(hit.point.y - y) < 0.0003,
      );
      assert.equal(
        surfaceHits.length,
        1,
        `one upward face at y=${y}, depth=${depth}, u=${u}`,
      );
      assert.equal(material(surfaceHits[0]), mat);
      assert.ok(surfaceHits[0].face!.normal.y > 0.99);
    }
  }
});

test("street tier stays bounded in the existing six materials with finite outward triangles", () => {
  assert.equal(meshes.length, 6);
  let triangles = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal"),
      uv = mesh.geometry.getAttribute("uv"),
      ix = mesh.geometry.index!;
    triangles += ix.count / 3;
    for (let i = 0; i < p.count; i++)
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
          uv.getX(i),
          uv.getY(i),
        ].every(Number.isFinite),
      );
    for (let i = 0; i < ix.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, ix.getX(i)),
        b = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 1)),
        c = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 2));
      const cross = b.sub(a).cross(c.sub(a));
      assert.ok(cross.length() > 1e-8);
      assert.ok(
        cross.dot(new T.Vector3().fromBufferAttribute(n, ix.getX(i))) > 0,
      );
    }
  }
  assert.ok(triangles < 10000);
});
