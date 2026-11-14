interface TreePosition {
  x: number;
  z: number;
}

/** Keep a small hysteresis band so neighbouring trees do not swap detail every step. */
export function selectForestLods<T extends TreePosition>(
  trees: T[],
  x: number,
  z: number,
  nearBudget: number,
  previousNear: T[] = [],
  previousMedium: T[] = [],
) {
  if (nearBudget <= 0) return { near: [] as T[], medium: [] as T[] };
  const high = nearBudget > 8;
  const distance = (t: T) => Math.hypot(t.x - x, t.z - z);
  const nearby = trees.filter((t) => distance(t) < (high ? 175 : 150));
  const rank = (previous: T[]) => {
    const preferred = new Set(previous);
    return (a: T, b: T) =>
      distance(a) / (preferred.has(a) ? 1.12 : 1) -
      distance(b) / (preferred.has(b) ? 1.12 : 1);
  };
  const near = nearby
    .filter((t) => distance(t) < (high ? 60 : 44))
    .sort(rank(previousNear))
    .slice(0, nearBudget);
  const nearSet = new Set(near);
  const medium = nearby
    .filter((t) => !nearSet.has(t))
    .sort(rank(previousMedium))
    .slice(0, high ? 128 : 64);
  return { near, medium };
}
