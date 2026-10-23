# Evidence notes

Running notes for the AI Evidence Log (ticket DE-29). Every correction and limit is written down when it happens.

## Sources and volume (collection finished 21 Oct 2026, 12:29 AM)

Window: 1 Jan 2024 to 20 Oct 2026. No usernames or author names stored.

| Source | What | Collected | Kept by keyword filter |
|---|---|---|---|
| Play Store | Groww, INDmoney, Zerodha Coin, ET Money, Paytm Money; India; English newest, English most helpful, Hindi newest. Groww's newest reviews pulled all the way back to Jan 2024 | 200,616 | 5,987 |
| App Store | Same 5 apps; Apple's public review feed, India, 500 most recent and 500 most helpful per app | 2,356 | 519 |
| Reddit posts | r/mutualfunds, r/personalfinanceindia, r/IndiaInvestments, r/IndianStockMarket, r/StockMarketIndia, r/FIREIndia; up to 15,000 newest posts each | 72,504 | 17,344 |
| Reddit comments | Every comment (up to 100) in the 300 most-discussed story threads: threads that mention SIPs and talk about stopping, keeping going, returns and so on (8,038 such threads found) | 26,413 | 26,413 |
| YouTube | Comments (up to 300 per video) on 28 videos whose titles mention SIPs, from 12 English and Hindi searches on 20 and 21 Oct; list in `data/youtube-videos.json` | 8,640 | 8,640 |
| TradingQ&A | 252 threads from 12 SIP searches | 1,628 | 676 |
| **Total** | | **312,157** | **59,579** |

The keyword filter keeps a post if it mentions SIPs or mutual funds at all (English and Hindi terms). The AI decides actual relevance in pass 1.

## Corrections so far

1. **YouTube picked an off-topic video.** One of the 25 most-commented search results was "How to use a new matcha whisk": the search matched "sip" as in sipping tea. Fix: a video now counts only if its own title mentions SIPs or mutual funds. Its 293 comments were removed.
2. **The keyword filter dropped most story-thread comments.** Only 26% of comments from our 300 SIP story threads passed, because the filter checked the thread title, while many threads were chosen for SIP mentions in their body. A comment like "I stopped mine after 6 months" never says "SIP". Fix: every comment in a story thread counts (19,431 added).
3. **The Reddit archive's "slow down" reply looked like "no more posts".** The first Reddit run stopped every community after 200 to 300 posts. Fix: busy replies are retried, the pace is slower, and the communities were collected again.

## Recall check (DE-08)

The 50-post hand check in the Google Sheet was replaced (user, 21 Oct) by a larger check: AI pass 1 (`pass1-v5`) on **1,000 posts the keyword filter dropped**, drawn at random with seed 2032 in proportion to the dropped pile of 252,578 posts (771 Play Store, 218 Reddit, 7 App Store, 4 TradingQ&A). Script `scripts/recall-check.mts`, sample `data/recall-2032-sample.json`, 107,239 tokens.

- The AI flagged **48** as relevant (`data/recall-2032-flagged.txt`).
- Claude reviewed all 48 and **confirmed 8** (`data/recall-2032-claude.json`). The other 40 were general account, KYC, login or withdrawal complaints with nothing tying them to mutual funds, or stock trading.
- So **8 of 1,000 dropped posts (0.8%) were relevant**: 6 of 218 Reddit posts (2.8%) and 2 of 771 store reviews (0.3%).
- Scaled up, the filter missed roughly 1,500 relevant Reddit posts and 500 store reviews. Against what it kept, that puts its **recall at roughly 85%**.
- **Pattern in the misses:** r/mutualfunds posts whose words never say SIP or mutual fund ("Investing since 2 years. What am I doing wrong?", "My current investment/month is 22k but I want to increase it to 30k").

## AI pass 1 (relevant? first-time?), 21 Oct 2026

Model gpt-4.1-mini, instructions `pass1-v5` (`src/pipeline/ai/pass1.ts`). Five versions were tried. Each was checked against blind labels from Claude (a different AI, as an independent second rater) on 100-post sets drawn with fixed seeds (2028, 2029, 2030; posts in `data/check-<seed>-posts.txt`, labels in `data/check-<seed>-claude.json`).

| Version | What changed | Agreement on "relevant?" |
|---|---|---|
| v1 | First draft | 15 of 20 (first test) |
| v3 | Stock SIPs out; mutual fund app reviews in; "experienced" needs a stated time | 78 of 100 |
| v4 | Praise and fund-picking out; judge the post, not its thread title | 90 of 100 (new set) |
| v5 | "What they check" requests, who influenced them and plans for their own SIP count | 270 of 300 (90%) across all three sets; 97% on experience |

Engine and Claude found almost the same number of relevant posts (109 vs 105 of 300), so the errors roughly cancel.

Full run on all store reviews, YouTube comments and TradingQ&A posts: 15,822 posts read, 4,492 relevant (including the 300 test posts), 2.0M tokens. Reddit is next, as a sample.

## Themes (DE-11), 22 Oct 2026

The AI (gpt-4.1-mini) read 300 relevant posts (150 from first-time investors, every source represented, seed 2033), found 59 candidate unmet needs in six groups of 50, and merged them into 14 suggested themes (`data/themes-suggested-2033.md`, 40,075 tokens). The team reviewed them and froze **12** (`src/pipeline/themes.ts`).

**Correction 4: the AI's top theme was fund-picking advice.** "Portfolio review and optimization advice" (39 of 300 posts) asked for help choosing funds, which the brief forbids and our relevance rules exclude. We kept it as T10 "Help me choose funds" **only to count it**, marked outside the rules, and moved its "is my portfolio on track?" part into T2.

Other changes from the AI's list:
- Merged four overlapping themes into two: payment status and payment reliability became T3 "What is happening with my money?"; support and cancellation became T4 "Get my stuck money sorted".
- Merged portfolio tracking, benchmarking and goal views into T2 "Am I on track?".
- **Added two themes the AI did not find**, both labelled team-added: T11 "Remind me why I started" (the brief's "stop thinking about it"; the sample leaned towards beginners asking for advice) and T12 "Move without losing my SIP" (switching apps, seen in pass 1). If pass 2 finds little for them, that is reported as a finding.

## AI pass 2 (the 11 fields), 22 Oct 2026

Model gpt-4.1-mini, instructions in `src/pipeline/ai/pass2.ts`. Ten versions; each fixed a problem found in testing:

| Version | Problem found | Fix |
|---|---|---|
| v1 to v2 | A batch got stuck copying a quote and ran away with tokens | Quotes at most 25 words; a hard cap on answer length; failed batches split and retried |
| v3 | It guessed facts and could not work out the stage | Post dates given; "only what the post says" |
| v4 to v5 | Still guessing | **Evidence rule in code**: every fact must come with the post's own words, and the evidence must contain a supporting word (a time for stage, a person or source for influencer, and so on); otherwise the answer is thrown away |
| v6 to v8 | Too many posts got "no theme" | Theme decided first; examples of which complaint goes to which theme |
| v9 | Questions ("is this right?", "can I...?") were not seen as needs | A question about one's own SIP is always a need; free code rules: requests for portfolio review go to T10; replies with no "I/my" and no question are advice to others (no theme) |
| v10 | Quotes sometimes taken from the thread title | Quote must come from the post itself; "improve my portfolio" added to the T10 rule |

**Correction 5: questions were treated as "no need".** The AI read "unmet need" as "complaint", so questions like "is this fund lineup good?" got no theme. Fixed in v9 with an instruction and two code rules (tested free on 100 posts first: 4 fixed, 0 broken).

**Independent review.** A separate AI reviewer (Claude Sonnet 5.5) checked the themes on 100 posts: **87 of 100 correct with v8, 90 of 100 with v9** (`data/review-2060-sonnet.json`, `data/review-2061-sonnet.json`). Earlier blind checks by Claude on 40 posts tracked the improvement (theme agreement 48%, 58%, 68% from v6 to v8).

**A finding from the "no theme" review:** most first-time posts with no theme are happy reviews about starting ("I started my first SIP, so easy"). Starting is not where it breaks.

## Pass 2 full run (23 Oct)

3,003 posts tagged with v10 (1,262 first-time plus a fixed random draw of 1,741 others, seed 2050), 1.92M tokens; 20 posts got no answer on the first pass and were redone (15,838 tokens).

**Correction 6: the T10 code rule fired on store reviews.** "I'd suggest a kill switch" in a Play Store review was tagged as a fund-picking request. The rule now skips store reviews, and the 10 reviews it had changed were set back to "no theme" (`scripts/fix-t10-store.mts`). No tokens: the rule only fires when the AI said "no theme".

**Correction 7: our own fact sheet was wrong about "whether to continue".** We wrote that these people "could not tell from the app if their SIP was doing fine". Counting showed 40 of the 65 were facing a fall or loss. The line now gives that count, and it led to a finding: falls cause the worry (40 of 65), payment problems cause the stopping (25 of 68 drop-offs, against 10 of 68 for falls).

## Live chat validation (23 Oct)

Typed questions are answered by gpt-4.1-mini from a fact sheet of our counted answers plus the 20 best-matching posts (free keyword and tag search, no AI). Tested on the same 10 questions each round (`scripts/chat-test.mts`, results in `data/chat-test-v*.json`), including advice, off-topic, Hinglish, a follow-up and a rule-override attempt.

| Round | Problem found | Fix |
|---|---|---|
| v1 | Independent reviewer (Claude Sonnet): 6 of 10 failed. Quotes spliced with "..." or edited, a tag carried over from the previous question, "which fund should I buy" not refused, a count used for the wrong thing, over length | Answer returned as fixed fields; **quotes checked in code** against the post, word for word; **every "n of N" checked in code** against the fact sheet; anything failing is dropped and the drop count shown |
| v2 | User test: "Which fund is good for me?" got an answer | **Advice refused in code before any AI call** (26 of 26 advice questions refused, 0 of 15 research questions wrongly refused, `scripts/advice-test.mts`) |
| v3 | "What could Groww do" designed features; age answer drew a conclusion the fact sheet calls "a lead to check" | Rules: report what investors ask for; keep the fact sheet's caveats |
| v4 | "Many posts show..." with no count behind it | Code drops any point saying many, most or often without an "n of N" |
| v4 review | Independent reviewer: 3 pass, 4 minor, 3 fail (was 6 fail). Counts lost their base ("25 of 68 investors"), "65 of 148" used as fall worry, a follow-up repeated itself, 8 of 11 quotes over 25 words, Hinglish quotes untranslated | Rules: always name N; fall worry is 40 of 65; no stage claims about triggers; follow-ups answer only the new question. Code: quotes over 25 words shortened to an exact sentence or whole-word piece, never cutting a word; percentages only next to their n of N; quotes carry an English translation |
| v6 | Quotes back in 9 of 10 answers; the AI tried to quote the fact sheet as a post (dropped by code) | Remaining weak spot: "65 of 148 worry about falls" can still slip into "what could Groww do" answers |

## Limits

- **Reddit's busy communities don't reach back to Jan 2024.** The 15,000-post cap reaches Jun 2025 (r/IndiaInvestments), Aug 2025 (r/mutualfunds), Dec 2025 (r/personalfinanceindia) and Jun 2026 (r/IndianStockMarket). The late-2024 to early-2025 market fall is covered by Groww Play Store reviews (about 3,000 SIP reviews from 2024 and 2025), YouTube and r/FIREIndia instead. We chose not to backfill Reddit (DE-07).
- **r/StockMarketIndia stopped at page 104 of 150** after the archive kept timing out. It is a stock-trading community, so little SIP evidence is lost.
- **Apple's feed caps at 500 reviews per sort order**, so App Store volume is small.
- **Few Hindi store reviews.** Most Hindi and Hinglish evidence comes from YouTube comments.
- **Public posts lean towards people who are annoyed enough to write.** Interviews and the survey balance this.
