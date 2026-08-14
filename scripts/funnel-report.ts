/**
 * Builds a deterministic 30-day funnel baseline from a privacy-safe aggregate CSV export.
 *
 * Usage:
 *   pnpm funnel:report -- <export.csv>
 *
 * The command is read-only. See docs/funnel-report.md for the strict export contract.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredColumns = ['date', 'page_path', 'event_name', 'provider', 'count'] as const;
const requiredEvents = [
  'page_view',
  'order_click',
  'phone_click',
  'directions_click',
  'review_click',
] as const;
const actionEvents = new Set<string>(requiredEvents.slice(1));
const locales = ['en', 'th', 'ru'] as const;

type Locale = (typeof locales)[number];

interface CsvRecord {
  cells: string[];
  recordNumber: number;
}

interface AggregateRow {
  date: string;
  pagePath: string;
  eventName: string;
  provider: string;
  count: number;
}

interface FunnelMetric {
  pageViews: number;
  menuViews: number;
  actions: number;
  menuActions: number;
}

function parseCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let recordNumber = 1;

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell.length > 0) throw new Error(`unexpected quote in CSV record ${recordNumber}`);
      inQuotes = true;
    } else if (character === ',') {
      cells.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      cells.push(cell);
      cell = '';
      if (cells.some((value) => value.trim().length > 0)) {
        records.push({ cells, recordNumber });
        recordNumber++;
      }
      cells = [];
    } else {
      cell += character;
    }
  }

  if (inQuotes) throw new Error(`unclosed quote in CSV record ${recordNumber}`);
  cells.push(cell);
  if (cells.some((value) => value.trim().length > 0)) records.push({ cells, recordNumber });
  return records;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function calendarDateInBangkok(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function normalizePagePath(value: string): string | null {
  const path = value.trim();
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[?#\\\s]/.test(path) ||
    path.includes('//')
  ) {
    return null;
  }
  return path === '/' ? path : `${path.replace(/\/+$/, '')}/`;
}

function localeForPath(path: string): Locale {
  if (/^\/th(?:\/|$)/.test(path)) return 'th';
  if (/^\/ru(?:\/|$)/.test(path)) return 'ru';
  return 'en';
}

function isMenuPath(path: string, locale: Locale): boolean {
  const expected = locale === 'en' ? '/menu/' : `/${locale}/menu/`;
  return path === expected;
}

function emptyMetric(): FunnelMetric {
  return { pageViews: 0, menuViews: 0, actions: 0, menuActions: 0 };
}

function checkedAdd(current: number, increment: number, label: string): number {
  const total = current + increment;
  if (!Number.isSafeInteger(total))
    throw new Error(`${label} exceeds JavaScript safe integer range`);
  return total;
}

function rate(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(2)}%` : 'INSUFFICIENT DATA';
}

function table(headers: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

function printInvalid(errors: string[]): never {
  console.error('INVALID EXPORT');
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

function printInsufficient(reasons: string[]): never {
  console.log('INSUFFICIENT DATA');
  for (const reason of [...new Set(reasons)]) console.log(`- ${reason}`);
  process.exit(2);
}

const rawInputArgs = process.argv.slice(2);
const inputArgs = rawInputArgs[0] === '--' ? rawInputArgs.slice(1) : rawInputArgs;
if (inputArgs.length !== 1 || inputArgs[0] === '--help' || inputArgs[0] === '-h') {
  const stream = inputArgs[0] === '--help' || inputArgs[0] === '-h' ? console.log : console.error;
  stream('usage: pnpm funnel:report -- <export.csv>');
  process.exit(inputArgs.length === 1 ? 0 : 1);
}

let records: CsvRecord[];
try {
  const source = readFileSync(resolve(inputArgs[0]!), 'utf8').replace(/^\uFEFF/, '');
  records = parseCsv(source);
} catch (error) {
  printInvalid([error instanceof Error ? error.message : 'could not read CSV']);
}

const headerRecord = records.shift();
if (!headerRecord) printInvalid(['CSV is empty']);

const header = headerRecord.cells.map((value) => value.trim().toLowerCase());
const headerErrors: string[] = [];
for (const column of requiredColumns) {
  const matches = header.filter((value) => value === column).length;
  if (matches === 0) headerErrors.push(`missing required column: ${column}`);
  if (matches > 1) headerErrors.push(`duplicate column: ${column}`);
}
for (const column of header) {
  if (!(requiredColumns as readonly string[]).includes(column)) {
    headerErrors.push(`unsupported column: ${column || '(empty)'}`);
  }
}
if (header.length !== requiredColumns.length) {
  headerErrors.push(`header must contain exactly ${requiredColumns.length} aggregate columns`);
}
if (headerErrors.length > 0) printInvalid(headerErrors);

const columnIndex = Object.fromEntries(header.map((column, index) => [column, index])) as Record<
  (typeof requiredColumns)[number],
  number
>;
const errors: string[] = [];
const rows: AggregateRow[] = [];
const seenDimensions = new Set<string>();

for (const record of records) {
  if (record.cells.length !== header.length) {
    errors.push(
      `record ${record.recordNumber}: expected ${header.length} cells, got ${record.cells.length}`,
    );
    continue;
  }

  const get = (column: (typeof requiredColumns)[number]) =>
    (record.cells[columnIndex[column]] ?? '').trim();
  const date = get('date');
  const rawPagePath = get('page_path');
  const eventName = get('event_name').toLowerCase();
  const provider = get('provider').toLowerCase();
  const rawCount = get('count');
  const pagePath = normalizePagePath(rawPagePath);

  if (!isCalendarDate(date)) errors.push(`record ${record.recordNumber}: invalid date ${date}`);
  if (!pagePath) errors.push(`record ${record.recordNumber}: invalid page_path ${rawPagePath}`);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(eventName)) {
    errors.push(`record ${record.recordNumber}: invalid event_name ${eventName}`);
  }
  if (provider && !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(provider)) {
    errors.push(`record ${record.recordNumber}: invalid provider ${provider}`);
  }
  if (eventName === 'page_view' && provider) {
    errors.push(`record ${record.recordNumber}: page_view provider must be empty`);
  }
  if (actionEvents.has(eventName) && !provider) {
    errors.push(`record ${record.recordNumber}: ${eventName} requires provider`);
  }
  if (!/^(?:0|[1-9]\d*)$/.test(rawCount)) {
    errors.push(`record ${record.recordNumber}: count must be a non-negative integer`);
  }
  const count = Number(rawCount);
  if (!Number.isSafeInteger(count)) {
    errors.push(`record ${record.recordNumber}: count exceeds JavaScript safe integer range`);
  }

  if (!isCalendarDate(date) || !pagePath || !Number.isSafeInteger(count) || count < 0) continue;
  const dimensions = [date, pagePath, eventName, provider].join('\u0000');
  if (seenDimensions.has(dimensions)) {
    errors.push(`record ${record.recordNumber}: duplicate aggregate dimensions`);
    continue;
  }
  seenDimensions.add(dimensions);
  rows.push({ date, pagePath, eventName, provider, count });
}

if (errors.length > 0) printInvalid(errors);

const dates = [...new Set(rows.map((row) => row.date))].sort();
const insufficient: string[] = [];
if (dates.length !== 30)
  insufficient.push(`expected exactly 30 distinct dates, got ${dates.length}`);
if (dates.length > 0) {
  const start = dates[0]!;
  const expectedDates = Array.from({ length: 30 }, (_, index) => addDays(start, index));
  const missingDates = expectedDates.filter((date) => !dates.includes(date));
  const unexpectedDates = dates.filter((date) => !expectedDates.includes(date));
  if (missingDates.length > 0)
    insufficient.push(`missing calendar dates: ${missingDates.join(', ')}`);
  if (unexpectedDates.length > 0) {
    insufficient.push(
      `dates fall outside one consecutive 30-day window: ${unexpectedDates.join(', ')}`,
    );
  }
  const latest = dates.at(-1)!;
  if (latest >= calendarDateInBangkok()) {
    insufficient.push(`latest date ${latest} is not a completed Asia/Bangkok calendar day`);
  }
}

const actionProviderKeys = [
  ...new Set(
    rows
      .filter((row) => actionEvents.has(row.eventName))
      .map((row) => `${row.eventName}\u0000${row.provider}`),
  ),
].sort();
for (const date of dates) {
  for (const locale of locales) {
    const localeRows = rows.filter(
      (row) => row.date === date && localeForPath(row.pagePath) === locale,
    );
    const missingEvents = requiredEvents.filter(
      (eventName) => !localeRows.some((row) => row.eventName === eventName),
    );
    if (missingEvents.length > 0) {
      insufficient.push(
        `${date} ${locale} is missing required event rows: ${missingEvents.join(', ')}`,
      );
    }
    if (
      !localeRows.some((row) => row.eventName === 'page_view' && isMenuPath(row.pagePath, locale))
    ) {
      insufficient.push(`${date} ${locale} is missing its menu page_view row`);
    }

    const missingProviders = actionProviderKeys.filter((key) => {
      const [eventName, provider] = key.split('\u0000');
      return !localeRows.some((row) => row.eventName === eventName && row.provider === provider);
    });
    if (missingProviders.length > 0) {
      insufficient.push(
        `${date} ${locale} is missing observed provider rows: ${missingProviders
          .map((key) => key.replace('\u0000', '/'))
          .join(', ')}`,
      );
    }
  }
}

if (insufficient.length > 0) printInsufficient(insufficient);

const totals = emptyMetric();
const byLocale = new Map<Locale, FunnelMetric>(locales.map((locale) => [locale, emptyMetric()]));
const byProvider = new Map<string, { count: number; events: Map<string, number> }>();
let ignoredEventCount = 0;

try {
  for (const row of rows) {
    const locale = localeForPath(row.pagePath);
    const localeMetric = byLocale.get(locale)!;
    const menuPath = isMenuPath(row.pagePath, locale);

    if (row.eventName === 'page_view') {
      totals.pageViews = checkedAdd(totals.pageViews, row.count, 'total page views');
      localeMetric.pageViews = checkedAdd(
        localeMetric.pageViews,
        row.count,
        `${locale} page views`,
      );
      if (menuPath) {
        totals.menuViews = checkedAdd(totals.menuViews, row.count, 'total menu views');
        localeMetric.menuViews = checkedAdd(
          localeMetric.menuViews,
          row.count,
          `${locale} menu views`,
        );
      }
      continue;
    }

    if (!actionEvents.has(row.eventName)) {
      ignoredEventCount = checkedAdd(ignoredEventCount, row.count, 'ignored event count');
      continue;
    }

    totals.actions = checkedAdd(totals.actions, row.count, 'total actions');
    localeMetric.actions = checkedAdd(localeMetric.actions, row.count, `${locale} actions`);
    if (menuPath) {
      totals.menuActions = checkedAdd(totals.menuActions, row.count, 'total menu actions');
      localeMetric.menuActions = checkedAdd(
        localeMetric.menuActions,
        row.count,
        `${locale} menu actions`,
      );
    }

    const providerMetric = byProvider.get(row.provider) ?? { count: 0, events: new Map() };
    providerMetric.count = checkedAdd(
      providerMetric.count,
      row.count,
      `${row.provider} provider actions`,
    );
    providerMetric.events.set(
      row.eventName,
      checkedAdd(
        providerMetric.events.get(row.eventName) ?? 0,
        row.count,
        `${row.provider} ${row.eventName} actions`,
      ),
    );
    byProvider.set(row.provider, providerMetric);
  }
} catch (error) {
  printInvalid([error instanceof Error ? error.message : 'aggregate total overflow']);
}

if (totals.pageViews === 0) {
  printInsufficient(['the complete window contains no page_view count above zero']);
}

const providerRows = [...byProvider.entries()].sort(
  ([providerA, metricA], [providerB, metricB]) =>
    metricB.count - metricA.count || providerA.localeCompare(providerB),
);
const localeRows = locales.map((locale) => {
  const metric = byLocale.get(locale)!;
  return [
    locale,
    String(metric.pageViews),
    String(metric.menuViews),
    rate(metric.menuViews, metric.pageViews),
    String(metric.actions),
    String(metric.menuActions),
    rate(metric.menuActions, metric.menuViews),
    rate(metric.actions, metric.pageViews),
  ];
});
const providerTableRows = providerRows.map(([provider, metric]) => {
  const eventMix = [...metric.events.entries()]
    .sort(([eventA], [eventB]) => eventA.localeCompare(eventB))
    .map(([eventName, count]) => `${eventName}=${count}`)
    .join(', ');
  return [
    provider,
    String(metric.count),
    eventMix,
    rate(metric.count, totals.actions),
    rate(metric.count, totals.pageViews),
  ];
});

const discoveryLocale = locales
  .map((locale) => {
    const metric = byLocale.get(locale)!;
    return { locale, metric, gap: Math.max(metric.pageViews - metric.menuViews, 0) };
  })
  .filter(({ metric }) => metric.pageViews > 0)
  .sort(
    (a, b) =>
      b.gap - a.gap || b.metric.pageViews - a.metric.pageViews || a.locale.localeCompare(b.locale),
  )[0];
const actionLocale = locales
  .map((locale) => {
    const metric = byLocale.get(locale)!;
    return { locale, metric, gap: Math.max(metric.menuViews - metric.menuActions, 0) };
  })
  .filter(({ metric }) => metric.menuViews > 0)
  .sort(
    (a, b) =>
      b.gap - a.gap || b.metric.menuViews - a.metric.menuViews || a.locale.localeCompare(b.locale),
  )[0];
const lowestProvider = [...providerRows].sort(
  ([providerA, metricA], [providerB, metricB]) =>
    metricA.count - metricB.count || providerA.localeCompare(providerB),
)[0];

const opportunities = [
  discoveryLocale
    ? `Menu discovery (${discoveryLocale.locale}): ${discoveryLocale.metric.menuViews}/${discoveryLocale.metric.pageViews} page views were menu views (${rate(discoveryLocale.metric.menuViews, discoveryLocale.metric.pageViews)}). Test a clearer Menu path on the highest-volume non-menu entry pages; this is an event ratio, not a unique-user journey.`
    : 'INSUFFICIENT DATA — no locale has page views.',
  actionLocale
    ? `Menu CTA (${actionLocale.locale}): ${actionLocale.metric.menuActions}/${actionLocale.metric.menuViews} tracked order/phone/directions/review actions occurred on menu paths (${rate(actionLocale.metric.menuActions, actionLocale.metric.menuViews)}). Review above-the-fold action labels and placement; event counts may include repeat clicks.`
    : 'INSUFFICIENT DATA — no locale has menu page views.',
  lowestProvider
    ? `Channel visibility (${lowestProvider[0]}): ${lowestProvider[1].count} tracked action(s), ${rate(lowestProvider[1].count, totals.actions)} of mandatory actions. It is the lowest observed provider; check link availability and placement before interpreting this as guest demand.`
    : 'INSUFFICIENT DATA — no provider action rows are available.',
];

const output = [
  '# 30-day funnel report',
  '',
  `Window: ${dates[0]}..${dates.at(-1)} (30 complete calendar days, Asia/Bangkok)`,
  `Accepted aggregate rows: ${rows.length}`,
  'Privacy: aggregate counts only; no user, session, contact or query-string fields accepted.',
  'Interpretation: these are event/page-view ratios, not unique-user or session conversion rates.',
  '',
  '## Totals',
  '',
  `- Site page views (find proxy): ${totals.pageViews}`,
  `- Menu page views: ${totals.menuViews}`,
  `- Find → menu ratio: ${rate(totals.menuViews, totals.pageViews)}`,
  `- Mandatory actions (order + phone + directions + review): ${totals.actions}`,
  `- Mandatory actions on menu paths: ${totals.menuActions}`,
  `- Menu → action ratio: ${rate(totals.menuActions, totals.menuViews)}`,
  `- Site view → action ratio: ${rate(totals.actions, totals.pageViews)}`,
  '',
  '## By locale',
  '',
  ...table(
    [
      'Locale',
      'Page views',
      'Menu views',
      'Find → menu',
      'Actions',
      'Menu actions',
      'Menu → action',
      'View → action',
    ],
    localeRows,
  ),
  '',
  '## By provider',
  '',
  ...table(
    ['Provider', 'Actions', 'Event mix', 'Share of actions', 'Actions / page views'],
    providerTableRows,
  ),
  '',
  '## Top 3 evidence-backed opportunities',
  '',
  ...opportunities.map((opportunity, index) => `${index + 1}. ${opportunity}`),
  '',
  `Ignored optional event count: ${ignoredEventCount}`,
];

console.log(output.join('\n'));
