import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  CANADA_PLACE_GROUND_STAYS,
  GROUND_STAY_ORIGIN,
} from "../src/world/canada-place-ground-stays-data";
import { addCanadaPlaceGroundStays } from "../src/world/canada-place-ground-stays";
import { addCanadaPlaceWestFacade } from "../src/world/canada-place-facade";
import { CANADA_MASTS } from "../src/world/canada-place-rigging";
import { CANADA_PLACE_PIER } from "../src/world/canada-place-deck";
import { pointInPoly, segmentPoint } from "../src/world/data";
const root = new T.Group(),
  chunks = addCanadaPlaceGroundStays(root);
root.updateMatrixWorld(true);
const concrete = chunks.find((c) =>
  (c.material as T.Material).name.includes("concrete"),
)!;
test("five source-registered twin stays retain exact mast-head contact and pier support", () => {
  assert.equal(CANADA_PLACE_GROUND_STAYS.length, 5);
  for (const a of CANADA_PLACE_GROUND_STAYS) {
    const mast = CANADA_MASTS.find((m) => m.side === 0 && m.bay === a.bay)!;
    for (const s of a.stays) {
      assert.equal(s.top[1], 46.17);
      assert.ok(
        Math.hypot(s.top[0] - mast.tip[0], s.top[2] - mast.tip[2]) < 0.09,
      );
    }
    for (let j = 0; j < a.worldFootprint.length; j += 2) {
      assert.ok(
        pointInPoly(
          a.worldFootprint[j],
          a.worldFootprint[j + 1],
          CANADA_PLACE_PIER,
        ),
      );
      assert.ok(
        Math.abs(
          a.worldFootprint[j] - a.localFootprint[j] - GROUND_STAY_ORIGIN[0],
        ) < 1e-9,
      );
    }
    assert.equal(a.worldMinY, 7.88);
    assert.equal(a.worldMaxY, 10.33);
  }
});
test("complete paired cable and connector axes do not cross current curved envelope", () => {
  const facade = new T.Group();
  const materials = new Map(
    ["concrete", "glass", "trim"].map((name) => [
      name,
      new T.MeshStandardMaterial({ name }),
    ]),
  );
  addCanadaPlaceWestFacade(facade, materials);
  facade.updateMatrixWorld(true);
  for (const a of CANADA_PLACE_GROUND_STAYS)
    for (const s of a.stays) {
      const start = new T.Vector3(...s.bottom),
        end = new T.Vector3(...s.top),
        v = end.clone().sub(start);
      // Both sides of finite cable radius, front/back casts avoid a winding-only pass.
      for (const shift of [-0.13, 0, 0.13]) {
        const o = new T.Vector3(a.normal[0] * shift, 0, a.normal[1] * shift);
        for (const reverse of [false, true]) {
          const from = (reverse ? end : start).clone().add(o),
            direction = v
              .clone()
              .normalize()
              .multiplyScalar(reverse ? -1 : 1);
          const ray = new T.Raycaster(from, direction, 0, v.length() - 0.4);
          assert.equal(
            ray.intersectObject(facade, true).length,
            0,
            `bay${a.bay} shift${shift}`,
          );
        }
      }
    }
});
test("physical plinth has outward faces, grounded base and bounded matching footprint", () => {
  const p = concrete.geometry.getAttribute("position"),
    normals = concrete.geometry.getAttribute("normal");
  let min = Infinity,
    max = -Infinity;
  for (let j = 0; j < p.count; j++) {
    assert.ok(
      Number.isFinite(normals.getX(j) + normals.getY(j) + normals.getZ(j)),
    );
    min = Math.min(min, p.getY(j));
    max = Math.max(max, p.getY(j));
    const x = p.getX(j),
      z = p.getZ(j);
    assert.ok(
      CANADA_PLACE_GROUND_STAYS.some(
        (a) =>
          pointInPoly(x, z, a.localFootprint) ||
          a.localFootprint.some(
            (_, k, r) =>
              k % 2 === 0 &&
              segmentPoint(
                x,
                z,
                r[k],
                r[k + 1],
                r[(k + 2) % r.length],
                r[(k + 3) % r.length],
              ).d < 0.0001,
          ),
      ),
    );
  }
  assert.ok(Math.abs(min - 7.8) < 1e-6);
  assert.equal(max, 10.25);
  for (const a of CANADA_PLACE_GROUND_STAYS) {
    const target = new T.Vector3(...a.point(0, 0, 8.15));
    const from = target
      .clone()
      .add(new T.Vector3(a.normal[0] * 4, 0, a.normal[1] * 4));
    assert.ok(
      new T.Raycaster(
        from,
        target.clone().sub(from).normalize(),
        0,
        5,
      ).intersectObject(concrete).length,
      "water-facing concrete must be front-visible",
    );
    const top = new T.Vector3(...a.point(0, -0.18, 12));
    assert.ok(
      new T.Raycaster(top, new T.Vector3(0, -1, 0), 0, 5).intersectObject(
        concrete,
      ).length,
      "closed shoulder top",
    );
  }
});
test("three shared material batches keep full geometry under a bounded budget", () => {
  assert.equal(chunks.length, 3);
  assert.ok(
    chunks.reduce((s, c) => s + c.geometry.getIndex()!.count / 3, 0) < 15000,
  );
  for (const c of chunks) assert.ok(c.castShadow && c.receiveShadow);
});
test("actual quantized source GLB supports every plinth corner at local deck7.8", async () => {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { MeshoptDecoder } = await import("meshoptimizer");
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read("public/models/vancouver/canada-place.glb");
  const source = new T.Group();
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      if (pr.getMaterial()?.getName() !== "concrete") continue;
      const pos = pr.getAttribute("POSITION")!,
        values = new Float32Array(pos.getCount() * 3);
      for (let i = 0; i < pos.getCount(); i++)
        values.set(pos.getElement(i, []), i * 3);
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.BufferAttribute(values, 3),
      );
      g.setIndex(Array.from(pr.getIndices()!.getArray()!));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      source.add(new T.Mesh(g, new T.MeshBasicMaterial()));
    }
  source.updateMatrixWorld(true);
  for (const a of CANADA_PLACE_GROUND_STAYS)
    for (let j = 0; j < a.localFootprint.length; j += 2) {
      const hits = new T.Raycaster(
        new T.Vector3(a.localFootprint[j], 7.95, a.localFootprint[j + 1]),
        new T.Vector3(0, -1, 0),
        0,
        0.4,
      ).intersectObject(source, true);
      assert.ok(hits.length);
      assert.ok(
        Math.abs(hits[0].point.y - 7.8) < 0.015,
        `source deck at bay${a.bay}`,
      );
    }
});
test("actual protective bodies and finite-radius hardware do not intersect recessed glazing or soffit", () => {
  const facade = new T.Group();
  addCanadaPlaceWestFacade(
    facade,
    new Map(
      ["concrete", "glass", "trim"].map((name) => [
        name,
        new T.MeshStandardMaterial({ name }),
      ]),
    ),
  );
  facade.traverse((o) => {
    if (o instanceof T.Mesh) (o.material as T.Material).side = T.DoubleSide;
  });
  facade.updateMatrixWorld(true);
  const edges = new Set<string>();
  for (const mesh of chunks) {
    const p = mesh.geometry.getAttribute("position"),
      ix = mesh.geometry.getIndex()!;
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = new T.Vector3().fromBufferAttribute(p, ix.getX(i + j)),
          b = new T.Vector3().fromBufferAttribute(
            p,
            ix.getX(i + ((j + 1) % 3)),
          );
        if (Math.min(a.y, b.y) > 18) continue;
        const key = [
          a
            .toArray()
            .map((n) => n.toFixed(4))
            .join(","),
          b
            .toArray()
            .map((n) => n.toFixed(4))
            .join(","),
        ]
          .sort()
          .join("|");
        if (edges.has(key)) continue;
        edges.add(key);
        const delta = b.clone().sub(a),
          length = delta.length();
        if (length < 0.001) continue;
        const hit = new T.Raycaster(
          a,
          delta.normalize(),
          0.0001,
          length - 0.0001,
        ).intersectObject(facade, true)[0];
        assert.ok(
          !hit,
          `${mesh.name} edge${a.toArray()}→${b.toArray()} intersects${hit?.object.name}`,
        );
      }
  }
});
test("optional calibrated concrete shader survives material clone and UVs are finite", () => {
  const material = new T.MeshStandardMaterial();
  const hook = () => {};
  material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => "anchor-material";
  const meshes = addCanadaPlaceGroundStays(new T.Group(), material),
    body = meshes.find((m) =>
      (m.material as T.Material).name.includes("concrete"),
    )!;
  assert.equal((body.material as T.Material).onBeforeCompile, hook);
  assert.equal(
    (body.material as T.Material).customProgramCacheKey(),
    "anchor-material",
  );
  assert.ok(
    Array.from(body.geometry.getAttribute("uv").array).every(Number.isFinite),
  );
});
test("rounded concrete shoulder has shared smooth normals and a horizontal crown", () => {
  const p = concrete.geometry.getAttribute("position"),
    n = concrete.geometry.getAttribute("normal"),
    ix = concrete.geometry.getIndex()!;
  const uses = new Map<number, number>();
  for (let i = 0; i < ix.count; i++)
    uses.set(ix.getX(i), (uses.get(ix.getX(i)) ?? 0) + 1);
  const shoulderHeights = new Set<number>();
  let curvedShared = 0,
    crowns = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 9.721 && p.getY(i) < 10.249) {
      shoulderHeights.add(Math.round(p.getY(i) * 10000));
      if ((uses.get(i) ?? 0) > 3 && n.getY(i) > 0.2 && n.getY(i) < 0.999)
        curvedShared++;
    }
    if (Math.abs(p.getY(i) - 10.25) < 1e-5) {
      assert.ok(n.getY(i) > 0.9999);
      crowns++;
    }
  }
  assert.equal(
    shoulderHeights.size,
    4,
    "four intermediate samples resolve one continuous quadratic roll",
  );
  assert.ok(
    curvedShared > 100,
    "shoulder strips share smooth normals rather than isolated faceted quads",
  );
  assert.equal(crowns, 120);
});
