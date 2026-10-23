import overview from "@/data/overview.json";
import answersFile from "@/data/answers.json";
import journey from "@/data/journey.json";
import { MIN_FOR_PERCENT } from "@/lib/answers";

const fmt = (n: number) => n.toLocaleString("en-US");
const SOURCES = ["Play Store", "App Store", "Reddit", "YouTube", "TradingQ&A"];
// The three findings shown beside the title; each opens its full answer in the chat.
const FEATURED = ["q3", "q7", "q9"];

export function Hero() {
  const { funnel } = overview;
  return (
    <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(ellipse_at_top_left,var(--tint-blue),transparent_60%),radial-gradient(ellipse_at_bottom_right,var(--tint-warm),transparent_55%)]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
        <p className="text-sm font-medium text-accent-strong">A discovery engine for Groww&apos;s first-time SIP investors</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Why do first SIPs last, or don&apos;t?</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
          We read what {fmt(funnel[0].n)} public posts say about investing, found {fmt(funnel[3].n)} about people&apos;s own SIPs, and tagged each one to the
          step of the journey where it went right or wrong. Then we made it something you can ask.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#chat" className="rounded-xl bg-accent px-5 py-3 font-medium text-white shadow-[0_8px_24px_-10px_rgba(42,120,214,0.7)] hover:bg-accent-strong">Ask the engine</a>
          <a href="#how" className="rounded-xl border border-line bg-raised px-5 py-3 font-medium hover:border-ink-3">See how it works</a>
        </div>
        </div>
        <ul className="space-y-3" aria-label="Three findings">
          {FEATURED.map((id, index) => {
            const answer = answersFile.answers.find((a) => a.id === id)!;
            return (
              <li key={id}>
                <a href={`/?q=${id}#chat`} className="rise group block rounded-2xl border border-line bg-raised/90 p-5 shadow-[0_12px_32px_-18px_rgba(23,23,26,0.3)] backdrop-blur transition hover:-translate-y-0.5 hover:border-accent" style={{ animationDelay: `${index * 90}ms` }}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${index === 0 ? "text-warm-strong" : "text-accent-strong"}`}>{answer.short}</p>
                  <p className="mt-1.5 font-semibold leading-snug">{answer.headline}</p>
                  <p className="mt-2 text-sm font-medium text-accent-strong group-hover:underline">Ask about this →</p>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const { funnel } = overview;
  const steps = [
    { n: funnel[0].n, title: "Collected", body: "Public posts from Jan 2024 to Oct 2026", chips: SOURCES },
    { n: funnel[1].n, title: "Kept", body: "Mention SIPs, mutual funds or investing" },
    { n: funnel[3].n, title: "About their own SIP", body: `AI read ${fmt(funnel[2].n)} and kept only the writer's own SIP story` },
    { n: funnel[4].n, title: "First-time investors", body: "Their first SIP. Every headline number comes from these" },
    { n: 3003, title: "Tagged in depth", body: "11 fields each: stage, what happened, trigger, need, quote" },
  ];
  return (
    <section id="how" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-accent-strong">How the engine works</p>
      <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">From {fmt(funnel[0].n)} posts to {fmt(funnel[4].n)} first-time investors, each tagged to where their SIP broke</h2>
      <ol className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step.title} className={`relative rounded-2xl border border-line bg-raised p-4 sm:p-5 ${index === 0 ? "col-span-2 md:col-span-1" : ""}`}>
            <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">{index + 1}</span>
            <div className="num mt-4 text-3xl font-semibold tracking-tight">{fmt(step.n)}</div>
            <div className="mt-1 font-medium">{step.title}</div>
            <p className="mt-1 text-sm leading-snug text-ink-2">{step.body}</p>
            {step.chips && (
              <div className="mt-3 flex flex-wrap gap-1">
                {step.chips.map((chip) => <span key={chip} className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-2">{chip}</span>)}
              </div>
            )}
            {index < steps.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-xs text-ink-3 md:flex">→</span>}
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-3 rounded-2xl bg-tint-blue p-5 text-sm sm:grid-cols-3">
        <p><span className="font-semibold">90% agreement</span> between the engine and a second AI reading the same 300 posts blind (own SIP or not, first time or not). A person checks 20 more by hand.</p>
        <p><span className="font-semibold">90 of 100 themes</span> judged correct by a separate AI reviewer checking the engine&apos;s work.</p>
        <p><span className="font-semibold">Every answer must quote the post.</span> Answers without words from the post behind them are thrown away in code.</p>
      </div>
    </section>
  );
}

export function Journey() {
  const { stages } = journey;
  const rated = stages.filter((stage) => stage.withOutcome >= MIN_FOR_PERCENT);
  const rate = (stage: (typeof stages)[number]) => stage.dropped / stage.withOutcome;
  const worst = rated.reduce((a, b) => (rate(b) > rate(a) ? b : a));
  const low = Math.round(Math.min(...rated.map(rate)) * 100);
  const high = Math.round(Math.max(...rated.map(rate)) * 100);
  return (
    <section id="journey" className="scroll-mt-16 border-y border-line bg-raised">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-sm font-medium text-warm-strong">The investor&apos;s journey</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">There is no safe month: {low}% to {high}% of first-timers at every stage are dropping off</h2>
        <p className="mt-3 max-w-2xl text-ink-2">
          Each stage shows how many first-time posts sit there, how many of those with a stated outcome were reducing, pausing, stopping or thinking of it,
          and the most common need Groww could act on.
        </p>
        <ol className="relative mt-12 grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
          <span aria-hidden className="absolute left-0 right-0 top-[11px] hidden h-0.5 bg-[linear-gradient(90deg,var(--accent),var(--warm))] md:block" />
          {stages.map((stage) => {
            const hot = stage === worst;
            const enough = stage.withOutcome >= MIN_FOR_PERCENT;
            return (
              <li key={stage.stage} className="relative">
                <span aria-hidden className={`relative z-10 hidden h-6 w-6 rounded-full border-4 border-raised md:block ${hot ? "bg-warm" : "bg-accent"}`} />
                <div className={`mt-0 rounded-2xl border p-4 md:mt-4 ${hot ? "border-warm bg-tint-warm" : "border-line bg-surface"}`}>
                  <div className="text-sm font-semibold">{stage.stage}</div>
                  <div className="num mt-1 text-xs text-ink-3">{stage.posts} posts</div>
                  <div className="mt-4">
                    {stage.withOutcome === 0 ? (
                      <p className="text-sm text-ink-3">Not started yet</p>
                    ) : (
                      <>
                        <div className="num text-2xl font-semibold tracking-tight">
                          {enough ? `${Math.round(rate(stage) * 100)}%` : `${stage.dropped} of ${stage.withOutcome}`}
                        </div>
                        <p className="text-xs text-ink-2">dropping off{enough ? ` (${stage.dropped} of ${stage.withOutcome})` : ""}</p>
                        {enough && (
                          <div className="mt-2 h-1.5 rounded-full bg-sunken">
                            <div className="h-1.5 rounded-full bg-warm" style={{ width: `${rate(stage) * 100}%` }} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {stage.need && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="text-xs text-ink-3">Top need</p>
                      <p className="mt-0.5 text-sm font-medium leading-snug">{stage.need.name}</p>
                      <p className="num text-xs text-ink-3">{stage.need.n} posts</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-sm text-ink-3">
          Only {journey.stated} of {fmt(journey.firstTimePosts)} first-time posts say when in their journey they are. People who quietly stop rarely post, so real drop-off is higher.
        </p>
      </div>
    </section>
  );
}
