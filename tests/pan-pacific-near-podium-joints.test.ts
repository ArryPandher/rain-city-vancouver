import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { geo } from "../src/world/data";
import source from "../src/world/canada-place-deck-data.json";
import { PAN_PACIFIC_NEAR_PODIUM as D } from "../src/world/pan-pacific-near-podium-data";
import {
  PAN_PACIFIC_NEAR_PANEL_JOINTS as J,
  PAN_PACIFIC_NEAR_PANEL_RUNS as runs,
  nearPodiumPanelCoordinates as coordinates,
  nearPodiumSpineArc as arc,
} from "../src/world/pan-pacific-near-podium-joints";
import {
  createPanPacificNearPodiumGeometry,
  panPacificNearPodiumPoint as point,
} from "../src/world/pan-pacific-near-podium";
import { createPanPacificNearPodium } from "../src/world/pan-pacific-near-podium-install";
import { batchStaticChunks } from "../src/world/static-chunk-batch";

const [ox, oz] = geo(source.origin[1], source.origin[0]);
const translation = new T.Vector3(ox, 0.08, oz);
const world = (p: T.Vector3) => p.add(translation);

test("panel metre coordinate follows all three actual curved spines without facet phase resets", () => {
  for (const tier of ["lower", "middle", "upper"] as const) {
    const width = D.spineWidth * D.tiers[tier].scale;
    const length = point(0, 0, 0, 0, tier).distanceTo(point(0, 1, 0, 0, tier));
    const at = (s: number) =>
      world(
        point(
          0,
          s / length,
          D.tiers[tier].bottom + 1,
          -D.spineCurveDepth * ((2 * s) / width - 1) ** 2,
          tier,
        ),
      );
    let polyline = 0;
    for (let i = 0; i <= 24; i++) {
      const s = (width * i) / 24;
      const uv = coordinates(at(s));
      assert.ok(Math.abs(uv[0] - arc(s, width, D.spineCurveDepth)) < 1e-9);
      assert.ok(Math.abs(uv[1] - (D.tiers[tier].bottom + 1 - D.floor)) < 1e-9);
      if (i) {
        const previous = at((width * (i - 1)) / 24);
        polyline += at(s).distanceTo(previous);
        assert.ok(uv[0] > coordinates(previous)[0]);
      }
    }
    // Actual 24-facet chord length agrees with the curved-metre schedule;
    // estimated .8m panels do not compress to .8m on the base-plane projection.
    assert.ok(
      Math.abs(polyline - arc(width, width, D.spineCurveDepth)) < 0.0007,
    );
    assert.ok(arc(width, width, D.spineCurveDepth) > width + 0.2);
    for (let edge = 1; edge < 5; edge++) {
      const before = coordinates(
        world(point(edge - 1, 1 - 1e-7, 11, 0, tier)),
      )[0];
      const after = coordinates(world(point(edge, 1e-7, 11, 0, tier)))[0];
      assert.ok(Math.abs(before - after) < 1e-5, `${tier} corner${edge}`);
      const run = runs[["lower", "middle", "upper"].indexOf(tier) * 5 + edge];
      const a = coordinates(world(point(edge, 0.3, 11, 0, tier)))[0];
      const b = coordinates(
        world(point(edge, 0.3 + J.width / run.length, 11, 0, tier)),
      )[0];
      assert.ok(Math.abs(b - a - J.width) < 1e-8);
    }
  }
});

test("actual duplicated curved-facet vertices share phase while mineral UVs stay caller-owned", () => {
  const g = createPanPacificNearPodiumGeometry().concrete;
  const p = g.getAttribute("position"),
    uv = g.getAttribute("uv"),
    n = g.getAttribute("normal");
  const seen = new Map<
    string,
    { u: number; panel: number; normal: T.Vector3 }
  >();
  let tangentDiscontinuities = 0;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) > 0.01) continue;
    const local = new T.Vector3().fromBufferAttribute(p, i);
    const key = local.toArray().join(",");
    const panel = coordinates(world(local))[0];
    const old = seen.get(key),
      normal = new T.Vector3().fromBufferAttribute(n, i);
    if (
      old &&
      old.normal.dot(normal) > 0.98 &&
      Math.abs(old.u - uv.getX(i)) > 0.1
    ) {
      tangentDiscontinuities++;
      assert.equal(
        old.panel,
        panel,
        "source positions, not per-facet tangent UVs, set phase",
      );
    }
    seen.set(key, { u: uv.getX(i), panel, normal });
  }
  assert.ok(
    tangentDiscontinuities > 30,
    "exercises existing curved facet UV discontinuities",
  );
});

test("concrete-only shallow seams preserve source geometry, mineral maps and six-draw assembly", () => {
  const pure = createPanPacificNearPodiumGeometry();
  const { group } = createPanPacificNearPodium({
    texture: () => new T.Texture(),
  });
  group.position.copy(translation);
  group.updateMatrixWorld(true);
  const opaque = group.children.filter(
    (m) => !Array.isArray((m as T.Mesh).material),
  ) as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[];
  assert.equal(group.children.length, 5);
  assert.equal(
    group.children.reduce(
      (draws, m) => draws + (Array.isArray((m as T.Mesh).material) ? 2 : 1),
      0,
    ),
    6,
  );
  for (const role of ["concrete", "frame", "backing", "soffit"] as const) {
    const mesh = opaque.find(
      (m) => m.name === `pan-pacific-near-podium-${role}`,
    )!;
    assert.deepEqual(mesh.geometry.index!.array, pure[role].index!.array);
    for (const attribute of ["position", "normal", "uv"])
      assert.deepEqual(
        mesh.geometry.getAttribute(attribute).array,
        pure[role].getAttribute(attribute).array,
      );
    assert.equal(mesh.material.displacementMap, null);
    assert.equal(mesh.material.emissive.getHex(), 0);
    assert.equal(mesh.material.transparent, false);
    assert.equal(
      Boolean(mesh.material.userData.nearPodiumPanelJoints),
      role === "concrete",
    );
  }
  const mesh = opaque[0],
    material = mesh.material;
  const shader = {
    uniforms: T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(
    shader as T.WebGLProgramParametersWithUniforms,
    {} as T.WebGLRenderer,
  );
  assert.deepEqual(
    shader.uniforms.nearPanelSize.value.toArray(),
    [0.8, 0.9, 0.006, 0.0015],
  );
  assert.equal(shader.uniforms.nearPanelRuns.value.length, 15);
  assert.match(shader.vertexShader, /modelMatrix\*nearPanelPosition/);
  assert.match(
    shader.vertexShader,
    /vNearPanelVertical=1\.0-abs\(inverseTransformDirection\(transformedNormal,viewMatrix\).y\)/,
  );
  assert.match(shader.fragmentShader, /fwidth\(metres\)/);
  assert.match(
    shader.fragmentShader,
    /smoothstep\(\.80,\.95,vNearPanelVertical\)/,
  );
  assert.match(
    shader.fragmentShader,
    /float nearRelief=-nearJoint\*nearPanelSize.w/,
  );
  assert.match(
    shader.fragmentShader,
    /#include <normal_fragment_maps>\nvec3 nearDx/,
  );
  assert.ok(shader.fragmentShader.includes("#include <lights_fragment_begin>"));
  assert.ok(
    material.customProgramCacheKey().endsWith(":near-podium-panel-joints-v1"),
  );
  // Custom material remains one premerged opaque draw; the shared batching
  // policy correctly excludes custom shaders instead of losing their state.
  const duplicate = mesh.clone();
  group.add(duplicate);
  assert.equal(
    batchStaticChunks(group, [...opaque, duplicate], true).length,
    0,
  );
  group.remove(duplicate);
  const local = new T.Vector3().fromBufferAttribute(
    mesh.geometry.getAttribute("position"),
    0,
  );
  assert.deepEqual(
    coordinates(local.clone().applyMatrix4(mesh.matrixWorld)),
    coordinates(world(local)),
  );
});

test("packed BatchedMesh restores source coordinates and surface orientation through instance transforms", () => {
  const g = createPanPacificNearPodiumGeometry().concrete;
  const instanceTransform = new T.Matrix4().compose(
    new T.Vector3(13, -2, 21),
    new T.Quaternion().setFromEuler(new T.Euler(0.24, 0.71, -0.15)),
    new T.Vector3(1.1, 0.9, 1.2),
  );
  // An equivalent packed domain deliberately differs from source coordinates.
  // This catches using raw packed vertices with only the parent model matrix.
  const packed = g.clone().applyMatrix4(instanceTransform.clone().invert());
  const { group } = createPanPacificNearPodium({
    texture: () => new T.Texture(),
  });
  const material = (
    group.children[0] as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>
  ).material;
  const batch = new T.BatchedMesh(
    1,
    packed.getAttribute("position").count,
    packed.index!.count,
    material,
  );
  const geometryId = batch.addGeometry(packed),
    instanceId = batch.addInstance(geometryId);
  batch.setMatrixAt(instanceId, instanceTransform);
  batch.position.copy(translation);
  batch.updateMatrixWorld();
  const range = batch.getGeometryRangeAt(geometryId)!;
  const actualTransform = new T.Matrix4();
  batch.getMatrixAt(instanceId, actualTransform);
  const sourceP = g.getAttribute("position"),
    sourceN = g.getAttribute("normal");
  const packedP = batch.geometry.getAttribute("position"),
    packedN = batch.geometry.getAttribute("normal");
  const fullTransform = batch.matrixWorld.clone().multiply(actualTransform);
  const normalTransform = new T.Matrix3().getNormalMatrix(fullTransform);
  let count = 0,
    horizontal = 0,
    vertical = 0;
  for (let i = 0; i < sourceP.count; i += 11) {
    const p = new T.Vector3().fromBufferAttribute(
      packedP,
      range.vertexStart + i,
    );
    const expected = world(new T.Vector3().fromBufferAttribute(sourceP, i));
    const restored = p.applyMatrix4(fullTransform);
    assert.ok(restored.distanceTo(expected) < 0.0001);
    const expectedUv = coordinates(expected),
      restoredUv = coordinates(restored);
    assert.ok(Math.abs(expectedUv[0] - restoredUv[0]) < 0.0001);
    assert.ok(Math.abs(expectedUv[1] - restoredUv[1]) < 0.0001);
    const normal = new T.Vector3()
      .fromBufferAttribute(packedN, range.vertexStart + i)
      .applyMatrix3(normalTransform)
      .normalize();
    const expectedNormal = new T.Vector3().fromBufferAttribute(sourceN, i);
    assert.ok(normal.distanceTo(expectedNormal) < 0.00001);
    if (Math.abs(expectedNormal.y) > 0.99) {
      horizontal++;
      assert.ok(
        1 - Math.abs(normal.y) < 0.00001,
        "horizontal mineral excluded after rotation",
      );
    } else if (Math.abs(expectedNormal.y) < 0.01) {
      vertical++;
      assert.ok(
        1 - Math.abs(normal.y) > 0.9999,
        "vertical panel included after rotation",
      );
    }
    count++;
  }
  assert.ok(count > 200 && horizontal > 20 && vertical > 50);
  const shader = {
    uniforms: T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(
    shader as T.WebGLProgramParametersWithUniforms,
    {} as T.WebGLRenderer,
  );
  const v = shader.vertexShader;
  assert.ok(
    v.indexOf("#include <batching_vertex>") <
      v.indexOf("nearPanelPosition=batchingMatrix"),
  );
  assert.ok(
    v.indexOf("nearPanelPosition=batchingMatrix") <
      v.indexOf("nearPanelPosition=instanceMatrix"),
  );
  assert.ok(
    v.indexOf("nearPanelPosition=instanceMatrix") <
      v.indexOf("modelMatrix*nearPanelPosition"),
  );
  assert.match(v, /inverseTransformDirection\(transformedNormal,viewMatrix\)/);
});
