// npm run seed: download the launch seed (or use seed/scout-launch-seed.json) and load it.
import { config } from "dotenv";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
config({ path: ".env.local", quiet: true });

const URL_ = "https://gist.githubusercontent.com/adriangrantdotorg/0bb2b27a0a6e2ef805be0f3c0b9698de/raw/scout-launch-seed.json";
const FILE = "seed/scout-launch-seed.json";

async function getSeed(): Promise<Record<string, unknown> | null> {
  if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, "utf8"));
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(URL_);
      if (r.ok) {
        const t = await r.text();
        writeFileSync(FILE, t);
        return JSON.parse(t);
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return null;
}

const { loadSeed } = await import("../src/lib/seed");
const seed = await getSeed();
if (!seed) {
  console.log("seed unreachable: the live sources will fill the site");
  process.exit(0);
}
const t = Date.now();
await loadSeed(seed, (s) => console.log("loaded", s));
console.log(`seed loaded in ${Math.round((Date.now() - t) / 1000)}s`);
