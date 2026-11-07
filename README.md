# SIP Discovery Engine

An AI-powered discovery engine for one question: why do first-time mutual fund investors keep their SIP going, or let it drop? It reads public posts by Indian investors, tags each one to the step of the journey where it went right or wrong, and answers the brief's nine questions as counted findings on a one-page site with an always-on chat.

Live site: https://sip-discovery-engine-nine.vercel.app/

The brief: Groww wants more first-time mutual fund investors to still have an active SIP 12 months after their first one.

## What it found

- **Why people stop (all investors):** an app or payment problem is the top trigger, 127 of 245 (52%), ahead of market falls, 16 of 245 (7%).
- **What worries first-timers in the app:** "payment or order status" is the top worry, 53 of 112 (47%), then whether to continue, 38 of 112 (34%).
- **The top need Groww can act on:** "Help me start properly", 237 of 439 (54%). "Which fund should I pick" is bigger (413 of 852 needs, 48%) but it is advice, which an app cannot give.
- **When first-timers drop off:** 44 of 506 (9%) who say what happened were reducing, pausing, stopping or thinking of stopping. It never settles: 6% to 13% at every stage, with no safe month.

**How this fits the deck's slide 2.** These headlines count AI tags. The deck's exit finding goes one step further: the 60 posts tagged "first-timer stopped" were read by hand, 8 were real year-one exits, and of the 6 that gave a reason, 4 were cash and 1 was a fall. So this site leads with app or payment trouble, and slide 2 leads with cash.

## The numbers

| Step | Posts |
|---|---|
| Collected (1 Jan 2024 to 20 Oct 2026) | 312,157 |
| Kept by the keyword filter | 59,579 |
| Read by AI (pass 1) | 24,822 |
| About someone's own SIP | 7,379 |
| From a first-time investor | 1,108 |
| Tagged in depth (AI pass 2) | 3,003 |

AI pass 1 flagged 1,262 posts as first-time. A code check removed 154 whose writers show more than a year of investing and never call it their first SIP, which leaves 1,108. The 3,003 tagged in depth are 1,262 first-time posts plus a fixed random draw of 1,741 others.

Sources: Play Store and App Store reviews of five investing apps (Groww, INDmoney, Zerodha Coin, ET Money, Paytm Money), six Indian investing subreddits, YouTube comments on 28 SIP videos, and TradingQ&A.

## How it works

1. **Collect.** Public posts from the sources above. No usernames or author names are stored.
2. **Filter.** A keyword filter (English and Hindi terms) keeps posts that mention SIPs or mutual funds. A recall check reads 1,000 posts the filter dropped, to see what it missed.
3. **AI pass 1.** gpt-4.1-mini decides whether the post is about the writer's own SIP and whether it is their first. A code rule corrects "first-time" when the post shows more than a year of investing.
4. **AI pass 2.** gpt-4.1-mini fills 11 fields per post: journey stage, why they started, what happened, the trigger, what they check, confusion, where they went for help, segment, app, the unmet need (one of 12 themes) and an exact quote. Every fact must come with the post's own words, or code throws it away.
5. **Analyse.** Code counts the answers to the nine questions as "n of N", first-time posts first, and writes the results to `src/data/`.
6. **Site and chat.** A Next.js page reads only the exported files. Typed questions are answered by AI from a fact sheet of the counted answers plus the 20 best-matching posts.

The full picture is in [ARCHITECTURE.md](ARCHITECTURE.md).

## How we know it is right (AI evals)

AI tags can be wrong, so we checked them against answer keys the AI never saw. The golden set is 30 posts picked at random within each source. A second AI model drafted the answer key blind from the post text only, and the team reviewed it. After the fixes in v11, 20 more first-time posts the fixes had never seen were labelled the same way (the holdout). The holdout is the unbiased score.

The bar is 80% on each key field.

| Key field | Golden set (30, v11) | Holdout (20, v11) | Bar 80% on fresh posts |
|---|---|---|---|
| Trigger (what set it off) | 28 of 30 (93%) | 20 of 20 (100%) | Met |
| Journey stage | 24 of 30 (80%) | 15 of 20 (75%) | Below |
| Unmet need (theme) | 22 of 30 (73%) | 14 of 20 (70%) | Below |
| What happened to the SIP | 23 of 30 (77%) | 11 of 20 (55%) | Below |

Three of the four key fields are below the bar on posts the fixes had not seen. The team chose to ship with these scores reported honestly rather than run another round. The golden set "after" scores are optimistic, because the v11 fixes were made after looking at those 30 posts.

| Other check | Result |
|---|---|
| Keyword filter recall | 8 of 1,000 dropped posts were relevant, so recall is roughly 85% |
| Pass 1 agreement with a second AI (blind) | 270 of 300 (90%) |
| Themes judged by an independent AI reviewer | 90 of 100 correct |
| Quotes found word for word in their post | 2,937 of 3,003 (the rest are hidden) |
| Chat refuses advice questions | 26 of 26 refused, 0 of 15 research questions wrongly refused |
| Chat review rounds (10 fixed questions, independent reviewer) | 6 of 10 failed at v1, 3 of 10 failed at v4 after fixes |

Full AI Evidence Log: [EVIDENCE-NOTES.md](EVIDENCE-NOTES.md). It lists every version of the instructions, corrections 1 to 10, and what each one changed in the findings.

## The chat's guardrails

- **Advice is refused in code before any AI call.** No tokens are spent and no fund name can slip out.
- **Quotes are checked word for word** against the post. A quote that does not match is dropped. Long quotes are cut to an exact sentence, never mid-word.
- **Every "n of N" is checked** against the fact sheet. Percentages are allowed only next to their "n of N".
- **Vague claims are dropped.** A point that says "many", "most" or "often" with no count behind it is removed, and the drop count is shown.
- **Limits per visitor and per day:** 15 questions per visitor and 100 in total per day. The counts live in server memory, so they reset when the server restarts. They protect the token allowance, but they are not a firm cap.
- Nothing a visitor types is stored.

## Run it locally

You need:

- Node 24
- An OpenAI key in `.env` as `OPENAI_API_KEY=...`
- `YOUTUBE_API_KEY` in `.env`, only for the YouTube collector

```bash
npm install
npm run dev        # the site, on http://localhost:3000
```

The site reads only the exported files in `src/data/`, so it runs without the database.

### Rebuild the data from scratch

The collected posts live in `data/engine.db` (SQLite). It is not in this repo: it is large, and it holds raw scraped posts. Run these in order to create it again. Collectors take arguments after `--`.

```bash
npm run collect:play -- groww 300000   # one app, and how many newest reviews to pull; no arguments runs every app
npm run collect:appstore
npm run collect:reddit
npm run collect:youtube
npm run collect:tradingqna
npm run pass1:run                      # AI pass 1 (resumable)
npm run pass1:reddit                   # AI pass 1 on the fixed Reddit sample (seed 2031)
npm run pass2:run                      # AI pass 2 on the fixed sample (seed 2050)
npx tsx scripts/reapply-rules.mts      # code rules (date, planning, outside the app), no tokens
npx tsx scripts/analyse.mts            # answers.json, journey.json, posts.json
npx tsx scripts/export-site.mts        # overview.json
```

Check each script's header comment for its options. The full runs spend real tokens (pass 2 used about 1.9M, plus 887k for the v11 re-run).

## Checks you can run

| Script | What it does |
|---|---|
| `npx tsx scripts/pass1-test.mts [size] [seed] [--blind]` | Runs pass 1 live on a small mixed sample and prints each answer next to its post |
| `npx tsx scripts/pass2-test.mts` | The same for pass 2, with `--blind` to save answers for a second rater |
| `npx tsx scripts/recall-check.mts` | Reads a random sample of posts the keyword filter dropped and lists the ones the AI calls relevant |
| `npx tsx scripts/golden-run.mts` | Runs the current pass 2 instructions on the golden set only |
| `npx tsx scripts/golden-score.mts --set holdout-2071` | Scores the engine against an answer key, field by field (default is the golden set, seed 2070) |
| `npx tsx scripts/date-rule-test.mts` | Checks the date rule with no AI (12 of 12 cases) |
| `npx tsx scripts/advice-test.mts` | Every advice question must be refused and no research question may be (no AI) |
| `npx tsx scripts/chat-test.mts` | Asks the same 10 chat questions each round and saves the answers for a reviewer |

## Repository layout

```
scripts/        Collectors, AI runs, tests, scoring, analysis and export (one-line header on each)
src/pipeline/   Shared collector code, keyword filter, database, AI instructions (ai/), code rules, the 12 themes
src/lib/        Chat search, chat prompt and fact sheet, advice filter, answer helpers
src/app/        The one-page site, chat widget and api/chat/route.ts
src/data/       Exported results the site reads (overview, answers, journey, accuracy, posts, opportunities)
data/           Samples, labels, test results and reviewer files (engine.db is not in the repo)
public/         Static files for the site
EVIDENCE-NOTES.md   The AI Evidence Log
ARCHITECTURE.md     How the parts fit together
```

## Limits

- **Public posts lean towards people annoyed enough to write.** Interviews and the survey are meant to balance this.
- **The Reddit sample is not backfilled.** The 15,000-post cap per community reaches back only to Jun 2025 (r/IndiaInvestments), Aug 2025 (r/mutualfunds), Dec 2025 (r/personalfinanceindia) and Jun 2026 (r/IndianStockMarket). Play Store reviews, YouTube and r/FIREIndia cover the earlier market fall instead.
- **"First-time" is a public stand-in.** It is judged from what a post says, and posts that say nothing about earlier investing may be mislabelled. 154 of 1,262 were removed by the code check alone.
- **The golden set was drafted by AI and reviewed by the team.** It is small (30 posts, plus 20 for the holdout), so a score moves a lot with a few posts.
- **Chat limits are not a firm cap.** They live in server memory and reset on restart.
- **Other gaps:** Apple's feed caps at 500 reviews per sort order, Hindi store reviews are few, and only 7 of 3,003 posts say how often people check their SIP, so public posts cannot answer "how often".
- **Not investment advice.** The engine reports what investors say and never recommends a fund.

Built from public posts only. No usernames are stored. Not investment advice.
