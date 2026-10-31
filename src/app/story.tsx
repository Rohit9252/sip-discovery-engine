import overview from "@/data/overview.json";
import answersFile from "@/data/answers.json";
import journey from "@/data/journey.json";
import posts from "@/data/posts.json";
import { MIN_FOR_PERCENT } from "@/lib/answers";
import { AskButton } from "./ask";

const fmt = (n: number) => n.toLocaleString("en-US");
const SOURCES = ["Play Store", "App Store", "Reddit", "YouTube", "TradingQ&A"];
const monthYear = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

type Stage = (typeof journey.stages)[number];
const enough = (stage: Stage) => stage.withOutcome >= MIN_FOR_PERCENT;
const rate = (stage: Stage) => stage.dropped / stage.withOutcome;
// The stage with the highest drop-off share, counting only stages with enough posts for a percentage.
const worstStage = () => journey.stages.filter(enough).reduce((a, b) => (rate(b) > rate(a) ? b : a));

// The hero starter chips and the three finding cards open the chat on these answers.
// Chips show the brief's own question in full, not a shortened label.
const STARTERS = ["q3", "q9", "q5"];
const FINDINGS = ["q3", "q5", "q9"];
// The hero strip shows one dot per instalment in the first year, grouped by the stages that cover them.
const STRIP: { stage: string; dots: number }[] = [
  { stage: "Months 1 to 3", dots: 3 },
  { stage: "Months 4 to 6", dots: 3 },
  { stage: "Months 7 to 12", dots: 6 },
];

const SECTION = "mx-auto max-w-[1200px] px-4 sm:px-8";
const H2 = "font-display text-3xl font-bold leading-[1.1] sm:text-[40px]";

export function Hero() {
  const { funnel } = overview;
  const worst = worstStage();
  const strip = STRIP.map((item) => ({ ...item, data: journey.stages.find((stage) => stage.stage === item.stage)! }));
  const hot = strip.reduce((a, b) => (rate(b.data) > rate(a.data) ? b : a));
  return (
    <section className={`${SECTION} grid items-center gap-10 pb-10 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 xl:pt-16`}>
      <div className="flex flex-col gap-5">
        <p className="kicker text-[11px] text-ink-3 sm:text-[13px]">A discovery engine · Groww · first-time SIP investors</p>
        <h1 className="font-display text-[2.125rem] font-bold leading-[1.03] tracking-[-0.02em] sm:text-[3.5rem] xl:text-[3.875rem]">Why do first SIPs last, or quietly stop?</h1>
        <p className="max-w-[34em] text-base text-ink-2 sm:text-lg">
          We read {fmt(funnel[0].n)} public posts, kept {fmt(funnel[3].n)} about people&apos;s own SIPs, and tagged each story to the instalment where it went right or wrong. Ask it anything.
        </p>
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-[#d3d5cd] bg-raised p-3.5 shadow-[0_18px_40px_-26px_rgba(47,91,234,0.55)]">
          <AskButton className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-line-strong bg-[#fafaf8] py-0 pl-4 pr-2 text-left text-base text-ink-3 hover:border-accent">
            <span className="flex-1">Ask anything about first SIPs…</span>
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent font-semibold text-white">→</span>
          </AskButton>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((id) => (
              <AskButton key={id} answerId={id} className="min-h-11 rounded-2xl border border-line bg-raised px-3.5 py-2 text-left text-sm font-medium hover:border-accent">
                {answersFile.answers.find((answer) => answer.id === id)!.question}
              </AskButton>
            ))}
          </div>
        </div>
      </div>

      <figure className="m-0 flex flex-col gap-4 rounded-[20px] border border-line bg-raised p-5 sm:p-7">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-display text-lg font-semibold">A first SIP, instalment by instalment</span>
          <span className="num text-xs text-ink-3">share dropping off</span>
        </figcaption>
        <div className="grid grid-cols-12 gap-1.5 sm:gap-2" aria-hidden="true">
          {strip.flatMap((item) =>
            Array.from({ length: item.dots }, (_, index) => {
              const ring = item === hot && index === item.dots - 1;
              return <span key={`${item.stage}-${index}`} className={`aspect-square rounded-full ${ring ? "box-border border-[3px] border-warm" : "bg-accent"}`} />;
            }),
          )}
        </div>
        <div className="grid grid-cols-[3fr_3fr_6fr] gap-2">
          {strip.map((item) => {
            const isHot = item === hot;
            return (
              <div key={item.stage} className={`border-t-2 pt-2 ${isHot ? "border-warm" : "border-ink"}`}>
                <div className={`num text-xl font-medium sm:text-[26px] ${isHot ? "text-warm-strong" : ""}`}>
                  {enough(item.data) ? `${Math.round(rate(item.data) * 100)}%` : `${item.data.dropped} of ${item.data.withOutcome}`}
                </div>
                <div className="num text-[11px] leading-snug text-ink-3 sm:text-xs">
                  <span className="block sm:hidden">{item.stage.replace("Months ", "M")}</span>
                  <span className="hidden sm:block">{item.stage}</span>
                  <span className="hidden sm:block">{item.data.dropped} of {item.data.withOutcome}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-ink-2">
          First-time posts with a stated outcome. No month is safe: the worst stage, {worst.stage.toLowerCase()}, is at {Math.round(rate(worst) * 100)}%. People who quietly stop rarely post, so real drop-off is higher.
        </p>
      </figure>
    </section>
  );
}

export function Findings() {
  const cards = FINDINGS.map((id) => answersFile.answers.find((answer) => answer.id === id)!);
  return (
    <section aria-label="Three findings" className={`${SECTION} grid gap-4 pb-14 sm:pb-[72px] md:grid-cols-3`}>
      {cards.map((answer, index) => (
        <article key={answer.id} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-raised p-6">
          <span className={`text-sm font-medium ${index === 0 ? "text-warm-strong" : "text-accent-strong"}`}>{answer.question}</span>
          <h2 className="font-display text-xl font-semibold leading-tight">{answer.headline}</h2>
          <AskButton answerId={answer.id} className="mt-auto min-h-11 self-start text-sm font-semibold text-accent-strong hover:underline">Ask about this →</AskButton>
        </article>
      ))}
    </section>
  );
}

export function HowItWorks() {
  const { funnel, dates } = overview;
  const steps = [
    { n: funnel[0].n, title: "Collected", body: `Public posts from ${monthYear(dates.oldest)} to ${monthYear(dates.newest)}`, chips: SOURCES },
    { n: funnel[1].n, title: "Kept", body: "Mention SIPs, mutual funds or investing" },
    { n: funnel[3].n, title: "About their own SIP", body: `AI read ${fmt(funnel[2].n)} and kept only the writer's own SIP story` },
    { n: funnel[4].n, title: "First-time investors", body: "Their first SIP. Every headline number comes from these", lit: true },
    { n: posts.length, title: "Tagged in depth", body: "11 fields each: stage, what happened, trigger, need, quote" },
  ];
  return (
    <section id="how" className="scroll-mt-16 bg-dark text-surface">
      <div className={`${SECTION} flex flex-col gap-8 py-14 sm:py-[72px]`}>
        <div className="flex max-w-[760px] flex-col gap-2.5">
          <p className="kicker text-[#9fa4ad] sm:text-[13px]">How the engine works</p>
          <h2 className={H2}>From {fmt(funnel[0].n)} posts to {fmt(funnel[4].n)} first-time investors, each tagged to where their SIP broke</h2>
        </div>
        <ol className="grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-0.5 overflow-hidden rounded-2xl bg-dark-2">
          {steps.map((step) => (
            <li key={step.title} className="flex flex-col gap-1.5 bg-dark p-[22px]">
              <span className={`num text-[28px] ${step.lit ? "text-[#8fb0ff]" : ""}`}>{fmt(step.n)}</span>
              <span className="font-semibold">{step.title}</span>
              <span className="text-sm text-[#b9bdc5]">{step.body}</span>
              {step.chips && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {step.chips.map((chip) => <span key={chip} className="rounded-full bg-dark-2 px-2 py-0.5 text-xs text-[#d6d9de]">{chip}</span>)}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="grid gap-4 rounded-2xl bg-dark-2 p-5 text-sm leading-relaxed text-[#d6d9de] md:grid-cols-3">
          <p><span className="font-semibold text-white">90% agreement</span> between the engine and a second AI reading the same 300 posts blind (own SIP or not, first time or not). Every field is also scored against an answer key: see How much to trust it.</p>
          <p><span className="font-semibold text-white">90 of 100 themes</span> judged correct by a separate AI reviewer checking the engine&apos;s work.</p>
          <p><span className="font-semibold text-white">Every answer must quote the post.</span> Answers without words from the post behind them are thrown away in code.</p>
        </div>
      </div>
    </section>
  );
}

export function Journey() {
  const { stages } = journey;
  const rated = stages.filter(enough);
  const worst = worstStage();
  const low = Math.round(Math.min(...rated.map(rate)) * 100);
  const high = Math.round(Math.max(...rated.map(rate)) * 100);
  return (
    <section id="journey" className={`${SECTION} flex scroll-mt-16 flex-col gap-7 py-14 sm:py-[72px]`}>
      <div className="flex max-w-[800px] flex-col gap-2.5">
        <p className="kicker text-warm-strong sm:text-[13px]">The investor&apos;s journey</p>
        <h2 className={H2}>There is no safe month: {low}% to {high}% of first-timers at every stage are dropping off</h2>
        <p className="max-w-2xl text-ink-2">
          Each stage shows how many first-time posts sit there, how many of those with a stated outcome were reducing, pausing, stopping or thinking of it,
          and the most common need Groww could act on.
        </p>
      </div>
      <ol className="grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
        {stages.map((stage) => {
          const hot = stage === worst;
          const started = stage.withOutcome > 0 && stage.stage !== "Before starting";
          return (
            <li key={stage.stage} className={`flex flex-col gap-2.5 rounded-2xl p-[18px] ${hot ? "border-[1.5px] border-warm bg-tint-warm" : "border border-line bg-raised"}`}>
              <span className="font-semibold">{stage.stage}{hot && <span className="kicker ml-2 text-[10px] text-warm-strong">worst</span>}</span>
              <span className="num text-[13px] text-ink-3">{stage.posts} posts</span>
              {started ? (
                <>
                  <span className={`num text-[22px] ${hot ? "text-warm-strong" : ""}`}>{enough(stage) ? `${Math.round(rate(stage) * 100)}%` : `${stage.dropped} of ${stage.withOutcome}`}</span>
                  {enough(stage) && (
                    <span className={`h-1.5 rounded-full ${hot ? "bg-[#f6dccb]" : "bg-[#ecede8]"}`}>
                      <span className="block h-1.5 rounded-full bg-warm" style={{ width: `${rate(stage) * 100}%` }} />
                    </span>
                  )}
                  <span className="num -mt-1 text-xs text-ink-3">dropping off{enough(stage) ? ` · ${stage.dropped} of ${stage.withOutcome}` : ""}</span>
                </>
              ) : (
                <span className="num text-[22px]">Not started</span>
              )}
              {stage.need && (
                <span className={`mt-auto border-t pt-2.5 text-sm ${hot ? "border-[#f1d5c2]" : "border-line"}`}>
                  {stage.need.name} <span className="num text-ink-3">· {stage.need.n}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-ink-3">
        Big number: share of first-time posts with a stated outcome that were reducing, pausing, stopping or thinking of it. Below {MIN_FOR_PERCENT} posts we show counts only.
        Only {journey.stated} of {fmt(journey.firstTimePosts)} first-time posts say when in their journey they are. People who quietly stop rarely post, so real drop-off is higher.
      </p>
    </section>
  );
}
