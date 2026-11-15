import { CACTUS_ID } from "./jack-poole-site";
import * as T from "three";
import { CityData, centroid, hash, seeded, Road, segmentPoint } from "./data";
import { Materials, label, bakeCurtainFacadeTint } from "./materials";
import { Batcher, walls, flatPolygon } from "./geometry";
import { specialBuilding } from "./vancouver-landmarks";
import { CollisionWorld } from "./collision";
import { shopInteriorMaterials, shopWindow } from "./shop-interiors";
import {
  hasStorefront,
  isResidential,
  isHouse,
  isIndustrial,
  isUtilityBuilding,
} from "./building-use";
import type { ArchitecturalDetail } from "./detailed-architecture";
import { ericksonPlace } from "./erickson-place";
import { conventionCentre } from "./convention-centre";
import { fairmontPacificRim } from "./fairmont-pacific-rim";
import { waterfrontCentre } from "./waterfront-centre-building";
import { fairmontWaterfront } from "./fairmont-waterfront-building";
import { createTerminalCityAssembly } from "./terminal-city-building";
import { rogersTower } from "./rogers-tower";
import { harbourGreenTower } from "./harbour-towers";
import { hastingsBuilding } from "./hastings-building";
import { lawCourts } from "./law-courts";
import { robsonSquare } from "./robson-square";
import { theatres } from "./theatres";
import { commodore } from "./commodore";
import { prospectLighthouse } from "./prospect-lighthouse";
import { buildingHeight } from "./building-profile";
import { pitchedRoof } from "./pitched-roof";
import { podiumPlanters } from "./podium-planters";
import { houseMaterial } from "./house-material";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
function tint(g: T.BufferGeometry, c: T.Color) {
  const a = new Float32Array(g.getAttribute("position").count * 3);
  for (let i = 0; i < a.length; i += 3) {
    a[i] = c.r;
    a[i + 1] = c.g;
    a[i + 2] = c.b;
  }
  g.setAttribute("color", new T.BufferAttribute(a, 3));
  return g;
}
function sideBox(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  a: number,
) {
  const g = new T.BoxGeometry(w, h, d);
  g.rotateY(a);
  g.translate(x, y, z);
  return g;
}
export function architecture(
  parent: T.Group,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
) {
  const shell = new Batcher(parent, 270),
    detail = new Batcher(parent, 170),
    interiors = new Batcher(parent, 170),
    roomMaterials = shopInteriorMaterials();
  let count = 0;
  const architecturalDetails: ArchitecturalDetail[] = [];
  const reflections: ReflectionProbeSpec[] = [];
  const terminalCity = createTerminalCityAssembly(m, reflections);
  const shopNames = [
    ["PACIFIC COFFEE", "THE CORNER CAFÉ", "WEST COAST COFFEE"],
    ["WATER STREET LIVING", "HARBOUR HOME", "COASTAL INTERIORS"],
    ["CORDOVA MOBILE", "COASTAL ELECTRONICS", "PACIFIC MOBILE"],
  ];
  const signMaterials = shopNames.map((names, type) =>
    names.map(
      (name) =>
        new T.MeshStandardMaterial({
          map: label(
            name,
            1024,
            128,
            "#e1d9c4",
            ["#263a39", "#302c2a", "#24353c"][type],
            51,
          ),
          roughness: 0.85,
        }),
    ),
  );
  const canopyMaterials = [0x28443e, 0x403e38, 0x493339].map(
    (color) => new T.MeshStandardMaterial({ color, roughness: 0.98 }),
  );
  const shopGlass = new T.MeshPhysicalMaterial({
    color: 0x233a40,
    metalness: 0.35,
    roughness: 0.14,
    clearcoat: 0.8,
  });
  const frames = new T.MeshStandardMaterial({
      color: 0x313b3d,
      metalness: 0.5,
      roughness: 0.5,
    }),
    ledge = new T.MeshStandardMaterial({ color: 0xa9ada8, roughness: 0.79 });
  const curtainFrame = new T.MeshStandardMaterial({
    color: 0xabb6b7,
    metalness: 0.65,
    roughness: 0.38,
  });
  const pitchedMaterial = new T.MeshStandardMaterial({
    color: 0xa6adb0,
    roughness: 0.94,
    map: m.texture("houses/grey-roof-color.webp", true),
    normalMap: m.texture("houses/grey-roof-normal.webp"),
    roughnessMap: m.texture("houses/grey-roof-roughness.webp"),
    normalScale: new T.Vector2(0.45, 0.45),
  });
  const utilityColor = m.texture("concrete_tile_facade-color.jpg", true),
    utilityNormal = m.texture("concrete_tile_facade-normal.jpg");
  for (const texture of [utilityColor, utilityNormal])
    texture.repeat.set(8, 17);
  const utilityMaterial = new T.MeshStandardMaterial({
    map: utilityColor,
    normalMap: utilityNormal,
    roughness: 0.96,
    normalScale: new T.Vector2(0.22, 0.22),
    vertexColors: true,
    side: T.DoubleSide,
  });
  const homeMaterial = houseMaterial(m),
    gableMaterial = houseMaterial(m, false);
  m.facades.push(homeMaterial);
  m.facades.forEach((mat) => {
    mat.vertexColors = true;
    mat.side = T.DoubleSide;
  });
  for (const b of data.buildings) {
    const ground = collision.groundHeight(...centroid(b.pts));
    shell.offsetY = detail.offsetY = interiors.offsetY = ground;
    if (specialBuilding(b) || b.id === CACTUS_ID) continue;
    if (
      lawCourts(b, shell, m) ||
      robsonSquare(b, shell, m) ||
      theatres(b, shell, m) ||
      prospectLighthouse(b, shell, m) ||
      commodore(b, shell, m, interiors, roomMaterials)
    ) {
      count++;
      continue;
    }
    if (
      terminalCity(b, shell) ||
      fairmontWaterfront(b, shell, m, reflections) ||
      waterfrontCentre(b, shell, m, reflections) ||
      ericksonPlace(b, shell, m, reflections) ||
      fairmontPacificRim(b, shell, m, collision, reflections) ||
      rogersTower(b, shell, m, collision, reflections) ||
      harbourGreenTower(b, shell, m, collision, reflections) ||
      hastingsBuilding(b, shell, m, collision, reflections) ||
      conventionCentre(b, shell, m, reflections)
    ) {
      count++;
      continue;
    }
    const [x, z] = centroid(b.pts),
      rand = seeded(hash(b.id)),
      nominalHeight = buildingHeight(b),
      pitched = pitchedRoof(b, nominalHeight),
      h = pitched?.bodyHeight ?? nominalHeight,
      style = h > 35 ? Math.floor(rand() * 8) : 8 + Math.floor(rand() * 4),
      heritage =
        h < 34 &&
        !isHouse(b.kind) &&
        !isIndustrial(b.kind) &&
        !isUtilityBuilding(b.kind) &&
        (!b.startYear || b.startYear < 1950) &&
        x > -1300 &&
        x < 1750 &&
        z > -700 &&
        z < 1350,
      mat =
        isIndustrial(b.kind) || isUtilityBuilding(b.kind)
          ? utilityMaterial
          : isHouse(b.kind)
            ? homeMaterial
            : heritage
              ? m.photoFacades[Math.floor(rand() * m.photoFacades.length)]
              : m.facades[style];
    const color = new T.Color().setHSL(
      0.06 + rand() * 0.13,
      0.025 + rand() * 0.055,
      heritage ? 0.87 + rand() * 0.12 : 0.62 + rand() * 0.3,
    );
    if (isHouse(b.kind))
      color.setHex(
        [0xe7ded0, 0xc5d1cb, 0xbfcbce, 0xd5cabb, 0xc8b6a7][hash(b.id) % 5],
      );
    if (b.wallColor) color.set(b.wallColor);
    const tintFacade = (geometry: T.BufferGeometry) => {
      tint(geometry, color);
      return style < 3 && mat === m.facades[style]
        ? bakeCurtainFacadeTint(geometry, style)
        : geometry;
    };
    const xs = b.pts.filter((_, i) => !(i % 2)),
      zs = b.pts.filter((_, i) => i % 2),
      w = Math.max(...xs) - Math.min(...xs),
      d = Math.max(...zs) - Math.min(...zs);
    const detailed = x < 2250 && z > -4300 && z < 1600;
    const tower = h > 44 && w * d > 450,
      podium = tower ? Math.min(15, h * 0.19) : 0,
      shrink = tower ? 0.66 + rand() * 0.2 : 1;
    const outline = b.pts.map(
      (v, i) => (i % 2 ? z : x) + (v - (i % 2 ? z : x)) * shrink,
    );
    try {
      if (tower) {
        shell.add(
          tint(walls(b.pts, podium), color),
          m.facades[style % 2 ? 3 : 7],
          x,
          z,
        );
        shell.add(flatPolygon(b.pts, [], podium, 5), m.roof, x, z);
        const towerGeo = walls(outline, h - podium);
        towerGeo.translate(0, podium, 0);
        shell.add(tintFacade(towerGeo), mat, x, z);
      } else shell.add(tintFacade(walls(outline, h)), mat, x, z);
      if (pitched) {
        shell.add(pitched.roof, pitchedMaterial, x, z);
        if (pitched.gables.getAttribute("position").count)
          shell.add(
            tint(pitched.gables, color),
            isHouse(b.kind) ? gableMaterial : utilityMaterial,
            x,
            z,
          );
        else pitched.gables.dispose();
        if (detailed)
          for (const [ax, ay, az, bx, by, bz] of pitched.edges) {
            const direction = new T.Vector3(bx - ax, by - ay, bz - az),
              trim = new T.BoxGeometry(0.2, direction.length(), 0.3);
            trim.applyQuaternion(
              new T.Quaternion().setFromUnitVectors(
                new T.Vector3(0, 1, 0),
                direction.normalize(),
              ),
            );
            trim.translate((ax + bx) / 2, (ay + by) / 2 + 0.03, (az + bz) / 2);
            detail.add(trim, ledge, x, z);
          }
      } else shell.add(flatPolygon(outline, [], h, 8), m.roof, x, z);
      count++;
      // Parapets, ledges, floor plates and corner piers make the silhouette dimensional.
      for (let i = 0; detailed && i < outline.length; i += 2) {
        const j = (i + 2) % outline.length,
          ax = outline[i],
          az = outline[i + 1],
          bx = outline[j],
          bz = outline[j + 1],
          len = Math.hypot(bx - ax, bz - az),
          angle = -Math.atan2(bz - az, bx - ax);
        if (len < 1.2) continue;
        if (!pitched)
          detail.add(
            sideBox(
              (ax + bx) / 2,
              h + (pitched ? 0.03 : 0.27),
              (az + bz) / 2,
              len,
              pitched ? 0.16 : 0.55,
              0.35,
              angle,
            ),
            ledge,
            x,
            z,
          );
        if (isHouse(b.kind))
          detail.add(sideBox(ax, h / 2, az, 0.16, h, 0.16, angle), ledge, x, z);
        if (h > 35 && style < 3) {
          const midX = (ax + bx) / 2,
            midZ = (az + bz) / 2;
          let nx = -(bz - az) / len,
            nz = (bx - ax) / len;
          if (nx * (midX - x) + nz * (midZ - z) < 0) {
            nx = -nx;
            nz = -nz;
          }
          for (let along = 0; along <= len; along += 1.6) {
            const t = along / len;
            detail.add(
              sideBox(
                ax + (bx - ax) * t + nx * 0.045,
                (h + podium) / 2,
                az + (bz - az) * t + nz * 0.045,
                0.055,
                h - podium,
                0.09,
                angle,
              ),
              curtainFrame,
              x,
              z,
            );
          }
          for (let y = podium + 3.2; y < h; y += 3.2)
            detail.add(
              sideBox(
                midX + nx * 0.045,
                y,
                midZ + nz * 0.045,
                len,
                0.095,
                0.09,
                angle,
              ),
              curtainFrame,
              x,
              z,
            );
        } else if (h > 24 && style % 3 === 0) {
          for (let y = podium + 3.2; y < h; y += 6.4)
            detail.add(
              sideBox((ax + bx) / 2, y, (az + bz) / 2, len, 0.16, 0.23, angle),
              ledge,
              x,
              z,
            );
        }
        if (
          tower &&
          isResidential(b.kind) &&
          h < 180 &&
          style >= 3 &&
          style <= 6 &&
          len > 9 &&
          i % 4 === 0 &&
          x > -1700 &&
          x < 1650 &&
          z > -1800
        ) {
          const midX = (ax + bx) / 2,
            midZ = (az + bz) / 2;
          let nx = -(bz - az) / len,
            nz = (bx - ax) / len;
          if (nx * (midX - x) + nz * (midZ - z) < 0) {
            nx = -nx;
            nz = -nz;
          }
          for (let floor = podium + 3.2; floor < h - 2; floor += 3.2) {
            const balconyWidth = Math.min(len - 1, 8.4);
            detail.add(
              sideBox(
                midX + nx * 0.65,
                floor,
                midZ + nz * 0.65,
                balconyWidth,
                0.18,
                1.45,
                angle,
              ),
              ledge,
              x,
              z,
            );
            detail.add(
              sideBox(
                midX + nx * 1.3,
                floor + 0.64,
                midZ + nz * 1.3,
                balconyWidth,
                1.12,
                0.045,
                angle,
              ),
              shopGlass,
              x,
              z,
            );
            detail.add(
              sideBox(
                midX + nx * 1.33,
                floor + 1.24,
                midZ + nz * 1.33,
                balconyWidth,
                0.04,
                0.05,
                angle,
              ),
              frames,
              x,
              z,
            );
            for (const side of [-1, 1])
              detail.add(
                sideBox(
                  midX +
                    Math.cos(angle) * side * balconyWidth * 0.48 +
                    nx * 0.65,
                  floor + 0.64,
                  midZ -
                    Math.sin(angle) * side * balconyWidth * 0.48 +
                    nz * 0.65,
                  0.045,
                  1.14,
                  1.45,
                  angle,
                ),
                shopGlass,
                x,
                z,
              );
          }
        }
        if (h > 35 && i % 4 === 0) {
          detail.add(
            sideBox(ax, (h + podium) / 2, az, 0.38, h - podium, 0.38, angle),
            frames,
            x,
            z,
          );
        }
      }
      // A stepped crown and roof equipment break up the uniformly flat tower tops.
      if (h > 30 && detailed && !b.height) {
        const rh = 2 + rand() * 4,
          rw = Math.min(10, w * 0.3),
          rd = Math.min(12, d * 0.3);
        shell.add(sideBox(x, h + rh / 2, z, rw, rh, rd, 0), m.stone, x, z);
        for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
          const xx = x + (rand() - 0.5) * w * 0.35,
            zz = z + (rand() - 0.5) * d * 0.35;
          detail.add(sideBox(xx, h + 0.65, zz, 1.8, 1.3, 2.4, 0), frames, x, z);
          const fan = new T.CylinderGeometry(0.55, 0.55, 0.12, 14);
          fan.translate(xx, h + 1.36, zz);
          detail.add(fan, m.chrome, x, z);
        }
        if (h > 95 && rand() > 0.4) {
          const aerial = new T.CylinderGeometry(0.08, 0.14, 11, 6);
          aerial.translate(x, h + rh + 5.5, z);
          shell.add(aerial, m.chrome, x, z);
        }
      }
      if (podium && detailed) {
        const pw = Math.min(w * 0.35, 15),
          pd = Math.min(d * 0.4, 17),
          px = x - w * 0.24,
          pz = z + d * 0.23;
        const candidate = [
          px - pw / 2,
          pz - pd / 2,
          px + pw / 2,
          pz - pd / 2,
          px + pw / 2,
          pz + pd / 2,
          px - pw / 2,
          pz + pd / 2,
        ];
        for (const planter of podiumPlanters(b.pts, outline, candidate)) {
          // A low stone container bears directly on the podium roof. Its inset
          // planting surface stays within the rim, never through a tower wall.
          for (const ring of [planter.curb.outer, ...planter.curb.holes]) {
            const side = walls(ring, 0.42);
            side.translate(0, podium, 0);
            detail.add(side, ledge, x, z);
          }
          for (const rim of planter.rim)
            detail.add(
              flatPolygon(rim.outer, rim.holes, podium + 0.42),
              ledge,
              x,
              z,
            );
          for (const planting of planter.planting) {
            // Inner faces turn toward the bed and meet the recessed turf.
            for (const ring of [planting.outer, ...planting.holes]) {
              const reversed: number[] = [];
              for (let i = ring.length - 2; i >= 0; i -= 2)
                reversed.push(ring[i], ring[i + 1]);
              const inner = walls(reversed, 0.12);
              inner.translate(0, podium + 0.3, 0);
              detail.add(inner, ledge, x, z);
            }
            detail.add(
              flatPolygon(planting.outer, planting.holes, podium + 0.3),
              m.grass,
              x,
              z,
            );
          }
        }
      }
      // Only mapped street-facing edges get shopfronts; alleys keep their service appearance.
      for (let i = 0; detailed && i < b.pts.length; i += 2) {
        const j = (i + 2) % b.pts.length,
          ax = b.pts[i],
          az = b.pts[i + 1],
          bx = b.pts[j],
          bz = b.pts[j + 1],
          len = Math.hypot(bx - ax, bz - az);
        if (len < 8 || len > 130) continue;
        const cx = (ax + bx) / 2,
          cz = (az + bz) / 2,
          near = collision.nearestRoad(cx, cz, 30);
        if (!near || near.d < 2) continue;
        let nx = -(bz - az) / len,
          nz = (bx - ax) / len;
        if (nx * (near.x - cx) + nz * (near.z - cz) < 0) {
          nx = -nx;
          nz = -nz;
        }
        const angle = Math.atan2(nx, nz),
          stores = Math.max(1, Math.round(len / 12)),
          storeWidth = len / stores;
        // Raised public decking can meet an existing upper facade. Preserve the
        // building datum; omit generic ground-floor entries buried by that deck.
        const streetGrade = collision.canada?.baselineHeight(
          cx + nx * 1.2,
          cz + nz * 1.2,
        );
        if (streetGrade !== undefined && streetGrade > ground + 0.6) continue;
        const retail = hasStorefront(b.kind, near.road.name);
        if (!retail && isResidential(b.kind)) {
          const doorColumn = Math.floor(len / 6),
            doorT = Math.min(0.8, (doorColumn * 3 + 1.5) / len);
          // A stone surround covers the generated window underneath the entrance.
          // It also keeps the far-view façade coherent when detailed doors are culled.
          detail.add(
            sideBox(
              ax + (bx - ax) * doorT + nx * 0.01,
              isHouse(b.kind) ? 1.32 : 1.65,
              az + (bz - az) * doorT + nz * 0.01,
              isHouse(b.kind) ? 1.45 : 2.18,
              isHouse(b.kind) ? 2.45 : 3.1,
              0.02,
              angle,
            ),
            m.stone,
            x,
            z,
          );
          architecturalDetails.push({
            kind: "door",
            variant: hash(b.id) % 2,
            x: ax + (bx - ax) * doorT + nx * 0.02,
            y: ground + 0.15,
            z: az + (bz - az) * doorT + nz * 0.02,
            angle,
            width: isHouse(b.kind) ? 1.1 : 1.4,
            height: isHouse(b.kind) ? 2.2 : 2.8,
          });
          // The generated residential texture repeats every 3 m horizontally and
          // 3.2 m vertically. Align modeled frames to those existing openings.
          if (!heritage && !tower && h >= (isHouse(b.kind) ? 3 : 6) && h < 35) {
            const windowHeight = isHouse(b.kind) ? 1.7 : 2.55;
            for (let along = 1.5; along < len - 1.0; along += 3) {
              for (
                let base = isHouse(b.kind) ? 0.75 : 0.4;
                base + windowHeight < h;
                base += 3.2
              ) {
                if (base < 1 && Math.abs(along - doorT * len) < 1.7) continue;
                const t = along / len;
                architecturalDetails.push({
                  kind: "window",
                  variant: 0,
                  x: ax + (bx - ax) * t + nx * 0.025,
                  y: ground + base,
                  z: az + (bz - az) * t + nz * 0.025,
                  angle,
                  width: isHouse(b.kind) ? 1.45 : 1.9,
                  height: windowHeight,
                });
              }
            }
          }
        }
        if (!retail) continue;
        for (let s = 0; s < stores; s++) {
          const t = (s + 0.5) / stores,
            xx = ax + (bx - ax) * t,
            zz = az + (bz - az) * t,
            type = Math.floor(rand() * roomMaterials.length),
            roomMaterial = roomMaterials[type];
          const part = (
            offset: number,
            y: number,
            width: number,
            height: number,
            depth: number,
            projection: number,
            material: T.Material,
          ) => {
            detail.add(
              sideBox(
                xx + Math.cos(angle) * offset + nx * projection,
                y,
                zz - Math.sin(angle) * offset + nz * projection,
                width,
                height,
                depth,
                angle,
              ),
              material,
              x,
              z,
            );
          };
          // A continuous photographed room spans the whole shop. Mullions subdivide
          // the glass without duplicating a new room behind each individual pane.
          interiors.add(
            shopWindow(
              xx + nx * 0.13,
              1.95,
              zz + nz * 0.13,
              storeWidth - 0.4,
              3.25,
              angle,
              7,
            ),
            roomMaterial,
            x,
            z,
          );
          for (const off of [-storeWidth / 2 + 0.15, storeWidth / 2 - 0.15])
            part(off, 1.95, 0.24, 3.8, 0.32, 0.19, ledge);
          for (const off of [-storeWidth / 6, storeWidth / 6])
            part(off, 1.95, 0.065, 3.25, 0.14, 0.22, frames);
          part(0, 2.95, storeWidth - 0.4, 0.07, 0.14, 0.22, frames);
          part(0, 3.66, storeWidth, 0.15, 0.3, 0.18, frames);
          part(0, 0.3, storeWidth, 0.2, 0.3, 0.18, frames);

          const signWidth = Math.min(storeWidth - 0.7, 10);
          part(
            0,
            4.35,
            signWidth,
            signWidth / 8,
            0.15,
            0.26,
            signMaterials[type][
              Math.floor(rand() * signMaterials[type].length)
            ],
          );
          if (rand() > 0.65) {
            const width = storeWidth - 0.35,
              canopy = new T.BoxGeometry(width, 0.075, 1.55);
            canopy.rotateX(0.13);
            canopy.rotateY(angle);
            canopy.translate(xx + nx * 0.8, 3.55, zz + nz * 0.8);
            detail.add(canopy, canopyMaterials[type], x, z);
            part(0, 3.33, width, 0.25, 0.055, 1.56, canopyMaterials[type]);
            for (const off of [-width * 0.4, width * 0.4])
              part(off, 3.38, 0.045, 0.045, 1.45, 0.8, frames);
          }

          // Door frames share the room behind the display window; no pasted-on
          // second interior or solid panel obscures the shop at the entrance.
          const door = storeWidth * 0.3;
          for (const off of [-0.62, 0.62])
            part(door + off, 1.46, 0.065, 2.6, 0.1, 0.28, frames);
          part(door, 2.76, 1.3, 0.065, 0.1, 0.28, frames);
          part(door, 0.18, 1.3, 0.09, 0.3, 0.25, ledge);
          part(door - 0.44, 1.4, 0.035, 0.4, 0.035, 0.38, m.chrome);
          for (const y of [1.22, 1.58])
            part(door - 0.44, y, 0.035, 0.035, 0.12, 0.33, m.chrome);
        }
      }
    } catch (e) {
      console.warn("Building geometry skipped", b.id, e);
    }
  }
  const chunks = shell.finish(),
    details = [...detail.finish(), ...interiors.finish(false)];
  details.forEach((c) => (c.userData.detail = true));
  return {
    chunks: [...chunks, ...details],
    count,
    architecturalDetails,
    reflections,
  };
}
