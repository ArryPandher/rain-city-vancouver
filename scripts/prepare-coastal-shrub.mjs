import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds } from "@gltf-transform/functions";
import * as T from "three";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read("public/models/forest/shrub_04.glb");
const material = doc.getRoot().listMaterials()[0],
  buffer = doc.getRoot().listBuffers()[0];
let seed = 17281;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pos = [],
  normal = [],
  uv = [],
  indices = [];
// Pixel bounds of individual leaves in Rico Cilliers' licensed Shrub 04 atlas.
const leaves = [
  [132, 96, 104, 240],
  [534, 74, 99, 270],
  [436, 395, 127, 252],
  [619, 385, 100, 218],
  [229, 643, 115, 294],
  [373, 713, 133, 244],
  [549, 687, 106, 225],
];
function add(g) {
  const p = g.getAttribute("position"),
    n = g.getAttribute("normal"),
    t = g.getAttribute("uv"),
    base = pos.length / 3;
  pos.push(...p.array);
  normal.push(...n.array);
  uv.push(...t.array);
  indices.push(...Array.from(g.index.array, (x) => x + base));
  g.dispose();
}
for (let i = 0; i < 240; i++) {
  const az = i * 2.39996323 + random() * 0.5,
    y = 0.22 + random() * 0.85,
    ring =
      Math.sqrt(Math.max(0.08, 1 - ((y - 0.55) / 0.78) ** 2)) *
      (0.45 + random() * 0.48),
    centre = new T.Vector3(Math.cos(az) * ring, y, Math.sin(az) * ring),
    length = 0.16 + random() * 0.12,
    width = length * (0.43 + random() * 0.12),
    outward = new T.Vector3(
      Math.cos(az) * 0.6,
      0.65 + random() * 0.45,
      Math.sin(az) * 0.6,
    ).normalize(),
    q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), outward);
  q.multiply(
    new T.Quaternion().setFromAxisAngle(
      new T.Vector3(0, 0, 1),
      random() * Math.PI * 2,
    ),
  );
  const points = [
    [-width / 2, -length / 2, 0],
    [0, -length / 2, 0.007],
    [width / 2, -length / 2, 0],
    [-width / 2, length / 2, 0],
    [0, length / 2, 0.018],
    [width / 2, length / 2, 0],
  ].map((p) => new T.Vector3(...p).applyQuaternion(q).add(centre));
  const [x, yy, w, h] = leaves[i % leaves.length],
    coords = [
      [0, 1],
      [0.5, 1],
      [1, 1],
      [0, 0],
      [0.5, 0],
      [1, 0],
    ],
    g = new T.BufferGeometry();
  g.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      points.flatMap((p) => p.toArray()),
      3,
    ),
  );
  // glTF texture V increases down the image.
  g.setAttribute(
    "uv",
    new T.Float32BufferAttribute(
      coords.flatMap(([u, v]) => [(x + w * u) / 1024, (yy + h * v) / 1024]),
      2,
    ),
  );
  g.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4]);
  g.computeVertexNormals();
  add(g);
}
for (let i = 0; i < 18; i++) {
  const a = i * 2.39996323,
    end = new T.Vector3(
      Math.cos(a) * 0.65,
      0.45 + random() * 0.45,
      Math.sin(a) * 0.65,
    ),
    start = new T.Vector3(0, 0, 0),
    delta = end.clone().sub(start),
    g = new T.CylinderGeometry(0.003, 0.009, delta.length(), 5, 1, false);
  g.applyQuaternion(
    new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      delta.clone().normalize(),
    ),
  );
  g.translate(...end.clone().multiplyScalar(0.5).toArray());
  const t = g.getAttribute("uv");
  for (let j = 0; j < t.count; j++)
    t.setXY(j, 0.89 + t.getX(j) * 0.03, 0.2 + t.getY(j) * 0.45);
  add(g);
}
for (const scene of doc.getRoot().listScenes())
  for (const n of [...scene.listChildren()]) scene.removeChild(n);
const accessor = (name, type, array) =>
  doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
const primitive = doc
  .createPrimitive()
  .setAttribute("POSITION", accessor("position", "VEC3", new Float32Array(pos)))
  .setAttribute("NORMAL", accessor("normal", "VEC3", new Float32Array(normal)))
  .setAttribute("TEXCOORD_0", accessor("uv", "VEC2", new Float32Array(uv)))
  .setIndices(accessor("indices", "SCALAR", new Uint16Array(indices)))
  .setMaterial(material);
const mesh = doc
    .createMesh("Original coastal broadleaf cluster")
    .addPrimitive(primitive),
  node = doc.createNode("Coastal broadleaf").setMesh(mesh);
doc.getRoot().listScenes()[0].addChild(node);
await doc.transform(prune(), dedup());
const file = "models/forest/coastal-broadleaf.glb";
await io.write("public/" + file, doc);
const source = JSON.parse(
  await fs.readFile("docs/sources/stanley-forest-assets.json", "utf8"),
).find((x) => x.file === "models/forest/shrub_04.glb");
const item = {
  ...source,
  file,
  title: "Rain City coastal broadleaf cluster",
  authors: {
    "Rico Cilliers": "Leaf photography and source material maps (CC0-1.0)",
    "Rain City": "Original cluster geometry and assembly (MIT)",
  },
  license: "MIT AND CC0-1.0",
  licenseUrl: undefined,
  licenseUrls: ["https://opensource.org/license/mit", source.licenseUrl],
  triangles: indices.length / 3,
  bounds: getBounds(doc.getRoot().listScenes()[0]),
  changes:
    "Original 240-leaf, folded-surface thicket with eighteen stems, using seven leaf regions from the existing licensed Shrub 04 color/alpha/normal/material atlas. Original alpha and 1K material maps retained. Geometry, clustering and slope orientation are a coastal planting interpretation, not a species survey.",
};
await fs.writeFile(
  "docs/sources/coastal-plant-assets.json",
  JSON.stringify([item], null, 2) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter(
        (x) => ![file, "models/forest/shrub_04-coastal.glb"].includes(x.file),
      ),
      {
        file,
        source: item.source,
        license: item.license,
        credit:
          "Leaf photography/material maps: Poly Haven — Rico Cilliers (CC0). Original thicket geometry: Rain City (MIT).",
        changes: item.changes,
      },
    ],
    null,
    2,
  ) + "\n",
);
await fs.rm("public/models/forest/shrub_04-coastal.glb", { force: true });
console.log(item);
