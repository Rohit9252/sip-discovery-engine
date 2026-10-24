import { readFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { applyDateRule, applyPlanningRule, applyOutsideRule, PASS2_VERSION, type Pass2Input } from "../src/pipeline/ai/pass2";

// Re-applies the code-only rules (date, planning, asking outside the app) to answers already
// saved, so a new rule is measured without a new AI run. No tokens.
// Usage: npx tsx scripts/reapply-rules.mts --golden 2070   (only the golden set's posts)
//        npx tsx scripts/reapply-rules.mts [--version pass2-v10]  (every post with that version; default: current)
const golden = process.argv.includes("--golden") ? process.argv[process.argv.indexOf("--golden") + 1] : "";
const VERSION = process.argv.includes("--version") ? process.argv[process.argv.indexOf("--version") + 1] : PASS2_VERSION;
const db = openDb();
const ids = golden
  ? (JSON.parse(readFileSync(`data/golden-${golden}.json`, "utf8")).posts as { id: string }[]).map((post) => post.id)
  : (db.prepare("SELECT post_id FROM labels WHERE task = 'pass2' AND json_extract(value, '$.version') = ?").all(VERSION) as { post_id: string }[]).map((row) => row.post_id);
const fetchPost = db.prepare("SELECT id, source, context, title, text, created_at AS createdAt, record_type AS recordType FROM posts WHERE id = ?");
const read = db.prepare("SELECT rater, value FROM labels WHERE post_id = ? AND task = 'pass2' AND json_extract(value, '$.version') = ?");
const write = db.prepare("UPDATE labels SET value = ? WHERE post_id = ? AND task = 'pass2' AND rater = ?");
let changed = 0;
for (const id of ids) {
  const row = read.get(id, VERSION) as { rater: string; value: string } | undefined;
  if (!row) continue;
  const result = JSON.parse(row.value);
  const before = JSON.stringify(result);
  const post = fetchPost.get(id) as unknown as Pass2Input;
  applyOutsideRule(post, result);
  applyDateRule(post, result);
  applyPlanningRule(post, result);
  if (JSON.stringify(result) !== before) {
    write.run(JSON.stringify(result), id, row.rater);
    changed++;
  }
}
console.log(`${changed} of ${ids.length} saved answers changed by the code rules.`);
