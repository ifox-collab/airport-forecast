# Airport Forecast Board (Cloudflare)

Same repository. Same Cloudflare project. New board.

- Official METAR / TAF (AWC), NOAA METAR backup
- TEMPO / PROB flashing
- Wind roses, live clock, 3-hour boxes
- ZK-TXA … ZK-TXF within **400 km** (callsign if squawking, else rego; **on ground** when on the ground)
- Browser refresh every **5 minutes**; TAF down retries every **2 minutes**

## Deploy

From this folder:

```
npx wrangler deploy
```

Cloudflare already watching this repo will pick up the push to `main`.
