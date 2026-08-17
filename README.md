# Airport Forecast Board (Cloudflare)

Weather every **5 minutes** in the browser (free).  
Flights via a light **Cloudflare Worker**: registrations **ZK-TXA … ZK-TXF** within **200 km** of watched airports, with altitude and ARRIVING / LEAVING.

## Deploy (Cloudflare)

1. Install Wrangler: `npm i -g wrangler`
2. Login: `wrangler login`
3. From this folder: `wrangler deploy`
4. Open the `*.workers.dev` URL (or attach a custom domain)

### What gets deployed
- `public/index.html` — board UI + weather (Open-Meteo, METAR, met.no backup)
- `worker.js` — `/api/flights` only (6 registrations, 200 km)

## Airports
BNE, MEL, SYD, ADL, PER, CNS, DRW, NLK, LST, AKL, CHC, PMR

## Flight strip example
`🛬 TNZ74 FL210 42km ARRIVING CHC`

## Free tier notes
- Weather does **not** use Worker compute (browser only)
- Flights Worker: few upstream calls (≤ ~12), fine on Workers Free for one TV
- Refresh: every 5 minutes
