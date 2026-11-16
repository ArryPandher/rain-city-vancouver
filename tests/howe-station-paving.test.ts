import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { canadaPlaceApproachGeometry } from "../src/world/canada-place-approach";
import { CANADA_PLACE_WALK_OFFSET } from "../src/world/canada-place-site";
import { HOWE_FORECOURT, HOWE_STATION } from "../src/world/howe-station-site";
import {
  KX,
  ORIGIN,
  pointInPoly,
  segmentPoint,
  type CityData,
} from "../src/world/data";
import {
  HOWE_STATION_OBSERVED_PAVING as ring,
  splitHoweStationPaving,
  stationPavingUV,
} from "../src/world/howe-station-paving";

const data = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
) as CityData;
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
const collision = new CollisionWorld(data);
assert.ok(collision.canada);
const site = collision.canada;
const parts = canadaPlaceApproachGeometry(
  data,
  site,
  collision.existingGroundHeight.bind(collision),
);
const source = parts.pavement;
const sourceCopies = Object.fromEntries(
  Object.entries(source.attributes).map(([n, a]) => [n, a.array.slice()]),
);
// Source-fit broad bands follow the normalized pavilion/street axes. Their
// observed phase is a photo interpretation, not a change to physical support.
const registration = {
  origin: [478.71652, -432.33508] as [number, number],
  uAxis: HOWE_STATION.axis,
  vAxis: HOWE_STATION.right,
};
const finish = (x: number, z: number) =>
  site.supportHeight(x, z) + CANADA_PLACE_WALK_OFFSET;
const split = splitHoweStationPaving(source, finish, registration);
const area = (geometry: T.BufferGeometry) => {
  const p = geometry.getAttribute("position");
  let sum = 0;
  for (let i = 0; i < p.count; i += 3)
    sum +=
      Math.abs(
        (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
          (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i)),
      ) / 2;
  return sum;
};
const triangleKey = (
  p: T.BufferAttribute | T.InterleavedBufferAttribute,
  i: number,
) =>
  [0, 1, 2]
    .flatMap((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)])
    .join("/");

test("observed paving replaces only existing finished support and conserves both original layers", (t) => {
  const tracedArea =
    Math.abs(
      ring.reduce((sum, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2;
  assert.ok(Math.abs(tracedArea - 331.884) < 0.001);
  assert.ok(
    split.metrics.patternedArea > 250 &&
      split.metrics.patternedArea <= tracedArea + 0.002,
  );
  assert.ok(
    Math.abs(area(source) - area(split.remainder) - area(split.field)) < 0.003,
    "split must conserve original support rather than add an overlay",
  );
  assert.ok(split.metrics.fieldTriangles < 3000);
  assert.ok(
    split.metrics.remainderTriangles +
      split.metrics.fieldTriangles -
      split.metrics.inputTriangles <
      1500,
  );
  for (const [name, attribute] of Object.entries(source.attributes))
    assert.deepEqual(attribute.array, sourceCopies[name]);
  const p = source.getAttribute("position"),
    rest = split.remainder.getAttribute("position");
  const retained = new Set(
    Array.from({ length: rest.count / 3 }, (_, n) => triangleKey(rest, n * 3)),
  );
  let lower = 0,
    outside = 0;
  for (let i = 0; i < p.count; i += 3) {
    const isLower = [0, 1, 2].every(
      (k) =>
        Math.abs(
          p.getY(i + k) -
            site.supportHeight(p.getX(i + k), p.getZ(i + k)) -
            0.065,
        ) < 0.0005,
    );
    const out = [0, 1, 2].every(
      (k) =>
        p.getX(i + k) < 477 ||
        p.getX(i + k) > 513 ||
        p.getZ(i + k) < -463 ||
        p.getZ(i + k) > -428,
    );
    if (isLower || out)
      assert.ok(
        retained.has(triangleKey(p, i)),
        "untouched triangle coordinates and winding survive exactly",
      );
    lower += Number(isLower);
    outside += Number(out);
  }
  assert.ok(lower > 100 && outside > 100);
  t.diagnostic(
    JSON.stringify({
      ...split.metrics,
      addedTriangles:
        split.metrics.remainderTriangles +
        split.metrics.fieldTriangles -
        split.metrics.inputTriangles,
    }),
  );
});

test("clipped vertices retain original triangle heights and smooth normals with source-oriented metric UVs", () => {
  const p = source.getAttribute("position"),
    n = source.getAttribute("normal");
  const cells = new Map<string, number[]>();
  for (let i = 0; i < p.count; i += 3) {
    if (
      [0, 1, 2].some(
        (k) =>
          Math.abs(p.getY(i + k) - finish(p.getX(i + k), p.getZ(i + k))) >
          0.0005,
      )
    )
      continue;
    const xs = [0, 1, 2].map((k) => p.getX(i + k)),
      zs = [0, 1, 2].map((k) => p.getZ(i + k));
    for (
      let x = Math.floor(Math.min(...xs) / 2);
      x <= Math.floor(Math.max(...xs) / 2);
      x++
    )
      for (
        let z = Math.floor(Math.min(...zs) / 2);
        z <= Math.floor(Math.max(...zs) / 2);
        z++
      ) {
        const key = `${x}/${z}`,
          list = cells.get(key) ?? [];
        list.push(i);
        cells.set(key, list);
      }
  }
  const q = split.field.getAttribute("position"),
    normal = split.field.getAttribute("normal"),
    uv = split.field.getAttribute("uv");
  let minHeight = Infinity,
    maxHeight = -Infinity;
  for (let k = 0; k < q.count; k++) {
    const x = q.getX(k),
      y = q.getY(k),
      z = q.getZ(k);
    const boundaryDistance = Math.min(
      ...ring.map(
        (a, i) => segmentPoint(x, z, ...a, ...ring[(i + 1) % ring.length]).d,
      ),
    );
    assert.ok(pointInPoly(x, z, ring.flat()) || boundaryDistance < 0.00004);
    const expectedUV = stationPavingUV(x, z, registration);
    assert.ok(
      Math.abs(uv.getX(k) - expectedUV[0]) < 0.000003 &&
        Math.abs(uv.getY(k) - expectedUV[1]) < 0.000003,
    );
    assert.ok(normal.getY(k) > 0.8);
    assert.ok(
      Math.abs(Math.hypot(normal.getX(k), normal.getY(k), normal.getZ(k)) - 1) <
        1e-6,
    );
    const candidates =
      cells.get(`${Math.floor(x / 2)}/${Math.floor(z / 2)}`) ?? [];
    const found = candidates.some((i) => {
      const ax = p.getX(i),
        az = p.getZ(i),
        bx = p.getX(i + 1),
        bz = p.getZ(i + 1),
        cx = p.getX(i + 2),
        cz = p.getZ(i + 2);
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) < 1e-12) return false;
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den,
        b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den,
        weights = [a, b, 1 - a - b];
      if (weights.some((w) => w < -0.01 || w > 1.01)) return false;
      if (
        Math.abs(
          weights.reduce((sum, w, j) => sum + w * p.getY(i + j), 0) - y,
        ) > 0.000002
      )
        return false;
      const interpolated = new T.Vector3(
        ...[0, 1, 2].map((c) =>
          weights.reduce((sum, w, j) => sum + w * n.getComponent(i + j, c), 0),
        ),
      ).normalize();
      return (
        interpolated.distanceTo(
          new T.Vector3(normal.getX(k), normal.getY(k), normal.getZ(k)),
        ) < 0.00001
      );
    });
    assert.ok(
      found,
      `replacement has its original support plane at ${x},${y},${z}`,
    );
    minHeight = Math.min(minHeight, y);
    maxHeight = Math.max(maxHeight, y);
  }
  assert.ok(
    maxHeight - minHeight > 0.25,
    "source grade must survive; no flat stamped plaza",
  );
});

test("replacement cannot fill the station stair opening or duplicate the finished walking surface", () => {
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const before = new T.Mesh(source, material),
    after = new T.Group();
  after.add(
    new T.Mesh(split.remainder, material),
    new T.Mesh(split.field, material),
  );
  before.updateMatrixWorld(true);
  after.updateMatrixWorld(true);
  const caster = new T.Raycaster(
    new T.Vector3(),
    new T.Vector3(0, -1, 0),
    0,
    30,
  );
  const heights = (root: T.Object3D, x: number, z: number) => {
    caster.ray.origin.set(x, 20, z);
    return caster
      .intersectObject(root, true)
      .map((h) => h.point.y)
      .filter((y, i, ys) => !i || Math.abs(y - ys[i - 1]) > 0.00001);
  };
  const well = HOWE_STATION.surfaceCutout;
  const middle = well.reduce(
    (p, q) => [p[0] + q[0] / well.length, p[1] + q[1] / well.length],
    [0, 0],
  );
  assert.deepEqual(heights(before, ...(middle as [number, number])), []);
  assert.deepEqual(heights(after, ...(middle as [number, number])), []);
  for (const t of [0.08, 0.25, 0.47, 0.72, 0.91]) {
    const x = ring[0][0] + (ring[1][0] - ring[0][0]) * t + 1.3;
    const z = ring[0][1] + (ring[1][1] - ring[0][1]) * t + 1.3;
    const a = heights(before, x, z),
      b = heights(after, x, z);
    assert.equal(
      b.length,
      a.length,
      "replacement keeps existing layers, not another coplanar surface",
    );
    assert.ok(a.length > 0);
    a.forEach((y, i) => assert.ok(Math.abs(y - b[i]) < 0.000005));
  }
  const fieldPositions = split.field.getAttribute("position");
  for (let i = 0; i < fieldPositions.count; i++) {
    const x = fieldPositions.getX(i),
      z = fieldPositions.getZ(i);
    const edge = Math.min(
      ...HOWE_FORECOURT.map(
        (a, j) =>
          segmentPoint(
            x,
            z,
            ...a,
            ...HOWE_FORECOURT[(j + 1) % HOWE_FORECOURT.length],
          ).d,
      ),
    );
    assert.ok(pointInPoly(x, z, HOWE_FORECOURT.flat()) || edge < 0.00004);
  }
  for (let i = 0; i < fieldPositions.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(fieldPositions, i),
      b = new T.Vector3().fromBufferAttribute(fieldPositions, i + 1),
      c = new T.Vector3().fromBufferAttribute(fieldPositions, i + 2);
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    assert.ok(
      Number.isFinite(normal.y) && normal.y > 0,
      "replacement keeps upward face winding",
    );
  }
});

test("registration is metre preserving and rejects skewed or scaled grid axes", () => {
  const origin = registration.origin;
  const a = stationPavingUV(...origin, registration),
    b = stationPavingUV(
      origin[0] + registration.uAxis[0] * 2,
      origin[1] + registration.uAxis[1] * 2,
      registration,
    );
  assert.ok(
    Math.hypot(...a) < 1e-12 &&
      Math.abs(b[0] - 2) < 1e-12 &&
      Math.abs(b[1]) < 1e-12,
  );
  assert.throws(
    () =>
      splitHoweStationPaving(source, finish, {
        ...registration,
        uAxis: [2, 0],
      }),
    /unit/,
  );
  assert.throws(
    () =>
      splitHoweStationPaving(source, finish, {
        ...registration,
        vAxis: registration.uAxis,
      }),
    /orthogonal/,
  );
});
