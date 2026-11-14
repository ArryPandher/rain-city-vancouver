import fs from "node:fs/promises";
const cache = "artifacts/local/building-tags-osm.json";
let source;
try {
  source = JSON.parse(await fs.readFile(cache, "utf8"));
} catch {
  const query =
    '[out:json][timeout:90];way["building"](49.265,-123.164,49.334,-123.010);out tags;';
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "RainCityVancouver/0.1 (personal open-source game)",
    },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(110000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  source = await response.json();
  if (!source.elements?.length) throw new Error("Empty building tag extract");
  await fs.mkdir("artifacts/local", { recursive: true });
  await fs.writeFile(cache, JSON.stringify(source));
}
const base = JSON.parse(
  await fs.readFile("public/data/vancouver.json", "utf8"),
);
const east = JSON.parse(
  await fs.readFile("public/data/vancouver-east.json", "utf8"),
);
const ids = new Set([...base.buildings, ...east.buildings].map((b) => b.id));
const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const metres = (value) => {
  if (!value) return undefined;
  const ft = value.match(/^(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);
  if (ft) return Number(ft[1]) * 0.3048 + Number(ft[2] || 0) * 0.0254;
  return positive(value.replace(/\s*m$/, ""));
};
const hex = (value) =>
  /^#[\da-f]{3}([\da-f]{3})?$/i.test(value ?? "") ? value : undefined;
const buildings = {};
for (const way of source.elements) {
  const id = "w" + way.id;
  if (!ids.has(id)) continue;
  const t = way.tags || {};
  const attrs = {
    kind: t.building !== "yes" ? t.building : undefined,
    height: metres(t.height),
    levels: positive(t["building:levels"]),
    roofShape: t["roof:shape"],
    roofHeight: metres(t["roof:height"]),
    roofMaterial: t["roof:material"],
    wallMaterial: t["building:material"],
    wallColor: hex(t["building:colour"]),
    roofColor: hex(t["roof:colour"]),
    startYear: /^\d{4}/.test(t.start_date ?? "")
      ? Number(t.start_date.slice(0, 4))
      : undefined,
  };
  if (Object.values(attrs).some((v) => v !== undefined)) buildings[id] = attrs;
}
const data = {
  meta: {
    source: "OpenStreetMap via Overpass",
    attribution: "© OpenStreetMap contributors, ODbL",
    sourceTimestamp: source.osm3s?.timestamp_osm_base,
    notes:
      "Current tagged heights, roof shapes and materials for existing mapped footprints. Authored landmark geometry is preserved. Missing values remain estimates.",
  },
  buildings,
};
await fs.writeFile(
  "public/data/vancouver-building-tags.json",
  JSON.stringify(data),
);
console.log(
  JSON.stringify(
    {
      buildings: Object.keys(buildings).length,
      heights: Object.values(buildings).filter((b) => b.height).length,
      roofShapes: Object.values(buildings).filter((b) => b.roofShape).length,
    },
    null,
    2,
  ),
);
