# ADR-0003: Domain — applevegancafe.com on Cloudflare Registrar

Date: 2026-07-15 · Status: accepted

## Context

All candidates were RDAP-verified available on 2026-07-15. Weighted scoring
(brand 25% / readability 20% / SEO 15% / scalability 20% / price 10% / legal
10%) ranked `applevegancafe.com` first (8.75).

## Decision

- Primary: **applevegancafe.com** — exact trading name, no hyphens, no city
  baked in (future branches/catering not blocked). Cloudflare Registrar
  at-cost ≈ $10.46/yr, free WHOIS privacy, auto-renew ON, prepay 2–3 years.
- Optional defensive: `apple-vegan-cafe.com` → 301 to apex.
- Rejected: `.cafe` ($4.63 teaser → $41.71/yr renewals), city-in-domain (blocks
  scale, EMD bonus negligible), `.co.th` (requires Thai juristic person / VAT /
  trademark; revisit if the family registers a company).
- Trademark risk "Apple": LOW (Apfelkind precedent; the cafe already trades
  under this name). Constraint: **the logo must never resemble Apple Inc.'s
  bitten-apple / minimalist apple-with-leaf silhouette**.

## Consequences

Requires Cloudflare nameservers (already the plan). www + defensive domain
redirect at zone level; HSTS preload only after a month of stable HTTPS.
