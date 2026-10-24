import { monthsSinceStart } from "../src/pipeline/ai/pass2";

// Checks the date rule with no AI: each case is a post text, its date, and the months expected.
const CASES: [string, string, number | null][] = [
  ["Started investing: Dec 2023 Current SIP: 70k", "2026-02-15", 26],
  ["Started investing from end of 2022. 10 yrs horizon", "2025-12-27", 36],
  ["From 2024 august, monthly 10000/- Rs.", "2026-09-13", 25],
  ["I have been investing in mutual fund through the Groww app for last 7 months.", "2026-04-20", 7],
  ["I have been investing in Quant small cap from Aug 2022 and recently started", "2026-03-18", 43],
  ["I started a SIP 4 months ago and it is down 6%", "2025-03-01", 4],
  ["Started using Groww for mutual funds 2 days ago", "2026-08-15", null],
  ["I opted out of linking my mutual funds to a demat account last year", "2026-05-05", null],
  ["I plan to invest 2 lakh from next month", "2026-01-20", null],
  ["23, I started my investment journey in Apr '24. Crossed 30L", "2026-07-14", 27],
  ["I not an expert started investing last year April need some suggestion", "2026-08-24", 16],
  ["Hit 10L - 50K per month SIP. Time taken 16 months.", "2025-10-12", 16],
];
let ok = 0;
for (const [text, date, want] of CASES) {
  const got = monthsSinceStart({ id: "t", source: "reddit", context: "", title: "", text, createdAt: date } as never);
  const pass = got === want;
  ok += pass ? 1 : 0;
  if (!pass) console.log(`MISS: "${text.slice(0, 60)}" (${date}) gave ${got}, wanted ${want}`);
}
console.log(`${ok} of ${CASES.length} date cases right`);
