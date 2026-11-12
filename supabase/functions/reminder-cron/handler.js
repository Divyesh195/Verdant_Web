// Pure Web API handler shared by the Edge entrypoint and local tests.
export async function handleReminderCron(request, config, fetcher = fetch) {
  const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  if (!config.edgeSecret || !config.apiSecret || !config.apiUrl) return json({ error: "Reminder relay is not configured." }, 503);
  const supplied = request.headers.get("authorization") ?? "";
  if (supplied.length > 1024) return json({ error: "Unauthorized" }, 401);
  const digest = value => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [actual, expected] = await Promise.all([digest(supplied), digest(`Bearer ${config.edgeSecret}`)]);
  const a = new Uint8Array(actual), b = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (difference !== 0) return json({ error: "Unauthorized" }, 401);
  let url;
  try {
    url = new URL(config.apiUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/api/cron/reminders") throw new Error();
  } catch { return json({ error: "Invalid reminder API URL configuration." }, 503); }
  try {
    const response = await fetcher(url.href, {
      method: "GET", headers: { Authorization: `Bearer ${config.apiSecret}` },
      redirect: "error", signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return json({ error: "Reminder API request failed.", upstreamStatus: response.status }, 502);
    const result = await response.json();
    if (![result.autoCompleted, result.processed, result.errors].every(n => Number.isSafeInteger(n) && n >= 0)) return json({ error: "Unexpected reminder API response." }, 502);
    return json({ autoCompleted: result.autoCompleted, processed: result.processed, errors: result.errors }, result.errors ? 502 : 200);
  } catch { return json({ error: "Reminder API timed out or could not be reached." }, 502); }
}
