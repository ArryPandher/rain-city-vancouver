import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  KX,
  ORIGIN,
  centroid,
  pointInPoly,
  segmentPoint,
} from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
import { FAIRMONT_LOBBY_CAVITY as cavity } from "../src/world/fairmont-arcade";
import { buildFairmontWaterfront } from "../src/world/fairmont-waterfront";
import { createFairmontWaterfrontMaterials } from "../src/world/fairmont-waterfront-materials";
import {
  FAIRMONT_WATERFRONT_ID as ID,
  FAIRMONT_WATERFRONT_RING as ring,
  FAIRMONT_WATERFRONT_CANOPY_SOURCE_RING as canopy,
  FAIRMONT_WATERFRONT_HOWE_BASE_TOP as rowAnchor,
  FAIRMONT_WATERFRONT_CANOPY_TOP as roofRise,
  FAIRMONT_WATERFRONT_PARTS as parts,
} from "../src/world/fairmont-waterfront-site";
import {
  createFairmontArcadeSite,
  FAIRMONT_ARCADE_DEPTH as depth,
  FAIRMONT_ARCADE_FRONTAGES as frontages,
  FAIRMONT_ARCADE_PIERS as piers,
  FAIRMONT_ARCADE_FLOOR_OFFSET as floorOffset,
} from "../src/world/fairmont-arcade-site";

function activeCollision() {
  const data = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540,
    convert = (pts: number[]) => pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const group of [data.buildings, data.areas])
    for (const item of group) {
      item.pts = convert(item.pts);
      if (item.holes) item.holes = item.holes.map(convert);
    }
  data.ocean = [];
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const collision = new CollisionWorld(data);
  assert.ok(
    collision.canada,
    "active named-road grade is required for ground contacts",
  );
  return collision;
}
const collision = activeCollision(),
  datum = collision.baselineGroundHeight(...centroid(ring.flat())),
  // Inspect geometry in the building's local vertical frame. Runtime applies
  // this same centroid baseline to both its batch and collision contract.
  grade = (x: number, z: number) =>
    collision.baselineGroundHeight(x, z) - datum,
  site = createFairmontArcadeSite(grade),
  root = new T.Group(),
  batch = new Batcher(root),
  materials = createFairmontWaterfrontMaterials({
    texture: () => new T.Texture(),
  });
buildFairmontWaterfront(batch, { id: ID, pts: ring.flat() }, materials, grade);
const meshes = batch.finish();
root.updateMatrixWorld(true);
const ray = (from: T.Vector3, to: T.Vector3) =>
  new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to) + 0.01,
  ).intersectObject(root, true);

function insideOrBoundary(x: number, z: number) {
  return (
    pointInPoly(x, z, ring.flat()) ||
    ring.some(
      (a, i) =>
        segmentPoint(x, z, ...a, ...ring[(i + 1) % ring.length]).d < 1e-5,
    )
  );
}

test("Howe arcade and round piers register to source attachment stations inside the retained outline", () => {
  assert.equal(piers.length, 6);
  assert.deepEqual(
    frontages.map((s) => s.edge),
    [0, 1, 2],
  );
  for (const polygon of site.openPolygons)
    for (let i = 0; i < polygon.length; i++)
      for (let j = 0; j <= 20; j++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length];
        assert.ok(
          insideOrBoundary(
            a[0] + ((b[0] - a[0]) * j) / 20,
            a[1] + ((b[1] - a[1]) * j) / 20,
          ),
        );
      }
  for (const pier of piers) {
    const f = facadeFrame(ring[pier.edge], ring[pier.edge + 1]),
      source = canopy[pier.canopyVertex],
      registered = segmentPoint(
        ...source,
        ...ring[pier.edge],
        ...ring[pier.edge + 1],
      );
    assert.ok(Math.abs(pier.along - registered.t * f.length) <= 0.851);
    for (let i = 0; i < 48; i++)
      assert.ok(
        pointInPoly(
          pier.point[0] + Math.cos((i * Math.PI) / 24) * pier.radius,
          pier.point[1] + Math.sin((i * Math.PI) / 24) * pier.radius,
          ring.flat(),
        ),
      );
  }
  assert.equal(site.closures.filter((s) => s.kind === "wall").length, 2);
  assert.equal(site.closures.filter((s) => s.kind === "glazing").length, 3);
});

test("public edge is open at eye and ankle height with deep glazing and opaque rear closure", () => {
  const section = frontages[1],
    f = facadeFrame(section.a, section.b),
    u = f.length * 0.18,
    outside = f.p(u, 0, -0.045),
    ground = grade(outside[0], outside[2]);
  assert.ok(Number.isFinite(ground), "use the active Howe approach sampler");
  for (const height of [
    ground + floorOffset + 0.28,
    ground + floorOffset + 1.65,
  ]) {
    const hits = ray(
      new T.Vector3(...f.p(u, height, -0.5)),
      new T.Vector3(
        ...f.p(
          u,
          height,
          depth + cavity.wallDepth + cavity.bayExtraDepth + 0.15,
        ),
      ),
    );
    assert.ok(hits.length > 1, "rear glass and opaque backing close the bay");
    assert.equal((hits[0].object as T.Mesh).material, materials.lobbyGlass);
    assert.ok(
      Math.abs(hits[0].distance - depth - 0.5) < 0.003,
      "flat old facade panels/glass must be removed",
    );
    const closing = hits.find(
      (hit) => (hit.object as T.Mesh).material !== materials.lobbyGlass,
    )!;
    assert.ok(
      closing.distance >= depth + 0.5 + cavity.lowerDepth - 0.003,
      "the old opaque backing 8 cm behind the glass is removed",
    );
    assert.ok(
      [materials.lobbyLining, materials.lobbyRear].includes(
        (closing.object as T.Mesh).material as T.MeshStandardMaterial,
      ),
    );
  }
});

test("floor triangles exactly match active-grade contact and remain within the existing canopy clearance", () => {
  let checked = 0,
    minimumClearance = Infinity,
    minGrade = Infinity,
    maxGrade = -Infinity;
  for (const panel of site.floorPanels) {
    const [a, b, c, d] = panel.corners,
      x = (a[0] + b[0]) / 2,
      z = (a[2] + b[2]) / 2,
      f = facadeFrame(frontages[panel.section].a, frontages[panel.section].b),
      exterior = grade(x + f.outward[0] * 0.045, z + f.outward[1] * 0.045);
    assert.ok(
      Math.abs((a[1] + b[1]) / 2 - exterior - 0.15) < 0.02,
      "floor joins existing street with a 15 mm lip",
    );
    minGrade = Math.min(minGrade, exterior);
    maxGrade = Math.max(maxGrade, exterior);
    minimumClearance = Math.min(
      minimumClearance,
      Math.min(...panel.corners.map((p) => site.ceilingAt(p[0], p[2])! - p[1])),
    );
    for (const t of [0.25, 0.75]) {
      const xx = ((a[0] + b[0]) / 2) * (1 - t) + ((c[0] + d[0]) / 2) * t,
        zz = ((a[2] + b[2]) / 2) * (1 - t) + ((c[2] + d[2]) / 2) * t;
      if (
        piers.some(
          (p) => Math.hypot(xx - p.point[0], zz - p.point[1]) < p.radius + 0.12,
        )
      )
        continue;
      const expected = site.floorAt(xx, zz)!,
        ceiling = site.ceilingAt(xx, zz)!;
      assert.ok(Number.isFinite(expected));
      const down = ray(
        new T.Vector3(xx, ceiling - 0.1, zz),
        new T.Vector3(xx, expected - 0.1, zz),
      );
      assert.ok(down.length);
      assert.ok(
        Math.abs(down[0].point.y - expected) < 0.001,
        `visible floor ${down[0].point.y} agrees with ${expected} at ${xx},${zz}; material ${Object.entries(materials).find(([, m]) => m === (down[0].object as T.Mesh).material)?.[0]}`,
      );
      const up = ray(
        new T.Vector3(xx, expected + 0.2, zz),
        new T.Vector3(xx, ceiling + 0.05, zz),
      );
      assert.ok(
        up.length && Math.abs(up[0].point.y - ceiling) < 0.001,
        "recess has a real shaded ceiling",
      );
      checked++;
    }
  }
  assert.ok(Number.isFinite(minGrade) && Number.isFinite(maxGrade));
  assert.ok(
    minimumClearance > 4.5,
    `fitted roof clearance ${minimumClearance}`,
  );
  assert.ok(checked > 100);
});

test("piers meet the sloping floor and upper structure with actual cylindrical surfaces", () => {
  for (const pier of piers) {
    const f = facadeFrame(ring[pier.edge], ring[pier.edge + 1]),
      h = site.floorAt(...pier.point)!,
      ceiling = site.ceilingAt(...pier.point)!;
    assert.ok(Number.isFinite(h));
    for (const y of [h + 0.03, (h + ceiling) / 2, ceiling - 0.03]) {
      const from = new T.Vector3(
          pier.point[0] + f.outward[0] * 1.5,
          y,
          pier.point[1] + f.outward[1] * 1.5,
        ),
        to = new T.Vector3(...[pier.point[0], y, pier.point[1]]),
        hits = ray(from, to);
      assert.ok(hits.length);
      assert.equal((hits[0].object as T.Mesh).material, materials.panel);
      assert.ok(
        hits[0].distance < 0.79,
        "round pier has substantial radius and no floating base",
      );
    }
  }
});

test("arcade additions retain finite batched geometry and a bounded hotel cost", () => {
  let triangles = 0;
  for (const mesh of meshes) {
    triangles += mesh.geometry.index!.count / 3;
    assert.ok(
      Array.from(mesh.geometry.getAttribute("position").array).every(
        Number.isFinite,
      ),
    );
  }
  assert.ok(triangles < 55000, `hotel triangles ${triangles}`);
  assert.ok(meshes.length <= 11);
});

test("a genuinely graded caller surface produces matched sloping floor triangles without uplifting the hotel", () => {
  const sampler = (x: number, z: number) => 1.5 + (z + 490) * 0.05,
    sloped = createFairmontArcadeSite(sampler);
  for (const panel of sloped.floorPanels) {
    const [a, b, c, d] = panel.corners,
      f = facadeFrame(frontages[panel.section].a, frontages[panel.section].b),
      exterior = sampler(
        a[0] + f.outward[0] * 0.045,
        a[2] + f.outward[1] * 0.045,
      );
    assert.ok(Math.abs(a[1] - exterior - floorOffset) < 1e-7);
    const x = (a[0] + b[0] + c[0] + d[0]) / 4,
      z = (a[2] + b[2] + c[2] + d[2]) / 4;
    assert.ok(Number.isFinite(sloped.floorAt(x, z)));
  }
  assert.ok(
    Math.max(...sloped.floorPanels.flatMap((p) => p.corners.map((v) => v[1]))) -
      Math.min(
        ...sloped.floorPanels.flatMap((p) => p.corners.map((v) => v[1])),
      ) >
      1.5,
  );
});

test("planar roof and straight frame members fit the apron reference without moving upper room rows", () => {
  assert.equal(roofRise, 6.43);
  assert.ok(Math.abs(rowAnchor - 13.894736842105264) < 1e-10);
  const roof = meshes.find((mesh) => mesh.material === materials.canopyGlass)!,
    position = roof.geometry.getAttribute("position");
  let low = Infinity,
    high = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      z = position.getZ(i),
      y = position.getY(i);
    assert.ok(Math.abs(y - (site.canopyTopAt(x, z) - 0.06)) < 0.00002);
    low = Math.min(low, y);
    high = Math.max(high, y);
  }
  assert.ok(
    high - low < 1 && Math.abs(site.canopyPlane.slope) < 0.02,
    "roof retains the fitted near-level shared-ground section",
  );
  assert.ok(
    high + 0.06 < rowAnchor + 0.32,
    "source-height fascia stays below the retained first room glazing",
  );
  for (const [x, z] of [
    [475.137, -466.193],
    [473.217, -480.127],
    [475.123, -456.291],
  ]) {
    const sheet = ray(new T.Vector3(x, 20, z), new T.Vector3(x, 0, z)).filter(
      (hit) => (hit.object as T.Mesh).material === materials.canopyGlass,
    );
    assert.equal(sheet.length, 1);
    assert.ok(
      Math.abs(sheet[0].point.y - (site.canopyTopAt(x, z) - 0.06)) < 0.01,
      "triangulated glass lies on one plane between source vertices",
    );
  }
  const metal = meshes.find((mesh) => mesh.material === materials.metal)!,
    p = metal.geometry.getAttribute("position");
  let frameSamples = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      y = p.getY(i);
    if (
      pointInPoly(x, z, ring.flat()) ||
      y > 15 ||
      ring.some(
        (a, j) =>
          segmentPoint(x, z, ...a, ...ring[(j + 1) % ring.length]).d < 0.1,
      )
    )
      continue;
    const offset = y - site.canopyTopAt(x, z);
    assert.ok(
      Math.min(
        ...[-0.64, -0.52, -0.48, -0.12, -0.07, 0].map((layer) =>
          Math.abs(offset - layer),
        ),
      ) < 0.005,
      "all spanning frame corners must stay on their parallel roof planes, not drape through intermediate heights",
    );
    frameSamples++;
  }
  assert.ok(frameSamples > 400);
  const tower = parts[0].ring;
  for (const index of [12, 13]) {
    const f = facadeFrame(tower[index], tower[(index + 1) % tower.length]),
      columns = Math.max(1, Math.round(f.length / 3.8)),
      u = (f.length / columns) * 0.27;
    const upper = ray(
      new T.Vector3(...f.p(u, rowAnchor + 1, -0.5)),
      new T.Vector3(...f.p(u, rowAnchor + 1, 0.6)),
    );
    assert.equal((upper[0].object as T.Mesh).material, materials.glass);
    assert.ok(
      Math.abs(upper[0].distance - 0.82) < 0.003,
      "first retained room still has its original 0.32 m inset",
    );
  }
});

test("pier caps follow the sloped soffit rather than floating under a level cylinder cap", () => {
  for (const pier of piers)
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const x = pier.point[0] + Math.cos(angle) * pier.radius * 0.65,
        z = pier.point[1] + Math.sin(angle) * pier.radius * 0.65,
        ceiling = site.ceilingAt(x, z)!;
      const hit = ray(
        new T.Vector3(x, ceiling + 0.3, z),
        new T.Vector3(x, ceiling - 0.3, z),
      )[0];
      assert.equal((hit.object as T.Mesh).material, materials.panel);
      assert.ok(
        Math.abs(hit.point.y - ceiling - 0.12) < 0.012,
        "column top remains embedded 120 mm into its actual local soffit",
      );
    }
});

test("roof fit is one plane with an unchanged mean source rise and no vertex clamps", () => {
  const { origin, axis, height, slope, samples, rmsError } = site.canopyPlane;
  assert.ok(samples.length > 100);
  let meanResidual = 0,
    stationResidual = 0,
    meanGround = 0;
  for (const sample of samples) {
    const [x, z] = sample.point,
      station = (x - origin[0]) * axis[0] + (z - origin[1]) * axis[1],
      fitted = site.canopyTopAt(x, z),
      residual = fitted - sample.referenceTop;
    assert.ok(Math.abs(fitted - (height + slope * station)) < 1e-10);
    meanResidual += residual;
    stationResidual += station * residual;
    meanGround += sample.referenceTop - roofRise;
  }
  assert.ok(Math.abs(meanResidual / samples.length) < 1e-10);
  assert.ok(
    Math.abs(stationResidual / samples.length) < 1e-10,
    "least-squares residual is orthogonal to the source long axis",
  );
  assert.ok(Math.abs(height - meanGround / samples.length - 6.43) < 1e-10);
  assert.ok(
    rmsError < 0.2,
    "the structural fit should remain close to the surveyed-height reference field",
  );
  const roof = meshes.find(
      (mesh) => mesh.material === materials.canopyGlass,
    )!.geometry,
    position = roof.getAttribute("position"),
    normal = roof.getAttribute("normal"),
    expectedNormal = new T.Vector3(
      -slope * axis[0],
      1,
      -slope * axis[1],
    ).normalize();
  for (let i = 0; i < position.count; i++) {
    assert.ok(
      Math.abs(
        position.getY(i) +
          0.06 -
          site.canopyTopAt(position.getX(i), position.getZ(i)),
      ) < 0.00002,
    );
    assert.ok(
      new T.Vector3().fromBufferAttribute(normal, i).dot(expectedNormal) >
        0.9999999,
      "all glass triangles have the same plane normal",
    );
  }
  for (const section of site.sections)
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const f = facadeFrame(section.a, section.b),
        front = f.p(t * f.length, 0),
        back = section.back(t, 0);
      assert.ok(
        Math.abs(
          section.ceilingAt(t) - (site.canopyTopAt(front[0], front[2]) - 0.64),
        ) < 1e-10,
      );
      assert.ok(
        Math.abs(
          section.ceilingAt(t, true) -
            (site.canopyTopAt(back[0], back[2]) - 0.64),
        ) < 1e-10,
      );
    }
});

test("fixed lobby glazing reveals pale lower lining, a deeper grey wall and a darker upper recess", () => {
  const section = site.sections[1],
    f = facadeFrame(section.a, section.b),
    t = 0.18,
    u = t * f.length,
    floor = section.heightAt(t),
    ceiling = section.ceilingAt(t, true);
  const zones = [
    {
      height: floor + 0.35,
      inset: cavity.lowerDepth,
      material: materials.lobbyLining,
    },
    {
      height: floor + 1.75,
      inset: cavity.wallDepth + cavity.bayExtraDepth,
      material: materials.lobbyRear,
    },
    {
      height: ceiling - 0.28,
      inset: cavity.upperDepth,
      material: materials.dark,
    },
  ];
  for (const zone of zones) {
    const hits = ray(
      new T.Vector3(...f.p(u, zone.height, -0.5)),
      new T.Vector3(
        ...f.p(
          u,
          zone.height,
          depth + cavity.wallDepth + cavity.bayExtraDepth + 0.15,
        ),
      ),
    );
    assert.equal((hits[0].object as T.Mesh).material, materials.lobbyGlass);
    const opaque = hits.find(
      (h) => (h.object as T.Mesh).material !== materials.lobbyGlass,
    )!;
    assert.equal((opaque.object as T.Mesh).material, zone.material);
    assert.ok(
      Math.abs(opaque.distance - (0.5 + depth + zone.inset)) < 0.003,
      "separate closed planes create visible parallax behind the existing glass",
    );
  }
});

test("visual cavity is closed above, below, behind and at its ends while collision stays at the glass", () => {
  const section = site.sections[1],
    f = facadeFrame(section.a, section.b),
    t = 0.18,
    floor = section.heightAt(t),
    ceiling = section.ceilingAt(t, true),
    xz = section.back(t, 0);
  xz[0] -= f.outward[0] * 0.85;
  xz[2] -= f.outward[1] * 0.85;
  const down = ray(
    new T.Vector3(xz[0], floor + 0.4, xz[2]),
    new T.Vector3(xz[0], floor - 0.1, xz[2]),
  );
  assert.ok(
    down.some(
      (h) =>
        Math.abs(h.point.y - floor) < 0.01 &&
        (h.object as T.Mesh).material === materials.roof,
    ),
  );
  const up = ray(
    new T.Vector3(xz[0], ceiling - 0.3, xz[2]),
    new T.Vector3(xz[0], ceiling + 0.1, xz[2]),
  );
  assert.ok(
    up.some(
      (h) =>
        Math.abs(h.point.y - ceiling) < 0.015 &&
        (h.object as T.Mesh).material === materials.lobbyLining,
    ),
  );
  const division = ray(
    new T.Vector3(xz[0], cavity.divisionTop - 0.15, xz[2]),
    new T.Vector3(xz[0], cavity.divisionTop + 0.05, xz[2]),
  );
  if (
    floor < cavity.divisionTop - cavity.divisionThickness &&
    ceiling > cavity.divisionTop
  )
    assert.ok(
      division.some(
        (h) =>
          Math.abs(
            h.point.y - (cavity.divisionTop - cavity.divisionThickness),
          ) < 0.001 && (h.object as T.Mesh).material === materials.lobbyLining,
      ),
    );
  for (const [s, end] of [
    [site.sections[0], 0],
    [site.sections.at(-1)!, 1],
  ] as const) {
    const ff = facadeFrame(s.a, s.b),
      inside = end ? 0.98 : 0.02,
      y = s.heightAt(inside) + 1.6,
      from = s.back(inside, y),
      to = s.back(end === 0 ? -0.04 : 1.04, y);
    for (const p of [from, to]) {
      p[0] -= ff.outward[0] * 0.3;
      p[2] -= ff.outward[1] * 0.3;
    }
    const hits = ray(new T.Vector3(...from), new T.Vector3(...to));
    assert.ok(
      hits.some((h) => (h.object as T.Mesh).material === materials.lobbyLining),
      "terminal return closes oblique views",
    );
  }
  const behind = f.p(t * f.length, floor, depth + 0.35);
  assert.equal(
    collision.blocked(behind[0], behind[2], 0.2, datum + floor + 0.15),
    true,
    "visual scenery does not open the hotel interior",
  );
});

test("new cavity lining stays within source footprint and behind glazing without extra textures or emission", () => {
  const lining = meshes.filter(
    (mesh) =>
      mesh.material === materials.lobbyLining ||
      mesh.material === materials.lobbyRear,
  );
  assert.equal(lining.length, 2);
  for (const mesh of lining) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      assert.ok(
        pointInPoly(x, z, ring.flat()),
        "lining stays inside original building",
      );
      const distances = site.sections
        .map((section) => {
          const q = segmentPoint(x, z, ...section.backA, ...section.backB),
            f = facadeFrame(section.a, section.b);
          return {
            distance: q.d,
            depth: -(x - q.x) * f.outward[0] - (z - q.z) * f.outward[1],
          };
        })
        .sort((a, b) => a.distance - b.distance);
      assert.ok(
        distances[0].depth >= -0.00005,
        "no new lining in front of fixed glazing",
      );
    }
  }
  assert.equal(materials.lobbyRear.map, null);
  assert.equal(materials.lobbyRear.normalMap, null);
  assert.equal(materials.lobbyRear.emissive.getHex(), 0);
  assert.equal(materials.lobbyRear.metalness, 0);
  assert.ok(
    materials.lobbyRear.color.r < materials.lobbyLining.color.r * 0.35 &&
      materials.lobbyRear.color.g < materials.lobbyLining.color.g * 0.35,
    "rear fields stay substantially darker than structural lining",
  );
  assert.equal(materials.lobbyLining.map, null);
  assert.equal(materials.lobbyLining.normalMap, null);
  assert.equal(materials.lobbyLining.emissive.getHex(), 0);
  assert.equal(materials.lobbyLining.metalness, 0);
  assert.ok(materials.lobbyLining.roughness > 0.8);
});

test("retained horizontal cap stays lined whenever the cavity actually crosses its level", () => {
  // The near-level runtime canopy is now below the local 8m division. Keep
  // coverage of the conditional closure with an explicit section crossing it.
  const callback = () => 3,
    local = createFairmontArcadeSite(callback),
    group = new T.Group(),
    builder = new Batcher(group);
  buildFairmontWaterfront(
    builder,
    { id: ID, pts: ring.flat() },
    materials,
    callback,
  );
  const built = builder.finish(),
    section = local.sections[1],
    f = facadeFrame(section.a, section.b),
    t = 0.18,
    p = section.back(t, cavity.divisionTop - 0.15);
  p[0] -= f.outward[0] * 0.85;
  p[2] -= f.outward[1] * 0.85;
  assert.ok(
    section.heightAt(t) < cavity.divisionTop - cavity.divisionThickness,
  );
  assert.ok(section.ceilingAt(t, true) > cavity.divisionTop);
  group.updateMatrixWorld(true);
  const hits = new T.Raycaster(
    new T.Vector3(...p),
    new T.Vector3(0, 1, 0),
    0,
    0.2,
  ).intersectObject(group, true);
  assert.ok(
    hits.some(
      (hit) =>
        Math.abs(hit.point.y - cavity.divisionTop + cavity.divisionThickness) <
          0.001 && (hit.object as T.Mesh).material === materials.lobbyLining,
    ),
  );
  built.forEach((mesh) => mesh.geometry.dispose());
});

test("broad structural-bay centres have closed extra recesses without changing front glazing", () => {
  const section = site.sections[1],
    f = facadeFrame(section.a, section.b),
    stations = site.piers
      .filter((p) => p.edge === section.edge)
      .map((p) => p.along)
      .sort((a, b) => a - b),
    start = stations[0],
    end = stations[1],
    span = end - start,
    centre = (start + end) / (2 * section.length),
    shoulder = (start + 0.7) / section.length;
  const at = (t: number, y: number, inset: number) => {
    const p = section.back(t, y);
    return new T.Vector3(
      p[0] - f.outward[0] * inset,
      y,
      p[2] - f.outward[1] * inset,
    );
  };
  for (const [t, inset] of [
    [centre, cavity.wallDepth + cavity.bayExtraDepth],
    [shoulder, cavity.wallDepth],
  ]) {
    const y = section.heightAt(t) + 1.8,
      hits = ray(
        at(t, y, -0.2),
        at(t, y, cavity.wallDepth + cavity.bayExtraDepth + 0.15),
      );
    assert.equal((hits[0].object as T.Mesh).material, materials.lobbyGlass);
    const wall = hits.find(
      (h) => (h.object as T.Mesh).material !== materials.lobbyGlass,
    )!;
    assert.equal((wall.object as T.Mesh).material, materials.lobbyRear);
    assert.ok(Math.abs(wall.distance - inset - 0.2) < 0.003);
  }
  for (const [along, direction] of [
    [start + span * 0.25, 1],
    [end - span * 0.25, -1],
  ]) {
    const t = along / section.length,
      y = section.heightAt(t) + 1.8,
      hits = ray(
        at(t + direction * 0.015, y, cavity.wallDepth + 0.25),
        at(t - direction * 0.015, y, cavity.wallDepth + 0.25),
      );
    assert.ok(
      hits.some((h) => (h.object as T.Mesh).material === materials.lobbyLining),
      "side return closes each deeper centre",
    );
  }
  const low = section.heightAt(centre) + cavity.lowerBand,
    high = section.ceilingAt(centre, true) - cavity.upperBand;
  for (const [from, to] of [
    [low + 0.2, low - 0.2],
    [high - 0.2, high + 0.2],
  ]) {
    const hits = ray(
      at(centre, from, cavity.wallDepth + 0.25),
      at(centre, to, cavity.wallDepth + 0.25),
    );
    assert.ok(
      hits.some((h) => (h.object as T.Mesh).material === materials.lobbyLining),
      "deeper centre has a floor and upper return",
    );
  }
});
