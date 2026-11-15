import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { createHoweStationPavilionMaterials } from "../src/world/howe-station-pavilion-materials";
import {
  buildHoweStationPavilion,
  howeStationPavilionLayout,
  type HoweStationPavilionSpec,
} from "../src/world/howe-station-pavilion";

const spec: HoweStationPavilionSpec = {
  origin: [481.03, -430.89],
  axis: [-0.66573, 0.74619],
  length: 11.371,
  width: 4.653,
  landingHeight: 8.08,
  stairStart: 2.621,
  groundHeight: (x, z) => 8.08 + (x - 481.03) * 0.035 + (z + 430.89) * -0.025,
};
function assembled(datum = 0) {
  const group = new T.Group(),
    batch = new Batcher(group),
    environment = new T.Texture();
  batch.offsetY = datum;
  const materials = createHoweStationPavilionMaterials(
    { texture: () => new T.Texture() },
    environment,
  );
  const layout = buildHoweStationPavilion(batch, spec, materials);
  const meshes = batch.finish();
  group.updateMatrixWorld(true);
  const ray = (a: [number, number, number], b: [number, number, number]) => {
    const from = new T.Vector3(...layout.p(...a)),
      to = new T.Vector3(...layout.p(...b));
    return new T.Raycaster(
      from,
      to.clone().sub(from).normalize(),
      0,
      from.distanceTo(to) + 0.001,
    ).intersectObject(group, true);
  };
  return { group, meshes, materials, layout, ray, environment };
}
const fixture = assembled(2.75);

test("parameterized placement preserves world datum and confines every component to the declared exterior envelope", () => {
  const { layout: s, meshes } = fixture;
  assert.ok(Math.abs(Math.hypot(...s.axis) - 1) < 1e-12);
  assert.equal(s.closedToGameplay, true);
  assert.equal(s.stairStart, 2.621);
  assert.equal(s.closedEntry.length, 2);
  let min = Infinity,
    max = -Infinity;
  for (const mesh of meshes) {
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - s.origin[0],
        z = p.getZ(i) - s.origin[1],
        v = x * s.right[0] + z * s.right[1],
        u = x * s.axis[0] + z * s.axis[1];
      assert.ok(Math.abs(v) <= s.radius + 0.0501);
      assert.ok(u >= -0.0501 && u <= s.length + 0.0501);
      min = Math.min(min, p.getY(i));
      max = Math.max(max, p.getY(i));
    }
  }
  assert.ok(Math.abs(min - s.minY) < 0.0001);
  assert.ok(Math.abs(max - s.maxY) < 0.0001);
  const flat = assembled();
  assert.equal(flat.meshes.length, meshes.length);
  for (let j = 0; j < meshes.length; j++) {
    const a = meshes[j].geometry.attributes.position,
      b = flat.meshes[j].geometry.attributes.position;
    assert.equal(a.count, b.count);
    for (let i = 0; i < a.count; i++)
      assert.ok(Math.abs(a.getY(i) - b.getY(i)) < 1e-5);
  }
});

test("entry and barrel glazing remain transparent front surfaces with real stairs and no opaque window backing", () => {
  const { ray, layout: s, materials } = fixture;
  const entrance = ray([0.7, 1.8, -1], [0.7, 1.8, 3.8]);
  assert.equal((entrance[0].object as T.Mesh).material, materials.glass);
  assert.ok(Math.abs(entrance[0].distance - 1) < 0.001);
  assert.equal(
    entrance.filter((h) => (h.object as T.Mesh).material === materials.glass)
      .length,
    1,
  );
  const side = ray([s.radius + 1, 1.8, 1.27], [0, 1.8, 1.27]);
  assert.equal((side[0].object as T.Mesh).material, materials.glass);
  const roof = ray(
    [0.5, s.springHeight + s.roofRise + 1, 1.27],
    [0.5, s.springHeight, 1.27],
  );
  assert.equal((roof[0].object as T.Mesh).material, materials.glass);
  for (const step of [0, 4, 11, s.steps - 1]) {
    const u = s.stairStart + (step + 0.5) * s.tread,
      hits = ray([0, 0.2, u], [0, -s.stairDrop - 0.3, u]);
    assert.equal((hits[0].object as T.Mesh).material, materials.stone);
    assert.ok(
      Math.abs(hits[0].point.y - (s.landingHeight - (step + 1) * s.riser)) <
        0.0001,
    );
  }
  const lower = ray(
    [0, 0.2, s.length - 0.4],
    [0, -s.stairDrop - 0.3, s.length - 0.4],
  );
  assert.equal((lower[0].object as T.Mesh).material, materials.stone);
  assert.ok(
    Math.abs(lower[0].point.y - (s.landingHeight - s.stairDrop)) < 0.0001,
  );
});

test("fine intermediate ribs and stronger end arches retain solid thickness and capped ends", () => {
  const { layout: s, ray, materials } = fixture,
    u = (s.length * 3) / s.ribs,
    v = 0.51,
    top = ray(
      [v, s.springHeight + s.roofRise + 0.5, u],
      [v, s.springHeight, u],
    ),
    under = ray(
      [v, s.springHeight, u],
      [v, s.springHeight + s.roofRise + 0.5, u],
    );
  assert.equal((top[0].object as T.Mesh).material, materials.metal);
  assert.equal((under[0].object as T.Mesh).material, materials.metal);
  const thickness = top[0].point.y - under[0].point.y;
  assert.ok(thickness > 0.045 && thickness < 0.07);
  const y = (top[0].point.y + under[0].point.y) / 2 - s.landingHeight;
  const cap = ray([v, y, u - 0.2], [v, y, u + 0.2]);
  assert.equal((cap[0].object as T.Mesh).material, materials.metal);
  assert.ok(Math.abs(cap[0].distance - 0.1775) < 0.001);
  const endTop = ray(
      [v, s.springHeight + s.roofRise + 0.5, 0],
      [v, s.springHeight + s.roofRise - 0.4, 0],
    ),
    endUnder = ray(
      [v, s.springHeight + s.roofRise - 0.4, 0],
      [v, s.springHeight + s.roofRise + 0.5, 0],
    ),
    endThickness = endTop[0].point.y - endUnder[0].point.y;
  assert.ok(endThickness > 0.075 && endThickness < 0.12);
  assert.ok(
    endThickness > thickness * 1.5,
    "perimeter arch has structural hierarchy",
  );
});

test("pane-edge seals sit behind narrow silver caps and coping reveals have real inset depth", () => {
  const { layout: s, ray, materials } = fixture,
    u = (s.length * 3) / s.ribs,
    side = (along: number, height: number) =>
      ray([s.radius + 0.2, height, along], [s.radius - 0.1, height, along]);
  assert.equal((side(u, 1.8)[0].object as T.Mesh).material, materials.metal);
  const gasket = side(u + 0.0285, 1.8)[0],
    clear = side(u + 0.1, 1.8)[0];
  assert.equal((gasket.object as T.Mesh).material, materials.gasket);
  assert.equal((clear.object as T.Mesh).material, materials.glass);
  assert.ok(
    Math.abs(clear.distance - gasket.distance - 0.004) < 0.0001,
    "seal is separated from the declared glass surface",
  );
  const reveal = side(0.7, s.baseTop - 0.072)[0],
    coping = side(0.7, s.baseTop - 0.03)[0];
  assert.equal((reveal.object as T.Mesh).material, materials.lining);
  assert.equal((coping.object as T.Mesh).material, materials.stone);
  assert.ok(
    Math.abs(reveal.distance - coping.distance - 0.008) < 0.0001,
    "coping bed is recessed geometry, not a painted stripe",
  );
});

test("barrel glass has continuous analytic ellipse normals and metric arc UVs", () => {
  const { layout: s, meshes, materials } = fixture;
  let inspected = 0;
  const samples: { v: number; y: number; uv: number; normal: T.Vector3 }[] = [];
  for (const mesh of meshes.filter(
    (mesh) => mesh.material === materials.glass,
  )) {
    const p = mesh.geometry.attributes.position,
      n = mesh.geometry.attributes.normal,
      uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) - s.landingHeight,
        alongNormal = n.getX(i) * s.axis[0] + n.getZ(i) * s.axis[1];
      if (y <= s.springHeight + 0.05 || Math.abs(alongNormal) > 0.001) continue;
      const v =
          (p.getX(i) - s.origin[0]) * s.right[0] +
          (p.getZ(i) - s.origin[1]) * s.right[1],
        u =
          (p.getX(i) - s.origin[0]) * s.axis[0] +
          (p.getZ(i) - s.origin[1]) * s.axis[1],
        expected = new T.Vector3(
          (s.right[0] * v) / s.radius ** 2,
          (y - s.springHeight) / s.roofRise ** 2,
          (s.right[1] * v) / s.radius ** 2,
        ).normalize(),
        actual = new T.Vector3().fromBufferAttribute(n, i);
      assert.ok(
        actual.distanceTo(expected) < 0.0001,
        "reflection normal follows the ellipse rather than an individual flat strip",
      );
      assert.ok(Math.abs(uv.getY(i) - u) < 0.0001);
      if (Math.abs(u) < 0.0001)
        samples.push({ v, y, uv: uv.getX(i), normal: actual });
      inspected++;
    }
  }
  assert.ok(inspected > 20);
  samples.sort((a, b) => a.v - b.v);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      distance = Math.hypot(b.v - a.v, b.y - a.y);
    assert.ok(Math.abs(b.uv - a.uv - distance) < 0.0001);
    assert.ok(
      a.normal.dot(b.normal) > 0.96,
      "adjacent panes retain smooth reflection direction",
    );
  }
});

test("sloping exterior base closes to its supplied ground while roof and landing remain level", () => {
  const { layout: s, ray, materials } = fixture;
  for (const side of [-1, 1])
    for (const u of [0.7, 5.2, 10.4]) {
      const v = side * s.radius,
        ground = s.ground(v, u),
        hits = ray(
          [v + side * 0.3, ground + 0.12, u],
          [v - side * 0.1, ground + 0.12, u],
        );
      assert.equal((hits[0].object as T.Mesh).material, materials.stone);
      assert.ok(Math.abs(hits[0].distance - 0.3) < 0.001);
    }
  for (const u of [0.8, 1.9]) {
    const hits = ray([0, 0.3, u], [0, -0.3, u]);
    assert.ok(Math.abs(hits[0].point.y - s.landingHeight) < 0.0001);
  }
  assert.throws(
    () =>
      buildHoweStationPavilion(
        new Batcher(new T.Group()),
        { ...spec, groundHeight: () => spec.landingHeight + 1 },
        materials,
      ),
    /clear.*ground/,
  );
});

test("pavilion materials borrow one environment and preserve the existing dielectric blending contract", () => {
  const { materials: m, environment } = fixture;
  assert.equal(m.glass.envMap, environment);
  assert.equal(m.metal.envMap, environment);
  assert.equal(m.glass.transmission, 0);
  assert.equal(m.glass.side, T.FrontSide);
  assert.equal(m.glass.depthWrite, false);
  assert.equal(m.glass.blendSrc, T.OneFactor);
  assert.equal(m.glass.blendDst, T.OneMinusSrcAlphaFactor);
  assert.equal(m.glass.userData.castShadow, false);
  assert.equal(m.glass.opacity, 1);
  assert.equal(m.stone.map?.colorSpace, T.SRGBColorSpace);
  assert.equal(m.stone.normalMap?.colorSpace, T.NoColorSpace);
  for (const material of Object.values(m))
    assert.equal(material.emissive.getHex(), 0);
  const shared = new T.Texture<HTMLImageElement>();
  shared.repeat.set(3, 4);
  const other = createHoweStationPavilionMaterials({ texture: () => shared });
  assert.deepEqual(shared.repeat.toArray(), [3, 4]);
  assert.notEqual(other.stone.map, shared);
});

test("finite outward geometry keeps the existing triangle budget plus one gasket batch", () => {
  let triangles = 0,
    vertices = 0;
  for (const mesh of fixture.meshes) {
    const g = mesh.geometry,
      p = g.attributes.position,
      n = g.attributes.normal,
      ix = g.index!;
    vertices += p.count;
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
        ].every(Number.isFinite),
      );
    for (let i = 0; i < ix.count; i += 3) {
      const a = ix.getX(i),
        b = ix.getX(i + 1),
        c = ix.getX(i + 2),
        cross = new T.Vector3()
          .fromBufferAttribute(p, b)
          .sub(new T.Vector3().fromBufferAttribute(p, a))
          .cross(
            new T.Vector3()
              .fromBufferAttribute(p, c)
              .sub(new T.Vector3().fromBufferAttribute(p, a)),
          );
      if (cross.lengthSq() > 1e-12)
        assert.ok(
          cross.dot(new T.Vector3().fromBufferAttribute(n, a)) >= -1e-6,
        );
    }
  }
  assert.equal(fixture.meshes.length, 7);
  assert.ok(triangles < 7000, `${triangles} triangles`);
  console.log(
    `Pavilion: ${triangles} triangles, ${vertices} vertices, ${fixture.meshes.length} batches`,
  );
  assert.throws(
    () => howeStationPavilionLayout({ ...spec, axis: [0, 0] }),
    /Invalid/,
  );
  assert.throws(
    () => howeStationPavilionLayout({ ...spec, stairDrop: 8 }),
    /does not fit/,
  );
});
