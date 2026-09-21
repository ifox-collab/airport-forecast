export async function onRequest() {
  return new Response(JSON.stringify({ disabled: true, flights: [], byAirport: {} }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
  });
}
