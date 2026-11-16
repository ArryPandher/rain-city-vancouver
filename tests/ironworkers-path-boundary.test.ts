import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createIronworkersPathBoundary,
  IRONWORKERS_PATH as D,
  IRONWORKERS_PATH_TIES,
  ironworkersMemberDistanceSquared,
} from "../src/world/ironworkers-path-boundary";
import {
  IRONWORKERS_ALIGNMENT as A,
  ironworkersPoint,
  ironworkersGradeT,
  ironworkersTAtDistance,
  IRONWORKERS_PLAN_LENGTH as LENGTH,
} from "../src/world/ironworkers-alignment";
import { bridgeY, BRIDGES } from "../src/world/collision";
import { ribbon, subdividePath } from "../src/world/geometry";
import { roadWidth, type Road } from "../src/world/data";
const bridge = BRIDGES.find((b) => b.id === "ironworkers")!,
  height = (t: number) => bridgeY(bridge, t, [0, 0]),
  candidate = createIronworkersPathBoundary(height, () => 0.07);
const roads = JSON.parse(fs.readFileSync(A.source, "utf8")).roads as Road[];

test("all source carriageway strips and full lane car footprints exclude path support and physical boundaries", (t) => {
  let strips = 0,
    corners = 0;
  for (const r of roads.filter((r) => A.roadIds.includes(r.id!))) {
    const g = ribbon(subdividePath(r.pts), roadWidth(r), 0, () => 0, 5, true),
      p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      assert.equal(
        candidate.supportAt(x, z),
        undefined,
        `${r.id} lane support ${x},${z}`,
      );
      assert.equal(
        candidate.blockedAt(x, z, 0.01, height(ironworkersGradeT(x, z)), false),
        false,
      );
      strips++;
    }
    g.dispose();
    for (let i = 0; i < r.pts.length - 2; i += 2) {
      const ax = r.pts[i],
        az = r.pts[i + 1],
        dx = r.pts[i + 2] - ax,
        dz = r.pts[i + 3] - az,
        len = Math.hypot(dx, dz),
        tx = dx / len,
        tz = dz / len,
        n = Math.ceil(len / 3);
      for (let j = 0; j <= n; j++)
        for (const lane of [-3.6, 0, 3.6])
          for (const along of [-2.45, 2.45])
            for (const side of [-1.43, 1.43]) {
              const x = ax + (dx * j) / n + tx * along + tz * (lane + side),
                z = az + (dz * j) / n + tz * along - tx * (lane + side);
              assert.equal(candidate.supportAt(x, z), undefined);
              assert.equal(
                candidate.blockedAt(
                  x,
                  z,
                  0.01,
                  height(ironworkersGradeT(x, z)),
                  false,
                ),
                false,
              );
              corners++;
            }
    }
  }
  t.diagnostic(`${strips} strip vertices, ${corners} full car corners`);
});

test("every supported triangle matches rendered top, retains upward winding, and excludes lanes/outside edges", (t) => {
  const scene = candidate.createRenderGroup(
      new T.MeshBasicMaterial(),
      new T.MeshBasicMaterial({ side: T.DoubleSide }),
    ),
    path = scene.group.children[0] as T.Mesh;
  path.updateMatrixWorld(true);
  let n = 0;
  for (const tri of candidate.topTriangles) {
    const [a, b, c] = tri.map((p) => new T.Vector3(...p)),
      normal = b.clone().sub(a).cross(c.clone().sub(a));
    assert.ok(normal.y > 0);
    const q = a.clone().add(b).add(c).divideScalar(3),
      expected = candidate.supportAt(q.x, q.z);
    assert.ok(expected !== undefined);
    assert.ok(
      Math.abs(expected - q.y) < 1e-5,
      `support mismatch ${q.toArray()} ${expected}`,
    );
    if (n++ % 17 === 0) {
      const hit = new T.Raycaster(
        q.clone().add(new T.Vector3(0, 0.1, 0)),
        new T.Vector3(0, -1, 0),
        0,
        0.2,
      ).intersectObject(path)[0];
      assert.ok(hit);
      assert.ok(Math.abs(hit.point.y - expected) < 1e-5);
    }
  }
  for (let s = 10; s < LENGTH - 10; s += 7)
    for (const sign of [-1, 1]) {
      const station = ironworkersTAtDistance(s);
      for (const side of [
        D.inner + 0.02,
        (D.inner + D.outer) / 2,
        D.outer - 0.02,
      ]) {
        const [x, z] = ironworkersPoint(station, sign * side),
          y = candidate.supportAt(x, z);
        assert.ok(y !== undefined);
        assert.ok(Math.abs(y - height(ironworkersGradeT(x, z)) - 0.12) < 0.012);
        assert.equal(
          candidate.blockedAt(x, z, 0.001, y + 0.2, true),
          false,
          `curb encroaches clear path ${s}/${side}`,
        );
        assert.equal(
          candidate.blockedAt(x, z, 0.001, y + 1.8, true),
          false,
          `clear path encroachment ${s}/${side}`,
        );
      }
      for (const side of [D.inner - 0.05, D.outer + 0.05]) {
        const [x, z] = ironworkersPoint(station, sign * side);
        assert.equal(candidate.supportAt(x, z), undefined);
      }
    }
  t.diagnostic(
    `${candidate.topTriangles.length} supported triangles; ${JSON.stringify(scene.stats)}`,
  );
});

test("all four finite approach finishes preserve exact mapped vertices and their clear open ends", () => {
  for (const tie of candidate.ties) {
    const road = roads.find((r) => r.id === tie.source)!;
    assert.ok(road);
    assert.ok(
      road.pts.some(
        (x, i) =>
          i % 2 === 0 && x === tie.point[0] && road.pts[i + 1] === tie.point[1],
      ),
    );
    const a = tie.end[0],
      b = tie.end[1];
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[2] - a[2]) - 2.5) < 1e-9);
    const x = tie.point[0],
      z = tie.point[1];
    assert.ok(Math.abs(candidate.supportAt(x, z)! - 0.07) < 0.001);
    for (const r of [0.36, 0.45])
      assert.equal(candidate.blockedAt(x, z, r, 0.07, false), false);
    for (let i = 1; i < tie.sections.length; i++) {
      const a = tie.centres[i - 1],
        b = tie.centres[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      for (const section of [tie.sections[i - 1], tie.sections[i]]) {
        const width = Math.abs(
          (section[1][0] - section[0][0]) * (-dz / length) +
            (section[1][2] - section[0][2]) * (dx / length),
        );
        assert.ok(width >= 2.5 - 1e-8, `tie pinched to ${width}m`);
      }
      if (i > 1 && i < tie.sections.length - 1) {
        const x = (a[0] + b[0]) / 2,
          z = (a[1] + b[1]) / 2;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8)
          assert.ok(
            candidate.supportAt(
              x + Math.cos(angle) * 0.45,
              z + Math.sin(angle) * 0.45,
            )! >= 0.069,
            "bike footprint unsupported on tie",
          );
      }
    }
    const sa = tie.start[0],
      sb = tie.start[1],
      sx = (sa[0] + sb[0]) / 2,
      sz = (sa[2] + sb[2]) / 2;
    assert.ok(candidate.supportAt(sx, sz)! >= 0.069);
    assert.equal(candidate.blockedAt(sx, sz, 0.45, 0.07, false), false);
  }
  assert.equal(IRONWORKERS_PATH_TIES.length, 4);
});

test("picket and rail cameras use finite physical boxes: contact blocks, real gaps/top/under-deck clear", () => {
  const pickets = candidate.members.filter((m) => m.kind === "picket"),
    m = pickets[Math.floor(pickets.length / 4)],
    p = new T.Vector3(...m.centre),
    axis = new T.Vector3(...m.axes[1]);
  // Exact OBB distance and a ray hit on the same reusable box transform.
  const mesh = new T.Mesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  mesh.applyMatrix4(m.matrix);
  mesh.updateMatrixWorld(true);
  const origin = p.clone().addScaledVector(axis, 0.3),
    hit = new T.Raycaster(
      origin,
      axis.clone().negate(),
      0,
      0.5,
    ).intersectObject(mesh)[0];
  assert.ok(hit);
  assert.ok(Math.abs(hit.distance - (0.3 - D.picketDepth / 2)) < 1e-7);
  assert.ok(
    Math.abs(
      ironworkersMemberDistanceSquared(
        m,
        ...(origin.toArray() as [number, number, number]),
      ) -
        (0.3 - D.picketDepth / 2) ** 2,
    ) < 1e-9,
  );
  assert.equal(candidate.blockedAt(p.x, p.z, 0.01, p.y, true), true);
  const next = pickets[pickets.indexOf(m) + 1],
    gap = p
      .clone()
      .add(new T.Vector3(...next.centre))
      .multiplyScalar(0.5);
  assert.equal(
    candidate.blockedAt(gap.x, gap.z, 0.015, gap.y + 0.5, true),
    false,
    "small camera fits actual picket gap",
  );
  assert.equal(
    candidate.blockedAt(gap.x, gap.z, 0.18, gap.y + 0.5, true),
    true,
    "normal chase sphere meets adjacent pickets",
  );
  assert.equal(
    candidate.blockedAt(p.x, p.z, 0.1, m.max[1] + 0.11, true),
    false,
  );
  assert.equal(candidate.blockedAt(p.x, p.z, 0.1, m.min[1] - 0.2, true), false);
  const diagonal = p.clone().addScaledVector(axis, D.picketDepth / 2 + 0.08);
  diagonal.y = m.max[1] + 0.08;
  assert.equal(
    candidate.blockedAt(diagonal.x, diagonal.z, 0.1, diagonal.y, true),
    false,
    "sphere clears the diagonal above the real top edge",
  );
  const rail = candidate.members.find(
    (m) => m.kind === "rail" && Math.abs(m.station - LENGTH / 2) < 3,
  )!;
  const [x, y, z] = rail.centre;
  assert.equal(candidate.blockedAt(x, z, 0.02, y, true), true);
  // Sweep normal actors through the outer fence: movement subdivisions cannot skip all contact.
  for (const r of [0.36, 0.45, 1.16]) {
    let contacts = 0;
    for (let u = -2; u <= 2; u += Math.min(0.2, r * 0.6)) {
      const q = p.clone().addScaledVector(axis, u);
      if (candidate.blockedAt(q.x, q.z, r, m.min[1], false)) contacts++;
    }
    assert.ok(contacts >= 2);
  }
});

test("render batches stay bounded and LOD never changes collision members", () => {
  const before = candidate.members.length,
    view = candidate.createRenderGroup(
      new T.MeshBasicMaterial(),
      new T.MeshBasicMaterial({ side: T.DoubleSide }),
    );
  assert.equal(view.stats.chunks, Math.ceil(LENGTH / D.chunkLength));
  assert.ok(view.stats.maxDrawCalls <= 24);
  assert.ok(view.stats.pickets > 20000 && view.stats.pickets < 21000);
  const camera = new T.PerspectiveCamera();
  camera.position.set(0, 200, 0);
  camera.updateMatrixWorld(true);
  view.group.updateMatrixWorld(true);
  for (const child of view.group.children)
    if (child instanceof T.LOD) {
      child.update(camera);
      assert.equal(child.getCurrentLevel(), 1);
      assert.ok(child.levels.every((l) => l.object instanceof T.InstancedMesh));
    }
  assert.equal(candidate.members.length, before);
});
