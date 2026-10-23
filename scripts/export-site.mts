import { mkdirSync, writeFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL, PASS1_VERSION } from "../src/pipeline/ai/pass1";

// Writes the files the site reads, so the site never touches the database.
// Usage: npx tsx scripts/export-site.mts
const db = openDb();
const SOURCES = [
  { key: "play_store", name: "Play Store reviews" },
  { key: "app_store", name: "App Store reviews" },
  { key: "reddit", name: "Reddit posts and comments" },
  { key: "youtube", name: "YouTube comments" },
  { key: "tradingqna", name: "TradingQ&A" },
];

const pass1 = `FROM labels l JOIN posts p ON p.id = l.post_id
  WHERE l.task = 'pass1' AND l.rater = ? AND json_extract(l.value, '$.version') = ?`;
const bySource = (sql: string, ...params: (string | number)[]) =>
  new Map((db.prepare(sql).all(...params) as { source: string; n: number }[]).map((row) => [row.source, row.n]));

const collected = bySource("SELECT source, COUNT(*) AS n FROM posts GROUP BY source");
const kept = bySource("SELECT source, SUM(keyword_pass) AS n FROM posts GROUP BY source");
const read = bySource(`SELECT p.source, COUNT(*) AS n ${pass1} GROUP BY p.source`, PASS1_MODEL, PASS1_VERSION);
const relevant = bySource(`SELECT p.source, COUNT(*) AS n ${pass1} AND json_extract(l.value, '$.relevant') = 1 GROUP BY p.source`, PASS1_MODEL, PASS1_VERSION);
const firstTime = bySource(`SELECT p.source, COUNT(*) AS n ${pass1} AND json_extract(l.value, '$.relevant') = 1 AND json_extract(l.value, '$.experience') = 'first_time' GROUP BY p.source`, PASS1_MODEL, PASS1_VERSION);
const dates = db.prepare("SELECT substr(MIN(created_at), 1, 10) AS oldest, substr(MAX(created_at), 1, 10) AS newest FROM posts").get() as { oldest: string; newest: string };

const sources = SOURCES.map(({ key, name }) => ({
  name,
  collected: collected.get(key) ?? 0,
  kept: kept.get(key) ?? 0,
  read: read.get(key) ?? 0,
  relevant: relevant.get(key) ?? 0,
  firstTime: firstTime.get(key) ?? 0,
}));
const total = (field: keyof Omit<(typeof sources)[number], "name">) => sources.reduce((sum, row) => sum + row[field], 0);

const overview = {
  exportedAt: new Date().toISOString(),
  dates,
  funnel: [
    { step: "Collected", n: total("collected"), note: `Public posts from ${dates.oldest} to ${dates.newest}` },
    { step: "Kept by the keyword filter", n: total("kept"), note: "Mention SIPs, mutual funds or investing" },
    { step: "Read by the AI (pass 1)", n: total("read"), note: "All kept store reviews, YouTube and TradingQ&A, plus a fixed Reddit sample" },
    { step: "About someone's own SIP", n: total("relevant"), note: "Their own SIP or mutual fund journey, not fund picking or praise" },
    { step: "From a first-time investor", n: total("firstTime"), note: "Their first SIP, on any app. Headline numbers come from these" },
  ],
  sources,
};

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/overview.json", JSON.stringify(overview, null, 2) + "\n", "utf8");
console.log(`src/data/overview.json: ${overview.funnel.map((row) => `${row.step} ${row.n}`).join(", ")}`);
