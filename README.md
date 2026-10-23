# SIP Discovery Engine

Why do first-time mutual fund investors keep their SIP going, or let it drop? This engine reads public posts by Indian investors, keeps the ones about the writer's own SIP, and tags each one to the step of the journey where it went right or wrong. The result is a site you can read and ask questions of.

**Numbers so far:** 312,157 public posts collected (Jan 2024 to Oct 2026), 59,579 kept by a keyword filter, 7,379 about someone's own SIP, 1,262 from first-time investors, 3,003 tagged in depth.

## How it works

1. **Collect** public posts: Play Store and App Store reviews of five investing apps, six Indian investing subreddits, YouTube comments on SIP videos, and TradingQ&A. No usernames are stored.
2. **Filter** with keywords, then check what the filter dropped (a recall check on 1,000 dropped posts).
3. **AI pass 1** (gpt-4.1-mini): is the post about the writer's own SIP, and is it their first?
4. **AI pass 2** (gpt-4.1-mini): 11 fields per post (journey stage, why they started, what happened, the trigger, what they check, confusion, where they went for help, segment, app), plus the unmet need and an exact quote. Every answer must be backed by the post's own words, or code throws it away.
5. **Analyse**: the brief's nine questions answered from the fields, counted as "n of N", first-time posts first.
6. **Site**: the story, the investor journey, and a chat. The nine questions have counted answers. Typed questions are answered by AI from a fact sheet of those counts plus the best-matching posts. Code refuses advice questions, and checks every quote and number before it is shown.

Every version of the AI instructions, every test and every correction is logged in [EVIDENCE-NOTES.md](EVIDENCE-NOTES.md).

## Run it

Needs Node 24 and an OpenAI key in `.env` (`OPENAI_API_KEY=...`; `YOUTUBE_API_KEY` for the YouTube collector).

```bash
npm install
npm run dev                      # the site, on http://localhost:3000
```

The site reads only the exported files in `src/data/`. To rebuild them from scratch:

```bash
npm run collect:play -- groww 300000  # and collect:appstore, collect:reddit, collect:youtube, collect:tradingqna
npm run pass1:run                     # AI pass 1
npm run pass2:run                     # AI pass 2 on the fixed sample (seed 2050)
npx tsx scripts/analyse.mts           # answers.json, journey.json, posts.json
npx tsx scripts/export-site.mts       # overview.json
```

The collected posts live in `data/engine.db` (SQLite, not in this repo because of its size).

## Checks

- `scripts/pass1-test.mts`, `scripts/pass2-test.mts`: run a version of the instructions on a small sample before any full run.
- `scripts/recall-check.mts`: how many relevant posts the keyword filter missed.
- `scripts/advice-test.mts`: the advice filter must refuse every advice question and no research question.
- `scripts/chat-test.mts`: the same 10 chat questions each round, saved for an independent reviewer.

Not investment advice. Built from public posts only.
