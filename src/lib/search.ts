// Finds the tagged posts that best match a typed question, with no AI and no cost.
// A post scores for the question's words found in its text, and more for matching
// the fields pass 2 tagged it with (stage, trigger, theme...), so "stopped after a fall"
// finds posts tagged market_fall_or_loss even when they say "crash" or "red".
import posts from "@/data/posts.json";

export interface Post {
  id: string;
  first: boolean;
  source: string;
  date: string;
  url: string;
  text: string;
  theme: string;
  need: string;
  quote: string;
  quoteEnglish: string;
  fields: Record<string, string[]>;
}

const ALL = posts as Post[];

// Question words that point at a tag: [pattern, field, code]. "theme" means the post's theme.
const CUES: [RegExp, string, string][] = [
  [/stop|quit|cancel|band kar|discontinu/i, "what_happened", "stopped"],
  [/pause|skip/i, "what_happened", "paused"],
  [/reduc|lower|decreas|cut/i, "what_happened", "reduced"],
  [/bounc|fail|insufficient|declin/i, "what_happened", "bounce"],
  [/continu|keep going|stay|still invest/i, "what_happened", "continuing"],
  [/increas|step.?up|top.?up/i, "what_happened", "increased"],
  [/switch|move|transfer|another app/i, "what_happened", "switched_app"],
  [/fall|crash|loss|losing|red|down|negative|dip|correction/i, "trigger", "market_fall_or_loss"],
  [/payment|debit|mandate|autopay|upi|order|deduct/i, "trigger", "app_or_payment_problem"],
  [/need(ed)? (the )?money|emergenc|withdraw/i, "trigger", "needed_money"],
  [/salary|income|job|laid off|layoff/i, "trigger", "income_drop_or_delay"],
  [/forgot|lost interest|bored/i, "trigger", "forgot_or_lost_interest"],
  [/advis|told me|suggested/i, "trigger", "someone_advised"],
  [/normal|panic|scared|worr/i, "theme", "T1"],
  [/on track|xirr|return|goal/i, "theme", "T2"],
  [/payment|status|allot|nav|processing/i, "theme", "T3"],
  [/stuck|refund|redeem|redemption|withdraw|support|customer care/i, "theme", "T4"],
  [/start|begin|first|setup|set up|kyc|new/i, "theme", "T5"],
  [/amount|how much|afford|skip|emergenc|step.?up/i, "theme", "T6"],
  [/safe|trust|fraud|scam|secure/i, "theme", "T7"],
  [/one place|track all|other app|consolidat/i, "theme", "T8"],
  [/charge|fee|exit load|lock.?in|tax|elss/i, "theme", "T9"],
  [/why.*start|motivat|remind|purpose/i, "theme", "T11"],
  [/switch|transfer|move/i, "theme", "T12"],
  [/youtube|video|finfluencer|influencer/i, "outside_app", "youtube"],
  [/friend|family|parent|colleague/i, "outside_app", "friends_or_family"],
  [/reddit|forum/i, "outside_app", "reddit_or_forums"],
  [/chatgpt|\bai\b|gemini/i, "outside_app", "ai_tools"],
  [/check|look at|track|how often|daily|monitor/i, "checks_what", "xirr_or_percent"],
  [/confus|understand|unclear/i, "confusion", "returns_calculation"],
  [/student|college|young|under 25|20s/i, "age", "under_25"],
  [/30s|thirties/i, "age", "25_to_34"],
  [/first (month|few months)|month (1|one|2|two|3|three)|early/i, "stage", "months_1_3"],
  [/year|12 months|long/i, "stage", "after_12_months"],
];

const STOP = new Set("a an and are as at be but by do does did for from has have how i if in is it its me my of on or so that the their them they this to was what when where which who why will with you your people investors investor sip sips mutual fund funds".split(" "));
const words = (text: string) => text.toLowerCase().match(/[a-zऀ-ॿ]{3,}/g)?.filter((word) => !STOP.has(word)) ?? [];

// How rare each word is across the posts, so "mandate" counts for more than "money".
const docFreq = new Map<string, number>();
for (const post of ALL) for (const word of new Set(words(post.text))) docFreq.set(word, (docFreq.get(word) ?? 0) + 1);
const rarity = (word: string) => Math.log(1 + ALL.length / (1 + (docFreq.get(word) ?? 0)));

export function search(question: string, howMany = 20): Post[] {
  const terms = [...new Set(words(question))];
  const cues = CUES.filter(([pattern]) => pattern.test(question));
  const scored = ALL.map((post) => {
    const text = post.text.toLowerCase();
    let score = 0;
    for (const term of terms) if (text.includes(term)) score += rarity(term);
    for (const [, field, code] of cues) {
      if (field === "theme" ? post.theme === code : post.fields[field]?.includes(code)) score += 4;
    }
    if (score === 0) return { post, score };
    if (post.first) score += 1.5;
    if (post.quote) score += 0.5;
    return { post, score };
  });
  return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, howMany).map((item) => item.post);
}
