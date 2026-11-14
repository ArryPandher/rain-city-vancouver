import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Materials, box, mesh, beam, label } from "./materials";
import { geo, centroid, Building } from "./data";
import { BRIDGES, bridgeY, bridgePoint, bridgeSample } from "./collision";
import { ribbon } from "./geometry";
export function buildLandmarks(parent: T.Group, m: Materials) {
  const landmarkGroups: T.Group[] = [];
  function place(lat: number, lon: number, angle = 0) {
    const g = new T.Group();
    const [x, z] = geo(lat, lon);
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    parent.add(g);
    landmarkGroups.push(g);
    return g;
  }
  const blue = new T.MeshPhysicalMaterial({
    color: 0x506e73,
    metalness: 0.5,
    roughness: 0.23,
    clearcoat: 0.8,
  });
  const sail = new T.MeshStandardMaterial({
    color: 0xf7f4e7,
    roughness: 0.75,
    side: T.DoubleSide,
  });
  const green = new T.MeshStandardMaterial({
    color: 0x476550,
    roughness: 0.88,
  });
  // Cruise ship beside the real Canada Place landmark model.
  {
    const g = place(49.28845, -123.1118, -0.39);
    // Harbour cruise ship, in-world scale with deck railings and lifeboats.
    const ship = new T.Group();
    ship.position.set(122, 0, -25);
    g.add(ship);
    const hullPos: number[] = [],
      hullUV: number[] = [],
      hullIdx: number[] = [];
    const hullRings = [
        [0.0, 0.72],
        [4, 0.92],
        [10, 1],
        [15, 1],
      ],
      segments = 80;
    for (let r = 0; r < hullRings.length; r++)
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2,
          zz = Math.cos(a) * 120,
          bow = zz > 55 ? 1 - 0.8 * Math.pow((zz - 55) / 65, 1.5) : 1,
          xx =
            Math.sign(Math.sin(a)) *
            Math.pow(Math.abs(Math.sin(a)), 0.35) *
            17 *
            bow *
            hullRings[r][1];
        hullPos.push(xx, hullRings[r][0], zz);
        hullUV.push(i / segments, r / 3);
        if (r && i) {
          const n = r * (segments + 1) + i;
          hullIdx.push(
            n,
            n - 1,
            n - segments - 1,
            n - 1,
            n - segments - 2,
            n - segments - 1,
          );
        }
      }
    const hull = new T.BufferGeometry();
    hull.setAttribute("position", new T.Float32BufferAttribute(hullPos, 3));
    hull.setAttribute("uv", new T.Float32BufferAttribute(hullUV, 2));
    hull.setIndex(hullIdx);
    hull.computeVertexNormals();
    mesh(hull, m.white, ship);
    const deckMat = new T.MeshStandardMaterial({
      color: 0xb5a794,
      roughness: 0.9,
    });
    const shipGlass = new T.MeshStandardMaterial({
      color: 0x24414c,
      metalness: 0.48,
      roughness: 0.19,
    });
    mesh(new RoundedBoxGeometry(31, 0.8, 221, 4, 3), deckMat, ship, 0, 15, -3);
    for (let k = 0; k < 5; k++) {
      const length = 199 - k * 13,
        width = 30 - k * 0.7,
        y = 17.1 + k * 3.05;
      mesh(
        new RoundedBoxGeometry(width, 2.8, length, 3, 0.8),
        m.white,
        ship,
        0,
        y,
        -5 - k * 3,
      );
      mesh(
        new RoundedBoxGeometry(width + 0.6, 0.28, length + 0.6, 3, 0.5),
        m.white,
        ship,
        0,
        y + 1.4,
        -5 - k * 3,
      );
      for (const side of [-1, 1]) {
        box(
          ship,
          shipGlass,
          side * (width / 2 + 0.02),
          y + 0.1,
          -5 - k * 3,
          0.045,
          1.43,
          length - 7,
        );
        for (let zz = -length / 2 + 2; zz < length / 2 - 5; zz += 3.4)
          box(
            ship,
            m.white,
            side * (width / 2 + 0.08),
            y + 0.1,
            zz - 5 - k * 3,
            0.07,
            1.6,
            0.16,
          );
        beam(
          ship,
          m.chrome,
          new T.Vector3(
            side * (width / 2 + 0.35),
            y - 0.38,
            -length / 2 - 5 - k * 3,
          ),
          new T.Vector3(
            side * (width / 2 + 0.35),
            y - 0.38,
            length / 2 - 7 - k * 3,
          ),
          0.045,
          5,
        );
      }
    }
    const life = new T.MeshStandardMaterial({
      color: 0xca7431,
      roughness: 0.6,
    });
    for (const side of [-1, 1])
      for (let zz = -76; zz < 77; zz += 16) {
        mesh(
          new RoundedBoxGeometry(3.3, 2.8, 10.5, 3, 1),
          life,
          ship,
          side * 17,
          13.5,
          zz,
        );
        for (const dx of [-1, 1])
          beam(
            ship,
            m.white,
            new T.Vector3(side * 14, 18, zz + dx * 3),
            new T.Vector3(side * 18, 17, zz + dx * 3),
            0.12,
            6,
          );
      }
    mesh(new RoundedBoxGeometry(10, 9, 18, 3, 2), m.white, ship, 0, 35, -40);
    mesh(
      new RoundedBoxGeometry(10.5, 2.1, 18.5, 3, 2),
      m.dark,
      ship,
      0,
      39.5,
      -40,
    );
    for (const zz of [-75, 45]) {
      mesh(new T.SphereGeometry(3.2, 16, 12), m.white, ship, 0, 35, zz);
      beam(
        ship,
        m.chrome,
        new T.Vector3(0, 30, zz),
        new T.Vector3(0, 43, zz),
        0.13,
        6,
      );
    }
    const pool = mesh(
      new RoundedBoxGeometry(8, 0.2, 18, 3, 2),
      new T.MeshPhysicalMaterial({
        color: 0x4d9da6,
        metalness: 0.3,
        roughness: 0.12,
      }),
      ship,
      0,
      31.1,
      10,
    );
    for (let zz = -65; zz < 65; zz += 5)
      for (const side of [-1, 1])
        box(ship, deckMat, side * 9, 31.4, zz, 1, 0.45, 2.2);
    for (let zz = -103; zz < 100; zz += 8)
      for (const side of [-1, 1]) {
        const porthole = mesh(
          new T.CircleGeometry(0.45, 12),
          shipGlass,
          ship,
          side * 17.025,
          8.4,
          zz,
        );
        porthole.rotation.y = (side * Math.PI) / 2;
      }
  }
  // Robson Square's stepped planters and reflecting pools occupy the open plaza.
  {
    const g = place(49.28214, -123.1212, -0.7);
    for (let j = 0; j < 4; j++) {
      box(g, m.concrete, 16 + j * 3, 0.35 + j * 0.18, j * 13, 36, 1.2, 9);
      box(g, m.grass, 16 + j * 3, 1.01 + j * 0.18, j * 13, 33, 0.1, 6);
    }
    const water = new T.MeshPhysicalMaterial({
      color: 0x375b5f,
      metalness: 0.45,
      roughness: 0.12,
      clearcoat: 1,
    });
    box(g, m.concrete, -10, 0.1, 8, 21, 0.3, 38);
    box(g, water, -10, 0.3, 8, 19, 0.08, 36);
    for (let i = 0; i < 7; i++)
      box(g, m.concrete, -28, 0.1 + i * 0.12, -25 + i * 0.65, 20, 0.22, 0.68);
    for (let j = 0; j < 5; j++) {
      beam(
        g,
        m.chrome,
        new T.Vector3(-35, 0, j * 7),
        new T.Vector3(-35, 3.8, j * 7),
        0.08,
      );
      beam(
        g,
        m.chrome,
        new T.Vector3(-35, 3.8, j * 7),
        new T.Vector3(-20, 3.8, j * 7),
        0.08,
      );
    }
  }
  // Small boats in Coal Harbour.
  for (let j = 0; j < 18; j++) {
    const g = place(
      49.292 + (j % 4) * 0.00023,
      -123.124 - Math.floor(j / 4) * 0.0004,
      -0.7,
    );
    box(g, m.white, 0, 1, 0, 3.3, 2, 10);
    box(g, m.dark, 0, 2, 0, 2.8, 0.1, 5);
    beam(g, m.chrome, new T.Vector3(0, 1, 0), new T.Vector3(0, 14, 0), 0.06, 6);
    beam(g, m.chrome, new T.Vector3(0, 5, 0), new T.Vector3(0, 4, 5), 0.04, 5);
  }
  // Bridges have playable continuous elevation profiles matching their rendered deck.
  for (const b of BRIDGES) {
    const g = new T.Group();
    parent.add(g);
    const length = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]),
      n = Math.ceil(length / 12),
      points: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      points.push(...bridgePoint(b, t));
    }
    const height = (x: number, z: number) => {
      return bridgeY(b, bridgeSample(b, x, z).t);
    };
    mesh(ribbon(points, b.width, 0.0, height), m.asphalt, g);
    const dx = (b.b[0] - b.a[0]) / length,
      dz = (b.b[1] - b.a[1]) / length,
      nx = dz,
      nz = -dx;
    const p = (t: number, side: number, y: number) =>
      new T.Vector3(
        bridgePoint(b, t)[0] + nx * side,
        y,
        bridgePoint(b, t)[1] + nz * side,
      );
    for (let i = 0; i < n; i++) {
      const t = i / n,
        tt = (i + 1) / n;
      for (const s of [-1, 1]) {
        const edge = (b.width / 2) * s;
        beam(
          g,
          m.concrete,
          p(t, edge, bridgeY(b, t) + 0.5),
          p(tt, edge, bridgeY(b, tt) + 0.5),
          0.4,
          6,
        );
        if (i % 3 === 0)
          beam(
            g,
            m.chrome,
            p(t, edge, bridgeY(b, t) + 0.5),
            p(t, edge, bridgeY(b, t) + 2),
            0.06,
            5,
          );
        beam(
          g,
          m.chrome,
          p(t, edge, bridgeY(b, t) + 2),
          p(tt, edge, bridgeY(b, tt) + 2),
          0.05,
          5,
        );
      }
      if (i % 2 === 0) {
        const strip = ribbon(
          points.slice(i * 2, Math.min((i + 2) * 2, points.length)),
          0.18,
          0.045,
          height,
        );
        mesh(strip, m.yellow, g);
      }
    }
    for (let t = 0.1; t < 1; t += 0.13) {
      const y = bridgeY(b, t);
      for (const s of [-1, 1])
        beam(
          g,
          m.concrete,
          p(t, b.width * 0.29 * s, -6),
          p(t, b.width * 0.29 * s, y - 1),
          1.7,
          8,
        );
    }
    if (b.style === "suspension") {
      const steel = new T.MeshStandardMaterial({
        color: 0x487e6d,
        metalness: 0.35,
        roughness: 0.57,
      });
      for (const t of [0.28, 0.73]) {
        for (const s of [-1, 1]) {
          beam(g, steel, p(t, s * 13, -8), p(t, s * 13, 102), 1.6, 8);
        }
        for (let y = 35; y < 100; y += 15) {
          beam(g, steel, p(t, -13, y), p(t, 13, y), 1.1, 8);
          beam(g, steel, p(t, -13, y), p(t, 13, y + 13), 0.45, 6);
        }
      }
      for (const s of [-1, 1])
        for (let i = 0; i < 70; i++) {
          const t = i / 70,
            tt = (i + 1) / 70;
          const cable = (t: number) =>
            t < 0.28
              ? 12 + (90 * t) / 0.28
              : t > 0.73
                ? 102 - (90 * (t - 0.73)) / 0.27
                : 53 + 49 * Math.pow((t - 0.505) / 0.225, 2);
          beam(
            g,
            steel,
            p(t, s * 12, cable(t)),
            p(tt, s * 12, cable(tt)),
            0.4,
            6,
          );
          if (i % 2 === 0)
            beam(
              g,
              m.chrome,
              p(t, s * 12, bridgeY(b, t) + 1),
              p(t, s * 12, cable(t)),
              0.1,
              5,
            );
        }
    } else if (b.style === "truss") {
      const steel = new T.MeshStandardMaterial({
        color: b.id === "ironworkers" ? 0x5b7f80 : 0x687679,
        metalness: 0.35,
        roughness: 0.6,
      });
      const count = Math.floor(length / 40);
      for (let i = 3; i < count - 3; i++) {
        const t = i / count,
          tt = (i + 1) / count,
          y = bridgeY(b, t),
          yy = bridgeY(b, tt);
        for (const s of [-1, 1]) {
          beam(
            g,
            steel,
            p(t, s * b.width * 0.47, y + 15),
            p(tt, s * b.width * 0.47, yy + 15),
            0.45,
            6,
          );
          beam(
            g,
            steel,
            p(t, s * b.width * 0.47, y),
            p(t, s * b.width * 0.47, y + 15),
            0.45,
            6,
          );
          beam(
            g,
            steel,
            p(t, s * b.width * 0.47, y),
            p(tt, s * b.width * 0.47, yy + 15),
            0.28,
            6,
          );
        }
        beam(
          g,
          steel,
          p(t, -b.width * 0.47, y + 15),
          p(t, b.width * 0.47, y + 15),
          0.35,
          6,
        );
      }
    }
  }
  return landmarkGroups;
}
