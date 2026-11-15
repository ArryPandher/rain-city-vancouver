import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildDetailedCarTemplate,
  cloneDetailedCar,
} from "../src/world/detailed-car";
import { carBodyGeometry } from "../src/world/car-body-geometry";

async function asset(file: string, mixed = false) {
  let bytes = await readFile(`public/models/${file}.glb`);
  if (mixed) {
    // Change only two primitive attribute declarations in the actual near GLB.
    // GLTFLoader must choose its real supplied/derivative material variants.
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const paint = json.materials.findIndex((m: { name: string }) =>
      /Paint 1/.test(m.name),
    );
    const primitives = json.meshes.flatMap(
      (mesh: {
        primitives: { material: number; attributes: Record<string, number> }[];
      }) => mesh.primitives.filter((p) => p.material === paint),
    );
    assert.ok(primitives.length >= 3);
    delete primitives[0].attributes.TANGENT;
    delete primitives[1].attributes.TEXCOORD_1;
    const text = Buffer.from(JSON.stringify(json));
    const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
    text.copy(padded);
    const header = Buffer.from(bytes.subarray(0, 20));
    const remainingChunks = bytes.subarray(20 + jsonLength);
    header.writeUInt32LE(20 + padded.length + remainingChunks.length, 8);
    header.writeUInt32LE(padded.length, 12);
    bytes = Buffer.concat([header, padded, remainingChunks]);
  }
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: "test-no-images",
    loadTexture: () => {
      const texture = new T.Texture();
      texture.flipY = false;
      return Promise.resolve(texture);
    },
  }));
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    )
  ).scene;
}

function bodySources(raw: T.Group) {
  const groups = new Map<T.MeshStandardMaterial, T.Mesh[]>();
  raw.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    for (let p: T.Object3D | null = o; p; p = p.parent)
      if (/^Wheel(Front|Rear)[LR]$/.test(p.name)) return;
    if (/Emblem|Wipers|Pedal|Floormat|Engine|InteriorRearHatch/.test(o.name))
      return;
    assert.ok(
      !Array.isArray(o.material),
      "loader separates material primitives",
    );
    const material = o.material as T.MeshStandardMaterial;
    let group = groups.get(material);
    if (!group) groups.set(material, (group = []));
    group.push(o);
  });
  return groups;
}

function bytesIn(geometry: T.BufferGeometry) {
  return (
    Object.values(geometry.attributes).reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      0,
    ) + (geometry.index?.array.byteLength ?? 0)
  );
}

for (const [file, previousBytes, triangles] of [
  ["car-concept", 3328642, 120139],
  ["car-traffic", 1034710, 28489],
] as const)
  test(`${file}: real loader tangent basis and UVs survive body baking, batching and clones`, async () => {
    const raw = await asset(file);
    const groups = bodySources(raw);
    const car = buildDetailedCarTemplate(raw, () => new T.Texture());
    const body = car.getObjectByName("car-body")!;
    const meshes = body.children as T.Mesh<
      T.BufferGeometry,
      T.MeshStandardMaterial
    >[];
    assert.equal(meshes.length, 16, "no extra current-asset body draws");
    assert.equal(new Set(meshes.map((mesh) => mesh.material)).size, 16);
    assert.equal(
      meshes.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0),
      triangles,
    );
    const normalization = new T.Matrix4().fromArray(
      car.userData.sourceNormalization,
    );
    let groupIndex = 0;
    let tangentVertices = 0;
    let uv1Vertices = 0;
    let withTangents = 0;
    let derivative = 0;
    for (const [material, sources] of groups) {
      const mesh = meshes[groupIndex++];
      assert.equal(mesh.material.name, material.name);
      assert.equal(mesh.material.normalMap, material.normalMap);
      assert.deepEqual(
        mesh.material.normalScale.toArray(),
        material.normalScale.toArray(),
      );
      if (material instanceof T.MeshPhysicalMaterial) {
        assert.deepEqual(
          (
            mesh.material as T.MeshPhysicalMaterial
          ).clearcoatNormalScale.toArray(),
          material.clearcoatNormalScale.toArray(),
        );
      }
      let offset = 0;
      for (const source of sources) {
        const geometry = source.geometry;
        const tangent = geometry.getAttribute("tangent");
        const normal = geometry.getAttribute("normal");
        const renderedTangent = mesh.geometry.getAttribute("tangent");
        assert.equal(Boolean(renderedTangent), Boolean(tangent));
        const matrix = normalization.clone().multiply(source.matrixWorld);
        assert.ok(
          matrix.determinant() > 0,
          "committed asset has no mirrored bake",
        );
        const normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
        for (let i = 0; i < normal.count; i++) {
          const expectedNormal = new T.Vector3()
            .fromBufferAttribute(normal, i)
            .applyNormalMatrix(normalMatrix);
          const renderedNormal = new T.Vector3().fromBufferAttribute(
            mesh.geometry.getAttribute("normal"),
            offset + i,
          );
          assert.ok(expectedNormal.distanceTo(renderedNormal) < 2e-6);
          if (tangent) {
            const expected = new T.Vector3()
              .fromBufferAttribute(tangent, i)
              .transformDirection(matrix);
            const rendered = new T.Vector3().fromBufferAttribute(
              renderedTangent,
              offset + i,
            );
            assert.ok(expected.distanceTo(rendered) < 2e-6);
            assert.equal(renderedTangent.getW(offset + i), tangent.getW(i));
            assert.equal(Math.abs(renderedTangent.getW(offset + i)), 1);
          }
          const uv1 = geometry.getAttribute("uv1");
          if (uv1) {
            const rendered = mesh.geometry.getAttribute("uv1");
            assert.equal(rendered.getX(offset + i), uv1.getX(i));
            assert.equal(rendered.getY(offset + i), uv1.getY(i));
          }
        }
        if (tangent) tangentVertices += tangent.count;
        if (geometry.getAttribute("uv1")) uv1Vertices += normal.count;
        offset += normal.count;
      }
      assert.equal(mesh.geometry.getAttribute("position").count, offset);
      if (material.normalScale.y !== 0) {
        if (mesh.geometry.hasAttribute("tangent")) {
          withTangents++;
          assert.ok(material.normalScale.y > 0, "supplied tangent convention");
        } else {
          derivative++;
          assert.ok(
            material.normalScale.y < 0,
            "loader derivative convention remains intact",
          );
        }
      }
    }
    assert.ok(withTangents > 0);
    assert.ok(derivative > 0);
    const bytes = meshes.reduce((sum, mesh) => sum + bytesIn(mesh.geometry), 0);
    assert.equal(bytes - previousBytes, tangentVertices * 16 + uv1Vertices * 8);
    console.log(
      `${file}: body buffers ${previousBytes} → ${bytes} bytes; ${tangentVertices} tangent vertices, ${uv1Vertices} UV1 vertices; 16 body draws/materials unchanged.`,
    );
    const first = cloneDetailedCar(car);
    const second = cloneDetailedCar(car);
    meshes.forEach((mesh, i) => {
      const a = first.body.children[i] as T.Mesh<
        T.BufferGeometry,
        T.MeshStandardMaterial
      >;
      const b = second.body.children[i] as T.Mesh<
        T.BufferGeometry,
        T.MeshStandardMaterial
      >;
      assert.equal(a.geometry, mesh.geometry);
      assert.equal(b.geometry, mesh.geometry);
      assert.notEqual(a.material, b.material);
      assert.equal(a.material.normalMap, mesh.material.normalMap);
      assert.deepEqual(
        a.material.normalScale.toArray(),
        mesh.material.normalScale.toArray(),
      );
    });
  });

test("mixed actual GLB layouts retain every primitive and both loader conventions", async () => {
  const raw = await asset("car-concept", true);
  const car = buildDetailedCarTemplate(raw, () => new T.Texture());
  const body = car.getObjectByName("car-body")!;
  const meshes = body.children as T.Mesh<
    T.BufferGeometry,
    T.MeshStandardMaterial
  >[];
  const paint = meshes.filter((mesh) => /Paint 1/.test(mesh.material.name));
  assert.equal(
    paint.length,
    3,
    "one derivative and two supplied-tangent UV layouts",
  );
  assert.equal(meshes.length, 18);
  assert.equal(new Set(meshes.map((mesh) => mesh.material)).size, 17);
  assert.equal(
    meshes.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0),
    120139,
    "layout variation must not drop or duplicate car triangles",
  );
  const supplied = paint.filter((mesh) =>
    mesh.geometry.hasAttribute("tangent"),
  );
  const derivative = paint.filter(
    (mesh) => !mesh.geometry.hasAttribute("tangent"),
  );
  assert.equal(supplied.length, 2);
  assert.equal(derivative.length, 1);
  assert.equal(supplied[0].material, supplied[1].material);
  assert.notEqual(supplied[0].material, derivative[0].material);
  assert.ok(supplied.every((mesh) => mesh.material.normalScale.y > 0));
  assert.ok(derivative[0].material.normalScale.y < 0);
  assert.equal(
    supplied.filter((mesh) => mesh.geometry.hasAttribute("uv1")).length,
    1,
  );
});

test("a reflected actual paint primitive retains physical bitangent handedness and front winding", async () => {
  const raw = await asset("car-concept");
  const entry = [...bodySources(raw)].find(([material]) =>
    /Paint 1/.test(material.name),
  )!;
  const source = entry[1][0].geometry;
  const matrix = new T.Matrix4()
    .makeRotationY(0.6)
    .scale(new T.Vector3(-2, 2, 2));
  const baked = carBodyGeometry(source, matrix);
  const n = source.getAttribute("normal");
  const t = source.getAttribute("tangent");
  const bn = baked.getAttribute("normal");
  const bt = baked.getAttribute("tangent");
  for (let i = 0; i < n.count; i++) {
    const expectedBitangent = new T.Vector3()
      .crossVectors(
        new T.Vector3().fromBufferAttribute(n, i),
        new T.Vector3().fromBufferAttribute(t, i),
      )
      .multiplyScalar(t.getW(i))
      .transformDirection(matrix);
    const renderedBitangent = new T.Vector3()
      .crossVectors(
        new T.Vector3().fromBufferAttribute(bn, i),
        new T.Vector3().fromBufferAttribute(bt, i),
      )
      .multiplyScalar(bt.getW(i))
      .normalize();
    assert.ok(expectedBitangent.distanceTo(renderedBitangent) < 2e-6);
    assert.equal(bt.getW(i), -t.getW(i));
  }
  for (let i = 0; i < source.index!.count; i += 3) {
    assert.equal(baked.index!.getX(i), source.index!.getX(i));
    assert.equal(baked.index!.getX(i + 1), source.index!.getX(i + 2));
    assert.equal(baked.index!.getX(i + 2), source.index!.getX(i + 1));
  }
  assert.notEqual(
    baked.getAttribute("tangent"),
    source.getAttribute("tangent"),
  );
});
