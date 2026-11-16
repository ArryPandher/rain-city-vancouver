import test from "node:test";
import assert from "node:assert/strict";
import {
  IRONWORKERS_REGISTERED_CONTROLS as C,
  IRONWORKERS_REGISTERED_SPANS as S,
  IRONWORKERS_REGISTERED_SOURCE as D,
  IRONWORKERS_REGISTERED_LIMIT as L,
  IRONWORKERS_REGISTERED_PLAN_ORIGIN as O,
  ironworkersElevationFromPixel,
  sampleIronworkersRegisteredProfile as sample,
  ironworkersRegisteredPoint as point,
} from "../src/world/ironworkers-registered-profile";
import {
  ironworkersFrame,
  ironworkersTAtDistance,
} from "../src/world/ironworkers-alignment";

test("printed pier dimensions register on actual curved road arc length without the six-metre tie bias", () => {
  let station = 0;
  assert.ok(O > 5.8 && O < 6.2);
  for (const span of S) {
    assert.equal(C.find((p) => p.name === span.south)!.station, station);
    station += span.length;
    assert.equal(C.find((p) => p.name === span.north)!.station, station);
    const t = ironworkersTAtDistance(O + station);
    assert.ok(Math.abs(ironworkersFrame(t).distance - O - station) < 1e-8);
  }
  const independent = [
    ["P18", 6811.21668, -952.218728],
    ["P17", 6810.711276, -984.425138],
    ["P16", 6808.498425, -1125.436988],
    ["P15", 6803.307786, -1456.205524],
    ["P14", 6801.081275, -1598.087818],
  ] as const;
  for (const [name, x, z] of independent) {
    const p = point(C.find((p) => p.name === name)!.station)!;
    assert.ok(
      Math.hypot(p[0] - x, p[2] - z) < D.planRegistrationUncertainty,
      name,
    );
  }
});

test("deck and lower steel reproduce measured pixels with explicit high-water/mean-water conversion", () => {
  assert.equal(ironworkersElevationFromPixel(284), 1.9);
  assert.ok(
    Math.abs(89 * D.metresPerPixel - 42.7) < 0.1,
    "independent red air-draft scale check",
  );
  for (const c of C) {
    const p = sample(c.station)!;
    assert.ok(Math.abs(p.deck - c.deck) < 1e-9);
    assert.ok(Math.abs(p.steel - c.steel) < 1e-9);
    const deck = point(c.station)!,
      lower = point(c.station, 0, "steel")!;
    assert.equal(deck[0], lower[0]);
    assert.equal(deck[2], lower[2]);
    assert.ok(Math.abs(deck[1] - lower[1] - p.depth) < 1e-9);
  }
  const bearing = sample(C.find((c) => c.name === "P16")!.station)!;
  assert.ok(bearing.depth > 45 && bearing.depth < 49);
  assert.ok(sample(0)!.deck > 45 && sample(0)!.deck < 49);
  assert.ok(sample(C.find((c) => c.name === "crest")!.station)!.deck > 60);
});

test("continuous profile retains positive structure depth and source span envelopes without offsite extrapolation", () => {
  for (let s = 0; s < L; s += 0.25) {
    const a = sample(s)!,
      b = sample(Math.min(L, s + 0.25))!;
    assert.ok(a.depth > 4.7 && a.depth < 49);
    assert.ok(Math.abs(b.deck - a.deck) / 0.25 < 0.1);
    const c = C.findIndex((p) => p.station > s),
      lo = C[c - 1],
      hi = C[c];
    assert.ok(
      a.deck >= Math.min(lo.deck, hi.deck) - 1e-8 &&
        a.deck <= Math.max(lo.deck, hi.deck) + 1e-8,
    );
  }
  for (const c of C.slice(1, -1)) {
    const e = 0.001,
      l = (sample(c.station)!.deck - sample(c.station - e)!.deck) / e,
      r = (sample(c.station + e)!.deck - sample(c.station)!.deck) / e;
    assert.ok(Math.abs(l - r) < 1e-5);
  }
  for (const s of [-1, L + 1, NaN, Infinity])
    assert.equal(sample(s), undefined);
});
