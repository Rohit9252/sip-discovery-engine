import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { PASS2_VERSION } from "../src/pipeline/ai/pass2";
// First-time posts carry v11 (re-run after the golden set, 24 Oct); the other posts keep v10.
const PREVIOUS = "pass2-v10";
import { THEMES } from "../src/pipeline/themes";
import { firstTimeHolds } from "../src/pipeline/first-time";
import { CONTINUED, DROPPED, label } from "../src/lib/labels";
import { MIN_FOR_PERCENT, type Answer, type BarsChart, type Quote, type Tone } from "../src/lib/answers";

// Answers our lead question (q0) and the brief's nine from the pass 2 fields and writes src/data/answers.json.
// Base rule (decided 23 Oct): first-time posts whenever 30 or more of them state the field,
// otherwise every tagged post, labelled as "all investors".
// Usage: npx tsx scripts/analyse.mts [--seed 2050]
const SEED = process.argv.includes("--seed") ? process.argv[process.argv.indexOf("--seed") + 1] : "2050";
const db = openDb();
const sample = JSON.parse(readFileSync(`data/pass2-sample-${SEED}.json`, "utf8")) as { firstTime: number; ids: string[] };
const firstIds = new Set(sample.ids.slice(0, sample.firstTime));

type Row = Record<string, unknown> & { id: string; source: string; postApp: string | null; recordType: string; url: string; first: boolean; quote: string; quote_english: string; quoteOk: boolean; theme: string };
const rows: Row[] = (db.prepare(`
  SELECT p.id, p.source, p.app AS postApp, p.record_type AS recordType, p.url, p.created_at AS createdAt, p.title, p.text, l.value
  FROM labels l JOIN posts p ON p.id = l.post_id
  WHERE l.task = 'pass2' AND json_extract(l.value, '$.version') IN (?, ?)
`).all(PASS2_VERSION, PREVIOUS) as { id: string; source: string; postApp: string | null; recordType: string; url: string; createdAt: string; title: string; text: string; value: string }[])
  .filter((row) => sample.ids.includes(row.id))
  .map(({ value, ...post }) => { const tags = JSON.parse(value); return { ...post, ...tags, first: firstIds.has(post.id) && firstTimeHolds(`${post.title} ${post.text}`, tags.stage) }; });
const FIRST = rows.filter((row) => row.first);

const EMPTY = new Set(["not_stated", "none_stated"]);
const values = (row: Row, field: string) => ([] as string[]).concat(row[field] as string | string[]).filter((value) => !EMPTY.has(value));
const states = (field: string) => (row: Row) => values(row, field).length > 0;
const has = (field: string, ...codes: string[]) => (row: Row) => values(row, field).some((value) => codes.includes(value));
const continued = has("what_happened", ...CONTINUED);
const dropped = has("what_happened", ...DROPPED);
const themeName = (id: string) => THEMES.find((theme) => theme.id === id)?.name ?? id;

const pct = (n: number, N: number) => Math.round((n / N) * 100);
// "25 of 68 (37%)", or just "12 of 20" below 30 posts.
const of = (n: number, N: number) => (N < MIN_FOR_PERCENT ? `${n} of ${N}` : `${n} of ${N} (${pct(n, N)}%)`);
// The same inside brackets, without brackets in brackets: "65 of 148, 44%".
const ofIn = (n: number, N: number) => (N < MIN_FOR_PERCENT ? `${n} of ${N}` : `${n} of ${N}, ${pct(n, N)}%`);

// First-time posts if enough of them state the field, otherwise everyone.
function base(field: string, filter: (row: Row) => boolean = () => true) {
  const firstRows = FIRST.filter(filter).filter(states(field));
  if (firstRows.length >= MIN_FOR_PERCENT) return { rows: firstRows, who: "first-time investors", first: true };
  return { rows: rows.filter(filter).filter(states(field)), who: "investors (all posts, as too few first-time posts say this)", first: false };
}

function count(list: Row[], field: string) {
  const counts = new Map<string, number>();
  for (const row of list) for (const value of new Set(values(row, field))) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function bars(title: string, list: Row[], field: string, options: { tone?: (code: string) => Tone; top?: number; name?: (code: string) => string } = {}): BarsChart & { top: { code: string; n: number }[] } {
  const counted = count(list, field).slice(0, options.top ?? 7);
  return {
    kind: "bars",
    title,
    N: list.length,
    bars: counted.map(([code, n]) => ({ label: options.name ? options.name(code) : label(field, code), n, tone: options.tone?.(code) ?? "neutral" })),
    top: counted.map(([code, n]) => ({ code, n })),
  };
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const strip = <T extends { top?: unknown }>({ top, ...chart }: T) => chart;

function sourceName(row: Row) {
  // Store reviews carry the app they were left on (the collector's key, not the pass 2 code).
  const STORE_APPS: Record<string, string> = { groww: "Groww", indmoney: "INDmoney", coin: "Zerodha Coin", etmoney: "ET Money", paytmmoney: "Paytm Money" };
  const app = row.postApp ? STORE_APPS[row.postApp] ?? row.postApp : "";
  if (row.source === "play_store") return `Play Store review · ${app}`;
  if (row.source === "app_store") return `App Store review · ${app}`;
  if (row.source === "reddit") return row.recordType === "post" ? "Reddit post" : "Reddit comment";
  if (row.source === "youtube") return "YouTube comment";
  return "TradingQ&A";
}

// A fixed, repeatable order so the same quotes come out on every export.
const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
function quotes(list: Row[], howMany = 3): Quote[] {
  const usable = list
    .filter((row) => row.quoteOk && row.quote.length >= 40 && row.quote.length <= 220 && !/https?:/.test(row.quote))
    .sort((a, b) => hash(a.id) - hash(b.id));
  const chosen: Row[] = [];
  // One quote per kind of source first, so a card never shows three Reddit posts.
  for (const row of usable) if (chosen.length < howMany && !chosen.some((c) => c.source === row.source)) chosen.push(row);
  for (const row of usable) if (chosen.length < howMany && !chosen.includes(row)) chosen.push(row);
  return chosen.map((row) => ({
    text: row.quote,
    ...(row.quote_english ? { english: row.quote_english } : {}),
    source: sourceName(row),
    ...(values(row, "stage").length ? { stage: label("stage", values(row, "stage")[0]) } : {}),
    url: row.url,
  }));
}
const posts = (params: Record<string, string>) => `/posts?${new URLSearchParams(params)}`;
const toneOf = (code: string): Tone => (CONTINUED.includes(code) ? "continued" : DROPPED.includes(code) ? "dropped" : "neutral");
const answers: Answer[] = [];

// Q0. Our lead question, shown first: why do first-timers stop their SIP in their first year?
// It sits on top of the brief's nine because it is the heart of the brief's business metric.
{
  const YEAR = ["months_1_3", "months_4_6", "months_7_12"];
  const inYear = FIRST.filter(dropped).filter(has("stage", ...YEAR));
  const withTrigger = inYear.filter(states("trigger"));
  const trigChart = bars("What set it off (first-time investors who dropped off in year 1 and said why)", withTrigger, "trigger", { tone: () => "dropped" });
  const top = trigChart.top[0];
  const tops = trigChart.top.filter((item) => item.n === top.n);
  const names = tops.map((item) => label("trigger", item.code));
  const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)!.toLowerCase()}` : names[0];
  const fall = withTrigger.filter(has("trigger", "market_fall_or_loss")).length;
  const thinking = inYear.filter(has("what_happened", "thinking_of_stopping")).length;
  const byStage = YEAR.map((stage) => `${label("stage", stage)}: ${inYear.filter(has("stage", stage)).length}`);
  answers.push({
    id: "q0",
    short: "Why first-year SIPs stop",
    question: "Why do people stop their SIP in their first year?",
    headline: `${joined} ${tops.length > 1 ? `tie as the top reasons first-timers give for dropping off in year 1 (${ofIn(top.n, withTrigger.length)} each)` : `is the top reason first-timers give for dropping off in year 1 (${ofIn(top.n, withTrigger.length)})`}, ahead of market falls (${ofIn(fall, withTrigger.length)})`,
    base: `From ${inYear.length} first-time investors who reduced, paused, stopped, bounced, moved or thought of stopping in their first 12 months; ${withTrigger.length} of them said what set it off.${withTrigger.length < 60 ? " A small base: treat the order as a lead to check." : ""}`,
    points: [
      `It happens all through the year, not in one month. ${byStage.join("; ")}.`,
      `${of(thinking, inYear.length)} were still only thinking of stopping: the moment before the break.`,
      `Market falls are what people expect to hear, but fewer first-year drop-offs name them than other reasons.`,
    ],
    charts: [strip(trigChart), strip(bars("What they did (first-time investors who dropped off in year 1)", inYear, "what_happened", { tone: () => "dropped" }))],
    // Quotes come from the top reason, so they back the headline.
    quotes: quotes(withTrigger.filter(has("trigger", top.code))),
    explore: { label: "See every post where a first-timer dropped off", href: posts({ group: "first", outcome: "dropped" }) },
  });
}

// Q1. Why do people start a SIP, and what do they expect to happen?
{
  const why = base("why_started");
  const who = base("influencer");
  const expect = base("expectation");
  const whyChart = bars(`Why they started (${why.who})`, why.rows, "why_started");
  const top = whyChart.top[0];
  const longTerm = expect.rows.filter(has("expectation", "long_term_growth")).length;
  const quick = expect.rows.filter(has("expectation", "quick_high_returns")).length;
  answers.push({
    id: "q1",
    short: "Why they start",
    question: "Why do people start a SIP, and what do they expect to happen?",
    headline: `${label("why_started", top.code)} is the top reason to start: ${of(top.n, why.rows.length)} first-timers who say why`,
    base: `From ${FIRST.length.toLocaleString("en-US")} first-time investor posts. Most posts don't say why they started, so each chart counts only the posts that do.`,
    points: [
      `${of(longTerm, expect.rows.length)} who say what they expected want long-term growth. Only ${quick} expected quick, high returns.`,
      `Few say who got them started (${who.rows.length} posts). Of those, ${of(who.rows.filter(has("influencer", "own_decision")).length, who.rows.length)} say it was their own decision.`,
    ],
    charts: [strip(whyChart), strip(bars(`Who got them started (${who.who})`, who.rows, "influencer"))],
    quotes: quotes(FIRST.filter(states("why_started"))),
    explore: { label: `See all ${why.rows.length} posts that say why they started`, href: posts({ group: "first", field: "why_started" }) },
  });
}

// Q2. What changes in their behaviour in the months after starting?
{
  const STAGES = ["months_1_3", "months_4_6", "months_7_12", "after_12_months"];
  const after = base("what_happened", (row) => !has("what_happened", "not_started_yet")(row));
  const withOutcome = FIRST.filter((row) => continued(row) || dropped(row));
  const rates = STAGES.map((stage) => {
    const atStage = withOutcome.filter(has("stage", stage));
    return { label: label("stage", stage), n: atStage.filter(dropped).length, N: atStage.length };
  });
  const happened = bars(`What they did with their SIP (${after.who})`, after.rows, "what_happened", { tone: toneOf, top: 8 });
  const totalDropped = after.rows.filter(dropped).length;
  // The range uses only stages with enough posts for a percentage.
  const shares = rates.filter((rate) => rate.N >= MIN_FOR_PERCENT).map((rate) => pct(rate.n, rate.N));
  answers.push({
    id: "q2",
    short: "What changes after starting",
    question: "What changes in their behaviour in the months after starting?",
    headline: `About 1 in ${Math.round(after.rows.length / totalDropped)} first-timers who say what happened were dropping off, and it never settles: ${Math.min(...shares)}% to ${Math.max(...shares)}% at every stage`,
    base: `From first-time posts that say what happened to their SIP after starting (${after.rows.length}). Posts by people who quietly stopped are rare, so the real drop-off is higher than this.`,
    points: [
      `${of(totalDropped, after.rows.length)} reduced, paused, stopped, bounced, moved or were thinking of stopping.`,
      `${rates.map((rate) => `${rate.label}: ${of(rate.n, rate.N)}`).join("; ")}.`,
      `There is no safe month: the risk at months 1 to 3 is still there after a year.`,
    ],
    charts: [strip(happened), { kind: "rates", title: "Share dropping off, by stage (first-time posts with a stated outcome)", tone: "dropped", rows: rates }],
    quotes: quotes(FIRST.filter(dropped).filter(states("stage"))),
    explore: { label: "See every first-time post by stage", href: posts({ group: "first", field: "stage" }) },
  });
}

// Q3. What leads investors to pause, reduce or stop a SIP?
{
  const trig = base("trigger", dropped);
  const chart = bars(`What happened just before they dropped off (${trig.who})`, trig.rows, "trigger", { tone: () => "dropped" });
  const top = chart.top[0];
  const tops = chart.top.filter((item) => item.n === top.n);
  const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)!.toLowerCase()}` : names[0]);
  const fall = trig.rows.filter(has("trigger", "market_fall_or_loss")).length;
  const allTrig = rows.filter(dropped).filter(states("trigger"));
  const allApp = allTrig.filter(has("trigger", "app_or_payment_problem")).length;
  answers.push({
    id: "q3",
    short: "What makes them stop",
    question: "What leads investors to pause, reduce or stop a SIP?",
    // Ties at the top are named together, so the headline never picks one of two equal counts.
    headline: `${trig.first ? "" : "Across all investors, "}${(() => { const names = joinNames(tops.map((item) => label("trigger", item.code))); return trig.first ? names : names.charAt(0).toLowerCase() + names.slice(1); })()} ${tops.length > 1 ? `tie as the top triggers (${ofIn(top.n, trig.rows.length)} each)` : `is the top trigger (${ofIn(top.n, trig.rows.length)})`}, ahead of market falls (${ofIn(fall, trig.rows.length)})`,
    base: `From ${trig.rows.length} ${trig.who} who reduced, paused, stopped, bounced, moved or thought of stopping, and said what set it off.${trig.rows.length < 60 ? " A small base: treat the order as a lead to check." : ""}`,
    points: [
      `Across all investors, ${of(allApp, allTrig.length)} drop-offs with a stated trigger began with an app or payment problem.`,
      `Market falls are the trigger we expected to lead, but fewer drop-offs name them.`,
    ],
    charts: [strip(chart), strip(bars(`How they dropped off (${trig.who})`, FIRST.filter(dropped), "what_happened", { tone: () => "dropped" }))],
    quotes: quotes(trig.rows.filter(has("trigger", top.code))),
    explore: { label: "See every post where someone dropped off", href: posts({ group: "first", outcome: "dropped" }) },
  });
}

// Q4. What do investors check, and how often, once they have started?
{
  const what = base("checks_what");
  const often = rows.filter(states("checks_how_often")).length;
  const chart = bars(`What they look at (${what.who})`, what.rows, "checks_what");
  const top = chart.top[0];
  answers.push({
    id: "q4",
    short: "What they check",
    question: "What do investors check, and how often, once they have started?",
    headline: `${label("checks_what", top.code)} is what first-timers check most: ${of(top.n, what.rows.length)} who say what they look at`,
    base: `From ${what.rows.length} ${what.who} who mention what they look at in the app. Only ${often} of all ${rows.length.toLocaleString("en-US")} posts say how often they check, so public posts cannot answer "how often". Our survey asks it directly.`,
    points: [
      `People mention a number (XIRR, returns, value) far more often than a goal: ${what.rows.filter(has("checks_what", "progress_to_goal")).length} talk about progress to a goal.`,
      `"How often" will come from the survey, not from posts.`,
    ],
    charts: [strip(chart)],
    // Quotes only from posts that check the thing the headline names.
    quotes: quotes(what.rows.filter(has("checks_what", top.code))),
    explore: { label: "See posts about what people check", href: posts({ group: "first", field: "checks_what" }) },
  });
}

// Q5. What confuses or worries them inside the app?
{
  const conf = base("confusion");
  const chart = bars(`What confused or worried them (${conf.who})`, conf.rows, "confusion");
  const [top, second] = chart.top;
  // How many "should I continue?" worries came with a fall: a fall trigger or the "Is this fall normal?" need.
  const unsure = conf.rows.filter(has("confusion", "whether_to_continue"));
  const unsureFall = unsure.filter((row) => has("trigger", "market_fall_or_loss")(row) || row.theme === "T1").length;
  const dropTriggers = FIRST.filter(dropped).filter(states("trigger"));
  const fallDrops = dropTriggers.filter(has("trigger", "market_fall_or_loss")).length;
  answers.push({
    id: "q5",
    short: "What confuses them",
    question: "What confuses or worries them inside the app?",
    headline: `"${label("confusion", top.code)}" is the top worry (${ofIn(top.n, conf.rows.length)}), then ${label("confusion", second.code).toLowerCase()} (${ofIn(second.n, conf.rows.length)})`,
    base: `From ${conf.rows.length} ${conf.who} who describe something confusing or worrying.`,
    points: [
      `"Whether to continue" counts people unsure whether to keep their SIP going. ${of(unsureFall, unsure.length)} of them were facing a fall or loss, yet market falls triggered only ${of(fallDrops, dropTriggers.length)} actual drop-offs with a stated trigger: falls cause the worry, payment problems cause the stopping.`,
      `Payment or order status covers money debited without units, or an order with no clear state.`,
    ],
    charts: [strip(chart)],
    quotes: quotes(conf.rows.filter(has("confusion", top.code, second.code))),
    explore: { label: `See all ${conf.rows.length} posts about confusion`, href: posts({ group: "first", field: "confusion" }) },
  });
}

// Q6. What do they do outside the app when they feel unsure?
{
  const out = base("outside_app");
  const notReddit = out.rows.filter((row) => row.source !== "reddit");
  const chart = bars(`Where they went for answers (${out.who})`, out.rows, "outside_app");
  answers.push({
    id: "q6",
    short: "Where they go when unsure",
    question: "What do they do outside the app when they feel unsure?",
    headline: `They ask strangers online: ${of(out.rows.filter(has("outside_app", "reddit_or_forums")).length, out.rows.length)} went to Reddit or a forum, and ${of(out.rows.filter(has("outside_app", "youtube")).length, out.rows.length)} to YouTube`,
    base: `From ${out.rows.length} ${out.who} who say where they looked. Many posts come from Reddit, so Reddit is over-counted here; outside Reddit, ${notReddit.length} posts say where they went.`,
    points: [
      `Almost nobody mentions the app's own support (${out.rows.filter(has("outside_app", "app_support")).length}) or an advisor (${out.rows.filter(has("outside_app", "advisor")).length}).`,
      `AI tools are starting to appear (${out.rows.filter(has("outside_app", "ai_tools")).length} posts).`,
    ],
    charts: [strip(chart)],
    quotes: quotes(out.rows.filter((row) => row.source !== "reddit").concat(out.rows)),
    explore: { label: "See posts about asking outside the app", href: posts({ group: "first", field: "outside_app" }) },
  });
}

// Q7. What separates investors who continue from those who quietly drop off?
{
  const keep = FIRST.filter(continued);
  const drop = FIRST.filter(dropped);
  const SIGNALS: { label: string; test: (row: Row) => boolean }[] = [
    { label: "Had an app or payment problem", test: (row) => has("trigger", "app_or_payment_problem")(row) || has("confusion", "payment_or_status")(row) },
    { label: "Unsure whether to continue", test: has("confusion", "whether_to_continue") },
    { label: "Saw a market fall or loss", test: has("trigger", "market_fall_or_loss") },
    { label: "Someone advised them", test: has("trigger", "someone_advised") },
    { label: "Names a goal", test: has("why_started", "goal") },
    { label: "Asks which funds to pick", test: (row) => row.theme === "T10" },
    { label: "Needs help to start properly", test: (row) => row.theme === "T5" },
  ];
  const signalRows = SIGNALS.map((signal) => ({ label: signal.label, n: [keep.filter(signal.test).length, drop.filter(signal.test).length] as [number, number] }))
    .sort((a, b) => Math.abs(b.n[1] / drop.length - b.n[0] / keep.length) - Math.abs(a.n[1] / drop.length - a.n[0] / keep.length));
  const top = signalRows[0];
  const topTest = SIGNALS.find((signal) => signal.label === top.label)!.test;
  function redditGap(signal: string) {
    const test = SIGNALS.find((item) => item.label === signal)!.test;
    const [k, d] = [keep, drop].map((list) => list.filter((row) => row.source === "reddit"));
    return `${d.filter(test).length} of ${d.length} drop-offs against ${k.filter(test).length} of ${k.length} continuers`;
  }
  answers.push({
    id: "q7",
    short: "Continuers vs drop-offs",
    question: "What separates investors who continue from those who quietly drop off?",
    headline: `"${top.label}" separates them most: ${pct(top.n[1], drop.length)}% of drop-offs against ${pct(top.n[0], keep.length)}% of continuers`,
    base: `${keep.length} first-time investors who kept going or increased, against ${drop.length} who reduced, paused, stopped, bounced, moved or thought of stopping. Same fields, side by side.`,
    points: [
      ...signalRows.slice(1, 3).map((row) => `${row.label}: ${pct(row.n[1], drop.length)}% of drop-offs, ${pct(row.n[0], keep.length)}% of continuers.`),
      // Drop-offs come more from store reviews, which are complaint-heavy, so check the gap inside one source.
      `It is not just where people post: on Reddit alone, ${redditGap(signalRows[0].label)}.`,
    ],
    charts: [{
      kind: "pairs",
      title: "Share of each group whose post shows this",
      groups: [{ label: "Kept going", N: keep.length, tone: "continued" }, { label: "Dropped off", N: drop.length, tone: "dropped" }],
      rows: signalRows,
    }],
    // Quotes only from posts that show the signal the headline names.
    quotes: quotes(drop.filter(topTest)).slice(0, 2).concat(quotes(keep.filter(topTest)).slice(0, 1)),
    explore: { label: "Compare the posts yourself", href: posts({ group: "first", outcome: "dropped" }) },
  });
}

// Q8. How do these patterns differ across user segments?
{
  const withOutcome = FIRST.filter((row) => continued(row) || dropped(row));
  const segment = (field: string) => count(withOutcome, field).map(([code, N]) => ({
    label: label(field, code),
    n: withOutcome.filter(has(field, code)).filter(dropped).length,
    N,
  }));
  const age = segment("age");
  const income = segment("income");
  const source = segment("money_source");
  const influencer = segment("influencer");
  const statedAny = withOutcome.filter((row) => ["age", "income", "money_source", "influencer"].some((field) => states(field)(row))).length;
  const comparable = [...age, ...income].filter((row) => row.N >= MIN_FOR_PERCENT);
  const ageRows = withOutcome.filter(states("age"));
  answers.push({
    id: "q8",
    short: "Differences by segment",
    question: "How do these patterns differ across user segments (income stability, age, source of money, who influenced them)?",
    headline: comparable.length >= 2
      ? `Where public posts allow a comparison, segments look alike: ${comparable.map((row) => `${row.label.toLowerCase()} ${pct(row.n, row.N)}%`).join(", ")} dropping off`
      : `Segments are too small in public posts to compare drop-off rates with confidence`,
    base: `${withOutcome.length} first-time posts say whether they kept going; ${statedAny} of them also say their age, income, source of money or who got them started. Groups under 30 show counts only.`,
    points: [
      `These are all below the ${pct(withOutcome.filter(dropped).length, withOutcome.length)}% average because of who states their age: ${ageRows.filter((row) => row.source === "reddit").length} of ${ageRows.length} are Reddit posts and ${ageRows.filter((row) => row.theme === "T10").length} are portfolio-review requests from people still investing.`,
      "Public posts rarely state income or who influenced them, so this is where our survey carries the answer.",
      "Treat any difference here as a lead to check, not a finding.",
    ],
    charts: [
      { kind: "rates", title: "Dropping off, by age", tone: "dropped", rows: age },
      { kind: "rates", title: "Dropping off, by income", tone: "dropped", rows: income },
      { kind: "rates", title: "Dropping off, by source of money and influence", tone: "dropped", rows: [...source, ...influencer].filter((row) => row.N >= 5) },
    ],
    quotes: quotes(withOutcome.filter(states("age")).filter(dropped)),
    explore: { label: "Filter posts by segment", href: posts({ group: "first", field: "age" }) },
  });
}

// Q9. What unmet needs emerge consistently across conversations?
{
  const needs = FIRST.filter((row) => row.theme !== "none");
  const inRules = needs.filter((row) => row.theme !== "T10");
  const name = (id: string) => `${themeName(id)}${id === "T10" ? " (outside the rules)" : ""}`;
  const chart = bars("Unmet needs of first-time investors", needs, "theme", { name, top: 12 });
  const top = count(inRules, "theme")[0];
  const dropNeeds = FIRST.filter(dropped).filter((row) => row.theme !== "none");
  answers.push({
    id: "q9",
    short: "Unmet needs",
    question: "What unmet needs emerge consistently across conversations?",
    headline: `"${themeName(top[0])}" is the top need Groww can act on: ${of(top[1], inRules.length)}. "Which fund should I pick" is bigger (${ofIn(needs.length - inRules.length, needs.length)} of all needs) but is advice an app can't give`,
    base: `From ${needs.length} first-time posts with an unmet need. "Help me choose funds" is counted but sits outside what an app may do (it would be investment advice).`,
    points: [
      `Among first-timers who dropped off, the top needs are ${count(dropNeeds.filter((row) => row.theme !== "T10"), "theme").slice(0, 2).map(([id, n]) => `"${themeName(id)}" (${n})`).join(" and ")}.`,
      "Each need is a theme at a journey stage; the Opportunities page compares them.",
    ],
    charts: [strip(chart), strip(bars(`Needs of first-timers who dropped off (${dropNeeds.length} posts)`, dropNeeds, "theme", { name, top: 6, tone: () => "dropped" }))],
    quotes: quotes(inRules.filter((row) => row.theme === top[0])),
    explore: { label: "Compare every need by stage", href: "/#opportunities" },
  });
}

// Opportunity areas: one theme at one journey stage (GLOSSARY). For each, from first-time posts:
// reach (posts), how it ends (dropping off among those with a stated outcome), the top trigger,
// where the posts come from, and an example quote. "Within the rules" is the team's call (themes.ts).
const STAGE_ORDER = ["before_starting", "setting_up", "months_1_3", "months_4_6", "months_7_12", "after_12_months"];
const cells = THEMES.flatMap((theme) => STAGE_ORDER.map((stage) => {
  const list = FIRST.filter((row) => row.theme === theme.id && has("stage", stage)(row));
  const outcome = list.filter((row) => continued(row) || dropped(row));
  const [trigger, triggerN] = count(list.filter(dropped), "trigger")[0] ?? ["", 0];
  const sources = [...list.reduce((map, row) => map.set(sourceName(row).split(" · ")[0], (map.get(sourceName(row).split(" · ")[0]) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  return {
    theme: theme.id, themeName: theme.name, need: theme.need, stage: label("stage", stage), stageCode: stage,
    withinRules: theme.withinRules ?? null, rulesReason: theme.rulesReason ?? "",
    posts: list.length, dropped: outcome.filter(dropped).length, withOutcome: outcome.length,
    trigger: trigger ? { name: label("trigger", trigger), n: triggerN } : null,
    sources: sources.slice(0, 3).map(([name, n]) => ({ name, n })),
    quote: quotes(list, 1)[0] ?? null,
  };
}));
const noStage = THEMES.map((theme) => ({ theme: theme.id, posts: FIRST.filter((row) => row.theme === theme.id && !states("stage")(row)).length }));
writeFileSync("src/data/opportunities.json", JSON.stringify({ firstTimePosts: FIRST.length, stages: STAGE_ORDER.map((stage) => label("stage", stage)), cells, noStage }, null, 2) + "\n", "utf8");
console.log("Top opportunity areas:", cells.filter((c) => c.theme !== "T10").sort((a, b) => b.posts - a.posts).slice(0, 6).map((c) => `${c.theme} @ ${c.stage}: ${c.posts}`).join("; "));

// The investor journey: for each stage, how many first-time posts sit there, how many of those
// with a stated outcome were dropping off, and the top need Groww can act on (T10 left out).
const journey = ["before_starting", "setting_up", "months_1_3", "months_4_6", "months_7_12", "after_12_months"].map((stage) => {
  const atStage = FIRST.filter(has("stage", stage));
  const withOutcome = atStage.filter((row) => continued(row) || dropped(row));
  const [needCode, needN] = count(atStage.filter((row) => row.theme !== "none" && row.theme !== "T10"), "theme")[0] ?? ["", 0];
  return {
    stage: label("stage", stage),
    posts: atStage.length,
    dropped: withOutcome.filter(dropped).length,
    withOutcome: withOutcome.length,
    need: needCode ? { name: themeName(needCode), n: needN } : null,
    quote: quotes(atStage.filter((row) => row.theme === needCode), 1)[0] ?? null,
  };
});

// Every tagged post, trimmed, for the chat's evidence search and the post browser.
// Codes stay as codes; the site turns them into words with src/lib/labels.ts.
const FIELDS = ["stage", "why_started", "influencer", "expectation", "what_happened", "trigger", "checks_what", "checks_how_often", "confusion", "outside_app", "income", "age", "money_source", "app"];
const exportPosts = rows.map((row) => ({
  id: row.id,
  first: row.first,
  source: sourceName(row),
  date: String(row.createdAt).slice(0, 10),
  url: row.url,
  text: [row.title, row.text].filter(Boolean).join(": ").replace(/\s+/g, " ").slice(0, 700).toWellFormed(), // the cut can split an emoji in two
  theme: row.theme,
  need: row.need,
  quote: row.quoteOk ? row.quote : "",
  quoteEnglish: row.quoteOk ? row.quote_english : "",
  fields: Object.fromEntries(FIELDS.map((field) => [field, values(row, field)]).filter(([, list]) => list.length)),
}));

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/journey.json", JSON.stringify({ firstTimePosts: FIRST.length, stated: FIRST.filter(states("stage")).length, stages: journey }, null, 2) + "\n", "utf8");
console.log(journey.map((j) => `${j.stage}: ${j.posts} posts, ${j.dropped}/${j.withOutcome} dropping, need ${j.need?.name} (${j.need?.n})`).join("\n"));
writeFileSync("src/data/posts.json", JSON.stringify(exportPosts) + "\n", "utf8");
writeFileSync("src/data/answers.json", JSON.stringify({ exportedAt: new Date().toISOString(), version: `${PASS2_VERSION} (first-time posts), ${PREVIOUS} (others)`, firstTimePosts: FIRST.length, answers }, null, 2) + "\n", "utf8");
for (const answer of answers) console.log(`\n${answer.id} ${answer.headline}\n   ${answer.base}\n   - ${answer.points.join("\n   - ")}`);
