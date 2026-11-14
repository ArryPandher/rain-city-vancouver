// Fit a source leaf's UV coordinates to its 3D surface. Mask coverage comes from
// a mask baked from the source UV triangles; the original RGB texture has no alpha.
export function leafCards(primitive, errorLimit = 0.2) {
  const positions = primitive.getAttribute("POSITION").getArray(),
    normals = primitive.getAttribute("NORMAL").getArray(),
    uv = primitive.getAttribute("TEXCOORD_0").getArray(),
    indices = primitive.getIndices().getArray();
  const parent = Int32Array.from({ length: positions.length / 3 }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const r = find(indices[i]);
    parent[find(indices[i + 1])] = r;
    parent[find(indices[i + 2])] = r;
  }
  const groups = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const r = find(indices[i]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(indices[i], indices[i + 1], indices[i + 2]);
  }
  const outP = [],
    outN = [],
    outUV = [],
    outI = [];
  const stats = {
    components: groups.size,
    cards: 0,
    preserved: 0,
    sourceTriangles: indices.length / 3,
    maxRelativeFitError: 0,
    maxAreaScale: 0,
    areaScaleSum: 0,
    triangles: 0,
  };
  for (const ix of groups.values()) {
    const ids = [...new Set(ix)],
      n = ids.length,
      mean = [0, 0, 0, 0, 0],
      normal = [0, 0, 0],
      min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity],
      bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const i of ids) {
      for (let k = 0; k < 3; k++) {
        mean[k] += positions[i * 3 + k] / n;
        normal[k] += normals[i * 3 + k];
        min[k] = Math.min(min[k], positions[i * 3 + k]);
        max[k] = Math.max(max[k], positions[i * 3 + k]);
      }
      mean[3] += uv[i * 2] / n;
      mean[4] += uv[i * 2 + 1] / n;
      bounds[0] = Math.min(bounds[0], uv[i * 2]);
      bounds[1] = Math.min(bounds[1], uv[i * 2 + 1]);
      bounds[2] = Math.max(bounds[2], uv[i * 2]);
      bounds[3] = Math.max(bounds[3], uv[i * 2 + 1]);
    }
    let uu = 0,
      uvc = 0,
      vv = 0;
    const pu = [0, 0, 0],
      pv = [0, 0, 0];
    for (const i of ids) {
      const u = uv[i * 2] - mean[3],
        v = uv[i * 2 + 1] - mean[4];
      uu += u * u;
      uvc += u * v;
      vv += v * v;
      for (let k = 0; k < 3; k++) {
        pu[k] += (positions[i * 3 + k] - mean[k]) * u;
        pv[k] += (positions[i * 3 + k] - mean[k]) * v;
      }
    }
    const det = uu * vv - uvc * uvc,
      a = pu.map((p, k) => (p * vv - pv[k] * uvc) / det),
      b = pv.map((p, k) => (p * uu - pu[k] * uvc) / det);
    const at = (u, v) =>
      a.map((x, k) => mean[k] + x * (u - mean[3]) + b[k] * (v - mean[4]));
    const span = Math.hypot(...max.map((x, k) => x - min[k]));
    let maxError = 0;
    for (const i of ids) {
      const fit = at(uv[i * 2], uv[i * 2 + 1]);
      maxError = Math.max(
        maxError,
        Math.hypot(...fit.map((x, k) => x - positions[i * 3 + k])),
      );
    }
    const cross = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ],
      len = Math.hypot(...normal),
      clen = Math.hypot(...cross);
    const preserve = () => {
      const remap = new Map();
      for (const i of ix) {
        if (!remap.has(i)) {
          remap.set(i, outP.length / 3);
          outP.push(...positions.subarray(i * 3, i * 3 + 3));
          outN.push(...normals.subarray(i * 3, i * 3 + 3));
          outUV.push(...uv.subarray(i * 2, i * 2 + 2));
        }
        outI.push(remap.get(i));
      }
      stats.preserved++;
    };
    if (
      !(det > 1e-14 && span > 1e-8 && clen > 1e-8 && len > 1e-8) ||
      maxError / span > errorLimit ||
      ix.length <= 6
    ) {
      preserve();
      continue;
    }
    let surfaceArea = 0,
      uvArea = 0;
    for (let j = 0; j < ix.length; j += 3) {
      const [u, v, w] = [ix[j], ix[j + 1], ix[j + 2]];
      const ab = [0, 1, 2].map(
          (k) => positions[v * 3 + k] - positions[u * 3 + k],
        ),
        ac = [0, 1, 2].map((k) => positions[w * 3 + k] - positions[u * 3 + k]);
      surfaceArea +=
        Math.hypot(
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ) / 2;
      uvArea +=
        Math.abs(
          (uv[v * 2] - uv[u * 2]) * (uv[w * 2 + 1] - uv[u * 2 + 1]) -
            (uv[v * 2 + 1] - uv[u * 2 + 1]) * (uv[w * 2] - uv[u * 2]),
        ) / 2;
    }
    const areaScale = Math.sqrt(surfaceArea / (uvArea * clen));
    if (!Number.isFinite(areaScale) || areaScale > 1.3) {
      preserve();
      continue;
    }
    const scaled = (p) => p.map((x, k) => mean[k] + (x - mean[k]) * areaScale);
    stats.maxAreaScale = Math.max(stats.maxAreaScale, areaScale);
    stats.areaScaleSum += areaScale;
    const start = outP.length / 3;
    const corners = [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[1]],
      [bounds[2], bounds[3]],
      [bounds[0], bounds[3]],
    ];
    for (const [u, v] of corners) {
      outP.push(...scaled(at(u, v)));
      outN.push(...normal.map((x) => x / len));
      outUV.push(u, v);
    }
    const forward = cross.reduce((s, x, k) => s + x * normal[k], 0) > 0;
    outI.push(
      ...(forward ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]).map(
        (i) => i + start,
      ),
    );
    stats.cards++;
    stats.maxRelativeFitError = Math.max(
      stats.maxRelativeFitError,
      maxError / span,
    );
  }
  stats.triangles = outI.length / 3;
  return {
    positions: new Float32Array(outP),
    normals: new Float32Array(outN),
    uvs: new Float32Array(outUV),
    indices: new Uint32Array(outI),
    stats,
  };
}
