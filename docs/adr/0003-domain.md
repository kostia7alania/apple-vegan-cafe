# ADR-0003: Domain — apple-vegan-cafe.com on Cloudflare Registrar

Date: 2026-07-15 · Amended: 2026-07-16 · Status: accepted

## Context

All candidates were RDAP-verified available on 2026-07-15. Weighted scoring
(brand 25% / readability 20% / SEO 15% / scalability 20% / price 10% / legal
10%) put the hyphenated and non-hyphenated variants in a virtual tie: the only
scoring difference was one subjective readability point. Trade-offs are real
but symmetric: hyphens read better visually and match word boundaries; the
non-hyphenated form is easier to dictate aloud and to type on a phone keyboard.
Most traffic will arrive via QR codes, Google Maps and search — where nobody
types the domain — so the choice is not decisive either way.

## Decision (amended 2026-07-16)

- Primary: **apple-vegan-cafe.com** — registered by the owner at Cloudflare
  Registrar (at-cost ≈ $10.46/yr, free WHOIS privacy). Auto-renew ON,
  prepaying 2–3 years recommended.
- Defensive (recommended, not yet registered): `applevegancafe.com` → 301 to
  the primary, to capture the "forgot the hyphens" typo traffic and block
  squatters.
- Rejected: `.cafe` ($4.63 teaser → $41.71/yr renewals), city-in-domain (blocks
  scale, EMD bonus negligible), `.co.th` (requires Thai juristic person / VAT /
  trademark; revisit if the family registers a company).
- Trademark risk "Apple": LOW (Apfelkind precedent; the cafe already trades
  under this name). Constraint: **the logo must never resemble Apple Inc.'s
  bitten-apple / minimalist apple-with-leaf silhouette**.

## Consequences

Requires Cloudflare nameservers (already the plan). www + defensive domain
redirect at zone level; HSTS preload only after a month of stable HTTPS.
