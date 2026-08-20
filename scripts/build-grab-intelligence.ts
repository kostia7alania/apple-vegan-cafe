/**
 * Builds a PII-minimized AI context and local-only dashboard from a private Grab snapshot.
 * Usage: pnpm grab:intelligence -- grab-backup.local/YYYY-MM-DD
 */
import { readFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import {
  ensurePrivateOutputDirectory,
  resolvePrivateBackupRoot,
  writePrivateFileAtomic,
} from './private-backup-path';

type CsvRow = Record<string, string>;
type Confidence = 'high' | 'medium' | 'low';

interface DailySale {
  date: string;
  netSalesThb: number;
  transactions: number;
}

interface Recommendation {
  priority: number;
  title: string;
  confidence: Confidence;
  evidence: string[];
  nextAction: string;
  primaryMetric: string;
  caveat: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('unclosed quote in CSV');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function readCsv(path: string): Promise<CsvRow[]> {
  const rows = parseCsv((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  const header = rows.shift();
  if (!header) throw new Error(`CSV is empty: ${path}`);
  if (new Set(header).size !== header.length) throw new Error(`CSV has duplicate columns: ${path}`);
  return rows.map((cells, index) => {
    if (cells.length !== header.length) {
      throw new Error(
        `${basename(path)} row ${index + 2} has ${cells.length} cells; expected ${header.length}`,
      );
    }
    return Object.fromEntries(header.map((column, cellIndex) => [column, cells[cellIndex]!]));
  });
}

function n(value: string | number | undefined, label = 'numeric value'): number {
  if (value === undefined || String(value).trim() === '') throw new Error(`${label} is blank`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a finite number`);
  return parsed;
}

function nonnegative(value: string | number | undefined, label: string, integer = false): number {
  const parsed = n(value, label);
  if (parsed < 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} must be a non-negative${integer ? ' integer' : ''}`);
  }
  return parsed;
}

function requiredText(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === '') throw new Error(`${label} is blank`);
  return value;
}

function calendarDate(value: string | undefined, label: string): string {
  const text = requiredText(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} is not YYYY-MM-DD`);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${label} is not a calendar date`);
  }
  return text;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundNullable(value: number | null, digits = 1): number | null {
  return value === null ? null : round(value, digits);
}

function percentChange(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null && previous > 0
    ? (current / previous - 1) * 100
    : null;
}

function formatPercent(value: number | null): string {
  return value === null ? 'n/a' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function baht(value: number | null): string {
  return value === null ? 'n/a' : `฿${Math.round(value).toLocaleString('en-US')}`;
}

function formatRatio(value: number | null): string {
  return value === null ? 'n/a' : `${value}%`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

type DailyCoverage = 'complete-daily' | 'partial-observed' | 'unavailable';

function dailyCoverage(
  dates: string[],
  from: string,
  through: string,
  label: string,
): DailyCoverage {
  if (dates.length === 0) return 'unavailable';
  const uniqueDates = new Set(dates);
  if (uniqueDates.size !== dates.length) throw new Error(`${label} contains duplicate dates`);

  const expectedDates = new Set<string>();
  for (let date = from; date <= through; date = addDays(date, 1)) expectedDates.add(date);
  return uniqueDates.size === expectedDates.size &&
    [...expectedDates].every((date) => uniqueDates.has(date))
    ? 'complete-daily'
    : 'partial-observed';
}

function capturedTotal(values: number[], coverage: DailyCoverage): number | null {
  if (coverage === 'unavailable') return null;
  const total = sum(values);
  // A zero is a claim about the whole period only when every day is present.
  return coverage === 'complete-daily' || total > 0 ? total : null;
}

function monday(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function correlation(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 4) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index++) {
    const leftDelta = left[index]! - leftMean;
    const rightDelta = right[index]! - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquare += leftDelta ** 2;
    rightSquare += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftSquare * rightSquare);
  return denominator > 0 ? round(numerator / denominator, 3) : null;
}

function periodTotals(rows: DailySale[]) {
  const netSalesThb = sum(rows.map((row) => row.netSalesThb));
  const transactions = sum(rows.map((row) => row.transactions));
  return {
    netSalesThb: round(netSalesThb, 2),
    transactions,
    averageTicketThb: transactions > 0 ? round(netSalesThb / transactions, 2) : null,
  };
}

function sparkline(values: number[], label: string): string {
  if (values.length === 0) return '';
  const width = 720;
  const height = 180;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 12) - 6;
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="5" vector-effect="non-scaling-stroke" /></svg>`;
}

function barRows(
  rows: Array<{ label: string; value: number }>,
  formatter: (value: number) => string,
): string {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return rows
    .map(
      (row) =>
        `<div class="bar-row"><div class="bar-label">${escapeHtml(row.label)}</div><div class="bar-track"><span style="width:${round((row.value / max) * 100)}%"></span></div><strong>${escapeHtml(formatter(row.value))}</strong></div>`,
    )
    .join('\n');
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
if (args.length !== 1 || args[0] === '--help' || args[0] === '-h') {
  const output = args.length === 1 ? console.log : console.error;
  output('usage: pnpm grab:intelligence -- <grab-backup-directory>');
  process.exit(args.length === 1 ? 0 : 1);
}

const projectRoot = resolve('.');
const backupRoot = await resolvePrivateBackupRoot(args[0]!);
const normalizedDir = await ensurePrivateOutputDirectory(backupRoot, 'normalized');

const [
  summary,
  menuItems,
  rating,
  salesCsv,
  monthlyCsv,
  itemCsv,
  peakCsv,
  offlineCsv,
  cancellationCsv,
  customerCsv,
  reviewCsv,
  forecastCsv,
  forecastMetadata,
  unavailableCsv,
  actionCsv,
] = await Promise.all([
  readFile(join(normalizedDir, 'summary.json'), 'utf8').then(JSON.parse),
  readFile(join(normalizedDir, 'menu-items-current.json'), 'utf8').then(JSON.parse),
  readFile(join(normalizedDir, 'rating-overview-current.json'), 'utf8').then(JSON.parse),
  readCsv(join(normalizedDir, 'sales-daily-alltime.csv')),
  readCsv(join(normalizedDir, 'sales-monthly-alltime.csv')),
  readCsv(join(normalizedDir, 'item-performance-current-90d.csv')),
  readCsv(join(normalizedDir, 'operations-peak-hours.csv')),
  readCsv(join(normalizedDir, 'operations-offline-daily.csv')),
  readCsv(join(normalizedDir, 'operations-cancellations-daily.csv')),
  readCsv(join(normalizedDir, 'customers-weekly-alltime.csv')),
  readCsv(join(normalizedDir, 'reviews-written-alltime.csv')),
  readCsv(join(normalizedDir, 'sales-forecast-8-weeks.csv')),
  readFile(join(normalizedDir, 'sales-forecast-metadata.json'), 'utf8').then(JSON.parse),
  readCsv(join(normalizedDir, 'unavailable-data-registry.csv')),
  readCsv(join(normalizedDir, 'business-action-log-template.csv')),
]);

if (!summary || typeof summary !== 'object' || Array.isArray(summary))
  throw new Error('summary.json must be an object');
if (!rating || typeof rating !== 'object' || Array.isArray(rating))
  throw new Error('rating-overview-current.json must be an object');
if (!Array.isArray(menuItems)) throw new Error('menu-items-current.json must be an array');

const allSales: DailySale[] = salesCsv.map((row, index) => ({
  date: calendarDate(row.Date, `sales row ${index + 2} Date`),
  netSalesThb: n(row['Net sales THB'], `sales row ${index + 2} Net sales`),
  transactions: nonnegative(row.Transactions, `sales row ${index + 2} Transactions`, true),
}));
const firstPositive = allSales.findIndex((row) => row.netSalesThb > 0 || row.transactions > 0);
if (firstPositive < 0) throw new Error('sales history contains no non-zero rows');
const sales = allSales.slice(firstPositive);
if (sales.length < 180)
  throw new Error('at least 180 daily rows are required for matched 90-day comparisons');
for (let index = 1; index < sales.length; index++) {
  if (sales[index]!.date !== addDays(sales[index - 1]!.date, 1)) {
    throw new Error(`sales history is not daily-contiguous at ${sales[index]!.date}`);
  }
}
const dataThrough = sales.at(-1)!.date;
const current28 = periodTotals(sales.slice(-28));
const previous28 = periodTotals(sales.slice(-56, -28));
const current90 = periodTotals(sales.slice(-90));
const previous90 = periodTotals(sales.slice(-180, -90));

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayPerformance = weekdays
  .map((label, day) => {
    const matching = sales
      .slice(-84)
      .filter((row) => new Date(`${row.date}T00:00:00.000Z`).getUTCDay() === day);
    return {
      label,
      averageNetSalesThb: round(mean(matching.map((row) => row.netSalesThb)), 2),
      averageTransactions: round(mean(matching.map((row) => row.transactions)), 2),
    };
  })
  .sort((left, right) => right.averageNetSalesThb - left.averageNetSalesThb);

const topItems = itemCsv
  .map((row, index) => ({
    name: requiredText(row['Grab item name'], `item row ${index + 2} Grab item name`),
    units: nonnegative(row['Units sold'], `item row ${index + 2} Units sold`, true),
    grossSalesThb: nonnegative(row['Gross sales THB'], `item row ${index + 2} Gross sales`),
    trendPct: n(row['Sales trend %'], `item row ${index + 2} Sales trend`),
  }))
  .sort((left, right) => right.grossSalesThb - left.grossSalesThb);
const itemRevenueTotal = sum(topItems.map((item) => item.grossSalesThb));
const top10RevenueSharePct =
  itemRevenueTotal > 0
    ? round((sum(topItems.slice(0, 10).map((item) => item.grossSalesThb)) / itemRevenueTotal) * 100)
    : null;

const peakHoursMap = new Map<number, number>();
for (const [index, row] of peakCsv.entries()) {
  const hour = nonnegative(row['Local hour'], `peak row ${index + 2} Local hour`, true);
  if (hour > 23) throw new Error(`peak row ${index + 2} Local hour must be at most 23`);
  const transactions = nonnegative(row.Transactions, `peak row ${index + 2} Transactions`, true);
  peakHoursMap.set(hour, (peakHoursMap.get(hour) ?? 0) + transactions);
}
const peakHours = [...peakHoursMap.entries()]
  .map(([hour, transactions]) => ({ hour, transactions }))
  .sort((left, right) => right.transactions - left.transactions);

const recentCutoff = addDays(dataThrough, -89);
const validatedOffline = offlineCsv.map((row, index) => ({
  date: calendarDate(row.Date, `offline row ${index + 2} Date`),
  status: requiredText(row['Store status'], `offline row ${index + 2} Store status`),
  offlineMinutes: nonnegative(row['Offline minutes'], `offline row ${index + 2} Offline minutes`),
}));
const recentOffline = validatedOffline.filter(
  (row) => row.date >= recentCutoff && row.date <= dataThrough,
);
const recentOpenDays = recentOffline.filter((row) => row.status === 'open');
const offlineCoverage = dailyCoverage(
  recentOffline.map((row) => row.date),
  recentCutoff,
  dataThrough,
  'offline dataset',
);
const offlineMinutes90 = capturedTotal(
  recentOpenDays.map((row) => row.offlineMinutes),
  offlineCoverage,
);
const salesByDate = new Map(sales.map((row) => [row.date, row.netSalesThb]));
const offlinePairs = recentOpenDays.filter((row) => salesByDate.has(row.date));
const validatedCancellations = cancellationCsv.map((row, index) => ({
  date: calendarDate(row.Date, `cancellation row ${index + 2} Date`),
  cancelledOrders: nonnegative(
    row['Cancelled orders'],
    `cancellation row ${index + 2} Cancelled orders`,
    true,
  ),
}));
const recentCancellations = validatedCancellations.filter(
  (row) => row.date >= recentCutoff && row.date <= dataThrough,
);
const cancellationCoverage = dailyCoverage(
  recentCancellations.map((row) => row.date),
  recentCutoff,
  dataThrough,
  'cancellation dataset',
);
const cancellations90 = capturedTotal(
  recentCancellations.map((row) => row.cancelledOrders),
  cancellationCoverage,
);

const salesByWeek = new Map<string, number>();
for (const row of sales) {
  const week = monday(row.date);
  salesByWeek.set(week, (salesByWeek.get(week) ?? 0) + row.netSalesThb);
}
const customerSeries = customerCsv.flatMap((row, index) => {
  const week = calendarDate(row.Week, `customer row ${index + 2} Week`);
  // Grab overlap exports can include a boundary fragment labelled by its first date.
  // Only full Monday-start weeks are comparable to the sales-week aggregation.
  if (new Date(`${week}T00:00:00.000Z`).getUTCDay() !== 1) return [];
  if (week < sales[0]!.date || addDays(week, 6) > dataThrough) return [];
  const salesThb = salesByWeek.get(week);
  if (salesThb === undefined) {
    throw new Error(`customer row ${index + 2} has no matching complete sales week`);
  }
  return [
    {
      week,
      total: nonnegative(row['Total customers'], `customer row ${index + 2} Total`, true),
      newCustomers: nonnegative(
        row['New customers'],
        `customer row ${index + 2} New customers`,
        true,
      ),
      repeatCustomers: nonnegative(
        row['Repeat customers'],
        `customer row ${index + 2} Repeat customers`,
        true,
      ),
      reactivated: nonnegative(
        row['Reactivated or infrequent'],
        `customer row ${index + 2} Reactivated customers`,
        true,
      ),
      salesThb,
    },
  ];
});
const customerTotals = (rows: typeof customerSeries) =>
  rows.length === 0
    ? null
    : {
        reportedWeeks: rows.length,
        from: rows[0]!.week,
        through: rows.at(-1)!.week,
        total: sum(rows.map((row) => row.total)),
        newCustomers: sum(rows.map((row) => row.newCustomers)),
        repeatCustomers: sum(rows.map((row) => row.repeatCustomers)),
        reactivated: sum(rows.map((row) => row.reactivated)),
      };
const currentCustomers = customerTotals(customerSeries.slice(-8));
const previousCustomers =
  customerSeries.length >= 16 ? customerTotals(customerSeries.slice(-16, -8)) : null;
const repeatSharePct =
  currentCustomers !== null && currentCustomers.total > 0
    ? round((currentCustomers.repeatCustomers / currentCustomers.total) * 100)
    : null;

const reviewText = reviewCsv.map((row) => row['Review text']?.toLowerCase() ?? '');
const themeRules = [
  ['Taste praise', ['delicious', 'อร่อย', 'вкусн']],
  ['Fresh / hot food', ['fresh', 'hot', 'สด', 'ร้อน']],
  ['Packaging / leakage', ['packag', 'box', 'กล่อง', 'ถุง', 'leak']],
  ['Missing / wrong item', ['missing', 'wrong', 'ไม่ได้', 'ผิด']],
  ['Salt / spice', ['salty', 'spicy', 'เค็ม', 'เผ็ด']],
  ['Portion / value', ['portion', 'price', 'small', 'แพง', 'ราคา']],
] as const;
const reviewThemes = themeRules
  .map(([label, terms]) => ({
    label,
    mentions: reviewText.filter((text) => terms.some((term) => text.includes(term))).length,
    method: 'keyword heuristic; no customer names or order IDs emitted',
  }))
  .sort((left, right) => right.mentions - left.mentions);

if (!forecastMetadata || typeof forecastMetadata !== 'object') {
  throw new Error('sales-forecast-metadata.json must be an object');
}
const forecast = forecastCsv.map((row, index) => {
  const forecastRow = {
    date: calendarDate(row.Date, `forecast row ${index + 2} Date`),
    baseThb: nonnegative(row['Forecast net sales THB'], `forecast row ${index + 2} Base`),
    lowThb: nonnegative(row['Low scenario THB'], `forecast row ${index + 2} Low`),
    highThb: nonnegative(row['High scenario THB'], `forecast row ${index + 2} High`),
  };
  if (forecastRow.lowThb > forecastRow.baseThb || forecastRow.baseThb > forecastRow.highThb) {
    throw new Error(`forecast row ${index + 2} must satisfy low <= base <= high`);
  }
  return forecastRow;
});
if (forecast.length !== 56)
  throw new Error(`forecast must contain 56 rows; found ${forecast.length}`);
const forecastSourceDataThrough = calendarDate(
  forecastMetadata.sourceDataThrough,
  'forecast sourceDataThrough',
);
if (forecastSourceDataThrough !== dataThrough) {
  throw new Error(
    `forecast sourceDataThrough ${forecastSourceDataThrough} does not match sales through ${dataThrough}`,
  );
}
if (forecast[0]!.date !== addDays(dataThrough, 1)) {
  throw new Error(`forecast must start on the day after sales data (${addDays(dataThrough, 1)})`);
}
for (let index = 1; index < forecast.length; index++) {
  if (forecast[index]!.date !== addDays(forecast[index - 1]!.date, 1)) {
    throw new Error(`forecast is not daily-contiguous at ${forecast[index]!.date}`);
  }
}
const forecastTotals = {
  from: forecast[0]?.date ?? null,
  through: forecast.at(-1)?.date ?? null,
  sourceDataThrough: forecastSourceDataThrough,
  baseThb: sum(forecast.map((row) => row.baseThb)),
  lowThb: sum(forecast.map((row) => row.lowThb)),
  highThb: sum(forecast.map((row) => row.highThb)),
  model: requiredText(forecastMetadata.selectedModel, 'forecast model'),
  modelLabel: requiredText(forecastMetadata.selectedModelLabel, 'forecast model label'),
  modelBacktestObservations: nonnegative(
    forecastMetadata.backtestObservations,
    'forecast backtest observations',
    true,
  ),
  modelBacktestWapePct: nonnegative(forecastMetadata.backtestWapePct, 'forecast backtest WAPE'),
  intervalMethod: requiredText(forecastMetadata.intervalMethod, 'forecast interval method'),
};

const correlations = [
  {
    id: 'weekly-new-customers-vs-sales',
    coefficient: correlation(
      customerSeries.map((row) => row.newCustomers),
      customerSeries.map((row) => row.salesThb),
    ),
    observations: customerSeries.length,
    interpretation:
      'Same-week association only; demand, promotions or availability can move both series.',
  },
  {
    id: 'weekly-repeat-customers-vs-sales',
    coefficient: correlation(
      customerSeries.map((row) => row.repeatCustomers),
      customerSeries.map((row) => row.salesThb),
    ),
    observations: customerSeries.length,
    interpretation: 'Grab-defined weekly observations, not deduplicated all-time customers.',
  },
  {
    id: 'open-day-offline-minutes-vs-sales',
    coefficient: correlation(
      offlinePairs.map((row) => row.offlineMinutes),
      offlinePairs.map((row) => salesByDate.get(row.date)!),
    ),
    observations: offlinePairs.length,
    interpretation:
      'Diagnostic only: offline time may cause lost demand or respond to operating pressure.',
  },
];

const topItem = topItems[0];
const bestWeekday = weekdayPerformance[0]!;
const weakestWeekday = weekdayPerformance.at(-1)!;
const completedActionRows = actionCsv.filter(
  (row) => row.status?.trim().toLowerCase() === 'completed',
).length;
const recommendations: Recommendation[] = [];
const addRecommendation = (recommendation: Omit<Recommendation, 'priority'>) => {
  recommendations.push({ priority: recommendations.length + 1, ...recommendation });
};

const operationalEvidence: string[] = [];
if (offlineMinutes90 !== null) {
  operationalEvidence.push(
    offlineCoverage === 'complete-daily'
      ? `${Math.round(offlineMinutes90)} offline minutes across the complete latest 90-day daily coverage`
      : `At least ${Math.round(offlineMinutes90)} offline minutes across ${recentOffline.length} captured dates; coverage is partial`,
  );
}
if (cancellations90 !== null) {
  operationalEvidence.push(
    cancellationCoverage === 'complete-daily'
      ? `${cancellations90} cancelled orders across the complete latest 90-day daily coverage`
      : `At least ${cancellations90} cancelled orders across ${recentCancellations.length} captured dates; coverage is partial`,
  );
}
if ((offlineMinutes90 ?? 0) > 0 || (cancellations90 ?? 0) > 0) {
  addRecommendation({
    title: 'Protect existing demand before buying more traffic',
    confidence:
      offlineCoverage === 'complete-daily' && cancellationCoverage === 'complete-daily'
        ? 'high'
        : 'medium',
    evidence: operationalEvidence,
    nextAction:
      'Review the highest-offline dates against staffing and device connectivity; log one corrective action before measuring four matched weekdays.',
    primaryMetric: 'offline minutes and completed transactions on matched weekdays',
    caveat: 'The archive cannot prove counterfactual lost orders or recovered revenue.',
  });
}

if (topItem && top10RevenueSharePct !== null) {
  addRecommendation({
    title: 'Use proven menu demand as the content queue',
    confidence: 'high',
    evidence: [
      `${topItem.name}: ${topItem.units} units and ${baht(topItem.grossSalesThb)} in the latest exact 90-day window`,
      `Top 10 items account for ${formatRatio(top10RevenueSharePct)} of measured item revenue`,
    ],
    nextAction:
      'Prioritize owner-verified descriptions, FAQ links and landing-page mentions for top sellers, preserving Grab ItemID as identity.',
    primaryMetric: 'menu-to-order clicks plus Grab units for affected ItemIDs',
    caveat: 'Sales do not verify ingredients, health benefits, recipe facts or customer reasons.',
  });
}

addRecommendation({
  title: 'Test the weak weekday instead of applying a permanent discount',
  confidence: 'medium',
  evidence: [
    `${bestWeekday.label} averages ${baht(bestWeekday.averageNetSalesThb)} over 12 weeks`,
    `${weakestWeekday.label} averages ${baht(weakestWeekday.averageNetSalesThb)} over 12 weeks`,
  ],
  nextAction:
    'Run one bounded four-week test on the weakest weekday with declared cost, stable comparison weekdays and contribution-margin target.',
  primaryMetric: 'incremental contribution after discount and Grab fees',
  caveat: 'Weather, holidays, closures, traveller mix and staffing are not joined yet.',
});

if (currentCustomers !== null && currentCustomers.total > 0) {
  const customerEvidence = [
    `${currentCustomers.newCustomers} new and ${currentCustomers.repeatCustomers} repeat observations in the latest ${currentCustomers.reportedWeeks} reported weeks`,
    `Repeat share ${formatRatio(repeatSharePct)}`,
  ];
  if (previousCustomers !== null) {
    customerEvidence.push(
      `Total observations ${formatPercent(percentChange(currentCustomers.total, previousCustomers.total))} vs the previous ${previousCustomers.reportedWeeks} reported weeks`,
    );
  }
  addRecommendation({
    title: 'Turn first orders into measured repeat demand',
    confidence: 'medium',
    evidence: customerEvidence,
    nextAction:
      'Track one retention action, then compare repeat share and contribution over 8 weeks without exporting customer identities.',
    primaryMetric: 'Grab repeat-customer share and contribution per order',
    caveat: 'Grab cohort counts are platform definitions, not an all-time customer database.',
  });
}

addRecommendation({
  title: 'Connect demand signals before claiming SEO ROI',
  confidence: 'high',
  evidence: [
    'Grab sales exist, but GA4, Search Console, Business Profile, weather and action observations are not joined',
    `${completedActionRows} completed business-action rows are available`,
  ],
  nextAction:
    'Start the action log and add weekly GSC/GBP/GA4 aggregates; then test 0–4 week lags from impressions to intent and Grab sales.',
  primaryMetric: 'search impressions → site intent → Grab transactions, with lag',
  caveat:
    'Correlation generates hypotheses; ROI requires a logged intervention, cost and comparison.',
});

const monthly = monthlyCsv
  .map((row, index) => {
    const month = requiredText(row.Month, `monthly row ${index + 2} Month`);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error(`monthly row ${index + 2} Month must be YYYY-MM`);
    }
    return {
      month,
      netSalesThb: n(row['Net sales THB'], `monthly row ${index + 2} Net sales`),
      transactions: nonnegative(row.Transactions, `monthly row ${index + 2} Transactions`, true),
      averageTicketThb: nonnegative(
        row['Average transaction THB'],
        `monthly row ${index + 2} Average transaction`,
      ),
    };
  })
  .filter((row) => row.netSalesThb > 0);

const capturedAt = requiredText(summary.capturedAt, 'summary capturedAt');
const supplementedAt =
  summary.supplementedAt === null || summary.supplementedAt === undefined
    ? null
    : requiredText(summary.supplementedAt, 'summary supplementedAt');
const ratingScore = nonnegative(rating.aggregatedRatingScore, 'rating score');
if (ratingScore > 5) throw new Error('rating score must be at most 5');
const ratingCount = nonnegative(rating.ratingCount, 'rating count', true);
const summaryMenuItems = nonnegative(summary.menu?.currentItems, 'summary menu items', true);
const summaryMenuItemsWithImages = nonnegative(
  summary.menu?.itemsWithImages,
  'summary menu items with images',
  true,
);
const summaryWrittenReviews = nonnegative(
  summary.insights?.writtenReviews,
  'summary written reviews',
  true,
);
const summaryRatingCount = nonnegative(
  summary.insights?.currentRatingCount,
  'summary rating count',
  true,
);
if (summaryWrittenReviews !== reviewCsv.length) {
  throw new Error(
    `written review coverage mismatch: summary=${summaryWrittenReviews}, rows=${reviewCsv.length}`,
  );
}
if (summaryRatingCount !== ratingCount) {
  throw new Error(`rating coverage mismatch: summary=${summaryRatingCount}, rating=${ratingCount}`);
}
const summarySalesFrom = calendarDate(summary.insights?.firstNonzeroDate, 'summary sales from');
let availableMenuItems = 0;
let menuItemsWithImages = 0;
for (const [index, item] of menuItems.entries()) {
  if (!item || typeof item !== 'object')
    throw new Error(`menu item ${index + 1} must be an object`);
  if (typeof item.available !== 'boolean') {
    throw new Error(`menu item ${index + 1} available must be boolean`);
  }
  if (item.available) availableMenuItems++;
  if (nonnegative(item.image_count, `menu item ${index + 1} image_count`, true) > 0) {
    menuItemsWithImages++;
  }
}
if (summaryMenuItems !== menuItems.length || summaryMenuItemsWithImages !== menuItemsWithImages) {
  throw new Error(
    `menu coverage mismatch: summary=${summaryMenuItems}/${summaryMenuItemsWithImages}, items=${menuItems.length}/${menuItemsWithImages}`,
  );
}

const context = {
  schemaVersion: 1,
  snapshot: {
    directory: basename(backupRoot),
    capturedAt,
    supplementedAt,
    dataThrough,
  },
  privacy: {
    classification: 'confidential-business-data',
    directCustomerOrOrderIdentifiersIncluded: false,
    contentScope:
      'aggregates, derived recommendations, coverage labels and merchant-authored menu labels',
    rawPiiExistsElsewhereInSnapshot: true,
    publicationRule:
      'Use aggregates as research context. Never publish customer, order, finance, employee, account, tax or credential data.',
  },
  evidencePolicy: {
    sourceOfTruth: 'Grab snapshot and exact normalized exports',
    unknownIsNotZero: true,
    correlationIsNotCausation: true,
    ownerVerificationRequiredFor:
      'ingredients, allergens, health/religious claims, policy, people, rights and facts absent from approved site content',
  },
  coverage: {
    menuItems: summaryMenuItems,
    menuItemsWithImages: summaryMenuItemsWithImages,
    salesFrom: summarySalesFrom,
    salesThrough: dataThrough,
    writtenReviews: summaryWrittenReviews,
    ratingCount: summaryRatingCount,
    missingDatasets: unavailableCsv.map((row) => ({
      area: row.Area,
      dataset: row['Dataset or history requested'],
      status: row['Capture status'],
      safeInterpretation: row['Safe interpretation'],
    })),
  },
  performance: {
    latest28: current28,
    previous28,
    latest28ChangePct: {
      netSales: roundNullable(percentChange(current28.netSalesThb, previous28.netSalesThb)),
      transactions: roundNullable(percentChange(current28.transactions, previous28.transactions)),
      averageTicket: roundNullable(
        percentChange(current28.averageTicketThb, previous28.averageTicketThb),
      ),
    },
    latest90: current90,
    previous90,
    latest90ChangePct: {
      netSales: roundNullable(percentChange(current90.netSalesThb, previous90.netSalesThb)),
      transactions: roundNullable(percentChange(current90.transactions, previous90.transactions)),
      averageTicket: roundNullable(
        percentChange(current90.averageTicketThb, previous90.averageTicketThb),
      ),
    },
    monthly,
    weekdayPerformance,
    forecast8Weeks: forecastTotals,
  },
  menu: {
    currentItems: menuItems.length,
    availableItems: availableMenuItems,
    itemsWithImages: menuItemsWithImages,
    top10RevenueSharePct,
    topItems: topItems.slice(0, 15),
  },
  operations: {
    offlineMinutesLatest90: offlineMinutes90,
    cancellationsLatest90: cancellations90,
    coverage: {
      offline: {
        status: offlineCoverage,
        observedRows: recentOffline.length,
        periodFrom: recentCutoff,
        periodThrough: dataThrough,
      },
      cancellations: {
        status: cancellationCoverage,
        observedRows: recentCancellations.length,
        periodFrom: recentCutoff,
        periodThrough: dataThrough,
      },
    },
    peakHours: peakHours.slice(0, 8),
  },
  customers: {
    latestReportedWeeks: currentCustomers,
    previousComparableWeeks: previousCustomers,
    repeatSharePct,
  },
  reputation: {
    rating: round(ratingScore, 2),
    ratingCount,
    writtenReviewCount: summaryWrittenReviews,
    writtenReviewCoverage: 'complete-summary-row-count-match',
    aggregateThemes: reviewThemes,
  },
  correlations,
  recommendations,
  contentQueue: topItems.slice(0, 8).map((item, index) => ({
    rank: index + 1,
    subject: item.name,
    evidence: `${item.units} units / ${baht(item.grossSalesThb)} in latest exact 90-day window`,
    safeUse:
      'Use for prioritization only. Confirm recipe, ingredients, availability and translations before publishing.',
  })),
  sourceIndex: {
    primary: [
      'normalized/summary.json',
      'normalized/sales-daily-alltime.csv',
      'normalized/item-performance-current-90d.csv',
      'normalized/menu-items-current.json',
      'normalized/operations-offline-daily.csv',
      'normalized/customers-weekly-alltime.csv',
      'normalized/rating-overview-current.json',
      'normalized/unavailable-data-registry.csv',
      'normalized/business-action-log-template.csv',
    ],
    sensitive: [
      'normalized/reviews-written-alltime.csv',
      'normalized/finance-transactions-detailed-available.csv',
      'normalized/employees-current.csv',
      'raw/finance-documents/',
      'raw/',
    ],
  },
};

const contextJson = `${JSON.stringify(context, null, 2)}\n`;

const agentBrief = `# Apple Vegan Cafe — AI decision brief

Snapshot: **${capturedAt}**, Grab sales through **${dataThrough}**. Confidential context, not public website copy.

## Direction

- Latest 28 days: **${baht(current28.netSalesThb)}**, ${current28.transactions} transactions, ${baht(current28.averageTicketThb)} average ticket. Sales ${formatPercent(percentChange(current28.netSalesThb, previous28.netSalesThb))} vs prior 28 days.
- Latest 90 days: **${baht(current90.netSalesThb)}**, ${current90.transactions} transactions. Sales ${formatPercent(percentChange(current90.netSalesThb, previous90.netSalesThb))} vs prior 90 days.
- 8-week base scenario: **${baht(forecastTotals.baseThb)}**; backtest WAPE **${forecastTotals.modelBacktestWapePct}%**, so use an operating range, not a promise.
- Best recent weekday: **${bestWeekday.label}** at ${baht(bestWeekday.averageNetSalesThb)} average; weakest: **${weakestWeekday.label}** at ${baht(weakestWeekday.averageNetSalesThb)}.
- Latest 90-day open-day offline time: **${offlineMinutes90 === null ? 'unknown' : `${Math.round(offlineMinutes90)} minutes`}** (${offlineCoverage}); cancellations: **${cancellations90 === null ? 'unknown' : cancellations90}** (${cancellationCoverage}).
- Reputation: **${round(ratingScore, 1)} / 5** from **${ratingCount} ratings**.

## Next actions

${recommendations.map((item) => `${item.priority}. **${item.title}** (${item.confidence}) — ${item.nextAction}\n   Evidence: ${item.evidence.join('; ')}.\n   Guardrail: ${item.caveat}`).join('\n')}

## Rules for agents

1. Start with \`business-context.json\`; follow source paths for exact evidence.
2. Absent data is unknown, not zero. Read \`normalized/unavailable-data-registry.csv\`.
3. Never turn sales into ingredient, health, allergen, religious or taste claims.
4. Never publish customer names, order IDs, finance, employee/account, tax or access data.
5. Recommendations require an evidence period, confidence, metric and falsifiable action.
6. Log a business action before evaluating ROI. Correlation is not proof of cause.
`;

const monthlySeries = monthly.slice(-18);
const dashboard = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <title>Private business pulse — Apple Vegan Cafe</title>
    <style>
      :root { color-scheme:dark; --bg:#11130f; --panel:#1c2119; --ink:#f5f2e8; --muted:#b9c1ae; --line:#3b4735; --accent:#a7d46f; --warm:#f0bf63; }
      * { box-sizing:border-box; }
      body { margin:0; font:16px/1.55 ui-sans-serif,system-ui,sans-serif; color:var(--ink); background:radial-gradient(circle at 85% 0,#26391d 0,transparent 32rem),var(--bg); }
      main { width:min(1180px,calc(100% - 2rem)); margin:auto; padding:2.5rem 0 5rem; }
      h1,h2,h3,p { margin-top:0; }
      h1 { max-width:14ch; font:700 clamp(2.4rem,7vw,5.8rem)/.95 ui-serif,Georgia,serif; letter-spacing:-.045em; }
      h2 { margin-bottom:1rem; font-size:1.15rem; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); }
      .eyebrow,.meta,.caveat { color:var(--muted); }
      .privacy { border:1px solid var(--warm); border-radius:999px; display:inline-flex; padding:.35rem .75rem; color:var(--warm); font-size:.82rem; font-weight:700; }
      .hero { padding:2rem 0 1rem; }
      .hero p { max-width:68ch; font-size:1.08rem; }
      .grid { display:grid; gap:1rem; }
      .metrics { grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); margin:2rem 0 3rem; }
      .card { background:color-mix(in srgb,var(--panel) 92%,transparent); border:1px solid var(--line); border-radius:1rem; padding:1.25rem; }
      .metric strong { display:block; font-size:clamp(1.7rem,4vw,2.6rem); line-height:1.1; }
      .metric span { color:var(--muted); }
      .two { grid-template-columns:minmax(0,1.45fr) minmax(260px,.75fr); margin-bottom:3rem; }
      svg { width:100%; height:14rem; color:var(--accent); overflow:visible; }
      .bar-row { display:grid; grid-template-columns:minmax(9rem,1.3fr) minmax(7rem,2fr) auto; gap:.75rem; align-items:center; margin:.8rem 0; }
      .bar-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .bar-track { height:.65rem; border-radius:999px; background:#2b3327; overflow:hidden; }
      .bar-track span { display:block; height:100%; background:linear-gradient(90deg,var(--accent),var(--warm)); border-radius:inherit; }
      .recommendations { counter-reset:priority; }
      .recommendation { position:relative; padding-left:4rem; margin-bottom:1rem; }
      .recommendation::before { counter-increment:priority; content:counter(priority); position:absolute; left:1.1rem; top:1.1rem; width:2rem; height:2rem; display:grid; place-items:center; border-radius:50%; background:var(--accent); color:#12170f; font-weight:900; }
      .recommendation h3 { margin-bottom:.35rem; }
      .tag { display:inline-block; margin-left:.4rem; padding:.1rem .45rem; border:1px solid var(--line); border-radius:999px; color:var(--muted); font-size:.75rem; vertical-align:.15rem; }
      table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
      th,td { padding:.65rem .5rem; border-bottom:1px solid var(--line); text-align:left; }
      th:not(:first-child),td:not(:first-child) { text-align:right; }
      footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); }
      @media (max-width:760px) { .two { grid-template-columns:1fr; } .bar-row { grid-template-columns:1fr auto; } .bar-track { grid-column:1/-1; } }
      @media print { :root { color-scheme:light; --bg:#fff; --panel:#fff; --ink:#111; --muted:#444; --line:#bbb; } body { background:#fff; } .card { break-inside:avoid; } }
    </style>
  </head>
  <body>
    <main>
      <header class="hero">
        <span class="privacy">PRIVATE · LOCAL SNAPSHOT</span>
        <p class="eyebrow">Grab data through ${escapeHtml(dataThrough)}</p>
        <h1>Business pulse, not rear-view reporting.</h1>
        <p>Direction, operational friction and the next measurable moves. Claims are tied to the saved snapshot; correlations remain exploratory.</p>
      </header>

      <section class="grid metrics" aria-label="Key performance indicators">
        <article class="card metric"><span>Latest 28-day sales</span><strong>${baht(current28.netSalesThb)}</strong><small>${formatPercent(percentChange(current28.netSalesThb, previous28.netSalesThb))} vs prior period</small></article>
        <article class="card metric"><span>Transactions</span><strong>${current28.transactions}</strong><small>${formatPercent(percentChange(current28.transactions, previous28.transactions))} vs prior period</small></article>
        <article class="card metric"><span>Average ticket</span><strong>${baht(current28.averageTicketThb)}</strong><small>${formatPercent(percentChange(current28.averageTicketThb, previous28.averageTicketThb))} vs prior period</small></article>
        <article class="card metric"><span>Grab rating</span><strong>${round(ratingScore, 1)} / 5</strong><small>${ratingCount} ratings</small></article>
      </section>

      <section class="grid two">
        <article class="card">
          <h2>Monthly net sales</h2>
          ${sparkline(
            monthlySeries.map((row) => row.netSalesThb),
            `Monthly net sales from ${monthlySeries[0]?.month ?? 'n/a'} through ${monthlySeries.at(-1)?.month ?? 'n/a'}`,
          )}
          <p class="meta">${monthlySeries[0]?.month ?? 'n/a'} → ${monthlySeries.at(-1)?.month ?? 'n/a'} · boundary months may be partial.</p>
        </article>
        <article class="card">
          <h2>Operating range</h2>
          <p class="metric"><strong>${baht(forecastTotals.baseThb)}</strong><span>8-week base scenario</span></p>
          <p>${baht(forecastTotals.lowThb)} low · ${baht(forecastTotals.highThb)} high</p>
          <p class="caveat">Backtest WAPE ${forecastTotals.modelBacktestWapePct}%. Useful for staffing and purchasing ranges, not a revenue promise.</p>
        </article>
      </section>

      <section class="grid two">
        <article class="card">
          <h2>Top menu demand · exact 90 days</h2>
          ${barRows(
            topItems.slice(0, 10).map((item) => ({ label: item.name, value: item.grossSalesThb })),
            baht,
          )}
          <p class="caveat">Top 10 share: ${formatRatio(top10RevenueSharePct)}. Demand prioritizes content; it does not verify recipe facts.</p>
        </article>
        <article class="card">
          <h2>Weekday shape · latest 12 weeks</h2>
          ${barRows(
            weekdayPerformance.map((row) => ({ label: row.label, value: row.averageNetSalesThb })),
            baht,
          )}
          <p class="caveat">Use matched weekdays. Weather, holidays, closures and staffing are not joined yet.</p>
        </article>
      </section>

      <section>
        <h2>Recommended next moves</h2>
        <div class="recommendations">
          ${recommendations
            .map(
              (item) =>
                `<article class="card recommendation"><h3>${escapeHtml(item.title)} <span class="tag">${item.confidence}</span></h3><p>${escapeHtml(item.nextAction)}</p><p class="meta"><strong>Evidence:</strong> ${item.evidence.map(escapeHtml).join('; ')}</p><p class="caveat"><strong>Guardrail:</strong> ${escapeHtml(item.caveat)}</p></article>`,
            )
            .join('\n')}
        </div>
      </section>

      <section class="grid two">
        <article class="card">
          <h2>Exploratory correlations</h2>
          <table><thead><tr><th>Signal pair</th><th>r</th><th>n</th></tr></thead><tbody>${correlations.map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${item.coefficient ?? 'n/a'}</td><td>${item.observations}</td></tr>`).join('')}</tbody></table>
          <p class="caveat">Association only. Log an intervention and comparison window before discussing ROI.</p>
        </article>
        <article class="card">
          <h2>Coverage gaps</h2>
          <p><strong>${unavailableCsv.length}</strong> explicitly registered missing or partial datasets are preserved instead of converted to zero.</p>
          <p>Offline: ${offlineCoverage}; cancellations: ${cancellationCoverage}; customers: ${currentCustomers === null ? 'unavailable' : `${currentCustomers.reportedWeeks} reported weeks`}.</p>
          <p>Next joins: GA4 intent, Search Console, Business Profile, weather/holidays, ingredient cost and the action log.</p>
        </article>
      </section>

      <footer>Generated from <code>${escapeHtml(relative(projectRoot, backupRoot))}</code>. Keep outside <code>public/</code>, <code>src/</code> and <code>dist/</code>.</footer>
    </main>
  </body>
</html>`;

const aiDir = await ensurePrivateOutputDirectory(backupRoot, 'ai');
const dashboardDir = await ensurePrivateOutputDirectory(backupRoot, 'dashboard');
await writePrivateFileAtomic(aiDir, 'business-context.json', contextJson);
await writePrivateFileAtomic(aiDir, 'AGENT-BRIEF.md', agentBrief);
await writePrivateFileAtomic(dashboardDir, 'index.html', dashboard);

console.log(`Grab intelligence written to ${backupRoot}`);
console.log(`AI context: ${relative(projectRoot, join(aiDir, 'business-context.json'))}`);
console.log(`Dashboard: ${relative(projectRoot, join(dashboardDir, 'index.html'))}`);
