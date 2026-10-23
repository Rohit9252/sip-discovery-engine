import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { matchedTerms } from "./keywords";
import type { Post, Source } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export function openDb(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "engine.db"));
  // WAL lets status checks read while a collector writes; busy_timeout makes a
  // writer wait for a lock instead of failing with "database is locked".
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 30000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      app TEXT,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      rating INTEGER,
      context TEXT,
      record_type TEXT NOT NULL,
      matched_terms TEXT NOT NULL,
      keyword_pass INTEGER NOT NULL,
      first_run TEXT NOT NULL
    );
    -- One judgement about one post: which question (task), who answered (rater), what they said.
    -- Raters: the engine's model, Claude as an independent second opinion, or the team.
    CREATE TABLE IF NOT EXISTS labels (
      post_id TEXT NOT NULL,
      task TEXT NOT NULL,
      rater TEXT NOT NULL,
      value TEXT NOT NULL,
      run_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, task, rater)
    );
    -- Every AI call or batch, with its token use, so cost is always visible.
    CREATE TABLE IF NOT EXISTS ai_runs (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      model TEXT NOT NULL,
      mode TEXT NOT NULL,
      posts INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      batch_id TEXT,
      status TEXT NOT NULL,
      note TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      receipt TEXT
    );
  `);
  return db;
}

export function startRun(db: DatabaseSync, source: Source): string {
  const startedAt = new Date().toISOString();
  const id = `${source}-${startedAt.replace(/[-:.TZ]/g, "")}`;
  db.prepare("INSERT INTO runs (id, source, started_at) VALUES (?, ?, ?)").run(id, source, startedAt);
  return id;
}

export function finishRun(db: DatabaseSync, runId: string, receipt: object) {
  db.prepare("UPDATE runs SET finished_at = ?, receipt = ? WHERE id = ?").run(
    new Date().toISOString(),
    JSON.stringify(receipt),
    runId,
  );
}

// Inserts new posts and leaves already-collected ones untouched. Returns how many were new.
export function savePosts(db: DatabaseSync, posts: Post[], runId: string): number {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO posts
      (id, source, app, url, created_at, title, text, rating, context, record_type, matched_terms, keyword_pass, first_run)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let added = 0;
  db.exec("BEGIN");
  for (const post of posts) {
    // A comment counts if its thread or video title mentions SIPs, even when the comment doesn't.
    const terms = matchedTerms(`${post.title}\n${post.text}\n${post.context ?? ""}`);
    // Reddit comments only come from story threads chosen because their title or body
    // mentions SIPs, so every one of them sits inside a SIP story (DE-07 decision).
    const storyComment = post.source === "reddit" && post.recordType === "comment";
    if (storyComment && terms.length === 0) terms.push("story thread");
    const result = insert.run(
      post.id, post.source, post.app, post.url, post.createdAt, post.title, post.text,
      post.rating, post.context, post.recordType, JSON.stringify(terms), terms.length > 0 ? 1 : 0, runId,
    );
    added += Number(result.changes);
  }
  db.exec("COMMIT");
  return added;
}
