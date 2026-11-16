import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { BRIDGES, bridgeY } from "../src/world/collision";
import {
  IRONWORKERS_ALIGNMENT as A,
  ironworkersPoint,
  ironworkersGradeT,
  ironworkersTAtDistance,
  ironworkersSample,
} from "../src/world/ironworkers-alignment";
import {
  createIronworkersPathBoundary,
  IRONWORKERS_PATH as P,
} from "../src/world/ironworkers-path-boundary";
import {
  createIronworkersLightStandards,
  ironworkersLightPlacements,
  IRONWORKERS_LIGHT_STANDARD as D,
  replacesIronworkersStreetLamp,
} from "../src/world/ironworkers-light-standards";
const bridge = BRIDGES.find((b) => b.id === "ironworkers")!;
const grade = (t: number) => bridgeY(bridge, t, [0, 0]);
const placements = ironworkersLightPlacements(grade);
const group = createIronworkersLightStandards(grade);
group.updateMatrixWorld(true);
const meshes = group.children as T.Mesh<
  T.BufferGeometry,
  T.MeshStandardMaterial
>[];

test("only exact source carriageways replace generic lamps; standards rise with the actual bridge datum", () => {
  const roads = JSON.parse(fs.readFileSync(A.source, "utf8")).roads;
  assert.deepEqual(
    roads
      .filter(replacesIronworkersStreetLamp)
      .map((r: { id: string }) => r.id)
      .sort(),
    [...A.roadIds].sort(),
  );
  assert.equal(
    replacesIronworkersStreetLamp({ id: A.roadIds[0], kind: "cycleway" }),
    false,
  );
  assert.equal(
    replacesIronworkersStreetLamp({ id: "unrelated", kind: "primary" }),
    false,
  );
  assert.equal(placements.length, 56);
  for (const p of placements)
    assert.equal(
      p.base[1],
      grade(ironworkersGradeT(p.base[0], p.base[2])) +
        D.mountingRise -
        D.mountingEmbed,
    );
  const elevated = ironworkersLightPlacements((t) => grade(t) + 7 + t * 2);
  for (let i = 0; i < placements.length; i++) {
    assert.deepEqual(
      [elevated[i].base[0], elevated[i].base[2]],
      [placements[i].base[0], placements[i].base[2]],
    );
    assert.ok(
      Math.abs(
        elevated[i].base[1] -
          placements[i].base[1] -
          7 -
          ironworkersGradeT(
            ...([placements[i].base[0], placements[i].base[2]] as [
              number,
              number,
            ]),
          ) *
            2,
      ) < 1e-10,
    );
  }
  const high = placements.filter((p) => p.station > 600 && p.station < 700);
  assert.ok(
    high.every((p) => p.base[1] > 39),
    "crest pole bases cannot remain at zero ground",
  );
});

test("actual pole bases sit inside existing separator curbs; no road or path top is changed", () => {
  const boundary = createIronworkersPathBoundary(grade, () => 0.07);
  const curbGroup = new T.Group();
  for (const m of boundary.members.filter((m) => m.kind === "curb")) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshBasicMaterial(),
    );
    mesh.applyMatrix4(m.matrix);
    curbGroup.add(mesh);
  }
  curbGroup.updateMatrixWorld(true);
  for (const p of placements) {
    const curb = new T.Raycaster(
      new T.Vector3(p.base[0], p.base[1] + 1, p.base[2]),
      new T.Vector3(0, -1, 0),
      0,
      2,
    ).intersectObject(curbGroup)[0];
    assert.ok(curb);
    assert.ok(p.base[1] <= curb.point.y && curb.point.y - p.base[1] < 0.03);
    const pole = new T.Raycaster(
      new T.Vector3(p.base[0], p.base[1] - 0.1, p.base[2]),
      new T.Vector3(0, 1, 0),
      0,
      1,
    ).intersectObject(group)[0];
    assert.ok(pole);
    assert.ok(Math.abs(pole.point.y - p.base[1]) < 0.00001);
  }
  // Every actual vertex below the mast arm stays within the existing curb footprint.
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const v = new T.Vector3()
        .fromBufferAttribute(pos, i)
        .applyMatrix4(mesh.matrixWorld);
      const y = v.y - grade(ironworkersGradeT(v.x, v.z));
      if (y < 9)
        assert.ok(
          Math.abs(ironworkersSample(v.x, v.z).d - P.curbSide) <
            P.curbWidth / 2 + 0.002,
        );
      else
        assert.ok(y > 9, "arms clear normal vehicle and chase camera envelope");
    }
  }
});

test("normal walking/driving eye and chase camera corridors clear all real fixture geometry", () => {
  let rays = 0;
  for (const p of placements) {
    const t = ironworkersTAtDistance(p.station);
    for (const side of [-16.55, -10.8, -7.2, -3.6, 0, 3.6, 7.2, 10.8, 16.55]) {
      const [x, z] = ironworkersPoint(t, side);
      const y = grade(ironworkersGradeT(x, z));
      // Vertical ordinary person/car camera envelopes, not a claim about unrestricted photo mode.
      const hits = new T.Raycaster(
        new T.Vector3(x, y + 0.15, z),
        new T.Vector3(0, 1, 0),
        0,
        6.5,
      ).intersectObject(group);
      assert.equal(hits.length, 0);
      const rear = ironworkersPoint(
        ironworkersTAtDistance(p.station - 9),
        side,
      );
      const start = new T.Vector3(x, y + 1.7, z),
        end = new T.Vector3(
          rear[0],
          grade(ironworkersGradeT(...rear)) + 4.5,
          rear[1],
        );
      const delta = end.clone().sub(start);
      assert.equal(
        new T.Raycaster(
          start,
          delta.clone().normalize(),
          0,
          delta.length(),
        ).intersectObject(group).length,
        0,
      );
      rays += 2;
    }
  }
  assert.equal(rays, 1008);
});

test("fixtures have bounded localized batches, opaque galvanized finish and no new light/emission", (t) => {
  const stats = group.userData.ironworkersLightStandards;
  assert.equal(stats.draws, 12);
  assert.ok(stats.triangles < 18000);
  const materials = new Set();
  group.traverse((o) => assert.equal(o instanceof T.Light, false));
  for (const mesh of meshes) {
    materials.add(mesh.material);
    assert.equal(mesh.material.transparent, false);
    assert.equal(mesh.material.emissive.getHex(), 0);
    assert.ok(mesh.position.x > 6700 && mesh.position.z < -900);
    assert.ok(mesh.geometry.boundingSphere!.radius < 160);
    assert.equal(mesh.receiveShadow, true);
    assert.equal(mesh.castShadow, mesh.material.name.includes("galvanized"));
  }
  assert.equal(materials.size, 2);
  t.diagnostic(JSON.stringify(stats));
});
