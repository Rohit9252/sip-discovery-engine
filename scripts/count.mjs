// Prints a one-line count for the status log: `node scripts/count.mjs reddit`, or no argument for everything.
// A file instead of `node -e`, because Windows PowerShell 5.1 strips quotes from inline code.
import { DatabaseSync } from "node:sqlite";

const source = process.argv[2];
const db = new DatabaseSync("data/engine.db", { readOnly: true });
db.exec("PRAGMA busy_timeout = 30000;");
const row = source
  ? db.prepare("SELECT COUNT(*) AS t, SUM(keyword_pass) AS k, substr(MIN(created_at), 1, 10) AS o FROM posts WHERE source = ?").get(source)
  : db.prepare("SELECT COUNT(*) AS t, SUM(keyword_pass) AS k, substr(MIN(created_at), 1, 10) AS o FROM posts").get();
console.log(`${row.t} collected, ${row.k ?? 0} kept, oldest ${row.o}`);
