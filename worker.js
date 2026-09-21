/**
 * Static asset worker only. No ADS-B. No /api/flights.
 * Keeps CPU under Free-tier 10ms by doing almost no work.
 */
export default {
  async fetch(request, env) {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  }
};
