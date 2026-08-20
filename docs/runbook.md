# Runbook

## The site is down

1. Check https://apple-vegan-cafe.com and https://apple-vegan-cafe.com/menu/.
   The site is static on Cloudflare — real downtime is almost always DNS/domain,
   not "the server". Check an external alert only after the monitor state below
   is recorded as **configured**.
2. Check domain expiry in the Cloudflare dashboard (auto-renew must be ON).
3. Cloudflare status: https://www.cloudflarestatus.com
4. A deploy that fails before Wrangler publishes keeps the last good version
   serving. Open the merge commit's GitHub Actions **CI** run: production deploy
   is the final job and cannot start until the full verification job passes. If
   Wrangler succeeded but the following availability check failed, the new
   artifact is already released and needs inspection or a merge-safe revert.

## Owner can't edit via /admin

- Fallback that always works: edit files directly on github.com (web UI) —
  `src/content/dishes/*.json` for prices/availability.
- If Sveltia itself is broken: swap the pinned script in
  `public/admin/index.html` to Decap CMS (same config.yml works).
- OAuth errors: re-check the sveltia-cms-auth Worker and its two secrets
  (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) in the Cloudflare dashboard.

## Changes don't appear on the site

1. Open the merge commit's GitHub Actions **CI** run and wait for both jobs.
   Verification currently includes browser and Lighthouse checks, so allow about
   5–7 minutes before treating a running job as stuck.
2. A red **verify** job usually means invalid content or a failed quality gate;
   the error names the file, field or check. For a red **Deploy verified main /
   deploy** job, inspect the failed step. If **Deploy current verified main**
   failed, publication is unconfirmed: inspect Wrangler output and the live
   URLs. If that step succeeded and **Check live production availability**
   failed, the artifact was released but live home/menu did not meet the
   contract.
3. Fix the file or revert the offending merge through a new PR. The next green
   `verify → deploy` chain releases the replacement; never bypass CI with a
   local production deploy. Do not use **Re-run all jobs** on an older main run:
   the release job compares its verified SHA with live `main` and rejects stale
   runs. Re-running a failed deploy is valid only while that run's SHA is still
   current `main` and its one-day artifact is available.

The pre-2026-08-20 standalone `Deploy` workflow (legacy workflow ID
`314276139`) is retired: removing its path put GitHub's workflow state at
`deleted`. Its still-rerunnable run history was removed during the gated-release
migration because those historical runs contain the old unguarded deployment
definition. Do not recreate that workflow; production releases belong only to
`CI → Deploy verified main`.

The deploy job targets the GitHub `production` environment, whose deployment
branch policy allows only `main`. `CLOUDFLARE_API_TOKEN` belongs only in that
environment; do not keep a repository-scoped copy, because repository secrets
are available to workflows on collaborator branches. To rotate the token, add
the replacement environment secret first, verify one current-main release, then
delete the old GitHub secret and revoke the old Cloudflare token.

## Roll back a bad release

1. In GitHub Actions, record the last known-good successful **CI** run and its
   commit SHA. Confirm that its final deploy job completed successfully.
2. Identify the offending merge commit. Create a rollback branch from current
   `main`, run `git revert -m 1 <bad-merge-sha>` (parent 1 is `main`), and open
   a PR. For a single-parent direct or squash commit, use
   `git revert <bad-commit-sha>` instead. Do not force-push `main` or re-run an
   unverified old artifact.
3. Review that the revert removes only the bad change, merge it, and wait for
   the same `verify → deploy` chain. Confirm `/` and `/menu/` on the resulting
   merge SHA. Cloudflare keeps serving the previous deployed version until the
   replacement artifact is successfully activated.

## Backups

- Content + code + history: this git repository (GitHub + every local clone).
  Quarterly: `git clone` onto the family laptop.
- NOT in git (document changes here): Cloudflare dashboard settings — DNS
  records, domain auto-renew, the sveltia-auth Worker secrets, Email Routing
  rules. GitHub settings: collaborators, the OAuth app, Actions deploy secret
  and public build variables.

## Google Search Console (configured)

Authenticated Search Console evidence refreshed on 2026-08-20:

- the verified domain property is `sc-domain:apple-vegan-cafe.com`;
- `https://apple-vegan-cafe.com/sitemap-index.xml` was resubmitted and last read
  on 2026-08-20; GSC reports **Success** with 31 discovered pages. The live
  sitemap currently contains 32 canonical URLs, so recheck after processing
  instead of treating the immediate one-URL gap as a submission failure;
- the Page indexing report last updated on 2026-08-17 and reported 15 indexed
  and 20 not-indexed URLs. This is an operating baseline, not a promise that
  every sitemap URL is indexed;
- URL Inspection reported both corrected EN/RU delivery landings indexed and
  accepted both into the priority crawl queue on 2026-08-20. The EN live test
  also reported that the current page is available to Google;
- the high-intent EN breakfast landing and the TH homepage remained
  `Discovered - currently not indexed` with no crawl date. Google accepted both
  into the priority crawl queue on 2026-08-20. This is a crawl request, not
  proof that either URL has since been indexed.

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

## Post-deploy live availability check

Every verified `main` deploy checks the live home and menu responses against
the same status/keyword contract below. The deploy job retries briefly to avoid
one transient network or edge response and fails visibly if production still
does not match. For a manual diagnostic run, use
`pnpm monitor:check --live`.

This is a release check, not continuous monitoring: it cannot detect an outage
that begins later and it does not prove that anyone receives an alert. It also
checks availability, not whether every edge is already serving this exact Git
SHA; the current-main and artifact-digest gates provide the release identity.

## Best-effort GitHub live probe

`.github/workflows/live-probe.yml` requests the same live home/menu check once
an hour at minute 17 and also supports a manual run. It uses only read access,
installs no packages, receives no secrets and cannot deploy or change the site.
The check retries three times before failing. The schedule actor's GitHub
Actions setting was confirmed on 2026-08-20 to email failed workflows; the
recipient is intentionally not stored in the repository.

This is a fallback signal, not a guaranteed monitor or SLA. GitHub may delay or
drop scheduled runs, runs schedules only from the default branch, and disables
scheduled workflows in a public repository after 60 days without activity.
Notifications depend on the schedule actor's current personal settings and move
to the user who later edits the cron schedule or re-enables the workflow. Check
the Actions history after an ownership or schedule change.

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

GitHub's dependency graph, Dependabot alerts and Dependabot security updates
are enabled. Security update PRs must pass the same protected `verify` check as
any other PR; they are not auto-merged. Check the current settings with:

```sh
gh api --include repos/kostia7alania/apple-vegan-cafe/vulnerability-alerts
gh api repos/kostia7alania/apple-vegan-cafe/automated-security-fixes
```

The activation snapshot on 2026-08-20 contained 860 dependency-graph packages
and 19 open alerts (10 high, 8 medium, 1 low). `pnpm audit` is useful for local
triage but is deliberately not a release gate: the public site is static, most
findings are in the build graph, and remediation still needs the normal PR
verification.

`renovate.json` remains a future version-update policy, but Renovate is not
installed and does not currently open PRs. If the app is installed later,
review its automerge policy before enabling it. TypeScript is intentionally
capped at 6.x (the config comment explains why; revisit at TS 7.1).

## Contacts

- Developer: TODO
- Cloudflare account owner: TODO
- GitHub org/repo admin: TODO
