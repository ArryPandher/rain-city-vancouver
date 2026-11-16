import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createCathedralPlaceMaterials } from "../src/world/cathedral-place-materials";
import { createCathedralPlaceGeometry } from "../src/world/cathedral-place";
import {
  addCathedralStonePanels,
  CATHEDRAL_STONE_PANELS as D,
} from "../src/world/cathedral-place-stone";
import { Batcher } from "../src/world/geometry";
import { batchStaticChunks } from "../src/world/static-chunk-batch";

function materials() {
  const donor = new T.Texture();
  donor.repeat.set(3, 4);
  donor.updateMatrix();
  return {
    donor,
    roles: createCathedralPlaceMaterials({ texture: () => donor }),
  };
}

test("stone finish preserves licensed samplers, optical roles and one material per existing geometry role", () => {
  const { donor, roles } = materials();
  assert.equal(Object.keys(roles).length, 5);
  assert.equal(roles.stone.color.getHex(), 0xd2cdc1);
  assert.equal(roles.stone.roughness, 0.94);
  assert.deepEqual(roles.stone.normalScale.toArray(), [0.08, 0.08]);
  for (const map of [
    roles.stone.map!,
    roles.stone.normalMap!,
    roles.stone.roughnessMap!,
  ]) {
    assert.notEqual(map, donor);
    assert.deepEqual(map.repeat.toArray(), [0.5, 0.5]);
  }
  assert.deepEqual(donor.repeat.toArray(), [3, 4]);
  assert.equal(roles.glass.ior, 1.65);
  assert.equal(roles.glass.roughness, 0.15);
  assert.equal(roles.glass.envMapIntensity, 0.85);
  for (const [role, material] of Object.entries(roles)) {
    assert.equal(!!material.userData.cathedralStonePanels, role === "stone");
    assert.equal(addCathedralStonePanels(material), material);
  }
  assert.ok(D.seam < D.width / 100 && D.relief < D.seam);
});

test("metric panel coordinates survive the actual grade/batching path with unchanged geometry and caps", () => {
  const candidate = createCathedralPlaceGeometry(),
    parent = new T.Group(),
    batcher = new Batcher(parent),
    { roles } = materials();
  batcher.offsetY = 7.31;
  const before = candidate.parts.stone.clone();
  for (const [role, geometry] of Object.entries(candidate.parts))
    batcher.add(geometry, roles[role as keyof typeof roles], 2.4, -131.8);
  const chunks = batcher.finish();
  assert.equal(chunks.length, 5);
  const stone = chunks.find((m) => m.material === roles.stone)!;
  assert.deepEqual(
    Array.from(stone.geometry.getAttribute("uv").array),
    Array.from(before.getAttribute("uv").array),
  );
  assert.deepEqual(
    Array.from(stone.geometry.getAttribute("normal").array),
    Array.from(
      before.clone().translate(0, 7.31, 0).getAttribute("normal").array,
    ),
  );
  const p = stone.geometry.getAttribute("position"),
    old = before.getAttribute("position"),
    uv = stone.geometry.getAttribute("uv"),
    n = stone.geometry.getAttribute("normal");
  let vertical = 0,
    horizontal = 0;
  for (let i = 0; i < p.count; i++) {
    assert.equal(p.getX(i), old.getX(i));
    assert.equal(p.getZ(i), old.getZ(i));
    assert.ok(Math.abs(p.getY(i) - old.getY(i) - 7.31) < 1e-5);
  }
  for (let i = 0; i < p.count; i += 3) {
    if (Math.abs(n.getY(i)) < 0.01) {
      vertical++;
      for (const j of [i + 1, i + 2]) {
        const metric = Math.hypot(
          uv.getX(i) - uv.getX(j),
          uv.getY(i) - uv.getY(j),
        );
        const actual = new T.Vector3()
          .fromBufferAttribute(p, i)
          .distanceTo(new T.Vector3().fromBufferAttribute(p, j));
        assert.ok(
          Math.abs(metric - actual) < 3e-5,
          "joint scale must remain in metres across each real facade/reveal triangle",
        );
      }
    } else if (Math.abs(n.getY(i)) > 0.99) horizontal++;
  }
  assert.ok(vertical > 100 && horizontal > 100);
  // Current static policy excludes custom shader cohorts. Even duplicated
  // stone chunks must stay one ordinary material cohort each, never silently
  // lose the finish when consolidated into a stock shader batch.
  const duplicate = new T.Mesh(stone.geometry.clone(), roles.stone);
  parent.add(duplicate);
  assert.equal(batchStaticChunks(parent, [stone, duplicate], true).length, 0);
  assert.equal(stone.parent, parent);
  assert.equal(duplicate.parent, parent);
});

test("shader chains prior hooks once, uses raw metric UVs and filters shallow vertical-only joints", () => {
  const material = new T.MeshStandardMaterial({
    name: "Cathedral Place pale limestone",
  });
  let priorCalls = 0;
  material.onBeforeCompile = (shader) => {
    priorCalls++;
    shader.uniforms.priorMarker = { value: 7 };
  };
  material.customProgramCacheKey = () => "prior-stone";
  addCathedralStonePanels(material);
  const once = material.onBeforeCompile;
  addCathedralStonePanels(material);
  assert.equal(material.onBeforeCompile, once);
  const shader = {
    uniforms: T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  assert.equal(priorCalls, 1);
  assert.equal(shader.uniforms.priorMarker.value, 7);
  assert.equal(
    material.customProgramCacheKey(),
    "prior-stone:cathedral-cut-stone-v1",
  );
  assert.deepEqual(
    shader.uniforms.cathedralPanelSize.value.toArray(),
    [1.1, 0.95, 0.006, 0.002],
  );
  assert.match(shader.vertexShader, /vCathedralPanelMetres=uv;/);
  assert.match(
    shader.vertexShader,
    /inverseTransformDirection\(transformedNormal,viewMatrix\)/,
  );
  assert.doesNotMatch(
    shader.vertexShader,
    /vCathedralPanelMetres=.*(?:mapTransform|modelMatrix|batchingMatrix)/,
  );
  assert.match(shader.fragmentShader, /fwidth\(metres\)/);
  assert.match(shader.fragmentShader, /cathedralVertical\*cathedralReadable/);
  assert.match(
    shader.fragmentShader,
    /#include <normal_fragment_maps>[\s\S]*cathedralGradient/,
  );
  assert.match(
    shader.fragmentShader,
    /cathedralRelief=-cathedralJoint\*cathedralPanelSize.w/,
  );
  assert.match(shader.vertexShader, /#include <project_vertex>/);
  assert.doesNotMatch(shader.vertexShader, /transformed\s*[+*\-]=/);
});
