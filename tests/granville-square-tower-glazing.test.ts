import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createGranvilleSquareOfficeGlass,
  GRANVILLE_SQUARE_OFFICE_PROBE as probe,
} from "../src/world/granville-square-tower-glazing";
import { createGranvilleSquareTowerMaterials } from "../src/world/granville-square-tower-materials";
import { buildGranvilleSquareTower } from "../src/world/granville-square-tower";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import { KX, ORIGIN, pointInPoly } from "../src/world/data";
import {
  GRANVILLE_SQUARE_TOWER as D,
  GRANVILLE_SQUARE_TOWER_RING as ring,
  GRANVILLE_SQUARE_TOWER_ID as id,
  granvilleSquareTowerLevel as level,
} from "../src/world/granville-square-tower-data";

test("office glazing exposes real backing with bounded Fresnel energy, no diffuse paint or refraction pass", () => {
  const glass = createGranvilleSquareOfficeGlass(),
    shader = {
      uniforms: T.UniformsUtils.clone(T.ShaderLib.physical.uniforms),
      vertexShader: T.ShaderLib.physical.vertexShader,
      fragmentShader: T.ShaderLib.physical.fragmentShader,
    };
  glass.onBeforeCompile(shader as any, {} as T.WebGLRenderer);
  assert.equal(glass.transparent, true);
  assert.equal(glass.depthWrite, false);
  assert.equal(glass.transmission, 0);
  assert.equal(glass.emissive.getHex(), 0);
  assert.equal(glass.metalness, 0);
  assert.equal(glass.roughness, 0.13);
  assert.equal(glass.ior, 1.8);
  assert.equal(glass.userData.castShadow, false);
  assert.equal(glass.blending, T.CustomBlending);
  assert.equal(glass.blendSrc, T.OneFactor);
  assert.equal(glass.blendDst, T.OneMinusSrcAlphaFactor);
  const patch = shader.fragmentShader.match(
    /float lobbyFacing[\s\S]*?(?=#include <opaque_fragment>)/,
  )?.[0];
  assert.ok(patch);
  // Execute the actual candidate's injected scalar arithmetic. Three supplies
  // reflected BRDF radiance; a unit incident radiance here isolates energy.
  const evaluate = new Function(
    "normal",
    "vViewPosition",
    "ior",
    "lobbyThroughput",
    "totalSpecular",
    "normalize",
    "dot",
    "clamp",
    "pow",
    `let outgoingLight=0,diffuseColor={a:1};
${patch.replace(/\bfloat\s+/g, "const ")}
return [outgoingLight,1-diffuseColor.a];`,
  );
  for (let i = 0; i <= 100; i++) {
    const facing = i / 100,
      f0 = ((glass.ior - 1) / (glass.ior + 1)) ** 2,
      f = f0 + (1 - f0) * (1 - facing) ** 5,
      [r, t] = evaluate(
        [0, 0, 1],
        [Math.sqrt(1 - facing ** 2), 0, facing],
        glass.ior,
        shader.uniforms.lobbyThroughput.value,
        f,
        (v: number[]) => v,
        (a: number[], b: number[]) => a.reduce((s, v, j) => s + v * b[j], 0),
        (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
        Math.pow,
      );
    assert.ok(r >= 0 && t >= 0 && r + t <= 1 + 1e-12);
    if (i === 0) assert.ok(Math.abs(t) < 1e-12);
    if (i === 100) {
      assert.ok(r > 0.081 && r < 0.082, "former coating F0 retained");
      assert.ok(
        t > 0.71 && t < 0.72,
        "existing cavity is visible at normal incidence",
      );
    }
  }
});

test("single probe clears both visible face planes and every mapped building footprint", () => {
  for (const edge of [0, 3]) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]),
      clearance =
        (probe[0] - ring[edge][0]) * f.outward[0] +
        (probe[2] - ring[edge][1]) * f.outward[1];
    assert.ok(Math.abs(clearance - 6) < 1e-10);
  }
  assert.equal(probe[1], 52);
  const data = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  for (const building of data.buildings) {
    const pts = building.pts.map(
      (v: number, i: number) => v / 2 - (i % 2 ? oz : ox),
    );
    assert.equal(pointInPoly(probe[0], probe[2], pts), false, building.id);
  }
});

test("actual tower capture geometry no longer blocks reflected rays from street-facing panes", (t) => {
  const m = createGranvilleSquareTowerMaterials({
      texture: () => new T.Texture(),
    }),
    root = new T.Group(),
    batch = new Batcher(root),
    base = 6.9255;
  buildGranvilleSquareTower(batch, { id, pts: ring.flat() }, m, () => base);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  assert.equal(meshes.length, 6);
  assert.equal(
    meshes.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0),
    45138,
  );
  const capture = meshes.filter(
    (mesh) => ![m.glass, m.lobbyGlass, m.frame].includes(mesh.material as any),
  );
  let samples = 0,
    oldBlocked = 0;
  for (const edge of [0, 3]) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % 4]),
      n = new T.Vector3(f.outward[0], 0, f.outward[1]),
      camera = new T.Vector3(
        ...(edge === 0 ? [607, 15, -422] : [570, 9, -452]),
      );
    for (let col = 0; col < D.bays[edge]; col++)
      for (const row of [0, 4, 12, 23]) {
        const u = ((col + 0.37) * f.length) / D.bays[edge],
          y = (level(row, base) + level(row + 1, base)) / 2,
          pane = new T.Vector3(...f.p(u, y, D.recess)),
          view = camera.clone().sub(pane).normalize(),
          reflected = n
            .clone()
            .multiplyScalar(2 * n.dot(view))
            .sub(view)
            .normalize();
        assert.ok(view.dot(n) > 0);
        const hit = new T.Raycaster(
          new T.Vector3(...probe),
          reflected,
          0.01,
          300,
        ).intersectObjects(capture);
        assert.equal(
          hit.length,
          0,
          `self-capture edge ${edge}, col ${col}, row ${row}`,
        );
        oldBlocked += Number(
          new T.Raycaster(
            new T.Vector3(526, 52, -410),
            reflected,
            0.01,
            300,
          ).intersectObjects(capture).length > 0,
        );
        const layers = new T.Raycaster(
          new T.Vector3(...f.p(u, y, -0.1)),
          n.clone().negate(),
          0,
          1.4,
        ).intersectObjects(meshes);
        assert.equal((layers[0].object as T.Mesh).material, m.glass);
        const backing = layers.find(
          (h) => (h.object as T.Mesh).material === m.backing,
        );
        assert.ok(backing);
        assert.ok(
          Math.abs(backing.distance - layers[0].distance - 0.38) < 0.00005,
        );
        samples++;
      }
  }
  assert.ok(
    oldBlocked > 0,
    "the previous probe reproduces actual self-occlusion",
  );
  t.diagnostic(
    `${samples} reflected rays: old probe ${oldBlocked} self-hits; new probe 0. Geometry remains 45,138 triangles / six batches.`,
  );
});
