import { readFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { PASS2_MODEL } from "../src/pipeline/ai/pass2";
import { saveLabels } from "../src/pipeline/labels";

// Compares the engine's pass 2 answers with a second rater's blind labels on theme,
// what_happened and stage. Usage: npx tsx scripts/compare-pass2.mts 2041
const seed = process.argv[2] ?? "2041";
const sheet = readFileSync(`data/check2-${seed}-posts.txt`, "utf8");
const second = JSON.parse(readFileSync(`data/check2-${seed}-claude.json`, "utf8")) as {
  rater: string; rules: string; labels: Record<string, [string, string, string]>; borderline: number[];
};
const ids = new Map<number, string>();
for (const match of sheet.matchAll(/^#(\d+) (\S+) \[/gm)) ids.set(Number(match[1]), match[2]);
const db = openDb();
saveLabels(db, "pass2", second.rater, `blind-check2-${seed}`, [...ids.entries()].map(([n, postId]) => {
  const [theme, what_happened, stage] = second.labels[String(n)];
  return { postId, value: { theme, what_happened, stage, version: second.rules, borderline: second.borderline.includes(n) } };
}));
const fields = ["theme", "what_happened", "stage"] as const;
const agree: Record<string, number> = { theme: 0, what_happened: 0, stage: 0 };
const lines: string[] = [];
for (const [n, postId] of ids) {
  const row = db.prepare("SELECT value FROM labels WHERE post_id = ? AND task = 'pass2' AND rater = ?").get(postId, PASS2_MODEL) as { value: string };
  const engine = JSON.parse(row.value) as Record<string, string>;
  const mine = second.labels[String(n)];
  const diffs: string[] = [];
  fields.forEach((field, i) => {
    if (engine[field] === mine[i]) agree[field]++;
    else diffs.push(`${field}: engine ${engine[field]}, ${second.rater} ${mine[i]}`);
  });
  if (diffs.length) lines.push(`#${n}${second.borderline.includes(n) ? " (borderline)" : ""}: ${diffs.join(" | ")}${engine.need ? `\n   engine need: ${engine.need}` : ""}`);
}
console.log(lines.join("\n"));
const total = ids.size;
console.log(`\nAgreement on ${total} posts: theme ${agree.theme} (${Math.round(100 * agree.theme / total)}%), what happened ${agree.what_happened} (${Math.round(100 * agree.what_happened / total)}%), stage ${agree.stage} (${Math.round(100 * agree.stage / total)}%).`);
