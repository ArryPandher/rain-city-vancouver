import * as T from "three";
import { makeDetailedCharacter } from "./detailed-character";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mesh, box, Materials, beam } from "../world/materials";
export interface Character {
  group: T.Group;
  hips: T.Group;
  arms: T.Group[];
  legs: T.Group[];
  head: T.Group;
  rightHand: T.Group;
  update: (
    t: number,
    speed: number,
    aim: boolean,
    bike?: boolean,
    cyclePhase?: number,
  ) => void;
}
const fabricCache = new Map<string, T.CanvasTexture>();
function fabric(kind: string) {
  if (fabricCache.has(kind)) return fabricCache.get(kind)!;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = kind === "denim" ? "#a3a9ab" : "#c2c0b8";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 2) {
    ctx.strokeStyle = i % 4 ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.13)";
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, kind === "denim" ? i - 160 : i);
    ctx.stroke();
    ctx.strokeStyle = "rgba(30,30,30,.08)";
    ctx.fillRect(i, 0, 1, 512);
  }
  for (let i = 0; i < 70; i++) {
    const y = i * 7.3;
    ctx.fillStyle = `rgba(30,30,30,${0.006 + (i % 4) * 0.003})`;
    ctx.fillRect(0, y, 512, 2);
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = 8;
  fabricCache.set(kind, t);
  return t;
}
function garment(profile: number[][], depth: number) {
  const g = new T.LatheGeometry(
    profile.map(([r, y]) => new T.Vector2(r, y)),
    32,
  );
  g.scale(1, 1, depth);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i),
      a = Math.atan2(p.getZ(i) / depth, p.getX(i)),
      wave = Math.sin(y * 100 + a * 2) * Math.sin(a * 3) * 0.0025;
    p.setX(i, p.getX(i) + Math.cos(a) * wave);
    p.setZ(i, p.getZ(i) + Math.sin(a) * wave * depth);
  }
  g.computeVertexNormals();
  return g;
}
export function makeCharacter(m: Materials, variant = 0): Character {
  if (variant === 0) {
    const detailed = makeDetailedCharacter();
    if (detailed) return detailed;
  }
  const group = new T.Group(),
    hips = new T.Group();
  hips.position.y = 0.94;
  group.add(hips);
  const skin = new T.MeshStandardMaterial({
    color: [0xb58b6e, 0x825e49, 0xc2a68a, 0x72523f][variant % 4],
    roughness: 0.82,
  });
  const shirt = new T.MeshStandardMaterial({
    color: [0x3f514c, 0x6a7274, 0x674b3d, 0x303d52, 0x897866][variant % 5],
    roughness: 0.92,
    map: fabric("cotton"),
    bumpMap: fabric("cotton"),
    bumpScale: 0.008,
  });
  const denim = new T.MeshStandardMaterial({
    color: variant === 0 ? 0x394750 : 0x364046,
    roughness: 0.95,
    map: fabric("denim"),
    bumpMap: fabric("denim"),
    bumpScale: 0.012,
  });
  const shoe = new T.MeshStandardMaterial({ color: 0x25282a, roughness: 0.8 });
  const hair = new T.MeshStandardMaterial({ color: 0x382c25, roughness: 1 });
  mesh(new RoundedBoxGeometry(0.34, 0.21, 0.24, 3, 0.06), denim, hips, 0, 0, 0);
  const torso = mesh(
    garment(
      [
        [0.158, 0.04],
        [0.166, 0.08],
        [0.161, 0.14],
        [0.17, 0.22],
        [0.199, 0.34],
        [0.216, 0.41],
        [0.195, 0.49],
        [0.076, 0.54],
      ],
      0.61,
    ),
    shirt,
    hips,
  );
  const collar = mesh(
    new T.TorusGeometry(0.074, 0.012, 8, 32),
    shirt,
    hips,
    0,
    0.544,
    0,
  );
  collar.rotation.x = Math.PI / 2;
  const seam = new T.MeshStandardMaterial({ color: 0x697674, roughness: 1 });
  for (const side of [-1, 1]) {
    beam(
      hips,
      seam,
      new T.Vector3(side * 0.159, 0.065, 0),
      new T.Vector3(side * 0.196, 0.37, 0),
      0.002,
      5,
    );
    const pocket = mesh(
      new RoundedBoxGeometry(0.115, 0.105, 0.009, 2, 0.009),
      denim,
      hips,
      side * 0.09,
      -0.037,
      -0.121,
    );
    pocket.rotation.z = side * 0.04;
    for (let j = 0; j < 2; j++)
      box(
        hips,
        seam,
        side * 0.092,
        -0.012 - j * 0.011,
        -0.127,
        0.095,
        0.002,
        0.002,
      );
  }
  box(
    hips,
    new T.MeshStandardMaterial({ color: 0x1a2427, roughness: 0.8 }),
    0,
    0.045,
    0.035,
    0.35,
    0.055,
    0.25,
  );
  box(hips, m.chrome, 0, 0.045, 0.167, 0.052, 0.045, 0.012);
  // Neck, sculpted head, eyes, ears, brows, short hair and nose.
  mesh(new T.CylinderGeometry(0.052, 0.059, 0.11, 12), skin, hips, 0, 0.58, 0);
  const head = new T.Group();
  head.position.set(0, 0.72, 0);
  hips.add(head);
  const skull = mesh(new T.SphereGeometry(0.105, 20, 16), skin, head, 0, 0, 0);
  skull.scale.set(0.9, 1.3, 0.94);
  const jaw = mesh(
    new RoundedBoxGeometry(0.14, 0.1, 0.14, 3, 0.04),
    skin,
    head,
    0,
    -0.075,
    0.016,
  );
  mesh(new T.SphereGeometry(0.017, 8, 8), skin, head, 0, -0.007, 0.101);
  for (const x of [-0.091, 0.091]) {
    const ear = mesh(
      new T.SphereGeometry(0.023, 8, 8),
      skin,
      head,
      x,
      -0.016,
      0,
    );
    ear.scale.y = 1.35;
  }
  const top = mesh(
    new T.SphereGeometry(0.107, 16, 10, 0, Math.PI * 2, 0, 1.65),
    hair,
    head,
    0,
    0.014,
    -0.006,
  );
  top.scale.set(0.93, 1.3, 0.94);
  for (const x of [-0.038, 0.038]) {
    box(head, hair, x, 0.025, 0.087, 0.03, 0.009, 0.008);
    const eye = mesh(
      new T.SphereGeometry(0.007, 8, 8),
      m.dark,
      head,
      x,
      0.008,
      0.096,
    );
    eye.scale.x = 1.5;
  }
  box(head, hair, 0, -0.052, 0.096, 0.045, 0.009, 0.008);
  const arms: T.Group[] = [],
    legs: T.Group[] = [],
    knees: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * 0.226, 0.44, 0);
    hips.add(arm);
    arms.push(arm);
    const shoulder = mesh(
      new T.CapsuleGeometry(0.067, 0.1, 4, 10),
      shirt,
      arm,
      side * 0.015,
      -0.078,
      0,
    );
    const upper = mesh(
      new T.CapsuleGeometry(0.052, 0.15, 4, 10),
      skin,
      arm,
      side * 0.015,
      -0.19,
      0,
    );
    const fore = mesh(
      new T.CapsuleGeometry(0.043, 0.17, 4, 10),
      skin,
      arm,
      side * 0.015,
      -0.39,
      0.025,
    );
    const hand = mesh(
      new T.SphereGeometry(0.047, 10, 8),
      skin,
      arm,
      side * 0.015,
      -0.53,
      0.04,
    );
    hand.scale.set(0.72, 1.2, 0.9);
    const leg = new T.Group();
    leg.position.set(side * 0.097, -0.1, 0);
    hips.add(leg);
    legs.push(leg);
    mesh(
      garment(
        [
          [0.066, -0.43],
          [0.07, -0.35],
          [0.079, -0.22],
          [0.088, -0.11],
          [0.091, 0.02],
        ],
        0.9,
      ),
      denim,
      leg,
    );
    const knee = new T.Group();
    knee.position.y = -0.4;
    leg.add(knee);
    knees.push(knee);
    mesh(
      garment(
        [
          [0.056, -0.35],
          [0.055, -0.31],
          [0.061, -0.2],
          [0.069, -0.07],
          [0.068, 0.015],
        ],
        0.9,
      ),
      denim,
      knee,
    );
    const foot = mesh(
      new RoundedBoxGeometry(0.138, 0.105, 0.278, 4, 0.026),
      shoe,
      knee,
      0,
      -0.375,
      0.06,
    );
    box(knee, m.dark, 0, -0.414, 0.05, 0.14, 0.023, 0.29);
    for (let i = 0; i < 4; i++)
      box(knee, seam, 0, -0.321, 0.077 + i * 0.019, 0.065, 0.005, 0.006);
    box(knee, shirt, 0, -0.298, -0.046, 0.14, 0.06, 0.06);
  }
  const watch = new T.MeshStandardMaterial({
    color: 0x222d32,
    metalness: 0.45,
    roughness: 0.38,
  });
  const band = mesh(
    new T.CylinderGeometry(0.048, 0.048, 0.036, 16),
    watch,
    arms[0],
    -0.015,
    -0.445,
    0.025,
  );
  box(arms[0], m.chrome, -0.015, -0.445, 0.07, 0.037, 0.031, 0.013);
  const rightHand = new T.Group();
  rightHand.position.set(0.015, -0.49, 0.07);
  arms[1].add(rightHand);
  const update = (t: number, speed: number, aim: boolean, bike = false) => {
    const moving = Math.min(1, speed / 2),
      run = speed > 4;
    const phase = t * (run ? 11 : 7.5);
    hips.position.y = 0.94 + Math.sin(phase * 2) * 0.026 * moving;
    legs[0].rotation.x = Math.sin(phase) * (run ? 0.72 : 0.5) * moving;
    legs[1].rotation.x = -legs[0].rotation.x;
    arms[0].rotation.x = -legs[0].rotation.x * 0.8;
    arms[1].rotation.x = -legs[1].rotation.x * 0.8;
    knees[0].rotation.x =
      Math.max(0, -Math.cos(phase)) * (run ? 0.85 : 0.35) * moving;
    knees[1].rotation.x =
      Math.max(0, Math.cos(phase)) * (run ? 0.85 : 0.35) * moving;
    hips.rotation.z = Math.sin(phase) * 0.028 * moving;
    arms.forEach((a, i) => (a.rotation.z = i === 0 ? 0.09 : -0.09));
    if (aim) {
      arms[1].rotation.x = -1.58;
      arms[0].rotation.x = -1.35;
      arms[0].rotation.z = -0.42;
      arms[1].rotation.z = 0.05;
    }
    if (bike) {
      hips.position.y = 1.14;
      hips.rotation.x = 0.27;
      legs[0].rotation.x = 0.9 + Math.sin(phase) * 0.45;
      legs[1].rotation.x = 0.9 - Math.sin(phase) * 0.45;
      arms[0].rotation.x = arms[1].rotation.x = -0.9;
    } else hips.rotation.x = 0;
  };
  return { group, hips, arms, legs, head, rightHand, update };
}
export function makeWeapon(m: Materials, type: number) {
  const g = new T.Group();
  const steel = new T.MeshStandardMaterial({
      color: 0x202a30,
      metalness: 0.7,
      roughness: 0.31,
    }),
    grip = new T.MeshStandardMaterial({
      color: type === 2 ? 0x624b36 : 0x293238,
      roughness: 0.78,
    });
  const len = type === 0 ? 0.24 : type === 1 ? 0.68 : 0.82;
  mesh(
    new RoundedBoxGeometry(0.055, 0.06, len * 0.65, 3, 0.005),
    steel,
    g,
    0,
    0,
    len * 0.22,
  );
  const handle = mesh(
    new RoundedBoxGeometry(0.048, 0.137, 0.067, 3, 0.009),
    grip,
    g,
    0,
    -0.078,
    0,
  );
  handle.rotation.x = -0.16;
  const barrel = mesh(
    new T.CylinderGeometry(
      type === 2 ? 0.017 : 0.012,
      type === 2 ? 0.019 : 0.014,
      len * 0.48,
      12,
    ),
    steel,
    g,
    0,
    0,
    len * 0.72,
  );
  barrel.rotation.x = Math.PI / 2;
  if (type > 0) {
    mesh(
      new RoundedBoxGeometry(0.07, 0.11, 0.26, 3, 0.012),
      grip,
      g,
      0,
      -0.032,
      -0.16,
    );
    mesh(
      new RoundedBoxGeometry(0.073, 0.07, 0.22, 3, 0.01),
      grip,
      g,
      0,
      -0.04,
      0.24,
    );
    for (let i = 0; i < 12; i++)
      box(g, steel, 0, 0.066, 0.015 + i * 0.022, 0.057, 0.012, 0.011);
    box(g, steel, 0, -0.13, 0.105, 0.038, 0.16, 0.07);
    box(g, m.dark, 0, 0.063, 0.14, 0.03, 0.03, 0.16);
  } else {
    box(g, m.dark, 0, 0.04, -0.015, 0.035, 0.018, 0.013);
    box(g, m.dark, 0, 0.04, 0.16, 0.009, 0.017, 0.014);
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        box(
          g,
          m.dark,
          side * 0.0283,
          0.002,
          -0.018 + i * 0.007,
          0.002,
          0.042,
          0.002,
        );
    box(g, m.dark, 0.0285, 0.012, 0.075, 0.002, 0.016, 0.034);
    for (let i = 0; i < 9; i++)
      box(g, m.dark, 0, -0.042 - i * 0.009, -0.035, 0.041, 0.002, 0.004);
    const muzzle = mesh(
      new T.CircleGeometry(0.008, 16),
      m.dark,
      g,
      0,
      0,
      len * 0.96 + 0.0005,
    );
  }
  const trigger = new T.TorusGeometry(0.024, 0.004, 5, 10, Math.PI * 1.6);
  const t = mesh(trigger, steel, g, 0, -0.055, 0.068);
  t.rotation.y = Math.PI / 2;
  g.rotation.x = Math.PI / 2;
  return g;
}
