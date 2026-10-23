import { writeFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";

// DE-08 recall check: draw 50 posts the keyword filter dropped, in roughly the same
// mix as the dropped pile, with a fixed seed so the same sample can be drawn again.
const SEED = 2026;
const PLAN: { source: string; take: number }[] = [
  { source: "play_store", take: 38 },
  { source: "reddit", take: 10 },
  { source: "app_store", take: 1 },
  { source: "tradingqna", take: 1 },
];
const MAX_CHARS = 400;

// Small seeded random number generator (mulberry32).
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Row = { id: string; source: string; created_at: string; title: string; text: string; url: string };
const db = openDb();
const next = random(SEED);
const picked: Row[] = [];
for (const { source, take } of PLAN) {
  const ids = db.prepare("SELECT id FROM posts WHERE keyword_pass = 0 AND source = ? ORDER BY id").all(source) as { id: string }[];
  const chosen = new Set<number>();
  while (chosen.size < take) chosen.add(Math.floor(next() * ids.length));
  for (const index of chosen) {
    picked.push(db.prepare("SELECT id, source, created_at, title, text, url FROM posts WHERE id = ?").get(ids[index].id) as Row);
  }
}

const label: Record<string, string> = { play_store: "Play Store", app_store: "App Store", reddit: "Reddit", tradingqna: "TradingQ&A" };
const cell = (value: string) => {
  let text = value.replace(/\s+/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = ` ${text}`; // stop the sheet reading it as a formula
  return `"${text.replace(/"/g, '""')}"`;
};
const lines = [["#", "Source", "Date", "Post (first 400 characters)", "Link to the original", "About a SIP? (Yes or No)", "Note (optional)"].map(cell).join(",")];
picked.forEach((row, index) => {
  const full = [row.title, row.text].filter(Boolean).join(": ");
  const post = full.length > MAX_CHARS ? `${full.slice(0, MAX_CHARS)}... (more at the link)` : full;
  lines.push([String(index + 1), label[row.source], row.created_at.slice(0, 10), post, row.url, "", ""].map(cell).join(","));
});
writeFileSync("data/recall-sample.csv", lines.join("\n") + "\n", "utf8");
writeFileSync("data/recall-sample.json", JSON.stringify({ seed: SEED, plan: PLAN, ids: picked.map((row) => row.id) }, null, 2), "utf8");
console.log(`${picked.length} posts written to data/recall-sample.csv`);
