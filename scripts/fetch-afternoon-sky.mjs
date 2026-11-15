// Reproduce the original photographic HDR without tone mapping or horizon edits.
import { createHash } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const source = JSON.parse(
  await readFile(new URL("docs/sources/afternoon-daylight.json", root), "utf8"),
);
const target = fileURLToPath(
  new URL("public/textures/afternoon-sky.hdr", root),
);
function verify(bytes) {
  if (
    bytes.length !== source.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== source.sha256
  )
    throw new Error(
      "Afternoon HDR does not match committed byte count/SHA-256; destination left unchanged",
    );
}
if (process.argv.includes("--verify")) {
  verify(await readFile(target));
  console.log(`Verified ${source.bytes} bytes: ${source.sha256}`);
} else {
  const response = await fetch(source.source);
  if (!response.ok) throw new Error(`HDR fetch failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verify(bytes); // No destination or temporary writes until all bytes are verified.
  const temporary = `${target}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  console.log(`Restored ${source.asset}, ${source.license}; ${source.credit}`);
}
