import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
} from "../src/world/architectural-mesh";
import { pointInPoly, segmentPoint } from "../src/world/data";
import { createFairmontArcadeSite } from "../src/world/fairmont-arcade-site";
import { FAIRMONT_WATERFRONT_RING as ring } from "../src/world/fairmont-waterfront-site";
import {
  FAIRMONT_TRANSFER_BAND as D,
  buildFairmontTransferBand,
  fairmontTransferPoint as at,
  fairmontTransferProfile as profile,
  fairmontTransferWebs as webs,
} from "../src/world/fairmont-transfer-band";

const site = createFairmontArcadeSite((x, z) => 0.01 * (z + 470)),
  root = new T.Group(),
  batch = new Batcher(root),
  material = new T.MeshBasicMaterial(),
  mesh = new ArchitecturalMesh(batch, 0, 0);
buildFairmontTransferBand(mesh, material, site);
mesh.finish();
const chunks = batch.finish();
root.updateMatrixWorld(true);
function cast(from: number[], to: number[]) {
  const origin = new T.Vector3(...from),
    target = new T.Vector3(...to);
  return new T.Raycaster(
    origin,
    target.clone().sub(origin).normalize(),
    0,
    target.distanceTo(origin) + 0.005,
  ).intersectObject(root, true);
}

test("registered webs remain at the source piers while real curved undersides recede between them", () => {
  assert.equal(site.sections.flatMap((s) => webs(s, site)).length, 6);
  const section = site.sections[1],
    f = facadeFrame(section.a, section.b),
    stations = webs(section, site).sort((a, b) => a.left - b.left),
    bay = (stations[0].right + stations[1].left) / 2,
    points = profile(section, site, bay),
    first = points[5].point,
    second = points[6].point,
    target = new T.Vector3(...first).lerp(new T.Vector3(...second), 0.5),
    normal = new T.Vector3(f.outward[0], -0.7, f.outward[1]).normalize(),
    start = target.clone().addScaledVector(normal, 1),
    hit = cast(start.toArray(), target.toArray())[0];
  assert.ok(
    hit && hit.point.distanceTo(target) < 0.001,
    "cove has a visible physical surface, not a dark painted card",
  );
  assert.ok(hit.face!.normal.y < -0.1, "underside faces downward");
  assert.ok(
    new T.Vector3(hit.face!.normal.x, 0, hit.face!.normal.z).dot(
      new T.Vector3(f.outward[0], 0, f.outward[1]),
    ) > 0.05,
  );
  const y = points[9].point[1] - 0.12,
    recessed = cast(at(section, bay, y, -0.4), at(section, bay, y, 0.65))[0];
  assert.ok(recessed);
  assert.ok(
    recessed.point.distanceTo(new T.Vector3(...at(section, bay, y, 0.6))) <
      0.001,
    "old full-width front wall is absent behind the recess",
  );
  for (const w of stations) {
    const t = (w.left + w.right) / 2,
      web = cast(at(section, t, y, -0.4), at(section, t, y, 0.65))[0];
    assert.ok(
      web &&
        web.point.distanceTo(new T.Vector3(...at(section, t, y, 0))) < 0.001,
    );
  }
  // Cheek at a web boundary physically closes the broad recessed bay.
  const t = stations[0].right,
    targetCheek = at(section, t, y, 0.3),
    cheek = cast(at(section, t + 0.01, y, 0.3), targetCheek)[0];
  assert.ok(
    cheek && cheek.point.distanceTo(new T.Vector3(...targetCheek)) < 0.001,
  );
});

test("caps, back and terminal ends close the band while the existing soffit remains its sole bottom", () => {
  const section = site.sections[1],
    t = 0.5;
  const top = cast(
    at(section, t, D.top + 0.3, 0.4),
    at(section, t, D.top - 0.1, 0.4),
  )[0];
  assert.ok(
    top &&
      Math.abs(top.point.y - D.top) < 0.00001 &&
      top.face!.normal.y > 0.999,
  );
  const back = cast(at(section, t, 8.8, 0.9), at(section, t, 8.8, 0.65))[0];
  assert.ok(
    back &&
      back.point.distanceTo(new T.Vector3(...at(section, t, 8.8, 0.68))) <
        0.001,
  );
  for (const [s, station, direction] of [
    [site.sections[0], 0, -1],
    [site.sections.at(-1)!, 1, 1],
  ] as const) {
    const target = at(s, station, 8.8, 0.64),
      along = new T.Vector3(s.b[0] - s.a[0], 0, s.b[1] - s.a[1]).normalize(),
      origin = new T.Vector3(...target).addScaledVector(
        along,
        direction * 0.25,
      ),
      end = cast(origin.toArray(), target)[0];
    assert.ok(
      end && end.point.distanceTo(new T.Vector3(...target)) < 0.001,
      "closed end return",
    );
  }
  const under = cast(
    at(section, t, section.ceilingAt(t) - 0.2, 0.64),
    at(section, t, section.ceilingAt(t) + 0.05, 0.64),
  );
  assert.equal(
    under.length,
    0,
    "no duplicate added bottom on the existing source ceiling",
  );
});

test("every new surface stays above public clearance, inside mapped envelope and in one existing material", (t) => {
  assert.equal(chunks.length, 1);
  let triangles = 0;
  for (const chunk of chunks) {
    const p = chunk.geometry.getAttribute("position"),
      n = chunk.geometry.getAttribute("normal");
    triangles += chunk.geometry.index!.count / 3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      assert.ok(Number.isFinite(x + y + z));
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 0.00001,
      );
      assert.ok(
        y >= site.canopyTopAt(x, z) - 0.64003,
        "profile never lowers the existing authoritative ceiling",
      );
      assert.ok(y <= D.top + 0.00001);
      assert.ok(
        pointInPoly(x, z, ring.flat()) ||
          ring.some(
            (a, j) =>
              segmentPoint(x, z, ...a, ...ring[(j + 1) % ring.length]).d <
              0.00004,
          ),
        "no unsupported projection into public walking space",
      );
    }
  }
  for (let i = 1; i < site.sections.length; i++) {
    const a = profile(site.sections[i - 1], site, 1),
      b = profile(site.sections[i], site, 0);
    a.forEach((p, j) =>
      assert.ok(
        new T.Vector3(...p.point).distanceTo(new T.Vector3(...b[j].point)) <
          1e-7,
        "profile mitres match across mapped face bends",
      ),
    );
  }
  assert.ok(triangles < 800);
  t.diagnostic(`${triangles} profile triangles in the existing panel material`);
});

test("continuous cove normals remove facet steps while keeping the lower ledge and web cheeks sharp", () => {
  const section = site.sections[1],
    stations = webs(section, site).sort((a, b) => a.left - b.left),
    t = stations[0].right,
    curve = profile(section, site, t),
    f = facadeFrame(section.a, section.b),
    outward = new T.Vector3(f.outward[0], 0, f.outward[1]),
    depthDirection = new T.Vector3(...at(section, t, 0, 1)).sub(
      new T.Vector3(...at(section, t, 0, 0)),
    ),
    cheekNormal = new T.Vector3(
      -depthDirection.z,
      0,
      depthDirection.x,
    ).normalize();
  const normalsAt = (point: number[]) =>
    chunks.flatMap((chunk) => {
      const p = chunk.geometry.getAttribute("position"),
        n = chunk.geometry.getAttribute("normal"),
        found: T.Vector3[] = [];
      for (let i = 0; i < p.count; i++)
        if (
          new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)).distanceTo(
            new T.Vector3(...point),
          ) < 0.00005
        )
          found.push(new T.Vector3(n.getX(i), n.getY(i), n.getZ(i)));
      return found;
    });
  let previousY = 0;
  for (let j = 2; j <= D.coveSegments; j++) {
    const all = normalsAt(curve[j].point),
      cove = all.filter((n) => n.y < -0.001 && n.dot(outward) > 0.01);
    assert.ok(
      cove.length >= 2,
      "both strips retain their coincident curve vertices",
    );
    assert.ok(
      cove.every((n) => n.distanceTo(cove[0]) < 0.00001),
      "no shading jump between curved strips",
    );
    assert.ok(cove[0].y < previousY, "normal turns progressively downward");
    previousY = cove[0].y;
    assert.ok(
      all.some(
        (n) => Math.abs(n.dot(cheekNormal)) > 0.999 && Math.abs(n.y) < 0.001,
      ),
      "web cheek remains a separate hard face",
    );
  }
  const lower = normalsAt(curve[D.coveSegments + 1].point);
  assert.ok(
    lower.some((n) => n.y < -0.999),
    "ellipse ends at its horizontal tangent",
  );
  assert.ok(
    lower.some((n) => n.dot(outward) > 0.999 && Math.abs(n.y) < 0.001),
    "vertical rear strip keeps the physical lower crease",
  );
  assert.equal(
    chunks.reduce((n, c) => n + c.geometry.index!.count / 3, 0),
    590,
    "normals add no faces or material batches",
  );
});
