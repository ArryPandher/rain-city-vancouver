import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { World } from "../src/world/world";
import { Batcher } from "../src/world/geometry";
import { BRIDGES, bridgeY } from "../src/world/collision";
import { type Road } from "../src/world/data";
import { ShadowCasterVolume } from "../src/rendering/shadow-caster-volume";
import { IRONWORKERS_ALIGNMENT as A } from "../src/world/ironworkers-alignment";
import { ironworkersLightPlacements } from "../src/world/ironworkers-light-standards";

const bridge = BRIDGES.find((b) => b.id === "ironworkers")!;
const grade = (t: number) => bridgeY(bridge, t, [5, 13]);

test("actual World build hook mounts one group to bridge grade and update preserves diffuser shadow exclusion", async () => {
  const scene = new T.Scene(),
    root = new T.Group(),
    sun = new T.DirectionalLight();
  scene.add(root, sun, sun.target);
  Object.assign(sun.shadow.camera, {
    left: -80,
    right: 80,
    top: 80,
    bottom: -80,
    near: 1,
    far: 650,
  });
  const rain = new T.Group();
  rain.visible = false;
  const called: string[] = [];
  const world = Object.assign(Object.create(World.prototype), {
    scene,
    root,
    chunks: [],
    time: 0,
    sun,
    rain,
    materials: { animatedUniforms: [], beacons: [] },
    data: { roads: [], areas: [] },
    terrain: () => {},
    collision: {
      groundHeight: () => 0,
      bridgeHeight: (b: typeof bridge, t: number) => {
        called.push(b.id);
        return grade(t);
      },
    },
    water: {
      uniforms: { time: { value: 0 }, sunDir: { value: new T.Vector3() } },
    },
    casterVolume: new ShadowCasterVolume(),
  }) as World;
  // Exercise the real owning hook, stopping at its next report before city construction.
  const stop = new Error("bounded fixture hook complete");
  await assert.rejects(
    world.build((_text, progress) => {
      if (progress === 0.19) throw stop;
    }),
    (e) => e === stop,
  );
  assert.ok(called.length > 56 && called.every((id) => id === "ironworkers"));
  const groups = root.children.filter(
    (g) => g.name === "Ironworkers deck-mounted light standards",
  );
  assert.equal(groups.length, 1);
  const group = groups[0];
  root.updateMatrixWorld(true);
  assert.equal(group.children.length, 12);
  assert.equal(new Set(world.chunks).size, world.chunks.length);
  for (const mesh of group.children)
    assert.ok(world.chunks.includes(mesh as T.Mesh));
  for (const p of ironworkersLightPlacements(grade)) {
    const hit = new T.Raycaster(
      new T.Vector3(p.base[0], p.base[1] - 0.1, p.base[2]),
      new T.Vector3(0, 1, 0),
      0,
      0.2,
    ).intersectObject(group)[0];
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y - p.base[1]) < 0.00001);
  }
  for (const [x, z, visible] of [
    [6800, -1600, true],
    [0, 0, false],
    [6800, -1600, true],
  ] as const) {
    world.update(0, x, z, 40);
    for (const object of group.children) {
      const mesh = object as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
      assert.equal(mesh.visible, visible);
      if (mesh.material.name.includes("diffuser")) {
        assert.equal(mesh.userData.allowShadow, false);
        assert.equal(mesh.castShadow, false);
      }
    }
    if (visible)
      assert.ok(group.children.some((m) => (m as T.Mesh).castShadow));
  }
});

test("actual streetDetails removes only generic bridge lamps, preserving signs and unrelated geometry/sequence", (t) => {
  const all = JSON.parse(fs.readFileSync(A.source, "utf8")).roads as Road[];
  const bridgeRoads = all.filter((r) => A.roadIds.includes(r.id!));
  const others = all
    .filter(
      (r) =>
        !A.roadIds.includes(r.id!) &&
        r.kind === "primary" &&
        r.pts.some((v, i) => i % 2 === 0 && v > 6500 && v < 7100),
    )
    .slice(0, 6);
  assert.equal(bridgeRoads.length, 4);
  assert.equal(others.length, 6);
  const roads = [
    others[0],
    bridgeRoads[0],
    others[1],
    bridgeRoads[1],
    others[2],
    bridgeRoads[2],
    others[3],
    bridgeRoads[3],
    ...others.slice(4),
  ];
  const before = structuredClone(roads);
  const documentDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        getContext: () => ({ fillRect() {}, fillText() {} }),
      }),
    },
  });
  const original = Batcher.prototype.add;
  type Record = { id: string; kind: "lamp" | "sign"; geometry: string };
  function run(replacement: boolean) {
    let current: Road | undefined;
    const input = roads.map((r) => ({
      ...r,
      id: !replacement && A.roadIds.includes(r.id!) ? `baseline:${r.id}` : r.id,
    }));
    const proxy = new Proxy(input, {
      get(target, prop, receiver) {
        if (prop === Symbol.iterator)
          return function* () {
            for (const r of target) {
              current = r;
              yield r;
            }
            current = undefined;
          };
        return Reflect.get(target, prop, receiver);
      },
    });
    const dark = new T.MeshStandardMaterial({ name: "dark" }),
      chrome = new T.MeshStandardMaterial({ name: "chrome" });
    const records: Record[] = [];
    const world = Object.assign(Object.create(World.prototype), {
      root: new T.Group(),
      chunks: [],
      facadeMultiDraw: false,
      nightLights: [],
      streetFurniture: [],
      materials: { dark, chrome },
      data: { roads: proxy },
      collision: {
        water: (x: number) => x < 2000,
        blocked: () => false,
        onStreet: () => false,
        groundHeight: () => 0,
      },
    }) as World;
    Batcher.prototype.add = function (g, m, x, z, key = "") {
      const result = original.call(this, g, m, x, z, key);
      const latest = world.streetFurniture.at(-1);
      if (current && latest) {
        const hash = createHash("sha256");
        for (const name of Object.keys(g.attributes).sort()) {
          hash.update(name);
          hash.update(Buffer.from(g.getAttribute(name).array.buffer));
        }
        if (g.index) hash.update(Buffer.from(g.index.array.buffer));
        hash.update(
          m === dark
            ? "dark"
            : m === chrome
              ? "chrome"
              : (m as T.MeshStandardMaterial).map
                ? "sign"
                : "lamp",
        );
        records.push({
          id: current.id!.replace("baseline:", ""),
          kind: latest.kind,
          geometry: hash.digest("hex"),
        });
      }
      return result;
    };
    world.streetDetails();
    return records;
  }
  try {
    const baseline = run(false),
      candidate = run(true);
    const isBridge = (r: Record) => A.roadIds.includes(r.id);
    assert.deepEqual(
      candidate.filter((r) => !isBridge(r)),
      baseline.filter((r) => !isBridge(r)),
    );
    assert.deepEqual(
      candidate.filter((r) => isBridge(r) && r.kind === "sign"),
      baseline.filter((r) => isBridge(r) && r.kind === "sign"),
    );
    assert.ok(baseline.some((r) => isBridge(r) && r.kind === "lamp"));
    assert.ok(candidate.every((r) => !isBridge(r) || r.kind !== "lamp"));
    assert.ok(candidate.filter((r) => !isBridge(r)).length > 10);
    assert.ok(candidate.some((r) => isBridge(r) && r.kind === "sign"));
    assert.deepEqual(roads, before);
    t.diagnostic(
      `${baseline.filter((r) => isBridge(r) && r.kind === "lamp").length} old bridge lamp parts removed; ${candidate.filter((r) => isBridge(r) && r.kind === "sign").length} bridge sign parts and ${candidate.filter((r) => !isBridge(r)).length} unrelated parts unchanged`,
    );
  } finally {
    Batcher.prototype.add = original;
    if (documentDescriptor)
      Object.defineProperty(globalThis, "document", documentDescriptor);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
