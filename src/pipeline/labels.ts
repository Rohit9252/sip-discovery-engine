import type { DatabaseSync } from "node:sqlite";

// Saves one rater's answers for a task. A later answer from the same rater replaces the earlier one.
export function saveLabels(
  db: DatabaseSync,
  task: string,
  rater: string,
  runId: string,
  rows: { postId: string; value: object }[],
) {
  const upsert = db.prepare(`
    INSERT INTO labels (post_id, task, rater, value, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (post_id, task, rater) DO UPDATE SET value = excluded.value, run_id = excluded.run_id, created_at = excluded.created_at
  `);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  for (const row of rows) upsert.run(row.postId, task, rater, JSON.stringify(row.value), runId, now);
  db.exec("COMMIT");
}

export function startAiRun(db: DatabaseSync, run: { task: string; model: string; mode: "live" | "batch"; posts: number; note?: string }) {
  const startedAt = new Date().toISOString();
  const id = `${run.task}-${run.mode}-${startedAt.replace(/[-:.TZ]/g, "")}`;
  db.prepare("INSERT INTO ai_runs (id, task, model, mode, posts, status, note, started_at) VALUES (?, ?, ?, ?, ?, 'running', ?, ?)").run(
    id, run.task, run.model, run.mode, run.posts, run.note ?? null, startedAt,
  );
  return id;
}

export function finishAiRun(db: DatabaseSync, id: string, result: { inputTokens: number; outputTokens: number; status: string; batchId?: string }) {
  db.prepare("UPDATE ai_runs SET input_tokens = ?, output_tokens = ?, status = ?, batch_id = COALESCE(?, batch_id), finished_at = ? WHERE id = ?").run(
    result.inputTokens, result.outputTokens, result.status, result.batchId ?? null, new Date().toISOString(), id,
  );
}
