const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CollectionError extends Error {}

// GET a JSON endpoint, retrying rate limits and server errors. Never logs the URL,
// because some URLs carry an API key.
export async function getJson<T = unknown>(url: string, attempts = 3): Promise<T> {
  let failure = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (research; SIP discovery)" } });
      if (response.ok) return (await response.json()) as T;
      failure = `HTTP ${response.status}`;
      // The Reddit archive reports "slow down" timeouts as 422.
      const busy = response.status === 422 && /timeout/i.test(await response.text());
      if (!busy && ![429, 500, 502, 503, 504].includes(response.status)) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 2 ** attempt * 1000);
    } catch (error) {
      failure = error instanceof Error ? error.name : "network error";
      await sleep(2 ** attempt * 1000);
    }
  }
  throw new CollectionError(`Request failed after ${attempts} attempts (${failure})`);
}
