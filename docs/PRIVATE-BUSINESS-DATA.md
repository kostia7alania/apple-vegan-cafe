# Private business data boundary

This public repository stores the website and the tools that operate on private business
snapshots. It must never store the snapshots themselves, even if the repository is later
made private. Website collaborators, CI jobs and installed GitHub Apps do not need access
to customer, order, finance, tax or account data.

## Storage contract

Keep each snapshot in one of these locations:

- `grab-backup.local/YYYY-MM-DD/`, covered by the repository's `*.local` ignore rule; or
- a separate encrypted private store/repository with its own least-privilege access list.

The snapshot can contain immutable raw payloads, reports, ItemID-keyed assets, normalized
tables, derived AI context and a local dashboard. Do not force-add an ignored snapshot or
move it to a tracked directory. Never store passwords, OTPs, cookies, authorization
headers, private keys or live signed URLs. Keep any invoice-decryption value in a password
manager or other secret store, separate from the invoices it unlocks.

Before processing a snapshot, the Grab tools resolve the real output path and fail closed
when it points at `public/`, `src/`, `dist/`, `.git/`, the repository root or any other
non-ignored path inside this checkout. Paths outside the checkout are allowed.

## Repository gate

Run:

```bash
pnpm privacy:check
pnpm build
pnpm privacy:check -- --dist
```

The checker rejects tracked `*.local`/private backup paths and tracked CSV, spreadsheet,
PDF or ZIP exports anywhere in the repository. Known private report/context filenames and
generated confidentiality markers in tracked JSON, Markdown or HTML are rejected too,
even after a file is copied outside the snapshot. The public source/build scan additionally
rejects known confidential markers, private-export files and every symlink. CI runs the
`--dist` form after every production build and before the artifact can deploy. This gate
reduces accidental disclosure; it is not encryption or an access-control layer.

## AI entry point

After the source snapshot has been normalized, run the private commands against its exact
path. An authorized agent should read `ai/AGENT-BRIEF.md`, then
`ai/business-context.json`, and follow `sourceIndex` only when exact evidence is required.
The derived context must omit customer identities and order IDs while preserving periods,
confidence, missing datasets and source paths.

## Dashboard boundary

`dashboard/index.html` is generated inside the private snapshot. It is safe to open
locally but must never be copied into `public/`, `src/` or `dist/`.

The public `/admin` route is a static CMS client, not an authorization boundary. A future
online analytics surface requires a separate authenticated service that returns only the
minimum necessary aggregates; it must not import the raw snapshot into Astro.

## Decision discipline

- Keep source payloads immutable; regenerate derived AI/dashboard files when needed.
- Preserve missing and unavailable datasets explicitly; unknown never becomes zero.
- Log each price, photo, hours, SEO, promotion or operations change before measuring it.
- Every recommendation names its evidence period, confidence, metric and a falsifiable
  next action.
- Correlation suggests where to test. It is not proof of cause or ROI.
