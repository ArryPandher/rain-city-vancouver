import { ironworkersPedestrianRoad } from "./ironworkers-pedestrians";
import {
  createCanadaPedestrianCircuit,
  canadaPedestrianPoint,
  advanceCanadaPedestrian,
  CANADA_PEDESTRIAN_SLOTS,
  PEDESTRIAN_POOL_LIMIT,
  type CanadaPedestrianCircuit,
} from "./canada-place-pedestrians";
import {
  createHowePedestrianCircuits,
  howePedestrianAssignment,
  howePedestrianPoint,
  howePedestrianHeight,
  advanceHowePedestrian,
  findHowePedestrianSpawn,
  HOWE_PEDESTRIAN_SLOTS,
  type HowePedestrianCircuit,
} from "./howe-pedestrians";
import { updateCarLOD, syncCarLOD } from "../world/car-lod";
import { batchCarWheels, syncCarWheelBatches } from "../world/wheel-batching";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { detailedCar, attachDetailedCarLOD } from "../world/detailed-car";
import { VehicleModel, makeCar, makeBike } from "../world/vehicles";
import { makeCharacter, Character } from "./character";
import { carState, CarState, angleDelta } from "./physics";
import { Road, isStreet, seeded, roadWidth } from "../world/data";
import { normalizeGeometry } from "../world/geometry";
import { World } from "../world/world";
import { drivingOffset, reverseRoad } from "../world/road-profile";
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
  howe?: { route: number; distance: number; pace: number; speed: number };
  canadaDistance?: number;
  canadaSpeed?: number;
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
  road.foot !== false &&
  ((isStreet(road) && road.sidewalk !== "none") ||
    ["pedestrian", "footway", "path", "cycleway"].includes(road.kind));
const sidewalkOffset = (road: Road, side: number) =>
  (isStreet(road) && road.sidewalk === "left"
    ? -1
    : isStreet(road) && road.sidewalk === "right"
      ? 1
      : side) *
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
  canadaCircuit: CanadaPedestrianCircuit | null = null;
  howeCircuits: HowePedestrianCircuit[] | null = null;
  constructor(
    public world: World,
    private readonly wheelMultiDraw = false,
  ) {}
  groundHeight(
    model: VehicleModel,
    x: number,
    z: number,
    referenceY = Infinity,
  ) {
    return model.group.userData.vehicleAsset === "e30-coupe"
      ? this.world.vehicleGroundHeight(x, z, referenceY)
      : this.world.collision.height(x, z, referenceY);
  }
  addVehicle(
    kind: "car" | "bike",
    x: number,
    z: number,
    heading: number,
    ai = false,
    color = 0x375f68,
    referenceY = Infinity,
    hero = false,
  ) {
    const model =
      kind === "bike"
        ? makeBike(this.world.materials)
        : detailedCar(color, ai, hero) || makeCar(this.world.materials, color);
    mergeGroup(model.body as T.Group);
    model.wheels.forEach(mergeGroup);
    if (kind === "car") {
      batchCarWheels(model.group, this.wheelMultiDraw);
      attachDetailedCarLOD(model, this.wheelMultiDraw);
    }
    model.group.position.set(
      x,
      this.groundHeight(model, x, z, referenceY) +
        (model.group.userData.roadClearance ?? 0.12),
      z,
    );
    model.group.rotation.y = heading;
    this.addShadow(model);
    this.world.scene.add(model.group);
    const v: Vehicle = {
      model,
      state: carState(x, z, heading),
      kind,
      name:
        kind === "bike"
          ? "Seawall cycle"
          : (model.group.userData.vehicleName ?? "Pacific GT"),
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
      roads
        .filter(pedestrianRoute)
        .map((r) =>
          ironworkersPedestrianRoad(r, this.world.collision.ironworkersPaths),
        ),
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
        this.world.collision.roadHeight(p.road, p.x, p.z),
      );
      v.road = p.road;
      v.segment = p.segment;
      v.progress = p.t;
      v.state.speed = i < 16 ? 6 + this.random() * 6 : 0;
      v.name = ["Pacific GT", "Harbour Coupe", "West End GT"][i % 3];
    }
    this.canadaCircuit ??= createCanadaPedestrianCircuit(this.world.collision);
    this.howeCircuits ??= createHowePedestrianCircuits(this.world.collision);
    for (let i = this.peds.length; i < PEDESTRIAN_POOL_LIMIT; i++) {
      let howe: Pedestrian["howe"];
      const howeSlot = i - CANADA_PEDESTRIAN_SLOTS;
      if (
        this.howeCircuits &&
        howeSlot >= 0 &&
        howeSlot < HOWE_PEDESTRIAN_SLOTS
      ) {
        const assignment = howePedestrianAssignment(
          this.howeCircuits,
          howeSlot,
        );
        const distance = findHowePedestrianSpawn(
          this.howeCircuits[assignment.route],
          assignment.distance,
          this.world.collision,
          this.pedestrianBodies(),
          this.howeVehicleObstacles(),
        );
        if (distance !== undefined)
          howe = { ...assignment, distance, speed: 0 };
      }
      const canadaDistance =
        this.canadaCircuit && i < CANADA_PEDESTRIAN_SLOTS
          ? (i * this.canadaCircuit.length) / CANADA_PEDESTRIAN_SLOTS
          : undefined;
      const fixed =
        canadaDistance !== undefined
          ? canadaPedestrianPoint(this.canadaCircuit!, canadaDistance)
          : howe
            ? howePedestrianPoint(this.howeCircuits![howe.route], howe.distance)
            : null;
      const side = i % 2 ? 1 : -1;
      const at = fixed
        ? {
            ...fixed,
            road: {
              kind: "footway",
              pts: (howe
                ? this.howeCircuits![howe.route]
                : this.canadaCircuit!
              ).points.flatMap((p) => [p.x, p.z]),
            } as Road,
            t: 0,
            segment: 0,
          }
        : this.place(walkingSpans, x, z, {
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
      p.group.position.set(
        at.x,
        howe
          ? howePedestrianHeight(this.world.collision, at)
          : fixed
            ? 7.88
            : this.world.collision.roadHeight(at.road, at.x, at.z),
        at.z,
      );
      p.group.rotation.y = at.heading;
      const ped: Pedestrian = {
        howe,
        canadaDistance,
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
          ? Math.max(0, roadWidth(sample.road) / 2 - 1.2)
          : drivingOffset(sample.road);
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
          model.kind === "car"
            ? (model.group.userData.contactFootprint?.halfWidth ?? 1.43) * 2.38
            : 1.3,
          model.kind === "car"
            ? (model.group.userData.contactFootprint?.halfLength ?? 2.45) * 2.57
            : 2.6,
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
      roads
        .filter(pedestrianRoute)
        .map((r) =>
          ironworkersPedestrianRoad(r, this.world.collision.ironworkersPaths),
        ),
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
      v.model.group.position.y =
        this.world.collision.roadHeight(p.road, p.x, p.z) + 0.13;
      this.sync(v, 0);
    }
    for (const p of this.peds) {
      if (p.canadaDistance !== undefined || p.howe) continue;
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
        this.world.collision.roadHeight(at.road, at.x, at.z),
        at.z,
      );
      p.down = 0;
      p.panic = 0;
      p.character.group.rotation.y = at.heading;
    }
  }
  /** Physical bodies include waiting/down actors, independently of render culling. */
  pedestrianBodies() {
    return this.peds.map((p) => {
      const group = p.character.group,
        down = p.down > 0;
      // Actors.update rotates the 1.8m rig +90deg about Z: its upward axis
      // becomes (-cos(heading), 0, sin(heading)), extending away from the feet.
      const heading = group.rotation.y,
        shift = down ? 0.9 : 0;
      return {
        x: group.position.x - Math.cos(heading) * shift,
        z: group.position.z + Math.sin(heading) * shift,
        y: group.position.y,
        radius: down ? 1 : 0.4,
        height: down ? 0.55 : 1.8,
      };
    });
  }
  private howeVehicleObstacles() {
    return this.vehicles.map((v) => ({
      x: v.state.x,
      z: v.state.z,
      y: v.model.group.position.y,
      heading: v.state.heading,
      kind: v.kind,
      speed: v.state.speed,
    }));
  }
  howePedestrianSummary() {
    return {
      totalPool: this.peds.length,
      circuitLengths: this.howeCircuits?.map((c) => c.length) ?? [],
      assigned: this.peds
        .filter((p) => p.howe)
        .map((p) => ({
          id: p.character.group.id,
          route: p.howe!.route,
          distance: p.howe!.distance,
          position: p.character.group.position.toArray(),
          speed: p.howe!.speed,
          state:
            p.down > 0
              ? "down"
              : p.howe!.speed === 0
                ? "waiting"
                : p.panic > 0
                  ? "panic"
                  : "walking",
          visible: p.character.group.visible,
        })),
    };
  }
  /** Read-only, requested diagnostics; stable object IDs and fixed world progress. */
  canadaPedestrianSummary() {
    return {
      totalPool: this.peds.length,
      circuitLength: this.canadaCircuit?.length ?? null,
      assigned: this.peds
        .filter((p) => p.canadaDistance !== undefined)
        .map((p) => ({
          id: p.character.group.id,
          distance: p.canadaDistance,
          position: p.character.group.position.toArray(),
          speed: p.canadaSpeed ?? 0,
          state:
            p.down > 0
              ? "down"
              : (p.canadaSpeed ?? 0) === 0
                ? "waiting"
                : p.panic > 0
                  ? "panic"
                  : "walking",
          visible: p.character.group.visible,
        })),
    };
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
      if (v === current) {
        updateCarLOD(v.model, 0, true);
        continue;
      }
      let { state: s } = v;
      const dist = Math.hypot(s.x - player.x, s.z - player.z);
      v.model.group.visible = dist < 650;
      updateCarLOD(v.model, dist, false);
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
                    (!o.oneway &&
                      Math.hypot(o.pts.at(-2)! - ex, o.pts.at(-1)! - ez) < 4)),
              );
            if (options.length) {
              r = options[Math.floor(this.random() * options.length)];
              if (
                !r.oneway &&
                Math.hypot(r.pts.at(-2)! - ex, r.pts.at(-1)! - ez) < 4
              )
                r = reverseRoad(r);
              v.road = r;
              v.segment = 0;
            } else if (Math.hypot(r.pts[0] - ex, r.pts[1] - ez) < 1) {
              v.segment = 0;
            } else if (r.oneway) {
              v.segment = r.pts.length - 4;
              v.progress = 1;
              s.speed = 0;
              this.sync(v, dt);
              continue;
            } else {
              v.road = reverseRoad(r);
              r = v.road;
              v.segment = 0;
            }
          }
          progress = 0;
        }
        const p = this.roadPoint(r, v.segment, progress, drivingOffset(r));
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
        if (p.canadaDistance !== undefined) p.canadaSpeed = 0;
        if (p.howe) p.howe.speed = 0;
        p.down -= dt;
        obj.rotation.z = Math.PI / 2;
        obj.position.y =
          (p.howe
            ? howePedestrianHeight(this.world.collision, obj.position)
            : this.world.collision.height(
                obj.position.x,
                obj.position.z,
                obj.position.y,
              )) + 0.18;
        continue;
      }
      obj.rotation.z = 0;
      p.panic = Math.max(0, p.panic - dt);
      if (p.howe && this.howeCircuits) {
        const bodies = this.pedestrianBodies().filter(
          (_, i) => this.peds[i] !== p,
        );
        bodies.push({
          x: player.x,
          z: player.z,
          y: player.y,
          radius: 0.55,
          height: 1.8,
        });
        const next = advanceHowePedestrian(
          this.howeCircuits[p.howe.route],
          { ...p.howe, panic: p.panic, down: p.down },
          dt,
          this.world.collision,
          bodies,
          this.howeVehicleObstacles(),
        );
        p.howe.distance = next.distance;
        p.howe.speed = next.speed;
        if (next.speed > 0)
          obj.rotation.y +=
            angleDelta(obj.rotation.y, next.heading) * (1 - Math.exp(-dt * 8));
        obj.position.set(next.x, next.y, next.z);
        if (obj.visible) p.character.update(this.timer, next.speed, false);
        continue;
      }
      if (p.canadaDistance !== undefined && this.canadaCircuit) {
        const obstacles = [
          ...(Math.abs(player.y - 7.88) < 2.5
            ? [{ x: player.x, z: player.z, radius: 0.8 }]
            : []),
          ...this.vehicles
            .filter((v) => Math.abs(v.model.group.position.y - 7.88) < 2.5)
            .map((v) => ({
              x: v.state.x,
              z: v.state.z,
              radius: v.kind === "car" ? 2.8 : 1.2,
            })),
          ...this.peds
            .filter(
              (other) =>
                other !== p &&
                Math.abs(other.character.group.position.y - 7.88) < 2.5,
            )
            .map((other) => ({
              x: other.character.group.position.x,
              z: other.character.group.position.z,
              radius: 0.4,
            })),
        ];
        const next = advanceCanadaPedestrian(
          this.canadaCircuit,
          { distance: p.canadaDistance, panic: p.panic, down: p.down },
          dt,
          this.world.collision,
          obstacles,
        );
        p.canadaDistance = next.distance;
        p.canadaSpeed = next.speed;
        if (next.speed > 0)
          obj.rotation.y +=
            angleDelta(obj.rotation.y, next.heading) * (1 - Math.exp(-dt * 8));
        obj.position.set(next.x, 7.88, next.z);
        if (obj.visible) p.character.update(this.timer, next.speed, false);
        continue;
      }
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
        obj.position.set(
          a.x,
          this.world.collision.height(a.x, a.z, obj.position.y),
          a.z,
        );
      } else {
        p.direction *= -1;
      }
      if (obj.visible) p.character.update(this.timer, speed, false);
    }
  }
  sync(v: Vehicle, dt: number) {
    const s = v.state,
      g = v.model.group;
    const support = (x: number, z: number, y: number) =>
      this.groundHeight(v.model, x, z, y);
    g.position.set(
      s.x,
      support(s.x, s.z, g.position.y) + (g.userData.roadClearance ?? 0.13),
      s.z,
    );
    g.rotation.order = "YXZ";
    g.rotation.y = s.heading;
    const forward = new T.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading));
    const samples = g.userData.groundSamples ?? {
      front: 1.5,
      rear: -1.5,
      halfTrack: 1,
    };
    const y1 = support(
        s.x + forward.x * samples.front,
        s.z + forward.z * samples.front,
        g.position.y,
      ),
      y0 = support(
        s.x + forward.x * samples.rear,
        s.z + forward.z * samples.rear,
        g.position.y,
      );
    g.rotation.x = -Math.atan2(y1 - y0, samples.front - samples.rear);
    const sideX = Math.cos(s.heading),
      sideZ = -Math.sin(s.heading);
    const left = support(
        s.x - sideX * samples.halfTrack,
        s.z - sideZ * samples.halfTrack,
        g.position.y,
      ),
      right = support(
        s.x + sideX * samples.halfTrack,
        s.z + sideZ * samples.halfTrack,
        g.position.y,
      );
    g.rotation.z = Math.atan2(right - left, 2 * samples.halfTrack);
    v.model.wheels.forEach(
      (w) =>
        (w.rotation.x += (s.speed * dt) / (w.userData.rollingRadius || 0.34)),
    );
    v.model.front.forEach((w) => (w.rotation.y = s.steer));
    if (v.kind === "car") {
      v.model.body.rotation.z =
        -s.steer * Math.min(1, Math.abs(s.speed) / 12) * 0.1;
      v.model.body.position.y =
        Math.sin(this.timer * 18) * Math.min(0.007, Math.abs(s.speed) * 0.0004);
    } else {
      g.rotation.z -= s.steer * Math.min(0.38, Math.abs(s.speed) * 0.025);
      const phase =
        (g.userData.pedalPhase ?? 0) +
        dt * Math.min(8, Math.abs(s.speed) * 0.9);
      g.userData.pedalPhase = phase;
      if (v.model.crank) v.model.crank.rotation.x = -phase;
      v.model.pedals?.forEach((p) => (p.rotation.x = phase));
    }
    syncCarWheelBatches(g);
    syncCarLOD(v.model);
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
