import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  pointInPoly,
  roadWidth,
  type CityData,
} from "../src/world/data";
import { Batcher, ribbon, subdividePath } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  PACIFIC_COAST_RING as ring,
  PACIFIC_COAST_CENTRE as centre,
  PACIFIC_COAST_ENTRANCE_THRESHOLDS as thresholds,
  pacificCoastBays,
} from "../src/world/pacific-coast-site";
import { createHoweCordovaJunctionSite } from "../src/world/howe-cordova-junction-site";
import {
  buildHoweCordovaJunction,
  clipHoweCordovaPaths,
  clipHoweCordovaRoadEdges,
} from "../src/world/howe-cordova-junction";
const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
);
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const b of data.buildings) b.pts = convert(b.pts);
for (const a of data.areas) {
  a.pts = convert(a.pts);
  a.holes = a.holes?.map(convert);
}
data.ocean = data.ocean.map(convert);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const collision = new CollisionWorld(data),
  apron = collision.pacificApron!,
  datum = collision.baselineGroundHeight(...centre);
const site = collision.howeCordovaJunction!;
const root = new T.Group(),
  batch = new Batcher(root),
  materials = {
    sidewalk: new T.MeshStandardMaterial(),
    curb: new T.MeshStandardMaterial(),
    gutter: new T.MeshStandardMaterial(),
  };
const counts = buildHoweCordovaJunction(batch, site, materials);
batch.finish();
root.updateMatrixWorld(true);
const h = facadeFrame(ring[1], ring[2]);
const near = (a: number, b: number, e = 0.0001) =>
  assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const hit = (x: number, z: number) =>
  new T.Raycaster(
    new T.Vector3(x, 15, z),
    new T.Vector3(0, -1, 0),
    0,
    10,
  ).intersectObject(root, true)[0];

test("bounded frontage support matches visible geometry, leaving all building and apron interiors untouched", () => {
  assert.ok(
    counts.triangles > 1500 && counts.triangles < 20000,
    JSON.stringify(counts),
  );
  assert.equal(counts.materialGroups, 3);
  for (let i = 0; i < site.triangles.length; i += 113) {
    const { points } = site.triangles[i],
      x = points.reduce((n, p) => n + p[0], 0) / 3,
      z = points.reduce((n, p) => n + p[2], 0) / 3;
    const support = site.height(x, z)!;
    near(collision.walkingHeight(x, z), support);
    near(collision.height(x, z), support);
    assert.ok(Number.isFinite(support));
    const rendered = hit(x, z);
    assert.ok(
      Math.abs(rendered.point.y - support) < 0.0002,
      JSON.stringify({
        i,
        x,
        z,
        surface: site.triangles[i].surface,
        points,
        support,
        hit: rendered.point.y,
        material: Object.entries(materials).find(
          ([, m]) => m === (rendered.object as T.Mesh).material,
        )?.[0],
      }),
    );
    assert.equal(pointInPoly(x, z, ring.flat()), false);
    assert.equal(apron.height(x, z), undefined);
    assert.ok(support >= collision.baselineGroundHeight(x, z) - 0.0002);
  }
  for (const p of [[452, -415], [410, -370], [455, -440], [...centre]])
    assert.equal(site.height(p[0], p[1]), undefined);
  near(collision.groundHeight(...centre), datum);
});

test("mapped carriageway centres and widths remain open; curb and gutter follow only the actual outer ribbon", () => {
  for (const id of ["w50162809", "w1255588459"]) {
    const road = data.roads.find((r) => r.id === id)!;
    const points = subdividePath(road.pts, 0.5);
    for (let i = 0; i < points.length; i += 2)
      assert.equal(site.height(points[i], points[i + 1]), undefined);
    const original = ribbon(
      subdividePath(road.pts),
      roadWidth(road),
      0.092,
      collision.groundHeight.bind(collision),
      5,
      true,
    );
    // The path clipper is only for footpaths; none of this carriageway is passed
    // through it by integration. Its original width/profile is unchanged.
    assert.ok(original.getAttribute("position").count > 0);
    original.dispose();
  }
  assert.ok(
    site.curbFaces.length > 20,
    "a real formed vertical edge is emitted",
  );
  const heights = site.curbFaces.flatMap((f) => [
    f[3][1] - f[0][1],
    f[2][1] - f[1][1],
  ]);
  assert.ok(Math.max(...heights) > 0.105 && Math.max(...heights) < 0.15);
});

test("both existing doors and the apron open end retain their actual grade without threshold traps", () => {
  for (const [index, threshold] of Object.entries(thresholds)) {
    const p = h.p(pacificCoastBays(1)[Number(index)].centre, 0, -0.3),
      y = site.height(p[0], p[2]) ?? collision.height(p[0], p[2]);
    assert.ok(datum + threshold - y > 0.02 && datum + threshold - y < 0.055);
    assert.equal(collision.blocked(p[0], p[2], 0.2, y), false);
  }
  for (const depth of [0.4, 0.525, 0.65]) {
    const before = h.p(8.798, 0, -depth),
      after = h.p(8.802, 0, -depth);
    const a = apron.height(before[0], before[2])!,
      b =
        site.height(after[0], after[2]) ?? collision.height(after[0], after[2]);
    near(a, b, 0.004);
  }
  // Existing outer Howe through-route: actor radius .4 stays off the apron rail.
  let previous: number | undefined;
  for (let u = 0; u <= 16; u += 0.1) {
    const p = h.p(u, 0, -1.6),
      y = site.height(p[0], p[2]) ?? collision.height(p[0], p[2]);
    assert.equal(collision.blocked(p[0], p[2], 0.4, y), false, `route at ${u}`);
    if (previous !== undefined)
      assert.ok(Math.abs(y - previous) < 0.035, `abrupt route grade at ${u}`);
    previous = y;
  }
});

test("crossing ramp descends to road finish and has continuously supported walking access", () => {
  const crossing = data.roads.find((r) => r.id === "w1194857146")!;
  const endpoint = crossing.pts.slice(-2);
  assert.ok(site.ramp(endpoint[0], endpoint[1]) < 0.001);
  // Follow the actual mapped crossing back to its curb, allowing outside-patch road.
  let previous: number | undefined,
    supported = 0;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = endpoint[0] + (435.2 - endpoint[0]) * t,
      z = endpoint[1] + (-390.3 - endpoint[1]) * t,
      y = site.height(x, z);
    if (y !== undefined) {
      supported++;
      if (previous !== undefined) assert.ok(Math.abs(y - previous) < 0.045);
      previous = y;
    }
  }
  assert.ok(supported > 1);
});

test("legacy path clipping removes double concrete only inside the supported finish", () => {
  const road = data.roads.find((r) => r.id === "w888496020")!,
    original = ribbon(
      subdividePath(road.pts),
      1.8,
      0.15,
      collision.groundHeight.bind(collision),
      5,
      true,
    );
  const clipped = clipHoweCordovaPaths(original, site),
    p = clipped.getAttribute("position");
  assert.ok(p.count > 0);
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3,
      z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    assert.equal(site.height(x, z), undefined);
  }
  const far = ribbon([0, 0, 5, 0], 1);
  assert.equal(clipHoweCordovaPaths(far, site), far);
});

test("all triangle normals and metric UVs are finite and top surfaces face upward", () => {
  for (const tri of site.triangles) {
    const [a, b, c] = tri.points;
    assert.ok(
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0,
    );
  }
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    for (const name of ["position", "normal", "uv"]) {
      const a = o.geometry.getAttribute(name);
      for (const v of a.array) assert.ok(Number.isFinite(v));
    }
  });
});

test("formed gutter replaces its old road band without an opaque road plane across the depression", () => {
  const group = new T.Group();
  group.add(root);
  const asphalt = new T.MeshBasicMaterial();
  for (const id of ["w50162809", "w1255588459", "w921565040"]) {
    const road = data.roads.find((r) => r.id === id)!;
    const geometry = ribbon(
      subdividePath(road.pts),
      roadWidth(road),
      0.092,
      (x, z) => collision.roadHeight(road, x, z),
      5,
      true,
    );
    const clipped = clipHoweCordovaRoadEdges(geometry, site);
    group.add(new T.Mesh(clipped, asphalt));
  }
  group.updateMatrixWorld(true);
  let checked = 0,
    deep = 0;
  for (let i = 0; i < site.triangles.length; i += 47) {
    const tri = site.triangles[i];
    if (tri.surface !== "gutter") continue;
    const x = tri.points.reduce((n, p) => n + p[0], 0) / 3,
      z = tri.points.reduce((n, p) => n + p[2], 0) / 3;
    const ray = new T.Raycaster(
      new T.Vector3(x, 15, z),
      new T.Vector3(0, -1, 0),
      0,
      10,
    ).intersectObject(group, true)[0];
    assert.equal((ray.object as T.Mesh).material, materials.gutter);
    near(ray.point.y, site.height(x, z)!, 0.0002);
    checked++;
    if (site.height(x, z)! - collision.groundHeight(x, z) < 0.09) deep++;
  }
  assert.ok(
    checked > 10 && deep > 2,
    "actual trough geometry remains visible and supported",
  );
  group.remove(root);
});

test("curb face normals point toward the lower gutter and slab top is physically supported", () => {
  let checked = 0;
  for (let i = 0; i < site.curbFaces.length; i += 9) {
    const f = site.curbFaces[i];
    if (f[3][1] - f[0][1] < 0.07) continue;
    const a = new T.Vector3(...f[0]),
      b = new T.Vector3(...f[1]),
      c = new T.Vector3(...f[2]);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const centre = a
      .clone()
      .add(b)
      .add(c)
      .add(new T.Vector3(...f[3]))
      .multiplyScalar(0.25);
    const outside = site.height(
        centre.x + normal.x * 0.055,
        centre.z + normal.z * 0.055,
      ),
      inside = site.height(
        centre.x - normal.x * 0.055,
        centre.z - normal.z * 0.055,
      );
    if (outside === undefined || inside === undefined) continue;
    assert.ok(
      inside - outside > 0.065,
      `curb winding at ${centre.x},${centre.z}`,
    );
    const ray = new T.Raycaster(
      centre.clone().addScaledVector(normal, 0.18),
      normal.clone().negate(),
      0,
      0.25,
    ).intersectObject(root, true)[0];
    assert.ok(ray);
    near(ray.distance, 0.18, 0.001);
    checked++;
  }
  assert.ok(checked > 8);
});
