import * as T from "three";
import { World } from "../world/world";
import { Actors } from "./actors";
import { GameAudio } from "./audio";
import { makeWeapon, Character } from "./character";
import { label } from "../world/materials";
export const WEAPONS = [
  {
    name: "Service pistol",
    capacity: 15,
    reserve: 180,
    rate: 0.23,
    reload: 1.25,
    spread: 0.004,
    recoil: 0.018,
    damage: 40,
  },
  {
    name: "Automatic carbine",
    capacity: 30,
    reserve: 300,
    rate: 0.085,
    reload: 1.75,
    spread: 0.009,
    recoil: 0.013,
    damage: 25,
  },
  {
    name: "Pump shotgun",
    capacity: 8,
    reserve: 64,
    rate: 0.8,
    reload: 2.1,
    spread: 0.043,
    recoil: 0.044,
    damage: 22,
  },
];
interface Effect {
  mesh: T.Object3D;
  life: number;
  total: number;
  velocity?: T.Vector3;
}
export class Combat {
  selected = 0;
  holstered = true;
  ammo = WEAPONS.map((w) => w.capacity);
  reserve = WEAPONS.map((w) => w.reserve);
  cooldown = 0;
  reloadLeft = 0;
  effects: Effect[] = [];
  models: T.Group[] = [];
  targets: T.Mesh[] = [];
  hits = 0;
  shots = 0;
  hitFlash = 0;
  heat = 0;
  flash = new T.PointLight(0xffb153, 0, 9);
  ray = new T.Raycaster();
  onHit: () => void = () => {};
  constructor(
    public world: World,
    public actors: Actors,
    public audio: GameAudio,
    public character: Character,
  ) {
    for (let i = 0; i < 3; i++) {
      const w = makeWeapon(world.materials, i);
      character.rightHand.add(w);
      w.visible = false;
      this.models.push(w);
    }
    world.scene.add(this.flash);
  }
  select(i: number) {
    if (i < 0 || i > 2) return;
    this.selected = i;
    this.holstered = false;
    this.reloadLeft = 0;
    this.models.forEach((m, k) => (m.visible = k === i));
  }
  holster() {
    this.holstered = true;
    this.models.forEach((m) => (m.visible = false));
    this.reloadLeft = 0;
  }
  reload() {
    if (
      this.holstered ||
      this.reloadLeft > 0 ||
      this.ammo[this.selected] >= WEAPONS[this.selected].capacity ||
      this.reserve[this.selected] <= 0
    )
      return;
    this.reloadLeft = WEAPONS[this.selected].reload;
    this.audio.reload();
  }
  shoot(camera: T.Camera) {
    if (this.holstered || this.cooldown > 0 || this.reloadLeft > 0)
      return false;
    const index = this.selected,
      w = WEAPONS[index];
    if (this.ammo[index] === 0) {
      this.reload();
      return false;
    }
    this.ammo[index]--;
    this.shots++;
    this.cooldown = w.rate;
    this.audio.shot(index);
    this.heat = Math.min(100, this.heat + 2.5);
    this.actors.panic(
      this.character.group.position.x,
      this.character.group.position.z,
    );
    const origin = new T.Vector3();
    this.character.rightHand.getWorldPosition(origin);
    origin.y += 0.06;
    const dir = new T.Vector3();
    camera.getWorldDirection(dir);
    origin.addScaledVector(dir, 0.48);
    this.flash.position.copy(origin);
    this.flash.intensity = 9;
    const flashMesh = new T.Mesh(
      new T.SphereGeometry(0.055, 6, 4),
      new T.MeshBasicMaterial({ color: 0xffe4a0 }),
    );
    flashMesh.position.copy(origin);
    flashMesh.scale.set(1, 1, 3);
    flashMesh.quaternion.copy(camera.quaternion);
    this.world.scene.add(flashMesh);
    this.effects.push({ mesh: flashMesh, life: 0.045, total: 0.045 });
    const solids = this.world.chunks.filter(
      (m) =>
        m.visible &&
        !(m instanceof T.InstancedMesh) &&
        m.material !== this.world.water &&
        m.geometry.boundingSphere &&
        m.geometry.boundingSphere.center.distanceTo(origin) <
          350 + m.geometry.boundingSphere.radius,
    );
    const pedMeshes: T.Object3D[] = [];
    for (const p of this.actors.peds)
      if (p.down === 0 && p.character.group.visible)
        pedMeshes.push(p.character.group);
    const cars = this.actors.vehicles
      .filter((v) => v.model.group.visible)
      .map((v) => v.model.group);
    for (let pellet = 0; pellet < (index === 2 ? 8 : 1); pellet++) {
      this.ray.setFromCamera(
        new T.Vector2(
          (Math.random() - 0.5) * w.spread,
          (Math.random() - 0.5) * w.spread,
        ),
        camera,
      );
      this.ray.far = 250;
      const hits = this.ray
        .intersectObjects(
          [...this.targets, ...pedMeshes, ...cars, ...solids],
          true,
        )
        .filter((h) => h.object.visible);
      const hit = hits[0],
        end = hit ? hit.point : this.ray.ray.at(180, new T.Vector3());
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints([origin, end]),
        new T.LineBasicMaterial({
          color: 0xffe4af,
          transparent: true,
          opacity: 0.6,
        }),
      );
      this.world.scene.add(line);
      this.effects.push({ mesh: line, life: 0.06, total: 0.06 });
      if (hit) {
        for (const t of this.targets)
          if (hit.object === t) {
            t.userData.health -= w.damage;
            if (t.userData.health <= 0 && t.visible) {
              t.visible = false;
              this.hits++;
              this.onHit();
              this.audio.tone(930, 0.12, 0.09);
            }
            this.hitFlash = 0.16;
          }
        for (const p of this.actors.peds) {
          let obj: T.Object3D | null = hit.object;
          while (obj) {
            if (obj === p.character.group) {
              p.down = 12;
              p.panic = 10;
              this.heat = Math.min(100, this.heat + 12);
              this.hitFlash = 0.15;
              break;
            }
            obj = obj.parent;
          }
        }
        for (let i = 0; i < 5; i++) {
          const spark = new T.Mesh(
            new T.SphereGeometry(0.02, 4, 3),
            new T.MeshBasicMaterial({ color: 0xffce8e }),
          );
          spark.position.copy(hit.point);
          this.world.scene.add(spark);
          this.effects.push({
            mesh: spark,
            life: 0.22,
            total: 0.22,
            velocity: new T.Vector3(
              (Math.random() - 0.5) * 5,
              Math.random() * 4,
              (Math.random() - 0.5) * 5,
            ),
          });
        }
      }
    }
    return true;
  }
  targetCourse(x: number, z: number, heading: number) {
    for (const t of this.targets) {
      t.removeFromParent();
      t.geometry.dispose();
      (t.material as T.Material).dispose();
    }
    this.targets = [];
    this.hits = 0;
    this.shots = 0;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#dbd3bf";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 5; i > 0; i--) {
      ctx.beginPath();
      ctx.arc(128, 128, i * 22, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "#27363a" : "#ded8c8";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(128, 128, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#d78046";
    ctx.fill();
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    for (let i = 0; i < 6; i++) {
      const distance = 12 + Math.floor(i / 3) * 8,
        side = ((i % 3) - 1) * 2.5;
      const xx = x + Math.sin(heading) * distance + Math.cos(heading) * side,
        zz = z + Math.cos(heading) * distance - Math.sin(heading) * side;
      const pos = this.world.collision.safe(xx, zz, 0.4);
      const target = new T.Mesh(
        new T.BoxGeometry(1.15, 1.55, 0.12),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
      );
      target.position.set(
        pos[0],
        this.world.collision.height(...pos) + 1.5,
        pos[1],
      );
      const standMat = new T.MeshStandardMaterial({
        color: 0x484d4c,
        metalness: 0.4,
        roughness: 0.7,
      });
      const stand = new T.Mesh(new T.BoxGeometry(0.07, 0.82, 0.07), standMat);
      stand.position.y = -1.08;
      target.add(stand);
      const foot = new T.Mesh(new T.BoxGeometry(0.95, 0.045, 0.7), standMat);
      foot.position.y = -1.475;
      target.add(foot);
      target.rotation.y = heading;
      target.userData.health = 50;
      this.world.scene.add(target);
      this.targets.push(target);
    }
    this.ammo = WEAPONS.map((w) => w.capacity);
    this.reserve = WEAPONS.map((w) => w.reserve);
    this.select(0);
  }
  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.heat = Math.max(0, this.heat - dt * 1.5);
    this.flash.intensity *= Math.exp(-45 * dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        const need = WEAPONS[this.selected].capacity - this.ammo[this.selected],
          take = Math.min(need, this.reserve[this.selected]);
        this.ammo[this.selected] += take;
        this.reserve[this.selected] -= take;
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.velocity) {
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.velocity.y -= 9.8 * dt;
      }
      if (e.life <= 0) {
        e.mesh.removeFromParent();
        if (e.mesh instanceof T.Mesh || e.mesh instanceof T.Line) {
          e.mesh.geometry.dispose();
          if (!Array.isArray(e.mesh.material)) e.mesh.material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }
}
