import fs from "node:fs/promises";
const url =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap";
let css = await (
  await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" },
  })
).text();
await fs.mkdir("public/fonts", { recursive: true });
let count = 0;
const cache = new Map();
for (const u of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g))) {
  const name = `barlow-${count++}.${u.includes(".woff2") ? "woff2" : "ttf"}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Font HTTP " + r.status);
  await fs.writeFile(
    "public/fonts/" + name,
    Buffer.from(await r.arrayBuffer()),
  );
  cache.set(u, `./${name}`);
}
for (const [u, p] of cache) css = css.replaceAll(u, p);
await fs.writeFile("public/fonts/barlow.css", css);
const license = await (
  await fetch(
    "https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt",
  )
).text();
await fs.writeFile("public/fonts/OFL.txt", license);
console.log("Vendored", count, "font files");
