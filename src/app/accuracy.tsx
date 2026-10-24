import data from "@/data/accuracy.json";

const pct = (n: number, of: number) => Math.round((n / of) * 100);
const TH = "num px-4 py-3 text-xs font-medium";

export function Accuracy() {
  const { golden, checks } = data;
  const key = golden.fields.filter((field) => field.key);
  const holdout = (data as { holdout?: { posts: number; fields: { field: string; key: boolean; agree: number; of: number }[] } }).holdout;
  const freshPass = holdout?.fields.filter((f) => f.key && f.agree / f.of >= golden.bar).length ?? 0;
  const barText = `${Math.round(golden.bar * 100)}%`;
  return (
    <section id="accuracy" className="mx-auto flex max-w-[1200px] scroll-mt-16 flex-col gap-6 px-4 py-14 sm:px-8 sm:py-[72px]">
      <div className="flex max-w-[820px] flex-col gap-2.5">
        <p className="kicker text-ink-3 sm:text-[13px]">How much to trust it</p>
        <h2 className="font-display text-3xl font-bold leading-[1.1] sm:text-[40px]">
          Fixes lifted the four key fields from {Math.min(...key.map((f) => pct(f.before, f.of)))}–{Math.max(...key.map((f) => pct(f.before, f.of)))}% right to {Math.min(...key.map((f) => pct(f.after, f.of)))}–{Math.max(...key.map((f) => pct(f.after, f.of)))}%
          {holdout ? `, but on fresh posts only ${freshPass} of ${key.length} meet the ${barText} bar` : ""}
        </h2>
        <p className="text-ink-2">{golden.method}</p>
      </div>

      <div tabIndex={0} role="region" aria-label="Accuracy by field, scrolls sideways on small screens" className="overflow-x-auto rounded-2xl border border-line bg-raised">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-surface text-ink-3">
            <tr>
              <th className={TH}>Field</th>
              <th className={TH}>Before the fixes (v10)</th>
              <th className={TH}>After (v11)</th>
              {holdout && <th className={TH}>Fresh posts (holdout)</th>}
              <th className={TH}>Bar: {barText}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {golden.fields.map((field) => {
              const fresh = holdout?.fields.find((f) => f.field === field.field);
              const best = fresh ? pct(fresh.agree, fresh.of) : pct(field.after, field.of);
              return (
                <tr key={field.field}>
                  <td className={`px-4 py-3 ${field.key ? "font-semibold" : "text-ink-2"}`}>{field.field}{field.key && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">key</span>}</td>
                  <td className="num px-4 py-3 text-ink-3">{field.before} of {field.of} ({pct(field.before, field.of)}%)</td>
                  <td className="num px-4 py-3">{field.after} of {field.of} ({pct(field.after, field.of)}%)</td>
                  {holdout && <td className="num px-4 py-3">{fresh ? `${fresh.agree} of ${fresh.of} (${pct(fresh.agree, fresh.of)}%)` : ""}</td>}
                  <td className="px-4 py-3">{field.key ? (best >= golden.bar * 100 ? <span className="font-semibold text-accent-strong">Meets it</span> : <span className="font-semibold text-warm-strong">Below it</span>) : <span className="text-ink-3">Not gated</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-sm text-ink-2">{golden.caveat}{holdout ? ` The fresh-posts column is that check: ${holdout.posts} first-time posts the fixes never saw.` : ""}</p>

      <h3 className="mt-4 font-display text-2xl font-semibold">Other checks</h3>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <li key={check.name} className="flex flex-col gap-1 rounded-[14px] border border-line bg-raised p-[18px]">
            <p className="text-[13px] text-ink-3">{check.name}</p>
            <p className="num text-2xl">{check.value}</p>
            <p className="mt-1 text-sm leading-snug text-ink-2">{check.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
