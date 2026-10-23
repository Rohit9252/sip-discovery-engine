import gplay from "google-play-scraper";
import { APPS, SINCE, type AppSource } from "../src/pipeline/sources";
import { openDb, startRun, finishRun, savePosts } from "../src/pipeline/db";
import type { Post } from "../src/pipeline/types";

// The library's type hints for sort are wrong; these are its real values.
const SORT = { NEWEST: 2, HELPFULNESS: 1 } as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Pass = { label: string; lang: "en" | "hi"; sort: number; target: number };
type Review = Awaited<ReturnType<typeof gplay.reviews>>["data"][number];

const db = openDb();
const runId = startRun(db, "play_store");
const errors: object[] = [];
const summary: Record<string, object> = {};

function toPost(app: AppSource, row: Review): Post | null {
  const createdAt = new Date(row.date);
  if (createdAt < new Date(SINCE) || !row.text?.trim()) return null;
  return {
    id: `play_store:${row.id}`,
    source: "play_store",
    app: app.key,
    url: `https://play.google.com/store/apps/details?id=${app.playId}&reviewId=${row.id}`,
    createdAt: createdAt.toISOString(),
    title: row.title ?? "",
    text: row.text,
    rating: row.score ?? null,
    context: null,
    recordType: "review",
  };
}

// Pulls one pass page by page and saves each page straight away, so a long pull
// never holds everything in memory and an interrupted run keeps what it got.
async function pull(app: AppSource, pass: Pass) {
  let pulled = 0;
  let added = 0;
  let token: string | undefined;
  while (pulled < pass.target) {
    let page;
    for (let attempt = 0; attempt < 3 && !page; attempt++) {
      try {
        page = await gplay.reviews({
          appId: app.playId, lang: pass.lang, country: "in", sort: pass.sort as never, num: 150,
          paginate: true, nextPaginationToken: token,
        });
      } catch (error) {
        if (attempt === 2) errors.push({ app: app.key, pass: pass.label, error: String(error) });
        else await sleep(2000 * (attempt + 1));
      }
    }
    if (!page || page.data.length === 0) break;
    pulled += page.data.length;
    added += savePosts(db, page.data.map((row) => toPost(app, row)).filter((post) => post !== null), runId);
    // Newest-first passes stop once they reach reviews older than our window.
    const oldest = page.data[page.data.length - 1].date;
    if (pass.sort === SORT.NEWEST && new Date(oldest) < new Date(SINCE)) break;
    if (!page.nextPaginationToken) break;
    token = page.nextPaginationToken;
    if (pulled % 15000 < 150) console.log(`${app.name} ${pass.label}: ${pulled} pulled, back to ${new Date(oldest).toISOString().slice(0, 10)}`);
    await sleep(300);
  }
  return { pulled, added };
}

// `npm run collect:play -- groww 300000` refills one app's newest English reviews,
// all the way back to SINCE. With no arguments, every app gets its normal passes.
const [onlyApp, newestTarget] = process.argv.slice(2);
const apps = onlyApp ? APPS.filter((app) => app.key === onlyApp) : APPS;
if (apps.length === 0) throw new Error(`Unknown app: ${onlyApp}`);

for (const app of apps) {
  const passes: Pass[] = onlyApp
    ? [{ label: "newest-en", lang: "en", sort: SORT.NEWEST, target: Number(newestTarget) || 300000 }]
    : [
        { label: "newest-en", lang: "en", sort: SORT.NEWEST, target: app.play.newestEn },
        { label: "helpful-en", lang: "en", sort: SORT.HELPFULNESS, target: app.play.helpfulEn },
        { label: "newest-hi", lang: "hi", sort: SORT.NEWEST, target: app.play.newestHi },
      ];
  for (const pass of passes) {
    const result = await pull(app, pass);
    summary[`${app.key} ${pass.label}`] = result;
    console.log(`${app.name} ${pass.label}: ${result.pulled} pulled, ${result.added} new`);
  }
}

finishRun(db, runId, { since: SINCE, country: "in", onlyApp: onlyApp ?? null, summary, errors });
const counts = db.prepare(`
  SELECT app, COUNT(*) AS total, SUM(keyword_pass) AS kept, MIN(created_at) AS oldest, MAX(created_at) AS newest
  FROM posts WHERE source = 'play_store' GROUP BY app ORDER BY total DESC
`).all();
console.table(counts);
if (errors.length) console.log("errors:", errors);
