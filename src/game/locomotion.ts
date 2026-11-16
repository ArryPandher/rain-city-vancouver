import type { AnimationAction } from "three";

export interface WalkingVelocity {
  x: number;
  z: number;
  grounded: boolean;
}
export type MovingClip =
  | "walk"
  | "run"
  | "walk_back"
  | "strafe_left"
  | "strafe_right";
export type GaitClip = MovingClip | "idle";
export type LocomotionRig = "male" | "female";
export const MOVING_CLIPS: readonly MovingClip[] = [
  "walk",
  "run",
  "walk_back",
  "strafe_left",
  "strafe_right",
];
// 120-phase sampling of30 actual boot-sole points on each committed rig.
// Align which foot supports the body, not the peak swing height (which differs
// between walking and running). Tests check the sampled contact ordering.
export const LOCOMOTION_PHASE_OFFSETS: Record<
  "male" | "female",
  Record<MovingClip, number>
> = {
  male: {
    walk: 0,
    run: -0.1,
    walk_back: 0.025,
    strafe_left: 0,
    strafe_right: 0,
  },
  female: {
    walk: 0,
    run: -0.125,
    walk_back: 0,
    strafe_left: 0,
    strafe_right: 0,
  },
};
export const locomotionClipPhase = (
  phase: number,
  clip: MovingClip,
  variant = 0,
  sourceRig?: LocomotionRig,
) =>
  (((phase +
    LOCOMOTION_PHASE_OFFSETS[
      sourceRig ?? (variant > 0 && variant % 3 === 0 ? "female" : "male")
    ][clip]) %
    1) +
    1) %
  1;

/** Animation/audio follow the displacement the existing collision solver allowed. */
export function walkingLocomotion(
  from: { x: number; z: number },
  to: { x: number; z: number },
  dt: number,
  grounded: boolean,
  footstepDistance: number,
) {
  const x = dt > 0 ? (to.x - from.x) / dt : 0;
  const z = dt > 0 ? (to.z - from.z) / dt : 0;
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const travelled = footstepDistance + (grounded ? distance : 0);
  const step = grounded && travelled > 0.85;
  return {
    x,
    z,
    grounded,
    speed: Math.hypot(x, z),
    footstepDistance: step ? 0 : travelled,
    step,
  };
}

/** +local X is left in this rig and in the existing A/D controls. L1 weights
 * continuously mix adjacent directions, including backward diagonals. */
export function locomotionWeights(
  speed: number,
  bike: boolean,
  velocity?: WalkingVelocity,
  facing = 0,
): Partial<Record<GaitClip, number>> {
  if (bike || speed <= 0.15) return { idle: 1 };
  const forwardClip = speed > 4.2 ? "run" : "walk";
  if (!velocity?.grounded) return { [forwardClip]: 1 };
  const forward = velocity.x * Math.sin(facing) + velocity.z * Math.cos(facing);
  const left = velocity.x * Math.cos(facing) - velocity.z * Math.sin(facing);
  const total = Math.abs(forward) + Math.abs(left);
  if (total < 1e-8) return { idle: 1 };
  const weights: Partial<Record<GaitClip, number>> = {};
  if (Math.abs(forward) > 1e-8)
    weights[forward >= 0 ? forwardClip : "walk_back"] =
      Math.abs(forward) / total;
  if (Math.abs(left) > 1e-8)
    weights[left >= 0 ? "strafe_left" : "strafe_right"] =
      Math.abs(left) / total;
  return weights;
}

/** Shared stride clock plus continuous weights, using only existing clips.
 * Moving clips share contact phase with source-measured offsets; the mixer advances
 * idle normally and applies all bone tracks before the existing procedural pose. */
export class CharacterLocomotion {
  private weights: Partial<Record<GaitClip, number>> = { idle: 1 };
  private targets: Partial<Record<GaitClip, number>> = { idle: 1 };
  private phase: number;
  constructor(
    private readonly actions: Map<string, AnimationAction>,
    private readonly variant: number,
    private readonly sourceRig?: LocomotionRig,
  ) {
    this.phase =
      ((variant * 0.173) / actions.get("walk")!.getClip().duration) % 1;
    for (const name of ["idle", ...MOVING_CLIPS]) {
      const action = actions.get(name);
      if (!action) continue;
      action.setEffectiveWeight(name === "idle" ? 1 : 0).play();
      if (name !== "idle") action.setEffectiveTimeScale(0);
      else action.time = (variant * 0.173) % action.getClip().duration;
    }
  }
  update(
    dt: number,
    speed: number,
    bike: boolean,
    velocity?: WalkingVelocity,
    facing = 0,
  ) {
    this.targets = locomotionWeights(speed, bike, velocity, facing);
    // A missing optional directional clip falls back to the already required walk.
    for (const [name, weight] of Object.entries(this.targets)) {
      if (!this.actions.has(name)) {
        this.targets.walk = (this.targets.walk ?? 0) + weight;
        delete this.targets[name as GaitClip];
      }
    }
    let phaseRate = 0;
    for (const [name, weight] of Object.entries(this.targets)) {
      if (name === "idle") continue;
      const scale =
        name === "run"
          ? speed / 5.2
          : name === "walk"
            ? Math.max(0.6, Math.min(1.65, speed / 2.2))
            : Math.max(0.6, speed / 2.2);
      phaseRate +=
        (weight * scale) / this.actions.get(name)!.getClip().duration;
    }
    this.phase = (this.phase + dt * phaseRate) % 1;
    // 96% of the transition completes in the former180ms fade window. Unlike
    // restarting fades on every directional change, this remains continuous.
    const blend = 1 - Math.exp(-18 * dt);
    for (const name of ["idle", ...MOVING_CLIPS] as GaitClip[]) {
      const action = this.actions.get(name);
      if (!action) continue;
      const target = this.targets[name] ?? 0;
      const weight =
        (this.weights[name] ?? 0) +
        (target - (this.weights[name] ?? 0)) * blend;
      this.weights[name] = Math.abs(weight - target) < 0.0001 ? target : weight;
    }
    const total = Object.values(this.weights).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    for (const name of ["idle", ...MOVING_CLIPS] as GaitClip[]) {
      const action = this.actions.get(name);
      if (!action) continue;
      this.weights[name] = (this.weights[name] ?? 0) / total;
      action.setEffectiveWeight(this.weights[name]!);
      if (name !== "idle")
        action.time =
          locomotionClipPhase(this.phase, name, this.variant, this.sourceRig) *
          action.getClip().duration;
    }
  }
  snapshot() {
    return {
      normalizedPhase: this.phase,
      phaseRig:
        this.sourceRig ??
        (this.variant > 0 && this.variant % 3 === 0 ? "female" : "male"),
      availableClips: ["idle", ...MOVING_CLIPS].filter((name) =>
        this.actions.has(name),
      ),
      clips: Object.entries(this.weights)
        .filter(([, weight]) => weight > 0.0001)
        .map(([name, weight]) => ({
          name,
          weight,
          target: this.targets[name as GaitClip] ?? 0,
          normalizedClipPhase:
            this.actions.get(name)!.time /
            this.actions.get(name)!.getClip().duration,
        })),
      targets: { ...this.targets },
    };
  }
}
export type CharacterLocomotionSnapshot = ReturnType<
  CharacterLocomotion["snapshot"]
>;
