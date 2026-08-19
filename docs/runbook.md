# Runbook

## The site is down

1. Check https://apple-vegan-cafe.com and https://apple-vegan-cafe.com/menu/.
   The site is static on Cloudflare — real downtime is almost always DNS/domain,
   not "the server". Check an external alert only after the monitor state below
   is recorded as **configured**.
2. Check domain expiry in the Cloudflare dashboard (auto-renew must be ON).
3. Cloudflare status: https://www.cloudflarestatus.com
4. A broken deploy cannot take the site down — the last good version keeps
   serving. Check Workers Builds logs only if _changes_ stop appearing.

## Owner can't edit via /admin

- Fallback that always works: edit files directly on github.com (web UI) —
  `src/content/dishes/*.json` for prices/availability.
- If Sveltia itself is broken: swap the pinned script in
  `public/admin/index.html` to Decap CMS (same config.yml works).
- OAuth errors: re-check the sveltia-cms-auth Worker and its two secrets
  (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) in the Cloudflare dashboard.

## Changes don't appear on the site

1. Wait 3 minutes (build + cache).
2. Workers Builds → latest build log. A red build = usually content that
   failed schema validation; the error names the file and field.
3. Fix the file (or revert the commit in GitHub UI) — the next build heals.

## Backups

- Content + code + history: this git repository (GitHub + every local clone).
  Quarterly: `git clone` onto the family laptop.
- NOT in git (document changes here): Cloudflare dashboard settings — DNS
  records, domain auto-renew, Workers Builds config, the sveltia-auth Worker
  secrets, Email Routing rules. GitHub settings: collaborators, the OAuth app.

## Google Search Console (configured)

Authenticated Search Console evidence observed on 2026-08-19:

- the verified domain property is `sc-domain:apple-vegan-cafe.com`;
- `https://apple-vegan-cafe.com/sitemap-index.xml` was submitted on 2026-07-21,
  last read on 2026-08-16 and reports **Success** with 31 discovered pages;
- the Page indexing report last updated on 2026-08-17 and reported 15 indexed
  and 20 not-indexed URLs. This is an operating baseline, not a promise that
  every sitemap URL is indexed.

The configured domain property is verified through DNS. The optional
`PUBLIC_GOOGLE_SITE_VERIFICATION` hook applies only if a separate URL-prefix
property is ever created with HTML-tag verification; it cannot recover or
re-verify the current domain property. Do not add the variable merely because
the hook exists, and do not start **Validate fix** unless an identified indexing
cause was actually fixed.

## HTTPS redirects (not configured)

Observed on 2026-08-19: the apex domain serves a complete `200` response over
plain HTTP, including deep EN/TH/RU paths and query strings. The HTTPS response
does send `Strict-Transport-Security: max-age=63072000; includeSubDomains`, but
that header cannot protect a visitor's first plain-HTTP request. Google Search
Console has also discovered an HTTP copy of a landing page.

This is a Cloudflare zone setting, not an application redirect. In the
family-owned Cloudflare account:

1. Open **SSL/TLS → Edge Certificates** and enable **Always Use HTTPS**. Confirm
   that the zone's SSL/TLS encryption mode is not `Off`.
2. Verify the redirect without following it:

   ```sh
   curl -I 'http://apple-vegan-cafe.com/vegan-breakfast-pattaya/?utm_source=redirect-check'
   ```

   The response must be a single permanent `301` or `308`; `Location` must be
   the identical HTTPS host, path, and query string.

3. Spot-check `/`, one `/th/` path, and one `/ru/` path. No HTTP response may
   serve a `200` body. Each final HTTPS target must return `200` and retain the
   HSTS header above without a redirect loop.
4. Re-inspect the known HTTP URL in Search Console after Google recrawls it.

Keep the deploy assets-only: do not add a Worker script or
`assets.run_worker_first` for this redirect. `public/_redirects` is path-based
and cannot express a scheme-wide rule. Configure `www` → apex separately with a
proxied DNS record and a zone Redirect Rule that preserves path and query.
Defer HSTS preload until both redirects cover all required subdomains and have
remained stable; the current header intentionally has no `preload` directive.

## External uptime monitor (not configured)

Current state: **monitor not configured**. The machine-readable contract at
`infrastructure/uptime-monitor.json` has `alertContact: null`; the local command
does not contact production and is not evidence that alerts exist.

Handoff contract:

- exact URLs: `https://apple-vegan-cafe.com/` and
  `https://apple-vegan-cafe.com/menu/`;
- expected HTTP status: `200` for both;
- required response keyword: `Apple Vegan Cafe` for both (stable across EN/TH/RU);
- cadence: every 300 seconds; timeout: 15 seconds;
- alert contact: currently `null`, so no external monitor may be described as
  configured.

Before creating anything externally, run `pnpm build` and then
`pnpm monitor:check`. In the family-owned monitoring account, create two
HTTP/keyword monitors with the exact contract above, attach a confirmed alert
contact, and send a provider test alert. Only after both checks and the test
alert succeed may `alertContact` and `state` be updated in the spec and this
section record the provider, non-secret contact reference, monitor IDs, owner,
and configuration date. Do not commit a private email address, phone number, API
key, or recovery code.

## Dependency updates

Renovate opens grouped PRs; minor/patch automerge when CI is green. Major
updates wait for a human. TypeScript is intentionally capped at 6.x
(renovate.json comment explains why; revisit at TS 7.1).

## Contacts

- Developer: TODO
- Cloudflare account owner: TODO
- GitHub org/repo admin: TODO
