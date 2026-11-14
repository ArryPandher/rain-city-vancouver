import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read("public/models/car-concept.glb");
await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.16, error: 0.003 }),
  prune(),
);
await io.write("public/models/car-traffic.glb", doc);
console.log(
  "Traffic car optimized; CC BY 4.0 attribution remains in asset metadata.",
);
