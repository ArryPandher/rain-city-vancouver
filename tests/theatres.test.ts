import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { theatres, VOGUE_ID, ORPHEUM_ID } from "../src/world/theatres";
import { Batcher } from "../src/world/geometry";
import {
  ORIGIN,
  KX,
  pointInPoly,
  segmentPoint,
  type Building,
} from "../src/world/data";
import type { Materials } from "../src/world/materials";

// Canvas rasterization is checked in-browser; the CPU checks placement and geometry.
const ctx = { fillRect() {}, fillText() {}, strokeText() {} };
Object.defineProperty(globalThis, "document", {
  value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  },
  configurable: true,
});
const data = JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8"));
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
for (const [id, name, signU] of [
  [VOGUE_ID, "Vogue", -336],
  [ORPHEUM_ID, "Orpheum", -258.3],
] as const)
  test(`${name} occupies its mapped entrance with clear street-level access and outward sign faces`, () => {
    const source = data.buildings.find((b: Building) => b.id === id);
    assert.ok(source);
    const b = {
      ...source,
      pts: source.pts.map((v: number, i: number) => v / 2 - (i % 2 ? oz : ox)),
    } as Building;
    const root = new T.Group(),
      batch = new Batcher(root);
    const m = {
      texture: () => new T.Texture(),
      roof: new T.MeshStandardMaterial(),
      chrome: new T.MeshStandardMaterial(),
      neonMaterials: [],
      practicalLights: [],
    } as unknown as Materials;
    assert.equal(theatres(b, batch, m), true);
    const meshes = batch.finish();
    let lettering = 0;
    for (const mesh of meshes) {
      const p = mesh.geometry.getAttribute("position"),
        n = mesh.geometry.getAttribute("normal");
      const isSign =
        (mesh.material as T.Material).name === `${name} neon lettering`;
      if (isSign) lettering++;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        if (id === VOGUE_ID && (x + z) / Math.SQRT2 < 149) {
          const u = (x - z) / Math.SQRT2;
          assert.ok(
            u > -348.5 && u < -323.7,
            "Vogue decoration stays within its frontage width",
          );
        }
        assert.ok(
          [x, y, z, n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite),
        );
        if (isSign) {
          const u = (x - z) / Math.SQRT2,
            v = (x + z) / Math.SQRT2;
          assert.ok(Math.abs(Math.abs(u - signU) - 0.31) < 0.002);
          assert.ok(
            v > 144 && v < 148.5,
            "blade projects from the Granville frontage",
          );
          assert.ok(
            (n.getX(i) - n.getZ(i)) * (u - signU) > 0,
            "both printed faces point outward",
          );
        }
        if (y >= 2.8 || pointInPoly(x, z, b.pts)) continue;
        let distance = Infinity;
        for (let j = 0; j < b.pts.length; j += 2) {
          const k = (j + 2) % b.pts.length;
          distance = Math.min(
            distance,
            segmentPoint(x, z, b.pts[j], b.pts[j + 1], b.pts[k], b.pts[k + 1])
              .d,
          );
        }
        assert.ok(
          distance < 0.65,
          `ground-level geometry overhangs the collision footprint by ${distance.toFixed(2)} m`,
        );
      }
    }
    assert.ok(lettering > 0);
    assert.equal(m.practicalLights.length, 2);
    assert.ok(
      m.practicalLights.every(
        (l) => l.light.intensity === 0 && !l.light.castShadow,
      ),
    );
  });
