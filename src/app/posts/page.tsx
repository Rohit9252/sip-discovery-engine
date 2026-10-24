import { Suspense } from "react";
import Link from "next/link";
import posts from "@/data/posts.json";
import { THEMES } from "@/pipeline/themes";
import { CONTINUED, DROPPED, LABELS, label } from "@/lib/labels";

export const metadata = { title: "Browse posts · SIP Discovery Engine" };

type Post = (typeof posts)[number] & { fields: Record<string, string[]> };
type Params = Record<string, string | undefined>;
const PAGE = 25;
const SOURCES = ["Play Store review", "App Store review", "Reddit post", "Reddit comment", "YouTube comment", "TradingQ&A"];

// Every filter is a plain query parameter, so the answers' "See all posts" links land here filtered.
function filter(all: Post[], p: Params) {
  const q = p.q?.trim().toLowerCase();
  return all.filter((post) =>
    (p.group !== "first" || post.first) &&
    (!p.theme || post.theme === p.theme) &&
    (!p.stage || post.fields.stage?.includes(p.stage)) &&
    (!p.field || (post.fields[p.field]?.length ?? 0) > 0) &&
    (!p.outcome || post.fields.what_happened?.some((code) => (p.outcome === "dropped" ? DROPPED : CONTINUED).includes(code))) &&
    (!p.source || post.source.startsWith(p.source)) &&
    (!q || post.text.toLowerCase().includes(q)));
}

function Select({ name, value, options, all }: { name: string; value?: string; options: [string, string][]; all: string }) {
  return (
    <select id={`filter-${name}`} name={name} defaultValue={value ?? ""} aria-label={all} className="min-h-11 rounded-xl border border-line-strong bg-raised px-3 text-sm">
      <option value="">{all}</option>
      {options.map(([code, text]) => <option key={code} value={code}>{text}</option>)}
    </select>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const found = filter(posts as Post[], p);
  const page = Math.max(1, Number(p.page) || 1);
  const shown = found.slice((page - 1) * PAGE, page * PAGE);
  const link = (n: number) => `/posts?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)), page: String(n) } as Record<string, string>)}`;
  const tag = (field: string, post: Post) => (post.fields[field] ?? []).map((code) => label(field, code)).join(", ");
  return (
    <>
      <form className="mt-6 flex flex-wrap gap-2" action="/posts">
        <Select name="group" value={p.group} all="All investors" options={[["first", "First-time investors"]]} />
        <Select name="theme" value={p.theme} all="Any unmet need" options={[...THEMES.map((t) => [t.id, t.name] as [string, string]), ["none", "No unmet need"]]} />
        <Select name="stage" value={p.stage} all="Any stage" options={Object.entries(LABELS.stage)} />
        <Select name="outcome" value={p.outcome} all="Any outcome" options={[["dropped", "Dropping off"], ["continued", "Kept going"]]} />
        <Select name="source" value={p.source} all="Any source" options={SOURCES.map((s) => [s, s])} />
        {p.field && <input type="hidden" name="field" value={p.field} />}
        <input id="filter-q" name="q" defaultValue={p.q ?? ""} placeholder="Search words…" aria-label="Search words" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-raised px-3.5 text-sm placeholder:text-ink-3" />
        <button className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-strong">Show posts</button>
      </form>
      <p className="mt-4 text-sm text-ink-2">
        {found.length.toLocaleString("en-US")} posts{p.field ? ` that say something about "${p.field.replace(/_/g, " ")}"` : ""}. Showing {shown.length ? `${(page - 1) * PAGE + 1} to ${(page - 1) * PAGE + shown.length}` : "none"}.
        {Object.values(p).some(Boolean) && <Link href="/posts" className="ml-2 inline-flex min-h-11 items-center font-semibold text-accent-strong hover:underline">Clear filters</Link>}
      </p>
      <ol className="mt-4 space-y-3">
        {shown.map((post) => (
          <li key={post.id} className="rounded-2xl border border-line bg-raised p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <span className="rounded-full bg-sunken px-2 py-0.5 font-medium text-ink">{post.source}</span>
              <span className="num">{post.date}</span>
              {post.first && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-strong">First-time</span>}
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="-my-2 ml-auto inline-flex min-h-11 items-center font-semibold text-accent-strong hover:underline">Open original ↗</a>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{post.text.length > 420 ? `${post.text.slice(0, 420)}…` : post.text}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {[["Unmet need", post.theme === "none" ? "None" : THEMES.find((t) => t.id === post.theme)?.name ?? post.theme], ["Stage", tag("stage", post)], ["What happened", tag("what_happened", post)], ["What set it off", tag("trigger", post)]]
                .filter(([, value]) => value)
                .map(([name, value]) => <div key={name} className="flex gap-2"><dt className="text-ink-3">{name}:</dt><dd>{value}</dd></div>)}
            </dl>
          </li>
        ))}
      </ol>
      <nav className="mt-6 flex justify-between text-sm" aria-label="Pages">
        {page > 1 ? <Link href={link(page - 1)} className="inline-flex min-h-11 items-center font-semibold text-accent-strong hover:underline">← Previous</Link> : <span />}
        {page * PAGE < found.length ? <Link href={link(page + 1)} className="inline-flex min-h-11 items-center font-semibold text-accent-strong hover:underline">Next →</Link> : <span />}
      </nav>
    </>
  );
}

export default function PostsPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong hover:underline">← Back to the engine</Link>
      <h1 className="mt-2 font-display text-4xl font-bold leading-tight tracking-[-0.02em]">Browse the tagged posts</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Every post the engine tagged in depth, with what it recorded. Filter to check any number on the main page against the posts behind it.</p>
      <Suspense fallback={<p className="mt-6 text-sm text-ink-3">Loading posts…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
