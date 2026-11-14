import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { detailedCar } from "../world/detailed-car";
import { VehicleModel, makeCar, makeBike } from "../world/vehicles";
import { makeCharacter, Character } from "./character";
import { carState, CarState, angleDelta } from "./physics";
import { Road, isStreet, seeded, roadWidth } from "../world/data";
import { normalizeGeometry } from "../world/geometry";
import { World } from "../world/world";
import {
  nearbyRoadSpans,
  sampleRoadSpan,
  advanceRoadCursor,
  pointOnRoad,
  type RoadSpan,
} from "./road-placement";
export interface Vehicle {
  model: VehicleModel;
  state: CarState;
  kind: "car" | "bike";
  name: string;
  ai: boolean;
  road?: Road;
  segment: number;
  progress: number;
  dir: number;
  health: number;
}
export interface Pedestrian {
  character: Character;
  road: Road;
  t: number;
  segment: number;
  direction: number;
  panic: number;
  down: number;
  side: number;
}
const pedestrianRoute = (road: Road) =>
  isStreet(road) ||
  ["pedestrian", "footway", "path", "cycleway"].includes(road.kind);
const sidewalkOffset = (road: Road, side: number) =>
  side *
  (isStreet(road)
    ? roadWidth(road) / 2 + 1.1
    : Math.max(0.4, roadWidth(road) / 2 - 0.8));
export function mergeGroup(g: T.Group) {
  const byMat = new Map<T.Material, T.Mesh[]>();
  for (const o of [...g.children]) {
    if (o instanceof T.Mesh && !Array.isArray(o.material)) {
      let a = byMat.get(o.material);
      if (!a) byMat.set(o.material, (a = []));
      a.push(o);
    }
  }
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const gs = meshes.map((m) => {
      m.updateMatrix();
      return normalizeGeometry(m.geometry.clone().applyMatrix4(m.matrix));
    });
    const geo = mergeGeometries(gs);
    if (geo) {
      const mesh = new T.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      meshes.forEach((m) => m.removeFromParent());
    }
    gs.forEach((g) => g.dispose());
  }
}
export class Actors {
  vehicles: Vehicle[] = [];
  peds: Pedestrian[] = [];
  random = seeded(518);
  timer = 0;
  constructor(public world: World) {}
  addVehicle(
    kind: "car" | "bike",
    x: number,
    z: number,
    heading: number,
    ai = false,
    color = 0x375f68,
  ) {
    const model =
      kind === "bike"
        ? makeBike(this.world.materials)
        : detailedCar(color, ai) || makeCar(this.world.materials, color);
    mergeGroup(model.body as T.Group);
    model.wheels.forEach(mergeGroup);
    model.group.position.set(x, this.world.collision.height(x, z) + 0.12, z);
    model.group.rotation.y = heading;
    this.addShadow(model);
    this.world.scene.add(model.group);
    const v: Vehicle = {
      model,
      state: carState(x, z, heading),
      kind,
      name: kind === "bike" ? "Seawall cycle" : "Pacific GT",
      ai,
      segment: 0,
      progress: 0,
      dir: 1,
      health: 100,
    };
    this.vehicles.push(v);
    return v;
  }
  populate(x: number, z: number) {
    const roads = this.world.collision.roads.query(x, z, 440);
    const trafficSpans = nearbyRoadSpans(roads.filter(isStreet), x, z, 420);
    const walkingSpans = nearbyRoadSpans(
      roads.filter(pedestrianRoute),
      x,
      z,
      240,
    );
    const colors = [0x839394, 0x2b4851, 0xc4bcae, 0x783a35, 0x202a32, 0xd1c9b9];
    for (let i = 0; i < 24; i++) {
      const p = this.place(trafficSpans, x, z, {
        radius: 420,
        minDistance: 24,
        parked: i >= 16,
      });
      if (!p) continue;
      const v = this.addVehicle(
        "car",
        p.x,
        p.z,
        p.heading,
        i < 16,
        colors[i % colors.length],
      );
      v.road = p.road;
      v.segment = p.segment;
      v.progress = p.t;
      v.state.speed = i < 16 ? 6 + this.random() * 6 : 0;
      v.name = ["Pacific GT", "Harbour Coupe", "West End GT"][i % 3];
    }
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      const at = this.place(walkingSpans, x, z, {
        radius: 240,
        minDistance: 16,
        pedestrian: true,
        side,
      });
      if (!at) continue;
      const p = makeCharacter(this.world.materials, i + 1);
      mergeGroup(p.hips);
      mergeGroup(p.head);
      p.arms.forEach(mergeGroup);
      p.legs.forEach(mergeGroup);
      this.world.scene.add(p.group);
      p.group.position.set(at.x, this.world.collision.height(at.x, at.z), at.z);
      const ped: Pedestrian = {
        character: p,
        road: at.road,
        t: at.t,
        segment: at.segment,
        direction: 1,
        panic: 0,
        down: 0,
        side,
      };
      this.peds.push(ped);
    }
  }
  place(
    spans: RoadSpan[],
    x: number,
    z: number,
    options: {
      radius: number;
      minDistance: number;
      pedestrian?: boolean;
      parked?: boolean;
      side?: number;
    },
  ) {
    for (let attempt = 0; attempt < 36; attempt++) {
      const sample = sampleRoadSpan(spans, this.random);
      if (!sample) return null;
      const offset = options.pedestrian
        ? sidewalkOffset(sample.road, options.side ?? 1)
        : options.parked
          ? Math.max(2.8, roadWidth(sample.road) / 2 - 1.2)
          : 3;
      const point = this.roadPoint(
        sample.road,
        sample.segment,
        sample.t,
        offset,
      );
      const distance = Math.hypot(point.x - x, point.z - z);
      if (distance < options.minDistance || distance > options.radius) continue;
      if (
        this.world.collision.water(point.x, point.z) ||
        this.world.collision.blocked(
          point.x,
          point.z,
          options.pedestrian ? 0.4 : 1.2,
        )
      )
        continue;
      if (
        this.vehicles.some(
          (v) =>
            Math.hypot(v.state.x - point.x, v.state.z - point.z) <
            (options.pedestrian ? 2 : 7),
        )
      )
        continue;
      if (
        options.pedestrian &&
        this.peds.some(
          (p) =>
            Math.hypot(
              p.character.group.position.x - point.x,
              p.character.group.position.z - point.z,
            ) < 1.8,
        )
      )
        continue;
      return { ...sample, ...point };
    }
    return null;
  }
  addShadow(model: VehicleModel) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!,
      gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    gradient.addColorStop(0, "rgba(0,0,0,.65)");
    gradient.addColorStop(0.5, "rgba(0,0,0,.45)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new T.CanvasTexture(c),
      shadow = new T.Mesh(
        new T.PlaneGeometry(
          model.kind === "car" ? 3.4 : 1.3,
          model.kind === "car" ? 6.3 : 2.6,
        ),
        new T.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          toneMapped: false,
        }),
      );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.025;
    shadow.renderOrder = 1;
    model.group.add(shadow);
  }
  recycle(player: T.Vector3, current: Vehicle | null, afterTravel = false) {
    const roads = this.world.collision.roads.query(player.x, player.z, 440);
    const trafficSpans = nearbyRoadSpans(
      roads.filter(isStreet),
      player.x,
      player.z,
      420,
    );
    const walkingSpans = nearbyRoadSpans(
      roads.filter(pedestrianRoute),
      player.x,
      player.z,
      250,
    );
    for (const v of this.vehicles) {
      if (
        v === current ||
        (!afterTravel &&
          Math.hypot(v.state.x - player.x, v.state.z - player.z) < 650)
      )
        continue;
      const p = this.place(trafficSpans, player.x, player.z, {
        radius: 420,
        minDistance: afterTravel ? 24 : 220,
        parked: !v.ai,
      });
      if (!p) continue;
      v.state.x = p.x;
      v.state.z = p.z;
      v.state.heading = p.heading;
      v.state.speed = v.ai ? 7 : 0;
      v.road = p.road;
      v.segment = p.segment;
      v.progress = p.t;
      this.sync(v, 0);
    }
    for (const p of this.peds) {
      if (!afterTravel && p.character.group.position.distanceTo(player) < 450)
        continue;
      const at = this.place(walkingSpans, player.x, player.z, {
        radius: 250,
        minDistance: afterTravel ? 16 : 160,
        pedestrian: true,
        side: p.side,
      });
      if (!at) continue;
      p.road = at.road;
      p.segment = at.segment;
      p.t = at.t;
      p.direction = 1;
      p.character.group.position.set(
        at.x,
        this.world.collision.height(at.x, at.z),
        at.z,
      );
      p.down = 0;
      p.panic = 0;
      p.character.group.rotation.y = at.heading;
    }
  }
  roadPoint(r: Road, seg: number, t: number, offset: number) {
    return pointOnRoad(r, seg, t, offset);
  }
  panic(x: number, z: number) {
    for (const p of this.peds) {
      if (p.character.group.position.distanceTo(new T.Vector3(x, 0, z)) < 90)
        p.panic = 8;
    }
  }
  update(dt: number, player: T.Vector3, current: Vehicle | null) {
    this.timer += dt;
    if (Math.floor(this.timer / 4) !== Math.floor((this.timer - dt) / 4))
      this.recycle(player, current);
    for (const v of this.vehicles) {
      if (v === current) continue;
      let { state: s } = v;
      const dist = Math.hypot(s.x - player.x, s.z - player.z);
      v.model.group.visible = dist < 650;
      if (v.ai && v.road && v.model.group.visible) {
        let r = v.road;
        const ax = r.pts[v.segment],
          az = r.pts[v.segment + 1],
          bx = r.pts[v.segment + 2],
          bz = r.pts[v.segment + 3];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        let progress = v.progress;
        const speed = player.distanceTo(v.model.group.position) < 8 ? 0 : 8.2;
        progress += (speed * dt) / len;
        if (progress > 1) {
          v.segment += 2;
          if (v.segment >= r.pts.length - 2) {
            const ex = bx,
              ez = bz;
            const options = this.world.collision.roads
              .query(ex, ez, 4)
              .filter(
                (o) =>
                  isStreet(o) &&
                  o !== r &&
                  (Math.hypot(o.pts[0] - ex, o.pts[1] - ez) < 4 ||
                    Math.hypot(o.pts.at(-2)! - ex, o.pts.at(-1)! - ez) < 4),
              );
            if (options.length) {
              r = options[Math.floor(this.random() * options.length)];
              if (Math.hypot(r.pts.at(-2)! - ex, r.pts.at(-1)! - ez) < 4)
                r = {
                  ...r,
                  pts: r.pts
                    .reduce<number[][]>((a, v, i) => {
                      if (i % 2 === 0) a.push([v, r.pts[i + 1]]);
                      return a;
                    }, [])
                    .reverse()
                    .flat(),
                };
              v.road = r;
              v.segment = 0;
            } else {
              v.road = {
                ...r,
                pts: r.pts
                  .reduce<number[][]>((a, v, i) => {
                    if (i % 2 === 0) a.push([v, r.pts[i + 1]]);
                    return a;
                  }, [])
                  .reverse()
                  .flat(),
              };
              r = v.road;
              v.segment = 0;
            }
          }
          progress = 0;
        }
        const p = this.roadPoint(r, v.segment, progress, 3);
        v.progress = progress;
        s.x = p.x;
        s.z = p.z;
        s.heading += angleDelta(s.heading, p.heading) * Math.min(1, dt * 6);
        s.speed = speed;
        this.sync(v, dt);
      }
    }
    for (const p of this.peds) {
      const obj = p.character.group,
        dist = obj.position.distanceTo(player);
      obj.visible = dist < 190;
      if (p.down > 0) {
        p.down -= dt;
        obj.rotation.z = Math.PI / 2;
        obj.position.y =
          this.world.collision.height(obj.position.x, obj.position.z) + 0.18;
        continue;
      }
      obj.rotation.z = 0;
      p.panic = Math.max(0, p.panic - dt);
      const r = p.road,
        speed = p.panic > 0 ? 4.8 : 1.2;
      const next = advanceRoadCursor(r, p, dt * speed);
      const a = this.roadPoint(
        r,
        next.segment,
        next.t,
        sidewalkOffset(r, p.side),
      );
      if (
        !this.world.collision.blocked(a.x, a.z, 0.3) &&
        !this.world.collision.water(a.x, a.z)
      ) {
        p.segment = next.segment;
        p.t = next.t;
        p.direction = next.direction;
        const dx = a.x - obj.position.x,
          dz = a.z - obj.position.z;
        if (Math.hypot(dx, dz) > 0.0001)
          obj.rotation.y +=
            angleDelta(obj.rotation.y, Math.atan2(dx, dz)) *
            (1 - Math.exp(-dt * 8));
        obj.position.set(a.x, this.world.collision.height(a.x, a.z), a.z);
      } else {
        p.direction *= -1;
      }
      if (obj.visible) p.character.update(this.timer, speed, false);
    }
  }
  sync(v: Vehicle, dt: number) {
    const s = v.state,
      g = v.model.group;
    g.position.set(s.x, this.world.collision.height(s.x, s.z) + 0.13, s.z);
    g.rotation.y = s.heading;
    const forward = new T.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading));
    const y1 = this.world.collision.height(
        s.x + forward.x * 1.5,
        s.z + forward.z * 1.5,
      ),
      y0 = this.world.collision.height(
        s.x - forward.x * 1.5,
        s.z - forward.z * 1.5,
      );
    g.rotation.x = -Math.atan2(y1 - y0, 3);
    v.model.wheels.forEach((w) => (w.rotation.x += (s.speed * dt) / 0.34));
    v.model.front.forEach((w) => (w.rotation.y = s.steer));
    if (v.kind === "car") {
      v.model.body.rotation.z =
        -s.steer * Math.min(1, Math.abs(s.speed) / 12) * 0.1;
      v.model.body.position.y =
        Math.sin(this.timer * 18) * Math.min(0.007, Math.abs(s.speed) * 0.0004);
    } else {
      g.rotation.z = -s.steer * Math.min(0.38, Math.abs(s.speed) * 0.025);
      const phase =
        (g.userData.pedalPhase ?? 0) +
        dt * Math.min(8, Math.abs(s.speed) * 0.9);
      g.userData.pedalPhase = phase;
      if (v.model.crank) v.model.crank.rotation.x = -phase;
      v.model.pedals?.forEach((p) => (p.rotation.x = phase));
    }
  }
  nearest(x: number, z: number, r = 7) {
    let nearest: Vehicle | null = null,
      d = r;
    for (const v of this.vehicles) {
      const dd = Math.hypot(v.state.x - x, v.state.z - z);
      if (dd < d) {
        nearest = v;
        d = dd;
      }
    }
    return nearest;
  }
}
