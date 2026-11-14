import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Terrain } from "../src/world/terrain";
import { terrainMeshes, terrainCutWall } from "../src/world/terrain-mesh";
import { ForestHabitat, PROSPECT_RIM } from "../src/world/forest-habitat";
import {
  pointInPoly,
  segmentPoint,
  KX,
  roadWidth,
  ORIGIN,
  type CityData,
  type Building,
} from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
import { buildSeawall } from "../src/world/seawall";
import {
  prospectLighthouse,
  PROSPECT_LIGHT_ID,
  prospectLightFrame,
} from "../src/world/prospect-lighthouse";
import { Batcher, subdividePath } from "../src/world/geometry";
import type { Materials } from "../src/world/materials";
import { coastalCoverMask } from "../src/world/coastal-cover";
import { PROSPECT_FORECOURT } from "../src/world/prospect-site";
import {
  addProspectGeology,
  PROSPECT_DETAIL,
  coastalGrowth,
} from "../src/world/prospect-geology";
import {
  buildProspectBank,
  coastalPlantSites,
  PROSPECT_PLANTING,
} from "../src/world/prospect-bank";
function materials() {
  return {
    texture: () => new T.Texture(),
    pbr: () => new T.MeshStandardMaterial(),
    concrete: new T.MeshStandardMaterial(),
    asphalt: new T.MeshStandardMaterial(),
    beacons: [],
  } as unknown as Materials;
}
function data() {
  const d = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540,
    cv = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  d.buildings.forEach((b) => (b.pts = cv(b.pts)));
  d.areas.forEach((a) => {
    a.pts = cv(a.pts);
    a.holes = a.holes?.map(cv);
  });
  d.ocean = d.ocean.map(cv);
  d.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  d.seawall = JSON.parse(
    fs.readFileSync("public/data/stanley-seawall.json", "utf8"),
  );
  const bytes = fs.readFileSync("public/data/stanley-height.u16");
  d.terrain = new Terrain(
    JSON.parse(fs.readFileSync("public/data/stanley-terrain.json", "utf8")),
    new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  );
  addProspectGeology(d, new CollisionWorld(d));
  return d;
}
test("shoreline clipping preserves land area, slope and upward faces without filling mapped water", () => {
  const t = new Terrain(
    {
      version: 1,
      sourceYear: 2002,
      minX: 0,
      minZ: 0,
      step: 4,
      columns: 3,
      rows: 3,
      scale: 1,
      binary: "",
      lakes: [],
    },
    new Uint16Array([10, 18, 26, 14, 22, 30, 18, 26, 34]),
  );
  const water = [3, -10, 20, -10, 20, 20, 3, 20],
    meshes = terrainMeshes(t, [], new T.MeshStandardMaterial(), [water]);
  let area = 0,
    count = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      idx = mesh.geometry.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, idx.getX(i)),
        b = new T.Vector3().fromBufferAttribute(p, idx.getX(i + 1)),
        c = new T.Vector3().fromBufferAttribute(p, idx.getX(i + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(n.y > 0);
      area += n.y / 2;
      count++;
      for (const v of [a, b, c]) {
        assert.ok(v.x <= 3.00001);
        assert.ok(Math.abs(v.y + 0.012 - t.height(v.x, v.z)) < 1e-5);
      }
    }
  }
  assert.ok(count > 2);
  assert.ok(Math.abs(area - 24) < 1e-5);
});
test("mapped seawall adds finite masonry, keeps named route centres clear, and blocks its low edge", () => {
  const d = data(),
    c = new CollisionWorld(d),
    root = new T.Group(),
    m = materials();
  const samples = d.roads
    .filter((r) => /^Stanley Park Seawall/.test(r.name ?? ""))
    .flatMap((r) =>
      subdividePath(r.pts, 1).reduce<[number, number][]>((a, x, i, points) => {
        if (i % 2 === 0) a.push([x, points[i + 1]]);
        return a;
      }, []),
    )
    .filter(
      ([x, z]) =>
        !c.blocked(x, z, 0.36, c.groundHeight(x, z)) &&
        !c.water(x, z, c.groundHeight(x, z)),
    );
  const meshes = buildSeawall(root, d, m, c);
  assert.ok(
    meshes.length > 15 && meshes.length < 150,
    `spatial chunks: ${meshes.length}`,
  );
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
  }
  const blocked = samples.filter(([x, z]) =>
    c.blocked(x, z, 0.36, c.groundHeight(x, z)),
  );
  assert.deepEqual(
    blocked,
    [],
    "stone and rails must not close the mapped walking/cycling centreline",
  );
  assert.equal(c.blocked(-1548.3, -3431.6, 0.3, 2), true);
  assert.equal(
    c.blocked(-1548.3, -3431.6, 0.3, 5),
    false,
    "jumping above a low cap is allowed",
  );
});
test("Prospect lighthouse follows its footprint and has the mapped red beacon focal elevation", () => {
  const d = data(),
    b = d.buildings.find((b) => b.id === PROSPECT_LIGHT_ID)!,
    c = new CollisionWorld(d),
    root = new T.Group(),
    batch = new Batcher(root),
    m = materials();
  assert.ok(b);
  batch.offsetY = c.groundHeight(-1554.7, -3427.5);
  assert.equal(prospectLighthouse(b, batch, m), true);
  assert.equal(prospectLighthouse({ ...b, id: "other" }, batch, m), false);
  const meshes = batch.finish();
  assert.ok(
    meshes.some((mesh) =>
      (mesh.material as T.Material).name.includes("red band"),
    ),
  );
  root.updateMatrixWorld(true);
  const frame = prospectLightFrame(b),
    rayStart = new T.Vector3(0.3, 1.4, 5).applyMatrix4(frame),
    direction = new T.Vector3(0, 0, -1).transformDirection(frame);
  rayStart.y += batch.offsetY;
  const hit = new T.Raycaster(rayStart, direction).intersectObjects(meshes)[0];
  assert.ok(hit, "front door must be visible from the approach");
  const local = hit.point
    .clone()
    .sub(new T.Vector3(0, batch.offsetY, 0))
    .applyMatrix4(frame.clone().invert());
  const facadeZ = new T.Vector3(b.pts[0], 0, b.pts[1]).applyMatrix4(
    frame.clone().invert(),
  ).z;
  assert.ok(
    local.z > facadeZ + 0.05,
    "door must project beyond the mapped wall, not be buried inside it",
  );
  const wallStart = new T.Vector3(0.85, 0.9, 5).applyMatrix4(frame);
  wallStart.y += batch.offsetY;
  const wallHit = new T.Raycaster(wallStart, direction).intersectObjects(
    meshes,
  )[0];
  assert.ok(wallHit, "near exterior wall must face outwards");
  const wallLocal = wallHit.point.clone().applyMatrix4(frame.clone().invert());
  assert.ok(
    Math.abs(wallLocal.z - facadeZ) < 0.01,
    "visible wall must be the near façade, not the inside of the far wall",
  );
  assert.equal(m.beacons.length, 1);
  assert.ok(Math.abs(m.beacons[0].light.position.y - 11.5) < 0.001);
  assert.equal(m.beacons[0].period, 2);
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      assert.ok([x, y, z].every(Number.isFinite));
      assert.ok(y < 14.2);
      if (y > batch.offsetY + 2.4 || pointInPoly(x, z, b.pts)) continue;
      let distance = Infinity;
      for (let j = 0; j < b.pts.length; j += 2) {
        const k = (j + 2) % b.pts.length;
        distance = Math.min(
          distance,
          segmentPoint(x, z, b.pts[j], b.pts[j + 1], b.pts[k], b.pts[k + 1]).d,
        );
      }
      assert.ok(distance < 0.32, "ground decorations must not occupy the path");
    }
  }
});

test("Prospect bank and planting preserve mapped route clearance and follow steep ground", () => {
  const d = data(),
    c = new CollisionWorld(d),
    root = new T.Group(),
    m = materials();
  const path = d.roads
    .filter((r) => /^Stanley Park Seawall/.test(r.name ?? ""))
    .flatMap((r) => {
      const p = subdividePath(r.pts, 1);
      return p.flatMap((x, i) => (i % 2 ? [] : [[x, p[i + 1]]]));
    })
    .filter(
      ([x, z]) =>
        Math.hypot(x + 1554.7, z + 3427.5) < 140 &&
        !c.blocked(x, z, 0.45, c.groundHeight(x, z)) &&
        !c.water(x, z, c.groundHeight(x, z)),
    );
  buildSeawall(root, d, m, c);
  buildProspectBank(root, d, m, c);
  assert.deepEqual(
    path.filter(([x, z]) => c.blocked(x, z, 0.45, c.groundHeight(x, z))),
    [],
    "retaining edges must leave bike/walk centres clear",
  );
  const sites = coastalPlantSites(d, c);
  assert.ok(
    sites.length > 500 && sites.length < 12000,
    `plant sites: ${sites.length}`,
  );
  assert.ok(
    sites.some((s) => s.normal[1] < 0.75),
    "vegetation must include sloping cliff ground",
  );
  for (const s of sites) {
    assert.ok(
      [s.x, s.y, s.z, s.height, s.angle, ...s.normal].every(Number.isFinite),
    );
    assert.ok(pointInPoly(s.x, s.z, PROSPECT_PLANTING));
    assert.ok(Math.abs(s.y + 0.06 - c.groundHeight(s.x, s.z)) < 1e-5);
    assert.equal(c.water(s.x, s.z, s.y), false);
    for (const r of c.roads.query(s.x, s.z, 26))
      for (let j = 0; j < r.pts.length - 2; j += 2)
        assert.ok(
          segmentPoint(
            s.x,
            s.z,
            r.pts[j],
            r.pts[j + 1],
            r.pts[j + 2],
            r.pts[j + 3],
          ).d >=
            roadWidth(r) / 2 + s.height * 1.3 + 0.1 - 1e-5,
          "complete plant envelope must stay outside route width",
        );
  }
});

test("coastal leaf cover excludes water, buildings and the entire mapped route width", () => {
  const d = data(),
    c = new CollisionWorld(d),
    mask = coastalCoverMask(d, c);
  const pixels = mask.texture.image.data;
  assert.ok(pixels);
  let covered = 0,
    steep = 0;
  for (let iz = 0; iz < mask.height; iz++)
    for (let ix = 0; ix < mask.width; ix++) {
      if (!pixels[(iz * mask.width + ix) * 4]) continue;
      const x = mask.minX + ix + 0.5,
        z = mask.minZ + iz + 0.5,
        y = c.groundHeight(x, z);
      covered++;
      if (
        Math.abs(c.groundHeight(x + 0.5, z) - c.groundHeight(x - 0.5, z)) > 0.7
      )
        steep++;
      assert.ok(pointInPoly(x, z, PROSPECT_PLANTING));
      assert.equal(c.water(x, z, y), false);
      assert.equal(c.blocked(x, z, 0.2, y), false);
      for (const road of c.roads.query(x, z, 26))
        for (let j = 0; j < road.pts.length - 2; j += 2)
          assert.ok(
            segmentPoint(
              x,
              z,
              ...(road.pts.slice(j, j + 4) as [number, number, number, number]),
            ).d >
              roadWidth(road) / 2 + 0.75,
          );
    }
  assert.ok(
    covered > 5000 && covered < (mask.width * mask.height) / 2,
    `covered square metres: ${covered}`,
  );
  assert.ok(steep > 500, `steep square metres: ${steep}`);
  mask.texture.dispose();
});

test("Prospect forecourt has level paving above the shared walking elevation", () => {
  const d = data(),
    c = new CollisionWorld(d),
    root = new T.Group(),
    m = materials();
  const meshes = buildProspectBank(root, d, m, c);
  root.updateMatrixWorld(true);
  let checked = 0;
  for (let x = -1581; x < -1541; x += 0.75)
    for (let z = -3435; z < -3415; z += 0.75) {
      if (!pointInPoly(x, z, PROSPECT_FORECOURT) || c.blocked(x, z, 0.4, 2))
        continue;
      assert.equal(c.groundHeight(x, z), 2);
      const hit = new T.Raycaster(
        new T.Vector3(x, 2.2, z),
        new T.Vector3(0, -1, 0),
        0,
        0.3,
      ).intersectObjects(meshes)[0];
      assert.ok(hit, `missing forecourt surface at ${x},${z}`);
      assert.ok(
        Math.abs(hit.point.y - 2.085) < 0.001,
        `uneven paving at ${x},${z}: ${hit.point.y}`,
      );
      checked++;
    }
  assert.ok(checked > 200);
});

test("coastal cluster geometry fits its slope-independent route clearance envelope", async () => {
  const { NodeIO } = await import("@gltf-transform/core"),
    { ALL_EXTENSIONS } = await import("@gltf-transform/extensions"),
    { getBounds } = await import("@gltf-transform/functions");
  const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read("public/models/forest/coastal-broadleaf.glb"),
    root = doc.getRoot(),
    bounds = getBounds(root.listScenes()[0]),
    height = bounds.max[1] - bounds.min[1],
    centreX = (bounds.max[0] + bounds.min[0]) / 2,
    centreZ = (bounds.max[2] + bounds.min[2]) / 2;
  let maxRadius = 0;
  for (const mesh of root.listMeshes())
    for (const primitive of mesh.listPrimitives()) {
      const p = primitive.getAttribute("POSITION")!,
        point: number[] = [];
      assert.ok(
        primitive.getMaterial()?.getBaseColorTexture(),
        "licensed leaf atlas must remain attached",
      );
      for (let i = 0; i < p.getCount(); i++) {
        p.getElement(i, point);
        maxRadius = Math.max(
          maxRadius,
          Math.hypot(
            point[0] - centreX,
            point[1] - bounds.min[1],
            point[2] - centreZ,
          ) / height,
        );
      }
    }
  assert.ok(
    maxRadius > 1 && maxRadius + 0.018 < 1.3,
    `radius including wind: ${maxRadius + 0.018}`,
  );
});

test("local cliff relief keeps the contour boundary and mapped walking grades", () => {
  const d = data(),
    t = d.terrain!,
    c = new CollisionWorld(d),
    b = PROSPECT_DETAIL;
  assert.equal(t.details.length, 1);
  addProspectGeology(d, c);
  assert.equal(t.details.length, 1, "rebuilding must not stack detail grids");
  const patch = t.details[0];
  assert.equal(patch.meta.step, 1);
  let changed = 0;
  for (let x = b.minX; x <= b.maxX; x++)
    for (let z = b.minZ; z <= b.maxZ; z++) {
      const delta = Math.abs(t.height(x, z) - t.baseHeight(x, z));
      assert.ok(delta < 1.455, `bounded relief at ${x},${z}: ${delta}`);
      if (delta > 0.05) changed++;
      if (x === b.minX || x === b.maxX || z === b.minZ || z === b.maxZ)
        assert.ok(
          delta <= 0.00501,
          "detail grid edge must join original contours",
        );
    }
  assert.ok(changed > 3000, `refined cliff samples: ${changed}`);
  for (const p of [
    [-1800, -3400],
    [-1400, -3300],
    [-2024, -2880],
    [-2439, -2464],
  ])
    assert.equal(t.height(p[0], p[1]), t.baseHeight(p[0], p[1]));
  let protectedSamples = 0;
  for (const r of d.roads) {
    const p = subdividePath(r.pts, 1);
    for (let i = 0; i < p.length; i += 2) {
      const x = p[i],
        z = p[i + 1];
      if (!patch.contains(x, z)) continue;
      assert.ok(
        Math.abs(t.height(x, z) - t.baseHeight(x, z)) < 0.0051,
        `route ${r.id} ${x},${z}`,
      );
      protectedSamples++;
    }
  }
  assert.ok(protectedSamples > 200);
});

test("finer terrain replaces coarse cells with one upward collision-matched surface", () => {
  const meta = {
      version: 1,
      sourceYear: 2002,
      minX: 0,
      minZ: 0,
      step: 4,
      columns: 4,
      rows: 4,
      scale: 1,
      binary: "",
      lakes: [],
    },
    t = new Terrain(meta, new Uint16Array(16).fill(5)),
    values = new Uint16Array(25).fill(5);
  values[12] = 7;
  t.details.push(
    new Terrain(
      { ...meta, minX: 4, minZ: 4, step: 1, columns: 5, rows: 5 },
      values,
    ),
  );
  const meshes = terrainMeshes(t, [], new T.MeshStandardMaterial());
  let area = 0,
    detailed = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      idx = mesh.geometry.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, idx.getX(i)),
        b = new T.Vector3().fromBufferAttribute(p, idx.getX(i + 1)),
        c = new T.Vector3().fromBufferAttribute(p, idx.getX(i + 2)),
        n = b.clone().sub(a).cross(c.clone().sub(a)),
        mid = a.clone().add(b).add(c).divideScalar(3);
      assert.ok(n.y > 0);
      assert.ok(Math.abs(mid.y + 0.012 - t.height(mid.x, mid.z)) < 1e-5);
      area += n.y / 2;
      if (mid.x > 4 && mid.x < 8 && mid.z > 4 && mid.z < 8) detailed++;
    }
    mesh.geometry.dispose();
  }
  assert.equal(area, 144, "replacement must neither overlap nor leave a hole");
  assert.equal(detailed, 32);
});

test("exposed high cliffs have rock windows while low banks keep dense growth", () => {
  let rock = 0,
    cliffCover = 0,
    lowCover = 0,
    samples = 0;
  for (let x = -1660; x < -1500; x += 2)
    for (let z = -3420; z < -3300; z += 2) {
      const high = coastalGrowth(x, 30, z, 3),
        low = coastalGrowth(x, 4, z, 3);
      assert.ok(high >= 0 && high <= 1 && low >= 0 && low <= 1);
      if (high < 0.05) rock++;
      cliffCover += high;
      lowCover += low;
      samples++;
    }
  assert.ok(rock / samples > 0.55);
  assert.ok(cliffCover / samples < 0.3);
  assert.ok(lowCover / samples > 0.65);
});

test("level forecourt cuts have rock faces joining every terrain interpolation break", () => {
  const d = data(),
    t = d.terrain!,
    wall = terrainCutWall(
      t,
      PROSPECT_FORECOURT,
      2.06,
      new T.MeshStandardMaterial(),
    ),
    p = wall.geometry.getAttribute("position"),
    normal = wall.geometry.getAttribute("normal");
  assert.ok(p.count > 100);
  let high = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    assert.ok(
      [x, y, z, normal.getX(i), normal.getY(i), normal.getZ(i)].every(
        Number.isFinite,
      ),
    );
    if (y > 2.061) {
      assert.ok(Math.abs(y + 0.012 - t.height(x, z)) < 0.002);
      high++;
    }
  }
  assert.ok(high > 50);
  wall.updateMatrixWorld();
  let checked = 0;
  for (let i = 0; i < PROSPECT_FORECOURT.length; i += 2) {
    const j = (i + 2) % PROSPECT_FORECOURT.length,
      ax = PROSPECT_FORECOURT[i],
      az = PROSPECT_FORECOURT[i + 1],
      bx = PROSPECT_FORECOURT[j],
      bz = PROSPECT_FORECOURT[j + 1];
    for (let k = 1; k < 20; k++) {
      const f = k / 20,
        x = ax + (bx - ax) * f,
        z = az + (bz - az) * f,
        top = t.height(x, z) - 0.012;
      if (top < 2.3) continue;
      const n = new T.Vector3(bz - az, 0, ax - bx).normalize(),
        origin = new T.Vector3(x, (top + 2.06) / 2, z).addScaledVector(n, 0.2),
        hit = new T.Raycaster(origin, n.negate(), 0, 0.4).intersectObject(
          wall,
        )[0];
      assert.ok(hit, `unclosed cut at ${x},${z}`);
      checked++;
    }
  }
  assert.ok(checked > 20);
  wall.geometry.dispose();
});

test("Prospect wooded rim fills the map gap while retaining plaza and trail openings", () => {
  const d = data(),
    c = new CollisionWorld(d),
    habitat = new ForestHabitat(d, c);
  assert.ok(
    habitat.contains(-1618, -3394),
    "reference wooded rim joins forest",
  );
  assert.equal(
    habitat.contains(-1642, -3370),
    false,
    "mapped lookout plaza stays open",
  );
  const trees = habitat
    .trees([])
    .filter((t) => pointInPoly(t.x, t.z, PROSPECT_RIM));
  assert.ok(trees.length >= 5, `rim trees: ${trees.length}`);
  for (const t of trees) {
    assert.ok(habitat.clear(t.x, t.z, 2.4));
    assert.ok(t.height >= 14 && t.height <= 27);
    assert.equal(c.water(t.x, t.z, c.groundHeight(t.x, t.z)), false);
    for (const road of c.roads.query(t.x, t.z, 30))
      for (let j = 0; j < road.pts.length - 2; j += 2)
        assert.ok(
          segmentPoint(
            t.x,
            t.z,
            road.pts[j],
            road.pts[j + 1],
            road.pts[j + 2],
            road.pts[j + 3],
          ).d >=
            roadWidth(road) / 2 + 2.4,
        );
  }
});
