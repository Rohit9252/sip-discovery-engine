import { readFileSync, writeFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";

// Picks a holdout set: first-time posts that were NOT in the golden set the v11 fixes were
// tuned on, so the v11 score on them is unbiased. Random, fixed seed. Text only, no AI answers.
// Usage: npx tsx scripts/holdout-pick.mts [--seed 2071] [--size 20]
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback);
const SEED = Number(arg("seed", "2071"));
const SIZE = Number(arg("size", "20"));
const sample = JSON.parse(readFileSync("data/pass2-sample-2050.json", "utf8")) as { firstTime: number; ids: string[] };
const golden = new Set((JSON.parse(readFileSync("data/golden-2070.json", "utf8")).posts as { id: string }[]).map((post) => post.id));
let seed = SEED;
const next = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pool = sample.ids.slice(0, sample.firstTime).filter((id) => !golden.has(id));
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(next() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const db = openDb();
const fetchPost = db.prepare("SELECT id, source, app, created_at, url, context, title, text FROM posts WHERE id = ?");
const posts = pool.slice(0, SIZE).map((id, index) => {
  const row = fetchPost.get(id) as { id: string; source: string; app: string | null; created_at: string; url: string; context: string | null; title: string; text: string };
  return { n: index + 1, id, source: `${row.source}${row.app ? ` (${row.app})` : ""}`, date: row.created_at.slice(0, 10), url: row.url, context: row.context ?? "", text: [row.title, row.text].filter(Boolean).join(": ").replace(/\s+/g, " ").slice(0, 2000).toWellFormed() };
});
writeFileSync(`data/holdout-${SEED}.json`, JSON.stringify({ seed: SEED, note: "First-time posts not in golden-2070, for an unbiased v11 score.", posts }, null, 2) + "\n", "utf8");
console.log(posts.map((p) => `#${p.n} [${p.source}, ${p.date}]${p.context ? ` (under: ${p.context.slice(0, 120)})` : ""}\n${p.text}\n`).join("\n"));
