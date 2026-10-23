// Questions that ask for investment advice are refused in code, before any AI call, so no
// wording of the prompt can talk the model into recommending a fund. The prompt keeps its own
// rule as a second layer for phrasings these patterns miss.
import answersFile from "@/data/answers.json";
import type { AnswersFile } from "./answers";

const ADVICE: RegExp[] = [
  // "which fund is good/best for me", "what fund should I pick", "best small cap fund"
  /\b(which|what|best|good|top|better|right|ideal|safest)\b.{0,40}\b(funds?|mf|mutual funds?|sips?|scheme|portfolio|stocks?|etfs?|index)\b.{0,30}\b(for me|to (buy|pick|choose|invest|start|add)|should i|i should|is (good|best|better))\b/i,
  /\b(best|top|good|safest|better)\b.{0,25}\b(small|mid|large|flexi|multi|index|elss|debt|hybrid|value|gold|silver|nifty|cap)\b.{0,15}\b(funds?|mf|sips?)\b/i,
  /\b(funds?|mf|sips?)\b.{0,20}\b(for me|is (good|best|right) for me|suit(s|able)? me)\b/i,
  // "is <any fund name> good for me?"
  /\bis\b.{2,60}\b(good|right|suitable|safe|worth it|ok|okay|better|best)\b.{0,10}\b(for me|to (buy|invest in|pick))\b/i,
  // "suggest/recommend a fund", "rate/review my portfolio"
  /\b(suggest|recommend|advise|tell me)\b.{0,30}\b(funds?|mf|schemes?|portfolio|sips?|where to invest|what to buy)\b/i,
  /\b(rate|review|roast|check|rebalance|fix)\b.{0,10}\bmy\b.{0,10}\b(portfolio|funds?|sips?|allocation)\b/i,
  // "should I buy/sell/stop/continue/redeem/switch", "how much should I invest"
  /\bshould i\b.{0,40}\b(buy|sell|invest|stop|continue|pause|redeem|withdraw|switch|exit|increase|add|start|hold|book)\b/i,
  /\b(is it (a )?good time|right time|when should i)\b.{0,30}\b(invest|buy|sell|start|stop)\b/i,
  /\bhow much\b.{0,20}\bshould i\b.{0,20}\b(invest|put|sip)\b/i,
  /\bwhere (should|can|do) i (invest|put|park)\b/i,
  // Hindi and Hinglish: "kaunsa fund lu", "best fund batao", "kis fund mein daalu"
  /\b(kaun ?sa|kon ?sa|konsa|kaunsa|kis)\b.{0,25}\b(fund|mf|sip|scheme)\b/i,
  /\b(fund|mf|sip|scheme)\b.{0,30}\b(batao|bataiye|suggest karo|lena chahiye|lu|loon|daalu|dalu|kharidu)\b/i,
  /(कौन ?सा|कौनसा|किस)\s*.{0,20}(फंड|फण्ड|म्यूचुअल)/,
];

export function asksForAdvice(question: string) {
  return ADVICE.some((pattern) => pattern.test(question));
}

// The refusal, with what the research can say instead (numbers from the counted answers).
export function adviceReply() {
  const needs = (answersFile as AnswersFile).answers.find((answer) => answer.id === "q9");
  const chart = needs?.charts[0];
  const fundBar = chart?.kind === "bars" ? chart.bars.find((bar) => bar.label.startsWith("Help me choose funds")) : undefined;
  return {
    answer: "I can't recommend funds or tell you what to do with your money. That is investment advice, and this engine only reports what investors say in public posts.",
    points: [
      ...(fundBar && chart?.kind === "bars" ? [`You're not alone in asking: "which fund should I pick" is the most common need in first-time investors' posts (${fundBar.n} of ${chart.N}).`] : []),
      "For advice on your own money, a SEBI-registered investment adviser can help.",
    ],
    quotes: [],
    followUp: "What do first-time investors expect when they start?",
    searched: 0,
    dropped: 0,
    refused: true,
  };
}
