// Correction by rule (no tokens, found by the golden set on 24 Oct): pass 1 called people
// first-time who had been investing for two or more years. A post pass 1 calls first-time,
// whose own stage (pass 2) is past 12 months and which never says it was their first SIP,
// does not meet our definition of a first-time post, so it is counted as experienced.
// "first salary" or "first job" does not count: it must be their first SIP or first investing.
const SAYS_FIRST = /\bfirst[- ](sips?|time|investments?|mutual funds?|mf|step)\b|\bnew to (investing|mutual funds?|mf|sips?)\b|\bbeginner\b|pehli (baar|sip)|pahli (baar|sip)|पहली (बार|एसआईपी)/i;

export function firstTimeHolds(text: string, stage: string | string[] | undefined) {
  const stages = ([] as string[]).concat(stage ?? []);
  return !(stages.includes("after_12_months") && !SAYS_FIRST.test(text));
}
