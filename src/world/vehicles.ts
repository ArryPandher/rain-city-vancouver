import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { box, mesh, beam, label, Materials } from "./materials";
export interface VehicleModel {
  group: T.Group;
  wheels: T.Group[];
  front: T.Group[];
  brakes: T.MeshStandardMaterial;
  headlights: T.MeshStandardMaterial;
  body: T.Object3D;
  kind: "car" | "bike";
  color: number;
  crank?: T.Group;
  pedals?: T.Group[];
}
function hull(sections: number[][], mat: T.Material, parent: T.Object3D) {
  const p: number[] = [],
    idx: number[] = [];
  for (const [z, w, y0, y1] of sections)
    p.push(-w, y0, z, w, y0, z, -w, y1, z, w, y1, z);
  for (let i = 0; i < sections.length - 1; i++) {
    const a = i * 4,
      b = a + 4;
    idx.push(
      a,
      b,
      a + 2,
      b,
      b + 2,
      a + 2,
      a + 1,
      a + 3,
      b + 1,
      b + 1,
      a + 3,
      b + 3,
      a + 2,
      b + 2,
      a + 3,
      b + 2,
      b + 3,
      a + 3,
      a,
      b + 1,
      b,
      a,
      a + 1,
      b + 1,
    );
  }
  idx.push(0, 2, 1, 1, 2, 3);
  const n = (sections.length - 1) * 4;
  idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat, parent);
}
export function makeCar(
  m: Materials,
  color = 0x254d56,
  type: "sport" | "sedan" | "police" = "sport",
): VehicleModel {
  const group = new T.Group(),
    body = new T.Group();
  group.add(body);
  const paint = new T.MeshPhysicalMaterial({
    color,
    metalness: 0.68,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  const black = new T.MeshStandardMaterial({
    color: 0x111719,
    roughness: 0.47,
    metalness: 0.25,
  });
  const rubber = new T.MeshStandardMaterial({
    color: 0x151718,
    roughness: 0.92,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: 0x122b34,
    metalness: 0.3,
    roughness: 0.09,
    clearcoat: 1,
  });
  hull(
    [
      [-2.35, 0.75, 0.42, 0.68],
      [-2.08, 0.98, 0.35, 0.88],
      [-1.2, 1.0, 0.32, 0.99],
      [0.85, 0.96, 0.32, 0.98],
      [1.9, 0.96, 0.39, 0.78],
      [2.36, 0.8, 0.47, 0.68],
    ],
    paint,
    body,
  );
  hull(
    [
      [-0.98, 0.78, 0.9, 1.05],
      [-0.52, 0.7, 1.0, 1.53],
      [0.75, 0.68, 1.0, 1.51],
      [1.35, 0.8, 0.9, 1.0],
    ],
    glass,
    body,
  );
  const roof = mesh(
    new RoundedBoxGeometry(1.43, 0.1, 1.36, 3, 0.05),
    paint,
    body,
    0,
    1.52,
    0.1,
  );
  for (const side of [-1, 1]) {
    beam(
      body,
      paint,
      new T.Vector3(side * 0.78, 1.0, -1),
      new T.Vector3(side * 0.69, 1.51, -0.55),
      0.045,
    );
    beam(
      body,
      paint,
      new T.Vector3(side * 0.8, 1.0, 1.35),
      new T.Vector3(side * 0.69, 1.51, 0.76),
      0.045,
    );
    beam(
      body,
      black,
      new T.Vector3(side * 0.78, 0.98, 0.25),
      new T.Vector3(side * 0.71, 1.51, 0.25),
      0.045,
    );
    box(body, black, side * 1.0, 0.43, -0.03, 0.06, 0.12, 2.55);
    const mirror = mesh(
      new RoundedBoxGeometry(0.26, 0.14, 0.32, 2, 0.06),
      paint,
      body,
      side * 1.05,
      1.12,
      0.78,
    );
    box(body, m.chrome, side * 1.065, 1.13, 0.63, 0.17, 0.08, 0.015);
    box(body, m.chrome, side * 0.97, 0.97, -0.18, 0.035, 0.045, 0.24);
  }
  const wheels: T.Group[] = [],
    front: T.Group[] = [];
  for (const x of [-0.96, 0.96])
    for (const z of [-1.48, 1.47]) {
      const steer = new T.Group();
      steer.position.set(x, 0.39, z);
      group.add(steer);
      if (z > 0) front.push(steer);
      const spin = new T.Group();
      steer.add(spin);
      wheels.push(spin);
      const tire = mesh(
        new T.TorusGeometry(0.295, 0.092, 12, 32),
        rubber,
        spin,
      );
      tire.rotation.y = Math.PI / 2;
      const disc = mesh(
        new T.CylinderGeometry(0.225, 0.225, 0.16, 32),
        m.chrome,
        spin,
      );
      disc.rotation.z = Math.PI / 2;
      const inner = mesh(
        new T.CylinderGeometry(0.19, 0.19, 0.175, 24),
        black,
        spin,
      );
      inner.rotation.z = Math.PI / 2;
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5;
        const spoke = box(
          spin,
          m.chrome,
          Math.sign(x) * 0.097,
          Math.sin(a) * 0.12,
          Math.cos(a) * 0.12,
          0.027,
          0.044,
          0.22,
        );
        spoke.rotation.x = -a;
      }
      const hub = mesh(
        new T.CylinderGeometry(0.061, 0.061, 0.2, 16),
        m.chrome,
        spin,
      );
      hub.rotation.z = Math.PI / 2;
    }
  const headlights = new T.MeshStandardMaterial({
    color: 0xe6f8ff,
    emissive: 0xbce2ff,
    emissiveIntensity: 2.5,
  });
  const brakes = new T.MeshStandardMaterial({
    color: 0xab1722,
    emissive: 0xff1020,
    emissiveIntensity: 0.8,
  });
  for (const s of [-1, 1]) {
    box(body, headlights, s * 0.57, 0.74, 2.13, 0.48, 0.07, 0.11);
    box(body, headlights, s * 0.8, 0.7, 2.06, 0.08, 0.09, 0.25);
    box(body, brakes, s * 0.59, 0.77, -2.19, 0.48, 0.075, 0.06);
    const ex = mesh(
      new T.CylinderGeometry(0.071, 0.071, 0.22, 12),
      black,
      body,
      s * 0.58,
      0.39,
      -2.23,
    );
    ex.rotation.x = Math.PI / 2;
  }
  box(body, black, 0, 0.49, 2.27, 1.3, 0.17, 0.06);
  for (let i = -5; i <= 5; i++)
    box(body, m.chrome, i * 0.1, 0.49, 2.305, 0.017, 0.12, 0.01);
  box(body, black, 0, 0.55, -2.24, 1.3, 0.1, 0.12);
  const plateMat = new T.MeshStandardMaterial({
    map: label("RAIN CITY", 256, 90, "#254154", "#e9eae2", 33),
    roughness: 0.5,
  });
  box(body, plateMat, 0, 0.66, -2.31, 0.42, 0.14, 0.025);
  if (type === "sport") {
    box(body, black, 0, 0.96, -2.03, 1.7, 0.08, 0.25);
    for (const s of [-1, 1])
      box(body, black, s * 0.55, 0.84, -2, 0.05, 0.24, 0.08);
  }
  if (type === "police") {
    const red = new T.MeshStandardMaterial({
        emissive: 0xff2222,
        emissiveIntensity: 3,
        color: 0x902020,
      }),
      blue = new T.MeshStandardMaterial({
        emissive: 0x3388ff,
        emissiveIntensity: 3,
        color: 0x153f8f,
      });
    box(body, red, -0.3, 1.64, 0, 0.48, 0.1, 0.25);
    box(body, blue, 0.3, 1.64, 0, 0.48, 0.1, 0.25);
  }
  return { group, wheels, front, brakes, headlights, body, kind: "car", color };
}
export function makeBike(m: Materials): VehicleModel {
  const group = new T.Group(),
    frame = new T.MeshPhysicalMaterial({
      color: 0xc87839,
      metalness: 0.7,
      roughness: 0.3,
      clearcoat: 1,
    }),
    rubber = new T.MeshStandardMaterial({ color: 0x182024, roughness: 0.88 });
  const wheels: T.Group[] = [];
  const front: T.Group[] = [];
  for (const z of [-0.72, 0.72]) {
    const steer = new T.Group();
    steer.position.set(0, 0.37, z);
    group.add(steer);
    if (z > 0) front.push(steer);
    const wheel = new T.Group();
    steer.add(wheel);
    wheels.push(wheel);
    const tire = mesh(new T.TorusGeometry(0.34, 0.037, 8, 28), rubber, wheel);
    tire.rotation.y = Math.PI / 2;
    const rim = mesh(new T.TorusGeometry(0.3, 0.012, 6, 28), m.chrome, wheel);
    rim.rotation.y = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        wheel,
        m.chrome,
        new T.Vector3(0, 0, 0),
        new T.Vector3(0, Math.sin(a) * 0.3, Math.cos(a) * 0.3),
        0.004,
        4,
      );
    }
  }
  const nodes = [
    new T.Vector3(0, 0.37, -0.72),
    new T.Vector3(0, 0.4, 0),
    new T.Vector3(0, 1.02, -0.26),
    new T.Vector3(0, 1.13, 0.45),
    new T.Vector3(0, 0.37, 0.72),
  ];
  for (const [a, b] of [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 4],
  ])
    beam(group, frame, nodes[a], nodes[b], 0.026, 8);
  box(group, rubber, 0, 1.09, -0.29, 0.25, 0.055, 0.31);
  beam(group, m.chrome, nodes[3], new T.Vector3(0, 1.24, 0.49), 0.021);
  beam(
    group,
    rubber,
    new T.Vector3(-0.32, 1.24, 0.49),
    new T.Vector3(0.32, 1.24, 0.49),
    0.025,
  );
  const crank = new T.Group(),
    pedals: T.Group[] = [];
  crank.position.y = 0.4;
  group.add(crank);
  for (const side of [-1, 1]) {
    const pedal = new T.Group();
    pedal.position.set(side * 0.17, 0, side * 0.15);
    crank.add(pedal);
    pedals.push(pedal);
    box(pedal, rubber, 0, 0, 0, 0.2, 0.035, 0.1);
    beam(
      crank,
      m.chrome,
      new T.Vector3(side * 0.14, 0, 0),
      new T.Vector3(side * 0.14, 0, side * 0.15),
      0.017,
      8,
    );
  }
  const brakes = new T.MeshStandardMaterial({
      color: 0xf32120,
      emissive: 0xf32120,
      emissiveIntensity: 0.5,
    }),
    headlights = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2,
    });
  box(group, brakes, 0, 0.97, -0.5, 0.05, 0.05, 0.025);
  box(group, headlights, 0, 1.16, 0.54, 0.06, 0.06, 0.05);
  return {
    group,
    wheels,
    front,
    brakes,
    headlights,
    body: group,
    kind: "bike",
    color: 0xc87839,
    crank,
    pedals,
  };
}
