// POST /api/analytics
// Body: { type: "generation", day: "YYYY-MM-DD", ts: number }
// If a KV namespace is bound as ANALYTICS, we increment a daily key.
// Otherwise, we no-op with 204 so the beacon doesn't error.

const ok = (status = 204) =>
  new Response(null, { status, headers: { "Access-Control-Allow-Origin": "*", "Vary": "Origin" } });

export const onRequestOptions = async () =>
  ok(204);

export const onRequestPost = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const day = body?.day || new Date().toISOString().slice(0, 10);
    const type = body?.type || "generation";

    // If KV is not bound, just succeed (no-op)
    if (!env.ANALYTICS) return ok();

    const key = `count:${type}:${day}`;
    const cur = parseInt((await env.ANALYTICS.get(key)) || "0", 10) || 0;
    await env.ANALYTICS.put(key, String(cur + 1));
    return ok();
  } catch {
    return ok(); // keep beacons silent
  }
};
