import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  PAN_PACIFIC_HOWE_PODIUM as D,
  PAN_PACIFIC_HOWE_PHOTO_TRACE as PHOTO,
  PAN_PACIFIC_HOWE_RUN as RUN,
  PAN_PACIFIC_HOWE_RUN_STATIONS as STATIONS,
  PAN_PACIFIC_HOWE_LENGTH as LENGTH,
  panPacificPhotoStation,
} from "../src/world/pan-pacific-howe-podium-data";
import {
  createPanPacificHowePodiumGeometry,
  panPacificHowePodiumPoint as point,
  type PanPacificHowePart,
} from "../src/world/pan-pacific-howe-podium";

const roles: PanPacificHowePart[] = [
  "concrete",
  "frame",
  "glass",
  "backing",
  "soffit",
];
const parts = createPanPacificHowePodiumGeometry();
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
function mesh(role: PanPacificHowePart) {
  const m = new T.Mesh(parts[role], material);
  m.updateMatrixWorld();
  return m;
}
function ray(
  u: number,
  y: number,
  tier: "lower" | "middle" | "upper" = "lower",
) {
  const origin = point(u, y, 4, tier),
    into = point(u, y, -4, tier).sub(origin).normalize();
  return new T.Raycaster(origin, into, 0, 9);
}

test("photographic rectification retains independent supports and uncertain near/far ends", () => {
  assert.equal(PHOTO.supports.length, 6);
  assert.equal(D.supports[0].confidence, "tree-obscured");
  assert.equal(panPacificPhotoStation(952, [952, 1484]), 0);
  assert.equal(panPacificPhotoStation(1484, [952, 1484]), 1);
  assert.ok(Math.abs(D.supports[1].u - 0.19365) < 0.00001);
  const spacings = D.supports
    .slice(1)
    .map((s, i) => (s.u - D.supports[i].u) * LENGTH);
  assert.ok(
    Math.max(...spacings) - Math.min(...spacings) > 1.2,
    "projective centres must not be replaced by equally spaced columns",
  );
  assert.equal(D.lowerWindowGroups.length, 4);
  assert.ok(
    D.lowerWindowGroups[3][0] > 0.38 && D.lowerWindowGroups[3][0] < 0.39,
  );
});

test("all three mitered boundaries reproduce the source tier vertices", () => {
  for (const tier of ["lower", "middle", "upper"] as const)
    for (let i = 0; i < RUN.length; i++) {
      const p = point(STATIONS[i] / LENGTH, 0, 0, tier),
        scale = D.tiers[tier].scale;
      assert.ok(Math.abs(p.x - (-132 + (RUN[i][0] + 132) * scale)) < 1e-7);
      assert.ok(Math.abs(p.z - (69 + (RUN[i][1] - 69) * scale)) < 1e-7);
      if (i > 0 && i < RUN.length - 1) {
        assert.ok(
          point(STATIONS[i] / LENGTH - 1e-9, 0, -2.8, tier).distanceTo(
            point(STATIONS[i] / LENGTH + 1e-9, 0, -2.8, tier),
          ) < 1e-5,
        );
      }
    }
});

test("bounded merged geometry closes lower and upper apertures behind actual glass", () => {
  assert.equal(parts.stats.geometryBatches, 5);
  assert.ok(parts.stats.triangles < 20_000, JSON.stringify(parts.stats));
  assert.ok(parts.stats.panes > 200);
  const cases: [number, number, "lower" | "middle" | "upper"][] = [
    [0.31, 9.8, "lower"],
    [0.148, 16.1, "middle"],
    [0.51, 19.1, "middle"],
    [0.61, 21.1, "upper"],
    [0.7, 23.1, "upper"],
  ];
  for (const [u, y, tier] of cases) {
    const r = ray(u, y, tier);
    const glass = r.intersectObject(mesh("glass"));
    const backing = r.intersectObject(mesh("backing"));
    assert.ok(glass.length > 0, `glass ${u}/${y}/${tier}`);
    assert.ok(backing.length > 0, `closed backing ${u}/${y}/${tier}`);
    assert.ok(
      backing[0].distance - glass[0].distance >= 0.4,
      `cavity depth ${tier}`,
    );
  }
  // The opaque interval between photographed isolated windows stays concrete.
  assert.ok(
    ray(0.195, 16.4, "middle").intersectObject(mesh("concrete")).length > 0,
  );
  assert.equal(
    ray(0.195, 16.4, "middle").intersectObject(mesh("glass")).length,
    0,
  );
});

test("retaining face meets PIER without a duplicate horizontal floor", () => {
  const atFloor = D.floor;
  for (const role of roles) {
    const g = parts[role],
      pos = g.getAttribute("position"),
      index = g.index!;
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(pos, index.getX(i + j)),
      );
      if (
        vertices.every((v) => Math.abs(v.y - atFloor) < 0.002) &&
        g.attributes.normal.getY(index.getX(i)) > 0.99
      ) {
        const area =
          vertices[1]
            .clone()
            .sub(vertices[0])
            .cross(vertices[2].clone().sub(vertices[0]))
            .length() / 2;
        // No upward-facing broad PIER deck is introduced. Downward wall
        // closure faces at contact elevation are not a visible floor.
        assert.ok(
          area < 0.12,
          `${role} unexpectedly adds a PIER floor triangle (${area})`,
        );
      }
    }
  }
  const retaining = ray(0.2, D.floor - 0.7).intersectObject(mesh("concrete"));
  assert.ok(retaining.length > 0);
  assert.ok(Math.abs(retaining[0].distance - 4) < 0.001);
  for (const support of D.supports) {
    const at = point(support.u, D.floor + 1, -D.columnInset);
    const down = new T.Raycaster(at, new T.Vector3(0, -1, 0), 0, 2);
    const hits = down.intersectObject(mesh("concrete"));
    assert.ok(
      hits.some((h) => Math.abs(h.point.y - D.floor) < 0.001),
      "column contact at source PIER",
    );
  }
});

test("each cut end has a full height physical return and all batches are finite", () => {
  for (const tier of ["lower", "middle", "upper"] as const) {
    const y = tier === "lower" ? 12 : tier === "middle" ? 16.4 : 23.5;
    const inset = tier === "lower" ? -1.8 : -0.35;
    for (const u of [0, 1]) {
      const end = point(u, y, inset, tier);
      const tangent = point(0.51, y, 0, tier)
        .sub(point(0.49, y, 0, tier))
        .normalize();
      const outward = tangent.multiplyScalar(u === 0 ? -1 : 1);
      const r = new T.Raycaster(
        end.clone().addScaledVector(outward, 1),
        outward.negate(),
        0,
        2,
      );
      assert.ok(
        r.intersectObject(mesh("concrete")).length > 0,
        `${tier} end${u}`,
      );
    }
  }
  for (const role of roles) {
    const g = parts[role];
    assert.equal(g.groups.length, 0);
    assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(g.attributes.normal.array).every(Number.isFinite));
    assert.equal(g.attributes.position.count, g.attributes.uv.count);
  }
});

test("upper gallery is pale closed panelling with only the photo-bounded dark recess", () => {
  for (const u of [0.08, 0.25, 0.4, 0.6, 0.78, 0.92]) {
    const r = ray(u, 12.5);
    assert.equal(
      r.intersectObject(mesh("glass")).length,
      0,
      "no invented upper glass ribbon",
    );
    const stone = r.intersectObject(mesh("concrete"));
    const substrate = r.intersectObject(mesh("soffit"));
    assert.ok(
      stone.length + substrate.length > 0,
      `closed pale upper wall at ${u}`,
    );
  }
  const opening = D.galleryWall.recess;
  const r = ray((opening.start + opening.end) / 2, 12.5);
  assert.equal(r.intersectObject(mesh("glass")).length, 0);
  const back = r.intersectObject(mesh("concrete"));
  assert.ok(back.length > 0);
  assert.ok(Math.abs(back[0].distance - (4 + D.recess + 0.36)) < 0.002);
  assert.ok(
    opening.end - opening.start < 0.02,
    "bounded recess cannot replace whole gallery",
  );
  assert.ok(
    D.galleryWall.panelBoundaries.length > 70,
    "fine panel rhythm differs from large lower panes",
  );
  // Lower gallery windows and traced upper podium apertures remain glazed.
  assert.ok(ray(0.31, 9.8).intersectObject(mesh("glass")).length > 0);
  assert.ok(
    ray(0.15, 16.4, "middle").intersectObject(mesh("glass")).length > 0,
  );
});

test("new retaining skirt stops exactly where original PIER wall begins", () => {
  assert.ok(Math.abs(D.retainingEnd - 0.4100776860725485) < 1e-10);
  for (const u of [0.43, 0.6, 0.8, 0.98]) {
    const hits = ray(u, D.floor - 0.7).intersectObject(mesh("concrete"));
    assert.equal(
      hits.length,
      0,
      "no duplicate new skirt over retained source wall",
    );
  }
  for (const u of [0.04, 0.2, 0.39])
    assert.ok(
      ray(u, D.floor - 0.7).intersectObject(mesh("concrete")).length > 0,
    );
  const pos = parts.concrete.getAttribute("position");
  const target = new T.Vector3(
    D.retainingEndPoint[0],
    D.floor,
    D.retainingEndPoint[1],
  );
  let found = false;
  for (let i = 0; i < pos.count; i++)
    if (new T.Vector3().fromBufferAttribute(pos, i).distanceTo(target) < 1e-5)
      found = true;
  assert.ok(found, "new vertical face meets decoded original PIER endpoint");
});

test("photographic gallery fascia keeps floor fixed and clears lower glazing head", () => {
  assert.equal(D.galleryY, 10.85);
  assert.equal(D.galleryThickness, 0.6);
  const underside = D.galleryY - D.galleryThickness;
  const columnFreeU = 0.31;
  const hit = ray(columnFreeU, underside + 0.1).intersectObject(
    mesh("concrete"),
  );
  assert.ok(hit.length > 0);
  assert.ok(
    Math.abs(hit[0].distance - (4 + D.galleryInset)) < 0.002,
    "fascia has real front face",
  );
  assert.equal(
    ray(columnFreeU, underside + 0.1).intersectObject(mesh("glass")).length,
    0,
  );
  assert.ok(
    ray(columnFreeU, underside - 0.04).intersectObject(mesh("glass")).length >
      0,
    "lower window ends below fascia without an opaque overlap",
  );
  const below = point(columnFreeU, underside - 0.1, -1.8);
  const up = new T.Raycaster(
    below,
    new T.Vector3(0, 1, 0),
    0,
    0.8,
  ).intersectObject(mesh("concrete"));
  assert.ok(
    up.some((h) => Math.abs(h.point.y - underside) < 0.001),
    "physical soffit at lowered underside",
  );
  assert.ok(
    up.some((h) => Math.abs(h.point.y - D.galleryY) < 0.001),
    "gallery floor unchanged",
  );
});
