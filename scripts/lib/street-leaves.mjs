import { MeshoptSimplifier } from "meshoptimizer";

/** Simplify each connected leaf in 3D. Keep all leaves and original attributes;
 * never infer surface winding or curvature from the texture atlas boundary. */
export async function simplifyLeaves(
  primitive,
  targetTriangles = 12,
  error = 0.025,
) {
  await MeshoptSimplifier.ready;
  const positions = primitive.getAttribute("POSITION").getArray();
  const normals = primitive.getAttribute("NORMAL").getArray();
  const uv = primitive.getAttribute("TEXCOORD_0").getArray();
  const indices = primitive.getIndices().getArray();
  const parents = Int32Array.from(
    { length: positions.length / 3 },
    (_, i) => i,
  );
  const find = (i) => {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const root = find(indices[i]);
    parents[find(indices[i + 1])] = root;
    parents[find(indices[i + 2])] = root;
  }
  const components = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const root = find(indices[i]);
    let c = components.get(root);
    if (!c) components.set(root, (c = []));
    c.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  const outP = [],
    outN = [],
    outUV = [],
    outI = [];
  let maxError = 0,
    flipped = 0,
    degenerate = 0;
  for (const triangles of components.values()) {
    const ids = [...new Set(triangles)],
      local = new Map(ids.map((id, i) => [id, i]));
    const p = Float32Array.from(
      ids.flatMap((i) => Array.from(positions.subarray(i * 3, i * 3 + 3))),
    );
    const a = Float32Array.from(
      ids.flatMap((i) => [
        ...normals.subarray(i * 3, i * 3 + 3),
        ...uv.subarray(i * 2, i * 2 + 2),
      ]),
    );
    const ix = Uint32Array.from(triangles.map((i) => local.get(i)));
    const [reduced, e] = MeshoptSimplifier.simplifyWithAttributes(
      ix,
      p,
      3,
      a,
      5,
      [0.04, 0.04, 0.04, 0.025, 0.025],
      null,
      Math.min(ix.length, targetTriangles * 3),
      error,
    );
    maxError = Math.max(maxError, e);
    const used = new Map();
    const add = (i) => {
      if (used.has(i)) return used.get(i);
      const j = outP.length / 3;
      outP.push(...p.subarray(i * 3, i * 3 + 3));
      outN.push(...a.subarray(i * 5, i * 5 + 3));
      outUV.push(...a.subarray(i * 5 + 3, i * 5 + 5));
      used.set(i, j);
      return j;
    };
    for (let i = 0; i < reduced.length; i += 3) {
      let [u, v, w] = [reduced[i], reduced[i + 1], reduced[i + 2]];
      const ab = [
          p[v * 3] - p[u * 3],
          p[v * 3 + 1] - p[u * 3 + 1],
          p[v * 3 + 2] - p[u * 3 + 2],
        ],
        ac = [
          p[w * 3] - p[u * 3],
          p[w * 3 + 1] - p[u * 3 + 1],
          p[w * 3 + 2] - p[u * 3 + 2],
        ],
        cross = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ];
      if (Math.hypot(...cross) < 1e-12) {
        degenerate++;
        continue;
      }
      const dot = cross.reduce(
        (s, c, k) => s + c * (a[u * 5 + k] + a[v * 5 + k] + a[w * 5 + k]),
        0,
      );
      if (dot < 0) {
        [v, w] = [w, v];
        flipped++;
      }
      outI.push(add(u), add(v), add(w));
    }
  }
  return {
    positions: new Float32Array(outP),
    normals: new Float32Array(outN),
    uvs: new Float32Array(outUV),
    indices: new Uint32Array(outI),
    stats: {
      leaves: components.size,
      triangles: outI.length / 3,
      maxError,
      flipped,
      degenerate,
    },
  };
}
