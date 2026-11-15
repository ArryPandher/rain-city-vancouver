import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Vector3 } from "three";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, centroid, type CityData } from "../src/world/data";
import {
  CANADA_PLACE_HOTEL,
  supportedDeck,
  solidAt,
} from "../src/world/canada-place-deck";
import { CANADA_PLACE_GROUND_STAYS } from "../src/world/canada-place-ground-stays-data";
import { shortenChaseBoom } from "../src/game/chase-camera";
function fixture(loaded = true) {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const c = new CollisionWorld(data);
  c.setCanadaPlaceCapabilities({
    loaded,
    concourse: loaded,
    entranceCanopy: loaded,
    groundStays: loaded,
    promenadeFixtures: loaded,
  });
  return c;
}
test("recorded Canada Place camera clears air over the railing without opening actor support", () => {
  const c = fixture(),
    focus = new Vector3(592.7468918345, 7.88 + 1.52, -652.0799777575),
    yaw = 0.5010733971;
  const endpoint = focus
    .clone()
    .add(new Vector3(-Math.sin(yaw) * 4.3, 0.55, -Math.cos(yaw) * 4.3));
  const old = endpoint.clone();
  shortenChaseBoom(focus, old, (p) => c.blocked(p.x, p.z, 0.25, p.y));
  assert.ok(
    old.distanceTo(focus) < 0.08,
    "reproduces native six-centimetre collapsed boom",
  );
  const contact = focus.clone().lerp(endpoint, 0.2 / 4.3);
  assert.equal(supportedDeck(contact.x, contact.z, 0.25), false);
  assert.equal(solidAt(contact.x, contact.z, 0.25, contact.y), false);
  assert.deepEqual(
    c.buildings.query(contact.x, contact.z, 0.25).map((b) => b.id),
    ["w223635729"],
  );
  assert.equal(
    c.blocked(contact.x, contact.z, 0.25, contact.y),
    true,
    "actor query remains unchanged",
  );
  const desired = endpoint.clone();
  assert.equal(
    shortenChaseBoom(focus, desired, (p) =>
      c.cameraBlocked(p.x, p.z, 0.25, p.y),
    ),
    1,
  );
  assert.deepEqual(desired.toArray(), endpoint.toArray());
  assert.equal(
    c.cameraBlocked(contact.x, contact.z, 0.25, 8.8),
    true,
    "camera cannot enter the rail/deck envelope",
  );
  assert.equal(
    fixture(false).cameraBlocked(contact.x, contact.z, 0.25, contact.y),
    true,
    "no exemption without loaded geometry",
  );
});
test("camera query retains hotel, ground stay and physical barrier collision", () => {
  const c = fixture();
  const hotel = centroid(CANADA_PLACE_HOTEL);
  assert.equal(c.cameraBlocked(...hotel, 0.25, 9.4), true);
  const anchor = CANADA_PLACE_GROUND_STAYS[2];
  const center = centroid(anchor.worldFootprint);
  assert.equal(c.cameraBlocked(...center, 0.25, 9.4), true);
  const x = 592.5,
    z = -652.5;
  c.addBarrier(x - 0.5, z, x + 0.5, z, 0.06, 11);
  assert.equal(
    c.cameraBlocked(x, z, 0.25, 9.5),
    true,
    "actual taller railing/wall still blocks camera",
  );
  assert.equal(c.blocked(x, z, 0.25, 7.88), true, "actor protection retained");
});
