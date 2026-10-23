import { APPS, SINCE } from "../src/pipeline/sources";
import { openDb, startRun, finishRun, savePosts } from "../src/pipeline/db";
import { getJson } from "../src/pipeline/http";
import type { Post } from "../src/pipeline/types";

type Label = { label: string };
type Entry = { id: Label; title: Label; content: Label; updated: Label; "im:rating"?: Label };
type Feed = { feed?: { entry?: Entry[] | Entry } };

// Apple's public review feed: 10 pages of 50 per sort order, India store only.
const SORTS = ["mostrecent", "mosthelpful"];
const PAGES = 10;

const db = openDb();
const runId = startRun(db, "app_store");
const errors: object[] = [];
const summary: Record<string, object> = {};

for (const app of APPS) {
  const byId = new Map<string, Post>();
  for (const sort of SORTS) {
    for (let page = 1; page <= PAGES; page++) {
      const url = `https://itunes.apple.com/in/rss/customerreviews/page=${page}/id=${app.appleId}/sortby=${sort}/json`;
      let entries: Entry[] = [];
      try {
        const data = await getJson<Feed>(url);
        const raw = data.feed?.entry ?? [];
        entries = Array.isArray(raw) ? raw : [raw];
      } catch (error) {
        errors.push({ app: app.key, sort, page, error: String(error) });
        break;
      }
      const reviews = entries.filter((entry) => entry["im:rating"]);
      if (reviews.length === 0) break;
      for (const entry of reviews) {
        const createdAt = new Date(entry.updated.label);
        const text = entry.content?.label ?? "";
        if (createdAt < new Date(SINCE) || !text.trim()) continue;
        byId.set(entry.id.label, {
          id: `app_store:${entry.id.label}`,
          source: "app_store",
          app: app.key,
          url: `https://apps.apple.com/in/app/id${app.appleId}?see-all=reviews`,
          createdAt: createdAt.toISOString(),
          title: entry.title?.label ?? "",
          text,
          rating: Number(entry["im:rating"]!.label),
          context: null,
          recordType: "review",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const posts = [...byId.values()];
  summary[app.key] = { unique: posts.length, added: savePosts(db, posts, runId) };
  console.log(`${app.name}: ${posts.length} reviews`);
}

finishRun(db, runId, { since: SINCE, country: "in", sorts: SORTS, pagesPerSort: PAGES, summary, errors });
console.table(db.prepare(`
  SELECT app, COUNT(*) AS total, SUM(keyword_pass) AS kept, MIN(created_at) AS oldest, MAX(created_at) AS newest
  FROM posts WHERE source = 'app_store' GROUP BY app ORDER BY total DESC
`).all());
if (errors.length) console.log("errors:", errors);
