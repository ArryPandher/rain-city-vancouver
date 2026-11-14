import test from "node:test";
import assert from "node:assert/strict";
import { buildingHeight } from "../src/world/building-profile";
import { pitchedRoof } from "../src/world/pitched-roof";
import { pointInPoly, type Building } from "../src/world/data";
const house: Building = {
  id: "test-house",
  kind: "house",
  pts: [-5, -4, 5, -4, 5, 4, -5, 4],
};
test("tagged metre heights take priority while small buildings get plausible defaults", () => {
  assert.equal(buildingHeight({ ...house, height: 8.3, levels: 3 }), 8.3);
  assert.equal(buildingHeight(house), 6.4);
  assert.equal(buildingHeight({ ...house, kind: "garage" }), 3.2);
  assert.equal(buildingHeight({ ...house, kind: "warehouse" }), 6.5);
  assert.equal(
    buildingHeight({ ...house, kind: "apartments", levels: 6 }),
    19.200000000000003,
  );
});
test("a gabled house keeps its tagged total height and creates a ridge and end walls", () => {
  const roof = pitchedRoof({ ...house, height: 8, roofShape: "gabled" }, 8)!;
  assert.equal(roof.totalHeight, 8);
  assert.ok(roof.bodyHeight < 8 && roof.bodyHeight > 5);
  const p = roof.roof.getAttribute("position"),
    n = roof.roof.getAttribute("normal");
  assert.ok(p.count > 0);
  assert.ok(roof.gables.getAttribute("position").count > 0);
  assert.ok(
    Math.abs(
      Math.max(...Array.from({ length: p.count }, (_, i) => p.getY(i))) - 8,
    ) < 1e-5,
  );
  for (let i = 0; i < p.count; i++) assert.ok(n.getY(i) >= -1e-6);
  roof.roof.dispose();
  roof.gables.dispose();
});
test("hipped roofs preserve concave building footprints instead of filling their recesses", () => {
  const building: Building = {
    ...house,
    pts: [0, 0, 10, 0, 10, 4, 4, 4, 4, 10, 0, 10],
    roofShape: "hipped",
  };
  const roof = pitchedRoof(building, 6.4)!,
    p = roof.roof.getAttribute("position");
  assert.ok(p.count > 0);
  let coveredArea = 0;
  for (let i = 0; i < p.count; i += 3) {
    const area =
      Math.abs(
        (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
          (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i)),
      ) / 2;
    assert.ok(area > 1e-8, "no zero-area roof slivers");
    coveredArea += area;
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3,
      z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    assert.ok(
      pointInPoly(x, z, building.pts) || x === 0 || z === 0,
      `roof outside footprint: ${x},${z}`,
    );
    for (let j = 0; j < 3; j++) {
      assert.ok(Number.isFinite(p.getY(i + j)));
      assert.ok(
        p.getY(i + j) >= 6.39 && p.getY(i + j) <= roof.totalHeight + 0.001,
      );
    }
  }
  assert.ok(
    Math.abs(coveredArea - 64) < 1e-4,
    "roof covers the full L-shaped footprint once",
  );
  roof.roof.dispose();
  roof.gables.dispose();
});
test("flat roofs and tall buildings keep their existing roof treatment", () => {
  assert.equal(pitchedRoof({ ...house, roofShape: "flat" }, 6.4), null);
  assert.equal(pitchedRoof({ ...house, roofShape: "hipped" }, 80), null);
});
