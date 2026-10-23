// The shape of src/data/answers.json, written by scripts/analyse.mts.
// One answer per question in the brief, built from the pass 2 fields of first-time posts.

export type Tone = "continued" | "dropped" | "neutral";

export interface Bar {
  label: string;
  n: number;
  tone?: Tone;
}

// One row per answer option, with its count among N posts that state the field.
export interface BarsChart {
  kind: "bars";
  title: string;
  N: number;
  bars: Bar[];
}

// The same rows for two groups side by side, as shares of each group.
export interface PairsChart {
  kind: "pairs";
  title: string;
  groups: [{ label: string; N: number; tone: Tone }, { label: string; N: number; tone: Tone }];
  rows: { label: string; n: [number, number] }[];
}

// One share per row, each with its own base: "of 120 posts from students, 31 dropped off".
export interface RatesChart {
  kind: "rates";
  title: string;
  tone: Tone;
  rows: { label: string; n: number; N: number }[];
}

export type Chart = BarsChart | PairsChart | RatesChart;

export interface Quote {
  text: string;
  english?: string;
  source: string;
  stage?: string;
  url: string;
}

export interface Answer {
  id: string;
  short: string;
  question: string;
  headline: string;
  base: string;
  points: string[];
  charts: Chart[];
  quotes: Quote[];
  explore: { label: string; href: string };
}

export interface AnswersFile {
  exportedAt: string;
  version: string;
  firstTimePosts: number;
  answers: Answer[];
}

// Below 30 posts we show counts only, never a percentage.
export const MIN_FOR_PERCENT = 30;

export function share(n: number, N: number) {
  if (N < MIN_FOR_PERCENT) return `${n} of ${N}`;
  const value = (n / N) * 100;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}
