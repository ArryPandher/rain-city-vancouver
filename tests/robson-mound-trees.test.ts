import {
  robsonMoundCirculationHeight,
  robsonMoundCirculationTerrainHeight,
} from "../src/world/robson-mound-circulation";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { KX, ORIGIN, pointInPoly, type CityData } from "../src/world/data";
import { treeProfile, type PublicTreeLayer } from "../src/world/tree-profile";
import { ROBSON_MOUND_OUTLINE } from "../src/world/robson-mound-site";
import {
  ROBSON_MOUND_TREE_SITES,
  isRobsonMoundTree,
  robsonMoundTreeGeometry,
  buildRobsonMoundTrees,
} from "../src/world/robson-mound-trees";
import type { Materials } from "../src/world/materials";

const height = (x: number, z: number) =>
  robsonMoundCirculationHeight(x, z) ??
  robsonMoundCirculationTerrainHeight(x, z) ??
  0;
const profiles = () =>
  ROBSON_MOUND_TREE_SITES.map((s) => treeProfile(s.x, s.z));

test("Robson replacement selects exactly eight mapped broadleaf sites, excluding inventoried street trees", () => {
  const d: CityData = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const found: number[][] = [];
  for (let i = 0; i < d.trees.length; i += 2) {
    const x = d.trees[i] / 2 - ox,
      z = d.trees[i + 1] / 2 - oz;
    if (isRobsonMoundTree(x, z)) found.push([x, z]);
  }
  assert.equal(found.length, 8);
  for (const s of ROBSON_MOUND_TREE_SITES) {
    assert.ok(found.some(([x, z]) => Math.hypot(s.x - x, s.z - z) < 0.00001));
    assert.ok(pointInPoly(s.x, s.z, ROBSON_MOUND_OUTLINE));
    assert.equal(isRobsonMoundTree(s.x + 0.5, s.z), false);
  }
  const publicLayer: PublicTreeLayer = JSON.parse(
    fs.readFileSync("public/data/vancouver-public-trees.json", "utf8"),
  );
  assert.equal(
    publicLayer.trees.filter((t) => isRobsonMoundTree(t[1], t[2])).length,
    0,
  );
});

test("mature crown groups keep the inherited top and physical ground root with finite bounded geometry", () => {
  let triangles = 0;
  for (const profile of profiles()) {
    const before = structuredClone(profile),
      g = robsonMoundTreeGeometry(profile, height);
    assert.deepEqual(profile, before, "source profile is never mutated");
    assert.equal(g.ground, height(profile.x, profile.z));
    assert.ok(
      g.width >= profile.width,
      "bounded wider mature crown interpretation",
    );
    assert.ok(g.wood.boundingBox!.min.y < g.ground);
    assert.ok(
      Math.abs(g.leaves.boundingBox!.max.y - g.ground - profile.height) <
        0.00002,
    );
    assert.ok(g.leaves.boundingBox!.max.x - g.leaves.boundingBox!.min.x < 12);
    for (const geometry of [g.wood, g.leaves]) {
      const p = geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
        assert.ok(p.getY(i) <= g.ground + profile.height + 0.00002);
      }
      assert.ok(Number.isFinite(geometry.boundingSphere!.radius));
      triangles += (geometry.index?.count ?? p.count) / 3;
    }
    g.wood.dispose();
    g.leaves.dispose();
  }
  assert.ok(triangles < 30000, `whole-view cost ${triangles}`);
});

test("wider crowns maintain headroom on the shared uphill terrain and low wood stays at the original root", () => {
  for (const profile of profiles()) {
    const g = robsonMoundTreeGeometry(profile, height);
    const leaves = g.leaves.getAttribute("position");
    for (let i = 0; i < leaves.count; i++) {
      const x = leaves.getX(i),
        y = leaves.getY(i),
        z = leaves.getZ(i);
      assert.ok(y - height(x, z) >= 2.24, `leaf headroom at ${x},${z}`);
    }
    const wood = g.wood.getAttribute("position");
    for (let i = 0; i < wood.count; i++) {
      const x = wood.getX(i),
        y = wood.getY(i),
        z = wood.getZ(i);
      if (y - g.ground < 2.2)
        assert.ok(
          Math.hypot(x - profile.x, z - profile.z) <=
            profile.diameter / 2 + 0.00002,
        );
    }
    const mesh = new T.Mesh(
      g.wood,
      new T.MeshBasicMaterial({ side: T.DoubleSide }),
    );
    mesh.updateMatrixWorld(true);
    const hits = new T.Raycaster(
      new T.Vector3(profile.x + 2, g.ground + 1, profile.z),
      new T.Vector3(-1, 0, 0),
    ).intersectObject(mesh);
    assert.ok(hits.length, "the structural trunk is actual closed geometry");
    assert.ok(hits.every((h) => Number.isFinite(h.distance)));
    g.wood.dispose();
    g.leaves.dispose();
  }
});

test("integration creates two named shared-material meshes and deduplicates source sites", () => {
  const parent = new T.Group(),
    source = profiles();
  const materials = { texture: () => new T.Texture() } as unknown as Materials;
  const group = buildRobsonMoundTrees(
    parent,
    materials,
    [...source, source[0], treeProfile(0, 0)],
    height,
  );
  assert.equal(parent.children.length, 1);
  assert.equal(group.children.length, 2);
  assert.equal(group.userData.robsonMoundTrees.count, 8);
  assert.ok(group.userData.robsonMoundTrees.triangles < 30000);
  assert.deepEqual(
    group.userData.robsonMoundTrees.sourceIds,
    ROBSON_MOUND_TREE_SITES.map((s) => s.osmId),
  );
  for (const child of group.children) {
    assert.ok(child instanceof T.Mesh);
    assert.ok(child.geometry.boundingSphere);
    assert.ok(child.name.startsWith("Robson mapped trees"));
    assert.ok(child.userData.center);
    if (child.userData.robsonMoundTreePart === "leaves") {
      assert.ok(child.customDepthMaterial);
      assert.ok(child.geometry.getAttribute("canopyCentre"));
      assert.ok(child.geometry.getAttribute("sliceAxis"));
      const shader = {
        vertexShader: "#include <common>\n#include <begin_vertex>",
        fragmentShader:
          "#include <common>\n#include <alphatest_fragment>\n#include <normal_fragment_maps>",
        uniforms: {},
      };
      (child.material as T.Material).onBeforeCompile(
        shader as never,
        {} as T.WebGLRenderer,
      );
      assert.ok(shader.fragmentShader.includes("sourceNormal"));
      assert.ok(
        shader.fragmentShader.includes("if(choice<start||choice>=end)discard"),
      );
      assert.equal(
        shader.vertexShader.includes("instanceMatrix"),
        false,
        "static geometry does not require missing instance attributes",
      );
    }
    child.geometry.dispose();
  }
});
