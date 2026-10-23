import { openDb } from "../src/pipeline/db";
import { PASS2_VERSION } from "../src/pipeline/ai/pass2";

// Correction 6 (23 Oct, no tokens): the T10 code rule fired on store reviews such as
// "I'd suggest a kill switch". The rule only fires when the AI said "none", so those posts go back to "none".
const db = openDb();
const rows = db.prepare(`
  SELECT l.post_id, l.rater, l.value FROM labels l JOIN posts p ON p.id = l.post_id
  WHERE l.task = 'pass2' AND json_extract(l.value, '$.version') = ? AND json_extract(l.value, '$.theme_by_rule') = 1
    AND p.source IN ('play_store', 'app_store')
`).all(PASS2_VERSION) as { post_id: string; rater: string; value: string }[];
const update = db.prepare("UPDATE labels SET value = ? WHERE post_id = ? AND task = 'pass2' AND rater = ?");
for (const row of rows) {
  const { theme_by_rule, ...value } = JSON.parse(row.value);
  update.run(JSON.stringify({ ...value, theme: "none", need: "", theme_by_rule: "undone: store review" }), row.post_id, row.rater);
}
console.log(`${rows.length} store reviews set back from T10 to none.`);
