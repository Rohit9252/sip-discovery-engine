import { readFileSync, writeFileSync } from "node:fs";
import { THEMES } from "../src/pipeline/themes";

// Builds the blind labelling page for the golden set: the posts and the theme list go in,
// the AI's answers never do. Usage: npx tsx scripts/golden-page.mts <template.html> <out.html> [--seed 2070]
const [template, out] = process.argv.slice(2);
const seed = process.argv.includes("--seed") ? process.argv[process.argv.indexOf("--seed") + 1] : "2070";
const { posts } = JSON.parse(readFileSync(`data/golden-${seed}.json`, "utf8")) as { posts: Record<string, unknown>[] };
const safe = (value: unknown) => JSON.stringify(value).replace(/</g, "\u003c");
const blind = posts.map(({ n, id, source, date, url, context, text }) => ({ n, id, source, date, url, context, text }));
const themes = THEMES.map(({ id, name, need }) => ({ id, name, need }));
writeFileSync(out, readFileSync(template, "utf8").replace("__POSTS__", safe(blind)).replace("__THEMES__", safe(themes)), "utf8");
console.log(`${out}: ${blind.length} posts, ${themes.length} themes`);
