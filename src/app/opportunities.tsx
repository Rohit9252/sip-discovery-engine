import Link from "next/link";
import data from "@/data/opportunities.json";
import { MIN_FOR_PERCENT } from "@/lib/answers";

type Cell = (typeof data.cells)[number];
const fmt = (n: number) => n.toLocaleString("en-US");
// Sequential cobalt, light to dark, one step per fifth of the largest cell. Text flips to white on the dark steps.
const STEPS = ["#f1f4fd", "#d9e3fb", "#b3c7f6", "#7e9eef", "#3f6ae6", "#2448c8"];
const step = (n: number, max: number) => (n === 0 ? 0 : Math.min(5, 1 + Math.floor((n / max) * 4.999)));
const postsLink = (cell: Cell) => `/posts?group=first&theme=${cell.theme}&stage=${cell.stageCode}`;
const dropText = (cell: Cell) =>
  cell.withOutcome === 0 ? "no stated outcome" : cell.withOutcome >= MIN_FOR_PERCENT ? `${Math.round((cell.dropped / cell.withOutcome) * 100)}% (${cell.dropped} of ${cell.withOutcome})` : `${cell.dropped} of ${cell.withOutcome}`;
const RULE_TEXT: Record<string, string> = { yes: "Yes", partly: "Partly", no: "No" };
const RULE_STYLE: Record<string, string> = { yes: "bg-accent-soft text-accent-strong", partly: "bg-warm-soft text-warm-strong", no: "bg-warm-soft text-warm-strong" };
const TH = "num px-2 py-3.5 text-center text-xs font-medium";

export function Opportunities() {
  const themes = [...new Set(data.cells.map((cell) => cell.theme))];
  const inRules = data.cells.filter((cell) => cell.withinRules !== "no");
  const max = Math.max(...inRules.map((cell) => cell.posts), 1);
  const ranked = inRules.filter((cell) => cell.posts > 0).sort((a, b) => b.posts - a.posts).slice(0, 8);
  const top = ranked[0];
  return (
    <section id="opportunities" className="scroll-mt-16 border-y border-line bg-raised">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-14 sm:px-8 sm:py-[72px]">
        <div className="flex max-w-[820px] flex-col gap-2.5">
          <p className="kicker text-accent-strong sm:text-[13px]">Opportunity areas · need × stage</p>
          <h2 className="font-display text-3xl font-bold leading-[1.1] sm:text-[40px]">
            The biggest area Groww can act on: &ldquo;{top.themeName}&rdquo; {top.stage.toLowerCase()}, in {fmt(top.posts)} first-time posts
          </h2>
          <p className="text-ink-2">
            An opportunity area is one unmet need at one stage of the journey. Each cell counts the first-time posts in it; darker means more.
            Select a cell to read its posts. &ldquo;Help me choose funds&rdquo; is counted but greyed: an app can&apos;t recommend funds.
          </p>
        </div>

        <div tabIndex={0} role="region" aria-label="Opportunity grid, scrolls sideways on small screens" className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface text-left text-ink-3">
                <th className="num px-4 py-3.5 text-xs font-medium">Unmet need</th>
                {data.stages.map((stage) => <th key={stage} className={TH}>{stage}</th>)}
                <th className="num px-4 py-3.5 text-xs font-medium">Within the rules?</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => {
                const row = data.cells.filter((cell) => cell.theme === theme);
                const outside = row[0].withinRules === "no";
                return (
                  <tr key={theme} className="border-t border-line">
                    <th scope="row" className={`px-4 py-1.5 text-left font-medium ${outside ? "text-ink-3" : ""}`}>{row[0].themeName}</th>
                    {row.map((cell) => {
                      const s = outside ? 0 : step(cell.posts, max);
                      return (
                        <td key={cell.stageCode} className="p-1">
                          {cell.posts > 0 ? (
                            <Link
                              href={postsLink(cell)}
                              title={`${cell.themeName}, ${cell.stage}: ${cell.posts} posts; dropping off ${dropText(cell)}`}
                              className={`num grid h-[38px] place-items-center rounded-lg transition hover:ring-2 hover:ring-accent-strong ${outside ? "bg-sunken text-ink-3" : s >= 4 ? "text-white" : "text-ink"}`}
                              style={outside ? undefined : { background: STEPS[s] }}
                            >
                              {cell.posts}
                            </Link>
                          ) : (
                            <span className="grid h-[38px] place-items-center text-ink-3">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RULE_STYLE[row[0].withinRules]}`}>{RULE_TEXT[row[0].withinRules]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-3">Posts that don&apos;t say their stage are left out of the grid. Counts below {MIN_FOR_PERCENT} show no percentage.</p>

        <h3 className="mt-6 font-display text-2xl font-semibold">The {ranked.length} largest areas, compared</h3>
        <div tabIndex={0} role="region" aria-label="Largest areas, scrolls sideways on small screens" className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-surface text-ink-3">
              <tr>
                {["Opportunity area", "Reach", "How it ends: dropping off", "Top trigger", "Where the posts come from", "Within the rules?"].map((h) => <th key={h} className="num px-3 py-3.5 text-xs font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ranked.map((cell) => (
                <tr key={cell.theme + cell.stageCode} className="align-top">
                  <td className="max-w-[18rem] px-3 py-3">
                    <Link href={postsLink(cell)} className="font-semibold hover:text-accent-strong hover:underline">{cell.themeName}, {cell.stage.toLowerCase()}</Link>
                    {cell.quote && <p className="mt-1 text-xs italic text-ink-2">&ldquo;{cell.quote.english ?? cell.quote.text}&rdquo;</p>}
                  </td>
                  <td className="num px-3 py-3">{cell.posts}</td>
                  <td className="num px-3 py-3">{dropText(cell)}</td>
                  <td className="px-3 py-3">{cell.trigger ? <>{cell.trigger.name} <span className="num text-ink-3">({cell.trigger.n})</span></> : "Not stated"}</td>
                  <td className="num px-3 py-3 text-[13px]">{cell.sources.map((source) => `${source.name} ${source.n}`).join(", ")}</td>
                  <td className="max-w-[14rem] px-3 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RULE_STYLE[cell.withinRules]}`}>{RULE_TEXT[cell.withinRules]}</span>
                    <p className="mt-1 text-xs text-ink-2">{cell.rulesReason}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
