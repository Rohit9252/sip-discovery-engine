import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL, PASS1_VERSION } from "../src/pipeline/ai/pass1";
import { PASS2_VERSION as CURRENT } from "../src/pipeline/ai/pass2";
const PASS2_VERSION = process.argv.includes("--version") ? process.argv[process.argv.indexOf("--version") + 1] : CURRENT;
import { label } from "../src/lib/labels";
import { THEMES } from "../src/pipeline/themes";
import { firstTimeHolds } from "../src/pipeline/first-time";

// Scores the engine against the golden set, field by field, and lists every disagreement.
// Golden labels come from the labelling page (saved under data/golden-<seed>-labels/labels/).
// Usage: npx tsx scripts/golden-score.mts [--seed 2070]
const SEED = process.argv.includes("--seed") ? process.argv[process.argv.indexOf("--seed") + 1] : "2070";
// --set holdout-2071 scores another labelled set the same way.
const SET = process.argv.includes("--set") ? process.argv[process.argv.indexOf("--set") + 1] : `golden-${SEED}`;
const dir = `data/${SET}-labels/labels`;
type Gold = Record<string, string> & { n: number; id: string };
const gold = readdirSync(dir).map((file) => JSON.parse(readFileSync(`${dir}/${file}`, "utf8")).data ?? JSON.parse(readFileSync(`${dir}/${file}`, "utf8"))) as Gold[];
gold.sort((a, b) => a.n - b.n);

const db = openDb();
const pass1 = db.prepare("SELECT value FROM labels WHERE post_id = ? AND task = 'pass1' AND rater = ? AND json_extract(value, '$.version') = ?");
const pass2 = db.prepare("SELECT value FROM labels WHERE post_id = ? AND task = 'pass2' AND json_extract(value, '$.version') = ?");
const textOf = db.prepare("SELECT title, text FROM posts WHERE id = ?");

const EMPTY = new Set(["not_stated", "none_stated", ""]);
// The engine's answers for one post, in the golden set's shape. List fields stay lists.
function engine(id: string) {
  const p1 = JSON.parse((pass1.get(id, PASS1_MODEL, PASS1_VERSION) as { value: string }).value);
  const p2 = JSON.parse((pass2.get(id, PASS2_VERSION) as { value: string }).value);
  const post = textOf.get(id) as { title: string; text: string };
  const experience = p1.experience === "first_time" && !firstTimeHolds(`${post.title} ${post.text}`, p2.stage) ? "experienced" : p1.experience;
  return { own_sip: p1.relevant ? "yes" : "no", experience, ...p2 } as Record<string, string | string[]>;
}

// Single fields must match exactly. List fields match when the golden answer is in the engine's
// list, or when both say nothing ("not stated" and "none stated" count as the same).
function agrees(gold: string, mine: string | string[]) {
  const list = ([] as string[]).concat(mine ?? []);
  if (EMPTY.has(gold)) return list.every((value) => EMPTY.has(value));
  return list.includes(gold);
}

const FIELDS = ["own_sip", "experience", "stage", "what_happened", "trigger", "theme", "why_started", "confusion", "outside_app"];
const KEY = new Set(["stage", "what_happened", "trigger", "theme"]);
const BAR = 0.8;
const name = (field: string, code: string) => (field === "theme" ? (code === "none" ? "No unmet need" : `${code} ${THEMES.find((t) => t.id === code)?.name}`) : field === "own_sip" || field === "experience" ? code : label(field, code));

const rows = gold.map((g) => ({ g, e: engine(g.id) }));
const results = FIELDS.map((field) => {
  const misses = rows.filter(({ g, e }) => !agrees(g[field], e[field])).map(({ g, e }) => ({ n: g.n, gold: name(field, g[field]), engine: ([] as string[]).concat(e[field]).map((code) => name(field, code)).join(" + ") }));
  return { field, key: KEY.has(field), agree: rows.length - misses.length, of: rows.length, share: (rows.length - misses.length) / rows.length, misses };
});

const lines = [`${SET}: engine (${PASS1_VERSION}, ${PASS2_VERSION}) against ${rows.length} labelled posts.`, ""];
for (const r of results) lines.push(`${r.key ? "KEY " : "    "}${r.field.padEnd(14)} ${String(r.agree).padStart(2)} of ${r.of} (${Math.round(r.share * 100)}%)${r.key ? (r.share >= BAR ? "  passes the 80% bar" : "  BELOW the 80% bar") : ""}`);
lines.push("");
for (const r of results) for (const m of r.misses) lines.push(`#${m.n} ${r.field}: golden "${m.gold}", engine "${m.engine}"`);
writeFileSync(`data/${SET}-score-${PASS2_VERSION}.json`, JSON.stringify({ seed: SEED, engine: { pass1: PASS1_VERSION, pass2: PASS2_VERSION }, bar: BAR, results }, null, 2) + "\n", "utf8");
console.log(lines.join("\n"));
