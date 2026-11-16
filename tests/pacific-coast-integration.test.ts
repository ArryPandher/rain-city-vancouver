import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, centroid, pairs, type CityData } from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";
import { Batcher } from "../src/world/geometry";
import { pacificCoast } from "../src/world/pacific-coast-building";
import {
  PACIFIC_COAST_ENTRANCE_THRESHOLDS,
  PACIFIC_COAST_SECTION,
  pacificCoastBays,
} from "../src/world/pacific-coast-site";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";

const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
);
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
const convert = (pts: number[]) => pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const b of data.buildings) b.pts = convert(b.pts);
for (const a of data.areas) {
  a.pts = convert(a.pts);
  a.holes = a.holes?.map(convert);
}
data.ocean = data.ocean.map(convert);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const building = data.buildings.find((b) => b.id === "w143683962")!;
const collision = new CollisionWorld(data);
const datum = collision.groundHeight(...centroid(building.pts));
const root = new T.Group();
const batch = new Batcher(root);
batch.offsetY = datum;
const reflections: ReflectionProbeSpec[] = [];
const library = { texture: () => new T.Texture<HTMLImageElement>() };
assert.equal(
  pacificCoast(
    building,
    batch,
    library,
    reflections,
    collision.groundHeight.bind(collision),
    collision.pacificApron,
  ),
  true,
);
batch.finish();
root.updateMatrixWorld(true);

test("325 Howe base meets the real shared street along both sloping public faces", () => {
  const ring = pairs(building.pts);
  for (const edge of [0, 1]) {
    const frame = facadeFrame(ring[edge], ring[edge + 1]);
    for (const fraction of [0.08, 0.23, 0.43, 0.63, 0.83, 0.94]) {
      const a = frame.p(frame.length * fraction, 0, -1);
      const y = collision.groundHeight(a[0], a[2]) + 0.05;
      const b = frame.p(frame.length * fraction, y, 0.8);
      const start = new T.Vector3(a[0], y, a[2]);
      const direction = new T.Vector3(...b).sub(start);
      const hits = new T.Raycaster(
        start,
        direction.clone().normalize(),
        0,
        direction.length(),
      ).intersectObject(root, true);
      assert.ok(
        hits.length,
        `exposed foundation gap at edge ${edge}, ${fraction}`,
      );
      assert.match(
        ((hits[0].object as T.Mesh).material as T.Material).name,
        /granite|ashlar|stone/i,
      );
      // The previous 1m sample is now on the source-grounded Howe apron rail.
      // Check the retained outer through-route instead of requiring that new
      // physical railing to remain non-colliding.
      const sidewalk = frame.p(
        frame.length * fraction,
        0,
        edge === 0 ? -2 : -1.6,
      );
      assert.equal(
        collision.blocked(
          sidewalk[0],
          sidewalk[2],
          0.25,
          collision.walkingHeight(sidewalk[0], sidewalk[2]),
        ),
        false,
        "public through-route remains outside building and railing collision",
      );
    }
  }
  assert.equal(
    collision.blocked(...centroid(building.pts), 0.3, datum + 1),
    true,
  );
});

test("facade captures have separate receivers and clear external origins without affecting neighbours", () => {
  assert.equal(reflections.length, 2);
  const ring = pairs(building.pts);
  for (const [edge, probe] of reflections.entries()) {
    const frame = facadeFrame(ring[edge], ring[edge + 1]);
    assert.equal(probe.resolution, 256);
    assert.ok(probe.position.every(Number.isFinite));
    assert.equal(
      collision.blocked(
        probe.position[0],
        probe.position[2],
        0.1,
        probe.position[1],
      ),
      false,
      "capture cannot sit inside its own or a neighboring building",
    );
    const middle = frame.p(frame.length / 2, datum + 10.8, 0);
    const offset = new T.Vector3(...probe.position).sub(
      new T.Vector3(...middle),
    );
    assert.ok(Math.abs(offset.length() - 1.2) < 1e-7);
    assert.ok(
      offset.dot(new T.Vector3(frame.outward[0], 0, frame.outward[1])) > 1.199,
    );
    assert.equal(probe.materials.length, 1);
    assert.match(probe.materials[0].name, /glazing/);
    assert.match(probe.materials[0].name, edge === 0 ? /Cordova/ : /Howe/);
    assert.equal(probe.materials[0].envMap, null);
  }
  assert.notEqual(reflections[0].materials[0], reflections[1].materials[0]);
  const otherBatch = new Batcher(new T.Group());
  const otherProbes: ReflectionProbeSpec[] = [];
  assert.equal(
    pacificCoast(
      { ...building, id: "w208599553" },
      otherBatch,
      library,
      otherProbes,
    ),
    false,
  );
  assert.equal(otherBatch.groups.size, 0);
  assert.equal(otherProbes.length, 0);
  const source = fs.readFileSync("src/world/architecture.ts", "utf8");
  const dispatch = source.indexOf("pacificCoast(");
  assert.ok(dispatch >= 0 && dispatch < source.indexOf("heritage ="));
});

test("Howe entrance thresholds meet the actual rising sidewalk", () => {
  const ring = pairs(building.pts);
  const frame = facadeFrame(ring[1], ring[2]);
  const bays = pacificCoastBays(1);
  for (const [index, threshold] of Object.entries(
    PACIFIC_COAST_ENTRANCE_THRESHOLDS,
  )) {
    const point = frame.p(bays[Number(index)].centre, 0, -0.3);
    const height =
      datum + threshold - collision.groundHeight(point[0], point[2]);
    assert.ok(
      height > 0.025 && height < 0.055,
      `entrance ${index}: ${height}m step`,
    );
  }
});

test("every street pane belongs only to its own facade receiver and preserves recess depth", () => {
  const ring = pairs(building.pts);
  for (const [edge, probe] of reflections.entries()) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const [index, bay] of pacificCoastBays(edge).entries()) {
      const door = edge === 1 && (index === 2 || index === 3);
      const samples = [
        {
          y:
            (door
              ? PACIFIC_COAST_ENTRANCE_THRESHOLDS[index]
              : edge === 0
                ? 0.3
                : 0.7) + 0.4,
          depth: PACIFIC_COAST_SECTION.baseRecess,
        },
        ...PACIFIC_COAST_SECTION.rows.map((row) => ({
          y: row.sill + 0.38,
          depth: PACIFIC_COAST_SECTION.windowRecess,
        })),
      ];
      for (const { y, depth } of samples) {
        const u = bay.left + (bay.right - bay.left) * 0.28;
        const from = new T.Vector3(...f.p(u, datum + y, -0.5));
        const into = new T.Vector3(-f.outward[0], 0, -f.outward[1]);
        const hit = new T.Raycaster(from, into, 0, 1.2).intersectObject(
          root,
          true,
        )[0];
        assert.ok(hit);
        assert.equal((hit.object as T.Mesh).material, probe.materials[0]);
        assert.ok(Math.abs(hit.distance - (0.5 + depth - 0.018)) < 0.0002);
      }
    }
    let panes = 0;
    root.traverse((object) => {
      if (!(object instanceof T.Mesh) || object.material !== probe.materials[0])
        return;
      const p = object.geometry.getAttribute("position");
      const n = object.geometry.getAttribute("normal");
      const normal = new T.Vector3(f.outward[0], 0, f.outward[1]);
      for (let i = 0; i < p.count; i++) {
        const world = new T.Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld);
        const distance =
          (world.x - ring[edge][0]) * f.outward[0] +
          (world.z - ring[edge][1]) * f.outward[1];
        assert.ok(
          Math.abs(distance + PACIFIC_COAST_SECTION.baseRecess - 0.018) <
            0.0002 ||
            Math.abs(distance + PACIFIC_COAST_SECTION.windowRecess - 0.018) <
              0.0002,
          "receiver geometry stays on its own facade's two original glazing planes",
        );
        assert.ok(
          new T.Vector3().fromBufferAttribute(n, i).dot(normal) > 0.9999,
        );
      }
      panes += (object.geometry.index?.count ?? p.count) / 6;
    });
    assert.equal(panes, pacificCoastBays(edge).length * 7);
  }
});

test("both receivers retain the same dielectric shader and independent environment ownership", () => {
  const materials = reflections.map(
    (probe) => probe.materials[0] as T.MeshPhysicalMaterial,
  );
  const shaders = materials.map((material) => {
    const shader = {
      uniforms: {},
      vertexShader: "",
      fragmentShader: "#include <common>\n#include <opaque_fragment>",
    };
    material.onBeforeCompile(shader as never, {} as T.WebGLRenderer);
    assert.equal(material.ior, 2.3);
    assert.equal(material.roughness, 0.045);
    assert.equal(material.metalness, 0);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.blending, T.CustomBlending);
    assert.equal(material.blendSrc, T.OneFactor);
    assert.equal(material.blendDst, T.OneMinusSrcAlphaFactor);
    assert.equal(material.userData.castShadow, false);
    assert.deepEqual(shader.uniforms, { lobbyThroughput: { value: 0.8 } });
    assert.match(shader.fragmentShader, /totalSpecular\*lobbyReflectionGain/);
    return shader;
  });
  assert.equal(shaders[0].fragmentShader, shaders[1].fragmentShader);
  assert.equal(
    materials[0].customProgramCacheKey(),
    materials[1].customProgramCacheKey(),
  );
  const cube = new T.CubeTexture();
  materials[0].envMap = cube;
  assert.equal(
    materials[1].envMap,
    null,
    "one capture cannot overwrite the other facade",
  );
  materials[0].envMap = null;
  cube.dispose();
});
