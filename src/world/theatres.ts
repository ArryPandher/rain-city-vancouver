import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Building, centroid } from "./data";
import { Batcher, walls, flatPolygon } from "./geometry";
import { Materials, label } from "./materials";
import { gridXZ } from "./robson-site";
export const VOGUE_ID = "w97160604",
  ORPHEUM_ID = "w301875556";
type P = [number, number, number];
const world = (u: number, y: number, v: number): P => {
  const [x, z] = gridXZ(u, v);
  return [x, y, z];
};
function letterPanel(word: string, vogue: boolean) {
  const c = document.createElement("canvas"),
    e = document.createElement("canvas");
  c.width = e.width = 512;
  c.height = e.height = 2048;
  const ctx = c.getContext("2d")!,
    ec = e.getContext("2d")!;
  ctx.fillStyle = vogue ? "#4e2529" : "#51473f";
  ctx.fillRect(0, 0, 512, 2048);
  ec.fillStyle = "#000";
  ec.fillRect(0, 0, 512, 2048);
  for (const cx of [ctx, ec]) {
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.lineJoin = "round";
  }
  const pitch = 1840 / word.length;
  for (let i = 0; i < word.length; i++) {
    const y = 110 + (i + 0.5) * pitch;
    ctx.font =
      ec.font = `${vogue ? "600" : "bold"} ${Math.round(pitch * 0.86)}px ${vogue ? "Arial" : "Georgia"}`;
    ctx.fillStyle = vogue ? "#5b3031" : "#d8d8c6";
    ctx.fillText(word[i], 256, y, 400);
    ctx.strokeStyle = vogue ? "#dd3744" : "#243e45";
    ctx.lineWidth = vogue ? 10 : 6;
    ctx.strokeText(word[i], 256, y, 400);
    ec.strokeStyle = vogue ? "#ffb3a8" : "#d4eeee";
    ec.lineWidth = vogue ? 3.5 : 3;
    ec.strokeText(word[i], 256, y, 400);
  }
  const texture = (canvas: HTMLCanvasElement) => {
    const t = new T.CanvasTexture(canvas);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: texture(c), emissiveMap: texture(e) };
}
/** Reference-guided theatres at their mapped footprints, including Orpheum's Granville entrance. */
export function theatres(b: Building, batch: Batcher, m: Materials) {
  const vogue = b.id === VOGUE_ID;
  if (!vogue && b.id !== ORPHEUM_ID) return false;
  const [cx, cz] = centroid(b.pts),
    add = (g: T.BufferGeometry, mat: T.Material) => batch.add(g, mat, cx, cz);
  const plaster = new T.MeshStandardMaterial({
    name: vogue
      ? "Vogue Theatre — plaster"
      : "Orpheum — limestone-toned plaster",
    color: vogue ? 0xd4ccac : 0xd6d1b9,
    map: m.texture("theatres/plaster-color.webp", true),
    normalMap: m.texture("theatres/plaster-normal.webp"),
    roughnessMap: m.texture("theatres/plaster-roughness.webp"),
    normalScale: new T.Vector2(0.18, 0.18),
    roughness: 0.95,
  });
  const trim = new T.MeshStandardMaterial({ color: 0xc1b99f, roughness: 0.88 });
  const red = new T.MeshStandardMaterial({
    color: vogue ? 0x5c242d : 0x55443a,
    roughness: 0.55,
    metalness: 0.23,
  });
  const dark = new T.MeshStandardMaterial({
    color: 0x26302e,
    roughness: 0.64,
    metalness: 0.24,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: 0x293e40,
    roughness: 0.23,
    metalness: 0.25,
    clearcoat: 0.45,
  });
  const photoUV = (g: T.BufferGeometry) => {
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 25.6);
    return g;
  };
  const box = (
    u: number,
    y: number,
    v: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material = plaster,
    round = 0,
  ) => {
    const g = round
      ? new RoundedBoxGeometry(w, h, d, 3, round)
      : new T.BoxGeometry(w, h, d);
    if (mat === plaster) {
      const p = g.getAttribute("position"),
        n = g.getAttribute("normal"),
        uv = g.getAttribute("uv");
      for (let i = 0; i < p.count; i++)
        uv.setXY(
          i,
          (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / 2,
          (Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i)) / 2,
        );
    }
    g.rotateY(Math.PI / 4);
    g.translate(...world(u, y, v));
    add(g, mat);
  };
  const panel = (a: P, bb: P, c: P, d: P, mat: T.Material) => {
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [a, bb, c, d].flatMap((p) => world(...p)),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    add(g, mat);
  };
  const frontPanel = (
    u: number,
    y: number,
    v: number,
    w: number,
    h: number,
    mat: T.Material,
  ) =>
    panel(
      [u + w / 2, y - h / 2, v],
      [u - w / 2, y - h / 2, v],
      [u - w / 2, y + h / 2, v],
      [u + w / 2, y + h / 2, v],
      mat,
    );
  const neon = (material: T.MeshStandardMaterial, day = 0.12, night = 2.4) => {
    m.neonMaterials.push({ material, day, night });
    return material;
  };
  const tube = (points: P[], radius: number, mat: T.Material) => {
    const curve = new T.CurvePath<T.Vector3>();
    for (let i = 1; i < points.length; i++)
      curve.add(
        new T.LineCurve3(
          new T.Vector3(...world(...points[i - 1])),
          new T.Vector3(...world(...points[i])),
        ),
      );
    add(
      new T.TubeGeometry(
        curve,
        Math.max(8, points.length * 4),
        radius,
        6,
        false,
      ),
      mat,
    );
  };
  const light = (
    u: number,
    y: number,
    v: number,
    color: number,
    intensity: number,
    distance: number,
  ) => {
    const l = new T.PointLight(color, 0, distance, 2);
    l.name = vogue ? "Vogue neon spill" : "Orpheum neon spill";
    l.position.set(...world(u, y, v));
    batch.parent.add(l);
    m.practicalLights.push({ light: l, day: 0, night: intensity });
  };
  const signU = vogue ? -336 : -258.3,
    faceV = vogue ? 148.08 : 148.43;
  // The auditorium follows the mapped shell. The entrance and blade are separately modeled.
  const height = vogue ? 17.8 : 15.2;
  add(photoUV(walls(b.pts, height)), plaster);
  add(flatPolygon(b.pts, [], height, 3), m.roof);
  const facadeU = vogue ? -336.1 : -255.5,
    facadeWidth = vogue ? 24.1 : 8.4;
  if (vogue) {
    box(facadeU, 10.8, faceV + 0.35, facadeWidth, 15.6, 0.7);
    box(facadeU, 18.6, faceV + 0.08, facadeWidth + 0.1, 0.35, 0.5, trim);
    const carving = new T.MeshStandardMaterial({
      map: m.texture("theatres/vogue-carving.webp", true),
      color: 0xd4ccac,
      roughness: 0.96,
    });
    for (let u = -347.4; u <= -324.8; u += 3.2) {
      box(u, 10.7, faceV - 0.16, 0.29, 15.6, 0.28, trim);
      if (u + 2.24 <= facadeU + facadeWidth / 2)
        frontPanel(u + 1.5, 16.9, faceV - 0.03, 1.48, 1.6, carving);
    }
    // Deep maroon entry piers and a broad shallow marquee leave the sidewalk open.
    box(facadeU, 3.45, faceV - 1.35, 23.9, 0.48, 3.4, red);
    box(facadeU, 3.11, faceV - 1.35, 23.5, 0.16, 3.1, trim);
    for (let u = -346.5; u < -325; u += 3.5) {
      box(u, 1.65, faceV - 0.03, 2.9, 2.9, 0.05, glass);
      box(u - 1.55, 1.7, faceV - 0.15, 0.35, 3.2, 0.35, red);
      for (const off of [-0.7, 0.7])
        box(u + off, 1.64, faceV - 0.11, 0.055, 2.8, 0.06, dark);
      box(u, 1.0, faceV - 0.18, 0.03, 0.5, 0.06, m.chrome);
    }
    const ribbon = neon(
      new T.MeshStandardMaterial({
        map: label(
          "VOGUE      VOGUE      VOGUE",
          2048,
          128,
          "#ead9bd",
          "#77202d",
          76,
        ),
        emissiveMap: label(
          "VOGUE      VOGUE      VOGUE",
          2048,
          128,
          "#e9c8a1",
          "#26030b",
          76,
        ),
        emissive: 0xffffff,
        roughness: 0.5,
      }),
      0.08,
      1.4,
    );
    frontPanel(facadeU, 3.73, faceV - 3.07, 23.6, 0.62, ribbon);
  } else {
    // Granville's narrow ornamental lobby connects to the larger Smithe Street auditorium.
    box(facadeU, 8.25, faceV + 0.22, 8.3, 16.5, 0.44);
    for (const u of [-259.35, -251.65]) {
      box(u, 8.4, faceV - 0.2, 0.52, 16.8, 0.55, trim);
      box(u, 15.9, faceV - 0.32, 0.86, 0.4, 0.75, trim);
    }
    for (const y of [11.8, 14.9, 16.1])
      box(facadeU, y, faceV - 0.18, 8.3, 0.34, 0.48, trim);
    // An arched doorway with a dark recessed grille beneath the stone surround.
    const arch = new T.Shape();
    arch.moveTo(-2.45, 0);
    arch.lineTo(2.45, 0);
    arch.lineTo(2.45, 5.6);
    arch.absarc(0, 5.6, 2.45, 0, Math.PI, false);
    arch.lineTo(-2.45, 0);
    const opening = new T.ShapeGeometry(arch);
    opening.rotateY(Math.PI * 1.25);
    opening.translate(...world(facadeU, 0.2, faceV - 0.03));
    add(opening, dark);
    const arc: P[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i * Math.PI) / 32;
      arc.push([
        facadeU + Math.cos(a) * 2.62,
        5.8 + Math.sin(a) * 2.62,
        faceV - 0.18,
      ]);
    }
    tube(arc, 0.13, trim);
    for (const u of [facadeU - 2.62, facadeU + 2.62])
      box(u, 2.95, faceV - 0.16, 0.23, 5.7, 0.26, trim);
    for (let u = facadeU - 2.2; u <= facadeU + 2.2; u += 0.38)
      box(u, 3.65, faceV - 0.1, 0.035, 6.6, 0.06, m.chrome);
    for (const y of [2.1, 3.9, 5.6])
      box(facadeU, y, faceV - 0.11, 4.55, 0.045, 0.08, m.chrome);
    box(facadeU, 3.4, faceV - 1.05, 8.4, 0.45, 2.5, red);
    const name = neon(
      new T.MeshStandardMaterial({
        map: label("ORPHEUM", 1024, 128, "#e5dbbe", "#304a4d", 83),
        emissiveMap: label("ORPHEUM", 1024, 128, "#ccb98b", "#000000", 83),
        emissive: 0xffffff,
        roughness: 0.55,
      }),
      0.1,
      1.2,
    );
    frontPanel(facadeU, 3.63, faceV - 2.31, 8.3, 0.48, name);
    // The perforated crown and shallow roundels distinguish the historic lobby.
    for (let u = facadeU - 3.6; u <= facadeU + 3.6; u += 0.8) {
      const g = new T.TorusGeometry(0.28, 0.075, 6, 16);
      g.rotateY(Math.PI / 4);
      g.translate(...world(u, 15.5, faceV - 0.19));
      add(g, trim);
    }
    for (const u of [facadeU - 3.1, facadeU + 3.1]) {
      const g = new T.TorusGeometry(0.46, 0.09, 6, 20);
      g.rotateY(Math.PI / 4);
      g.translate(...world(u, 10.15, faceV - 0.14));
      add(g, trim);
    }
  }
  // Each projecting blade has two correctly oriented faces and an independent metal body.
  const bladeV = faceV - 1.72,
    bladeHeight = vogue ? 16.2 : 18.4,
    bladeBottom = vogue ? 7.7 : 6.2,
    bladeWidth = vogue ? 2.55 : 2.8;
  box(
    signU,
    bladeBottom + bladeHeight / 2,
    bladeV,
    0.58,
    bladeHeight + 0.45,
    bladeWidth + 0.3,
    red,
    vogue ? 0.12 : 0.48,
  );
  const letters = letterPanel(vogue ? "VOGUE" : "ORPHEUM", vogue),
    face = neon(
      new T.MeshStandardMaterial({
        name: vogue ? "Vogue neon lettering" : "Orpheum neon lettering",
        ...letters,
        emissive: 0xffffff,
        roughness: 0.58,
        metalness: 0.05,
        side: T.DoubleSide,
      }),
      0.15,
      vogue ? 3 : 2.3,
    );
  for (const side of [-1, 1]) {
    const u = signU + side * 0.31,
      a = bladeV + (side * bladeWidth) / 2,
      bb = bladeV - (side * bladeWidth) / 2;
    panel(
      [u, bladeBottom, a],
      [u, bladeBottom, bb],
      [u, bladeBottom + bladeHeight, bb],
      [u, bladeBottom + bladeHeight, a],
      face,
    );
  }
  const glow = neon(
    new T.MeshStandardMaterial({
      color: vogue ? 0x983e38 : 0x84a5a5,
      emissive: vogue ? 0xff423c : 0x8adae7,
      roughness: 0.34,
      metalness: 0.1,
    }),
    0.1,
    vogue ? 2.6 : 2.0,
  );
  for (const side of [-1, 1]) {
    const u = signU + side * 0.35,
      left = bladeV - bladeWidth / 2 - 0.17,
      right = bladeV + bladeWidth / 2 + 0.17,
      low = bladeBottom - 0.16,
      high = bladeBottom + bladeHeight + 0.16;
    const points: P[] = vogue
      ? [
          [u, low, left],
          [u, high, left],
          [u, high, right],
          [u, low, right],
          [u, low, left],
        ]
      : [0, 1].flatMap((half) =>
          Array.from({ length: 25 }, (_, i) => {
            const a = half * Math.PI + (i * Math.PI) / 24;
            const r = (right - left) / 2;
            return [
              u,
              (half ? low + r : high - r) + Math.sin(a) * r,
              bladeV + Math.cos(a) * r,
            ] as P;
          }),
        );
    if (!vogue) points.push(points[0]);
    tube(points, 0.045, glow);
    for (let y = bladeBottom + 0.2; y < bladeBottom + bladeHeight; y += 0.48)
      for (const v of [left, right]) {
        const bulb = new T.SphereGeometry(0.045, 5, 4);
        bulb.translate(...world(u, y, v));
        add(bulb, glow);
      }
  }
  for (const y of [bladeBottom + 0.4, bladeBottom + bladeHeight - 1])
    box(signU, y, faceV - 0.65, 0.18, 0.18, 2.5, dark);
  if (vogue) {
    const iconTex = m.texture("theatres/vogue-diana.webp", true);
    iconTex.wrapS = iconTex.wrapT = T.ClampToEdgeWrapping;
    const icon = neon(
      new T.MeshStandardMaterial({
        name: "Vogue — Diana neon figure",
        map: iconTex,
        emissiveMap: iconTex,
        emissive: 0xffffff,
        alphaTest: 0.2,
        side: T.DoubleSide,
        roughness: 0.6,
      }),
      0.16,
      2.1,
    );
    icon.userData.castShadow = false;
    for (const side of [-1, 1]) {
      const u = signU + side * 0.32,
        a = bladeV + side * 0.83,
        bb = bladeV - side * 0.83;
      panel([u, 24.4, a], [u, 24.4, bb], [u, 27, bb], [u, 27, a], icon);
    }
    const board = neon(
      new T.MeshStandardMaterial({
        map: label(
          "LIVE MUSIC • VANCOUVER",
          1024,
          384,
          "#26383a",
          "#d2d0b8",
          62,
        ),
        emissiveMap: label(
          "LIVE MUSIC • VANCOUVER",
          1024,
          384,
          "#172126",
          "#c3b99d",
          62,
        ),
        emissive: 0xffffff,
        roughness: 0.7,
      }),
      0.08,
      0.8,
    );
    box(signU, 6.15, faceV - 1.8, 6.8, 2.4, 3.6, red);
    frontPanel(signU, 6.15, faceV - 3.63, 6.5, 2.05, board);
  }
  light(
    signU,
    13,
    faceV - 4.2,
    vogue ? 0xff3148 : 0x77c8e8,
    vogue ? 90 : 60,
    25,
  );
  light(facadeU, 2.9, faceV - 1.5, 0xffd49b, vogue ? 24 : 14, 13);
  return true;
}
