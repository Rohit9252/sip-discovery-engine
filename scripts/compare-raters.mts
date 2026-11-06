import { readFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL } from "../src/pipeline/ai/pass1";
import { saveLabels } from "../src/pipeline/labels";

// Saves a second rater's blind pass 1 labels and compares them with the engine's.
// Usage: npx tsx scripts/compare-raters.mts 2028
const seed = process.argv[2] ?? "2028";
const sheet = readFileSync(`data/check-${seed}-posts.txt`, "utf8");
const second = JSON.parse(readFileSync(`data/check-${seed}-second-ai.json`, "utf8")) as {
  rater: string; rules: string; relevant: number[]; first_time: number[]; experienced: number[]; borderline: number[];
};

// "#12 youtube:Ugx... [YouTube]" headers give the post id for each number.
const ids = new Map<number, string>();
for (const match of sheet.matchAll(/^#(\d+) (\S+) \[/gm)) ids.set(Number(match[1]), match[2]);

const db = openDb();
const rows = [...ids.entries()].map(([number, postId]) => ({
  postId,
  value: {
    relevant: second.relevant.includes(number),
    experience: second.first_time.includes(number) ? "first_time" : second.experienced.includes(number) ? "experienced" : "not_stated",
    borderline: second.borderline.includes(number),
    version: second.rules,
  },
}));
saveLabels(db, "pass1", second.rater, `blind-check-${seed}`, rows);

type Answer = { relevant: boolean; experience: string; reason?: string };
let relevantAgree = 0;
let experienceAgree = 0;
const disagreements: string[] = [];
for (const [number, postId] of ids) {
  const engineRow = db.prepare("SELECT value FROM labels WHERE post_id = ? AND task = 'pass1' AND rater = ?").get(postId, PASS1_MODEL) as { value: string } | undefined;
  if (!engineRow) { disagreements.push(`#${number}: engine has no answer`); continue; }
  const engine = JSON.parse(engineRow.value) as Answer;
  const mine = rows.find((row) => row.postId === postId)!.value;
  if (engine.relevant === mine.relevant) relevantAgree++;
  if (engine.experience === mine.experience) experienceAgree++;
  if (engine.relevant !== mine.relevant || engine.experience !== mine.experience) {
    const post = db.prepare("SELECT title, text FROM posts WHERE id = ?").get(postId) as { title: string; text: string };
    const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
    disagreements.push(
      `#${number}${mine.borderline ? " (borderline)" : ""}: engine ${engine.relevant ? "RELEVANT" : "not relevant"}/${engine.experience}, ${second.rater} ${mine.relevant ? "RELEVANT" : "not relevant"}/${mine.experience}\n` +
      `   POST: ${body.slice(0, 200)}${body.length > 200 ? "..." : ""}\n   ENGINE REASON: ${engine.reason ?? ""}`,
    );
  }
}
console.log(disagreements.join("\n\n"));
const total = ids.size;
console.log(`\nRelevant: agreed on ${relevantAgree} of ${total} (${Math.round((100 * relevantAgree) / total)}%). Experience: agreed on ${experienceAgree} of ${total} (${Math.round((100 * experienceAgree) / total)}%).`);
const engineRelevant = [...ids.values()].filter((postId) => {
  const row = db.prepare("SELECT value FROM labels WHERE post_id = ? AND task = 'pass1' AND rater = ?").get(postId, PASS1_MODEL) as { value: string } | undefined;
  return row && (JSON.parse(row.value) as Answer).relevant;
}).length;
console.log(`Engine called ${engineRelevant} relevant; ${second.rater} called ${second.relevant.length} relevant.`);
