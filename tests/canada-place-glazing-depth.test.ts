import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import data from "../src/world/canada-place-concourse-data.json";
import { CanadaPlaceGlazingDepth } from "../src/world/canada-place-glazing-depth";

const index = data.stations.findIndex((s) => s.s > 45);
const a = data.stations[index - 1],
  b = data.stations[index];
const point = (out: number, y: number) =>
  new T.Vector3(
    (a.x + b.x) / 2 + ((a.nx + b.nx) / 2) * out,
    y,
    (a.z + b.z) / 2 + ((a.nz + b.nz) / 2) * out,
  );
const hit = (mesh: T.Mesh, start: T.Vector3, end: T.Vector3) => {
  mesh.updateMatrixWorld(true);
  return new T.Raycaster(
    start,
    end.clone().sub(start).normalize(),
    0,
    start.distanceTo(end),
  ).intersectObject(mesh)[0];
};
test("concourse lining exposes metres of volume, with closed source back, floor and ceiling", () => {
  const mesh = new CanadaPlaceGlazingDepth().finish(new T.Group());
  const rear = hit(mesh, point(13, 11.5), point(-1, 11.5));
  assert.ok(rear);
  assert.ok(rear.distance > 12, "no artificial .40m curved backsheet");
  assert.ok(rear.point.distanceTo(point(0.025, 11.5)) < 0.02);
  const floor = hit(mesh, point(4, 12), point(4, 7));
  assert.ok(floor);
  assert.ok(
    Math.abs(floor.point.y - 7.825) < 0.002,
    "floor is concourse grade, not door head",
  );
  const roof = hit(mesh, point(4, 12), point(4, 19));
  assert.ok(roof);
  assert.ok(Math.abs(roof.point.y - 17.625) < 0.002);
  const p = mesh.geometry.getAttribute("position");
  for (const v of p.array) assert.ok(Number.isFinite(v));
  assert.equal((mesh.material as T.MeshStandardMaterial).emissive.getHex(), 0);
  mesh.geometry.dispose();
});
test("pane retains shallow perimeter rebate without a closed curved back panel", () => {
  const depth = new CanadaPlaceGlazingDepth();
  depth.addPane(
    [
      [0, 11, 0],
      [2, 11, 0],
      [2, 12, 0],
      [0, 12, 0],
    ],
    [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    true,
    true,
  );
  const mesh = depth.finish(new T.Group());
  assert.equal(
    hit(mesh, new T.Vector3(1, 11.5, 0.2), new T.Vector3(1, 11.5, -0.5)),
    undefined,
  );
  assert.ok(
    hit(mesh, new T.Vector3(1, 11.5, -0.05), new T.Vector3(-0.2, 11.5, -0.05)),
    "physical jamb remains",
  );
  mesh.geometry.dispose();
});

test("lining floor follows recessed solid bays without covering the public walkway", () => {
  for (const boundary of data.solidBays.flat()) {
    assert.ok(
      data.stations.some((st) => Math.abs(st.s - boundary) < 1e-7),
      "floor intervals must split at each solid-bay boundary",
    );
  }
  const mesh = new CanadaPlaceGlazingDepth().finish(new T.Group());
  for (let i = 1; i < data.stations.length; i++) {
    const a = data.stations[i - 1],
      b = data.stations[i],
      mid = (a.s + b.s) / 2;
    if (!data.solidBays.some(([l, r]) => mid > l && mid < r)) continue;
    const scale = (a.scale + b.scale) / 2;
    const p = (out: number, y: number) =>
      new T.Vector3(
        (a.x + b.x) / 2 + ((a.nx + b.nx) / 2) * out * scale,
        y,
        (a.z + b.z) / 2 + ((a.nz + b.nz) / 2) * out * scale,
      );
    const outside = (data.solidBayOutward + data.groundOutward) / 2;
    assert.equal(
      hit(mesh, p(outside, 8.2), p(outside, 7.7)),
      undefined,
      "recess walkway has no elevated lining floor",
    );
    assert.ok(
      hit(
        mesh,
        p(data.solidBayOutward - 0.2, 8.2),
        p(data.solidBayOutward - 0.2, 7.7),
      ),
      "floor still closes solid-bay interior",
    );
  }
  mesh.geometry.dispose();
});

test("source-profile lining closes all four returns and both opaque fronts from inside", async () => {
  const { canadaPlaceConcoursePoint: p, addCanadaPlaceWestFacade } =
    await import("../src/world/canada-place-facade");
  const root = new T.Group();
  const additions = addCanadaPlaceWestFacade(
    root,
    new Map([["concrete", new T.MeshStandardMaterial({ side: T.FrontSide })]]),
  );
  const lining = additions.find(
    (m) => m.name === "canada-west-glazing-backing",
  )!;
  for (const [a, b] of data.solidBays) {
    for (const y of [9, 11.5, 14]) {
      for (const [s, sign] of [
        [a, 1],
        [b, -1],
      ]) {
        const result = hit(
          lining,
          p(s - sign * 0.3, 10.4, y),
          p(s + sign * 0.3, 10.4, y),
        );
        assert.ok(result, `missing inner return at${s}/${y}`);
        assert.ok(
          result.distance > 0.26 && result.distance < 0.29,
          "lining lies just inside adjacent glazed volume",
        );
      }
    }
    const mid = (a + b) / 2;
    assert.ok(
      hit(lining, p(mid, 9, 11.5), p(mid, 10.5, 11.5)),
      "solid front closes from inside",
    );
    root.updateMatrixWorld(true);
    const start = p(mid + 0.5, 11, 14.4),
      end = p(mid + 0.5, 9, 14.4);
    const result = new T.Raycaster(
      start,
      end.clone().sub(start).normalize(),
      0,
      start.distanceTo(end),
    ).intersectObject(root, true)[0];
    assert.ok(result);
    assert.equal(
      result.object.name,
      "canada-west-round-infill",
      "original round infill remains first from outside",
    );
  }
});
