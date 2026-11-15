import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import type { PwcPlaceMaterials } from "./pwc-place-materials";
import {
  PWC_LOBBY_CEILING as ceiling,
  createPwcLobbySite,
  type PwcLobbySite,
} from "./pwc-lobby-site";
import { PWC_PLACE_LOBBY_TOP } from "./pwc-place-site";

/** Closed visual lobby behind an open, physically described exterior recess.
 * No photograph texture, room furnishing or invented door-leaf pattern. */
export function buildPwcLobbyFrontage(
  mesh: ArchitecturalMesh,
  edge: number,
  m: PwcPlaceMaterials,
  site: PwcLobbySite = createPwcLobbySite(() => 0),
) {
  const section = site.sections.find((s) => s.edge === edge);
  if (!section) return false;
  const { frame: f, plan, mouth, depth, entry, heightAt: floor } = section,
    yaw = -Math.atan2(f.outward[0], -f.outward[1]);
  const quad = (material: T.Material, points: Vertex3[], normal: Vertex3) => {
    const cross = new T.Vector3(...points[1])
      .sub(new T.Vector3(...points[0]))
      .cross(new T.Vector3(...points[2]).sub(new T.Vector3(...points[0])));
    if (cross.dot(new T.Vector3(...normal)) < 0)
      points = [points[0], points[3], points[2], points[1]];
    const w = new T.Vector3(...points[0]).distanceTo(
        new T.Vector3(...points[1]),
      ),
      h = new T.Vector3(...points[0]).distanceTo(new T.Vector3(...points[3]));
    mesh.quad(material, points[0], points[1], points[2], points[3], [
      0,
      0,
      w,
      0,
      w,
      h,
      0,
      h,
    ]);
  };
  type Height = number | ((u: number) => number);
  const at = (height: Height, u: number) =>
    typeof height === "number" ? height : height(u);
  const cuts = (left: number, right: number) => [
    left,
    ...section.stations.filter((u) => u > left + 1e-8 && u < right - 1e-8),
    right,
  ];
  const face = (
    left: number,
    right: number,
    low: Height,
    high: Height,
    d: number,
    material: T.Material,
  ) => {
    const split = cuts(left, right);
    for (let i = 0; i < split.length - 1; i++) {
      const l = split[i],
        r = split[i + 1];
      quad(
        material,
        [
          f.p(l, at(low, l), d),
          f.p(r, at(low, r), d),
          f.p(r, at(high, r), d),
          f.p(l, at(high, l), d),
        ],
        [f.outward[0], 0, f.outward[1]],
      );
    }
  };
  const horizontal = (
    left: number,
    right: number,
    near: number,
    far: number,
    y: Height,
    up: boolean,
    material = m.stone,
  ) => {
    const split = cuts(left, right);
    for (let i = 0; i < split.length - 1; i++) {
      const l = split[i],
        r = split[i + 1];
      quad(
        material,
        [
          f.p(l, at(y, l), near),
          f.p(r, at(y, r), near),
          f.p(r, at(y, r), far),
          f.p(l, at(y, l), far),
        ],
        [0, up ? 1 : -1, 0],
      );
    }
  };
  const side = (
    u: number,
    near: number,
    far: number,
    left: boolean,
    material = m.stone,
    low: Height = floor,
    high: Height = ceiling,
  ) =>
    quad(
      material,
      [
        f.p(u, at(low, u), near),
        f.p(u, at(low, u), far),
        f.p(u, at(high, u), far),
        f.p(u, at(high, u), near),
      ],
      [
        left ? -f.outward[1] : f.outward[1],
        0,
        left ? f.outward[0] : -f.outward[0],
      ],
    );

  // Outer fascia and low stone threshold remain attached to the original edge.
  face(0, f.length, 0, floor, 0, m.stone);
  face(0, mouth, floor, ceiling, 0, m.stone);
  face(f.length - mouth, f.length, floor, ceiling, 0, m.stone);
  face(0, f.length, ceiling, PWC_PLACE_LOBBY_TOP, 0, m.metal);
  horizontal(0, f.length, 0, 0.16, ceiling, false, m.metal);

  // Trapezoid strips tessellate the actual footprint of the recess without
  // an overlapping floor across its opaque rear mass or adjacent facade.
  for (const panel of site.floorPanels.filter((p) => p.edge === edge))
    quad(m.stone, panel.corners, [0, 1, 0]);
  for (const [left, right, near, far] of section.strips) {
    horizontal(left, right, near, far, ceiling, false);
  }

  for (let i = 1; i < plan.length; i++) {
    const [ua, da] = plan[i],
      [ub, db] = plan[(i + 1) % plan.length],
      glass = Math.abs(da - db) < 1e-8 && da >= depth,
      pa = f.p(ua, floor(ua), da),
      pb = f.p(ub, floor(ub), db),
      normal: Vertex3 = [-(pb[2] - pa[2]), 0, pb[0] - pa[0]];
    if (!glass) {
      quad(
        m.stone,
        [pa, pb, f.p(ub, ceiling, db), f.p(ua, ceiling, da)],
        normal,
      );
      continue;
    }
    const left = Math.min(ua, ub),
      right = Math.max(ua, ub),
      // Visual-only depth estimate: the collision surface remains the glass.
      // All sampled cavity points stay inside the retained source footprint.
      back = da + 3.2,
      entryZone = entry && da === entry.depth,
      centre = (left + right) / 2,
      rearZones = entryZone
        ? [
            { left, right: centre - 1.6, depth: back, material: m.lobbyRear },
            {
              left: centre - 1.6,
              right: centre + 1.6,
              depth: back + 1,
              material: m.backing,
            },
            { left: centre + 1.6, right, depth: back, material: m.lobbyRear },
          ]
        : [{ left, right, depth: back, material: m.lobbyRear }];
    face(left, right, floor, ceiling, da, m.lobbyGlass);
    side(left, da, back, true, m.lobbyLining);
    side(right, da, back, false, m.lobbyLining);

    // Continuous full-height rear surfaces replace the bordered pale fields.
    // Only structural returns/soffits remain pale. The deeper dark entry is a
    // closed visual inference; no door leaves, room use or furnishings claimed.
    for (let zone = 0; zone < rearZones.length; zone++) {
      const rear = rearZones[zone],
        previous = rearZones[zone - 1];
      face(rear.left, rear.right, floor, ceiling, rear.depth, rear.material);
      horizontal(rear.left, rear.right, da, rear.depth, floor, true);
      horizontal(
        rear.left,
        rear.right,
        da,
        rear.depth,
        ceiling,
        false,
        m.lobbyLining,
      );
      if (previous && previous.depth !== rear.depth)
        side(
          rear.left,
          Math.min(previous.depth, rear.depth),
          Math.max(previous.depth, rear.depth),
          rear.depth > previous.depth,
          m.lobbyLining,
        );
    }
    // Continuous commercial screen: sparse full-height uprights and a low
    // entrance-scale transom, without pretending to know the door leaves.
    const bays = Math.max(
      1,
      Math.round((right - left) / (entry && da === entry.depth ? 3 : 2.2)),
    );
    for (let bay = 0; bay <= bays; bay++) {
      const u = left + ((right - left) * bay) / bays;
      mesh.box(
        f.p(u, (floor(u) + ceiling) / 2, da - 0.04),
        0.065,
        ceiling - floor(u),
        0.12,
        m.metal,
        yaw,
      );
    }
    for (const [y, h] of [
      [(u: number) => floor(u) + 0.045, 0.09],
      // Upper screen rails are level architectural members. Only the bottom
      // threshold follows the pavement; draping this transom bends the facade.
      [5.0, 0.095],
      [6.8, 0.07],
      [ceiling - 0.045, 0.09],
    ] as [Height, number][]) {
      const split = cuts(left, right);
      for (let i = 0; i < split.length - 1; i++) {
        const a = new T.Vector3(...f.p(split[i], at(y, split[i]), da - 0.04)),
          b = new T.Vector3(
            ...f.p(split[i + 1], at(y, split[i + 1]), da - 0.04),
          ),
          tangent = b.clone().sub(a).normalize(),
          normal = new T.Vector3(f.outward[0], 0, f.outward[1]),
          up = normal.clone().cross(tangent).normalize(),
          geometry = new T.BoxGeometry(a.distanceTo(b), h, 0.12);
        geometry.applyMatrix4(new T.Matrix4().makeBasis(tangent, up, normal));
        geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        mesh.add(geometry, m.metal);
      }
    }
    // Sparse rear structural ribs are independent of the glazing divisions.
    // Entry depth returns replace its old centre rib, keeping that view open.
    const ribs = entryZone ? 1 : Math.max(1, Math.round((right - left) / 3.4));
    for (let rib = 1; rib < ribs; rib++) {
      const u = left + ((right - left) * rib) / ribs;
      mesh.box(
        f.p(u, (floor(u) + ceiling) / 2, back - 0.3),
        0.28,
        ceiling - floor(u),
        0.6,
        m.lobbyLining,
        yaw,
      );
    }
  }

  for (const c of site.columns.filter((c) => c.edge === edge)) {
    const g = new T.CylinderGeometry(c.radius, c.radius, c.top - c.bottom, 24),
      uv = g.getAttribute("uv");
    for (let j = 0; j < uv.count; j++)
      uv.setXY(
        j,
        uv.getX(j) * Math.PI * c.radius * 2,
        uv.getY(j) * (c.top - c.bottom),
      );
    g.translate(c.x, (c.bottom + c.top) / 2, c.z);
    mesh.add(g, m.stone);
  }
  return true;
}
