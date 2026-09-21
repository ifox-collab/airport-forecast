# Airport Forecast Board (Cloudflare)

Weather only (browser). No ADS-B Worker.

- METAR + TAF text when the METAR API includes TAF
- 3-hour boxes = MODEL (Open-Meteo, met.no backup)
- Last-good cache + STALE tag if a feed fails
- Refresh every 5 minutes
- Flight category badge (VFR / MVFR / IFR / LIFR) from METAR
- Not for operational / dispatch use

Cloudflare Pages serves `public/index.html`. After a push, hard-refresh (Ctrl+F5).
