import * as T from "three";

/** Bake a static car primitive without discarding the tangent/UV convention
 * already selected by GLTFLoader for its material. */
export function carBodyGeometry(source: T.BufferGeometry, matrix: T.Matrix4) {
  const geometry = source.clone().applyMatrix4(matrix);
  const count = geometry.getAttribute("position").count;
  if (!geometry.index)
    geometry.setIndex(Array.from({ length: count }, (_, i) => i));
  if (!geometry.getAttribute("uv"))
    geometry.setAttribute(
      "uv",
      new T.Float32BufferAttribute(new Float32Array(count * 2), 2),
    );
  // Object transforms normally supply the renderer's winding reversal. Once a
  // reflection is baked into vertices, carry it into the indices and TBN sign.
  if (matrix.determinant() < 0) {
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const second = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, second);
    }
    const tangent = geometry.getAttribute("tangent");
    if (tangent)
      for (let i = 0; i < tangent.count; i++) tangent.setW(i, -tangent.getW(i));
  }
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  return geometry;
}

/** Keep different loader layouts in separate draws instead of erasing optional
 * attributes, inventing tangents, or losing primitives in a failed merge. */
export function carGeometryLayout(geometry: T.BufferGeometry) {
  const layout = (
    attribute: T.BufferAttribute | T.InterleavedBufferAttribute,
  ) => [
    attribute.itemSize,
    attribute.array.constructor.name,
    attribute.normalized,
    "gpuType" in attribute ? attribute.gpuType : null,
  ];
  return JSON.stringify([
    Object.entries(geometry.attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attribute]) => [name, layout(attribute)]),
    Object.entries(geometry.morphAttributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attributes]) => [name, attributes!.map(layout)]),
    geometry.morphTargetsRelative,
  ]);
}
