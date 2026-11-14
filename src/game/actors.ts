import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { detailedCar } from "../world/detailed-car";
import { VehicleModel, makeCar, makeBike } from "../world/vehicles";
import { makeCharacter, Character } from "./character";
import { carState, CarState, angleDelta } from "./physics";
import { Road, isStreet, seeded, roadWidth } from "../world/data";
import { normalizeGeometry } from "../world/geometry";
import { World } from "../world/world";
export interface Vehicle {
  model: VehicleModel;
  state: CarState;
  kind: "car" | "bike";
  name: string;
  ai: boolean;
  road?: Road;
  segment: number;
  dir: number;
  health: number;
}
export interface Pedestrian {
  character: Character;
  road: Road;
  t: number;
  direction: number;
  panic: number;
  down: number;
  side: number;
}
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
      dir: 1,
      health: 100,
    };
    this.vehicles.push(v);
    return v;
  }
  populate(x: number, z: number) {
    const nearby = this.world.data.roads.filter(
      (r) =>
        isStreet(r) &&
        r.pts.some(
          (_, i) =>
            i % 2 === 0 && Math.hypot(r.pts[i] - x, r.pts[i + 1] - z) < 600,
        ),
    );
    if (!nearby.length) return;
    const colors = [0x839394, 0x2b4851, 0xc4bcae, 0x783a35, 0x202a32, 0xd1c9b9];
    for (let i = 0; i < 24; i++) {
      const r = nearby[Math.floor(this.random() * nearby.length)];
      let seg = Math.floor(this.random() * (r.pts.length / 2 - 1)) * 2;
      const p = this.roadPoint(r, seg, 0.3 + this.random() * 0.4, 3);
      if (
        this.world.collision.water(p.x, p.z) ||
        this.world.collision.blocked(p.x, p.z, 1)
      )
        continue;
      const v = this.addVehicle(
        "car",
        p.x,
        p.z,
        p.heading,
        i < 16,
        colors[i % colors.length],
      );
      v.road = r;
      v.segment = seg;
      v.state.speed = i < 16 ? 6 + this.random() * 6 : 0;
      v.name = ["Pacific GT", "Harbour Coupe", "West End GT"][i % 3];
    }
    for (let i = 0; i < 34; i++) {
      const r = nearby[Math.floor(this.random() * nearby.length)],
        p = makeCharacter(this.world.materials, i + 1);
      mergeGroup(p.hips);
      mergeGroup(p.head);
      p.arms.forEach(mergeGroup);
      p.legs.forEach(mergeGroup);
      this.world.scene.add(p.group);
      const ped: Pedestrian = {
        character: p,
        road: r,
        t: this.random(),
        direction: 1,
        panic: 0,
        down: 0,
        side: i % 2 ? 1 : -1,
      };
      this.peds.push(ped);
    }
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
  recycle(player: T.Vector3, current: Vehicle | null) {
    const roads = this.world.collision.roads
      .query(player.x, player.z, 420)
      .filter(isStreet);
    if (!roads.length) return;
    for (const v of this.vehicles) {
      if (
        v === current ||
        Math.hypot(v.state.x - player.x, v.state.z - player.z) < 900
      )
        continue;
      const road = roads[Math.floor(this.random() * roads.length)];
      const seg = Math.floor(this.random() * (road.pts.length / 2 - 1)) * 2;
      const p = this.roadPoint(road, seg, 0.3 + this.random() * 0.4, 3);
      if (
        this.world.collision.blocked(p.x, p.z, 1) ||
        this.world.collision.water(p.x, p.z)
      )
        continue;
      v.state.x = p.x;
      v.state.z = p.z;
      v.state.heading = p.heading;
      v.state.speed = v.ai ? 7 : 0;
      v.road = road;
      v.segment = seg;
      this.sync(v, 0);
    }
    for (const p of this.peds) {
      if (p.character.group.position.distanceTo(player) < 450) continue;
      p.road = roads[Math.floor(this.random() * roads.length)];
      p.t = this.random();
      p.down = 0;
      p.panic = 0;
    }
  }
  roadPoint(r: Road, seg: number, t: number, offset: number) {
    const ax = r.pts[seg],
      az = r.pts[seg + 1],
      bx = r.pts[seg + 2],
      bz = r.pts[seg + 3],
      dx = bx - ax,
      dz = bz - az,
      l = Math.hypot(dx, dz) || 1;
    return {
      x: ax + dx * t + (dz / l) * offset,
      z: az + dz * t - (dx / l) * offset,
      heading: Math.atan2(dx, dz),
      len: l,
    };
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
        let progress =
          ((s.x - ax) * (bx - ax) + (s.z - az) * (bz - az)) / (len * len);
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
        obj.position.y = 0.18;
        continue;
      }
      obj.rotation.z = 0;
      p.panic = Math.max(0, p.panic - dt);
      const r = p.road,
        a = this.roadPoint(r, 0, p.t, (roadWidth(r) / 2 + 1.1) * p.side),
        speed = p.panic > 0 ? 4.8 : 1.2;
      p.t += ((dt * speed) / a.len) * p.direction;
      if (p.t > 1) {
        p.t = 1;
        p.direction = -1;
      }
      if (p.t < 0) {
        p.t = 0;
        p.direction = 1;
      }
      if (
        !this.world.collision.blocked(a.x, a.z, 0.3) &&
        !this.world.collision.water(a.x, a.z)
      ) {
        obj.position.set(a.x, 0, a.z);
        obj.rotation.y = a.heading + (p.direction < 0 ? Math.PI : 0);
      } else {
        p.direction *= -1;
        p.t = Math.max(0, Math.min(1, p.t + p.direction * 0.08));
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
