/**
 * Builds a small forward-looking decision layer over an existing private Grab backup.
 *
 * Usage:
 *   pnpm grab:analyze -- grab-backup.local/YYYY-MM-DD
 *
 * The source backup remains private/ignored. The command writes only derived files
 * inside its normalized/ and reports/ directories.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ensurePrivateOutputDirectory,
  resolvePrivateBackupRoot,
  writePrivateFileAtomic,
  writePrivateFileIfMissing,
} from './private-backup-path';

interface DailySale {
  date: string;
  netSales: number;
  transactions: number;
}

interface ForecastRow {
  date: string;
  base: number;
  low: number;
  high: number;
}

interface ModelScore {
  id: ModelId;
  label: string;
  wape: number;
  errors: number[];
}

type ModelId = 'seasonal_7' | 'weekday_mean_28' | 'weekday_mean_56_trend';

const modelLabels: Record<ModelId, string> = {
  seasonal_7: 'тот же день недели предыдущей недели',
  weekday_mean_28: 'среднее по тому же дню недели за 28 дней',
  weekday_mean_56_trend: 'среднее по дню недели за 56 дней с ограниченным трендом',
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (inQuotes) throw new Error('unclosed quote in CSV');
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function percentChange(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null && previous > 0
    ? (current / previous - 1) * 100
    : null;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'н/д';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function baht(value: number | null): string {
  return value === null ? 'н/д' : `฿${Math.round(value).toLocaleString('en-US')}`;
}

function quantile(values: number[], probability: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(probability * sorted.length));
  return sorted[index]!;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function requiredNumber(value: string | undefined, label: string): number {
  if (value === undefined || value.trim() === '') throw new Error(`${label} is blank`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a finite number`);
  return parsed;
}

function requiredTransactionCount(value: string | undefined, label: string): number {
  const parsed = requiredNumber(value, label);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function modelPrediction(
  model: ModelId,
  history: DailySale[],
  nextDate: string,
  fixedTrendScale?: number,
): number {
  if (history.length === 0) return 0;
  if (model === 'seasonal_7') return history.at(-7)?.netSales ?? history.at(-1)!.netSales;

  const windowSize = model === 'weekday_mean_28' ? 28 : 56;
  const targetWeekday = weekday(nextDate);
  const matchingDays = history
    .slice(-windowSize)
    .filter((row) => weekday(row.date) === targetWeekday)
    .map((row) => row.netSales);
  const weekdayAverage = mean(matchingDays);
  if (model === 'weekday_mean_28') return weekdayAverage;

  const recent = sum(history.slice(-28).map((row) => row.netSales));
  const previous = sum(history.slice(-56, -28).map((row) => row.netSales));
  const rawScale = previous > 0 ? recent / previous : 1;
  const trendScale = fixedTrendScale ?? Math.max(0.8, Math.min(1.2, rawScale));
  return weekdayAverage * trendScale;
}

function scoreModels(rows: DailySale[]): ModelScore[] {
  const startIndex = Math.max(56, rows.length - 112);
  const modelIds = Object.keys(modelLabels) as ModelId[];
  return modelIds
    .map((id) => {
      const errors: number[] = [];
      let absoluteActual = 0;
      for (let index = startIndex; index < rows.length; index++) {
        const actual = rows[index]!;
        const predicted = modelPrediction(id, rows.slice(0, index), actual.date);
        errors.push(Math.abs(actual.netSales - predicted));
        absoluteActual += Math.abs(actual.netSales);
      }
      return {
        id,
        label: modelLabels[id],
        wape: absoluteActual > 0 ? sum(errors) / absoluteActual : Number.POSITIVE_INFINITY,
        errors,
      };
    })
    .sort((left, right) => left.wape - right.wape);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
if (args.length !== 1 || args[0] === '--help' || args[0] === '-h') {
  const output = args.length === 1 ? console.log : console.error;
  output('usage: pnpm grab:analyze -- <grab-backup-directory>');
  process.exit(args.length === 1 ? 0 : 1);
}

const backupRoot = await resolvePrivateBackupRoot(args[0]!);
const normalizedDir = await ensurePrivateOutputDirectory(backupRoot, 'normalized');
const sourcePath = join(normalizedDir, 'sales-daily-alltime.csv');
const csv = parseCsv((await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, ''));
const header = csv.shift();
if (!header) throw new Error('sales CSV is empty');

const indexes = Object.fromEntries(header.map((column, index) => [column, index])) as Record<
  string,
  number
>;
if (new Set(header).size !== header.length) throw new Error('sales CSV has duplicate columns');
for (const column of ['Date', 'Net sales THB', 'Transactions']) {
  if (indexes[column] === undefined) throw new Error(`sales CSV missing column: ${column}`);
}

const allRows = csv.map((cells, index) => {
  const record = index + 2;
  if (cells.length !== header.length) {
    throw new Error(`sales CSV row ${record} has ${cells.length} cells; expected ${header.length}`);
  }
  const date = cells[indexes['Date']!] ?? '';
  if (!isCalendarDate(date)) throw new Error(`sales CSV row ${record} has an invalid Date`);
  return {
    date,
    netSales: requiredNumber(cells[indexes['Net sales THB']!], `sales CSV row ${record} Net sales`),
    transactions: requiredTransactionCount(
      cells[indexes['Transactions']!],
      `sales CSV row ${record} Transactions`,
    ),
  };
});
const firstPositive = allRows.findIndex((row) => row.netSales > 0 || row.transactions > 0);
if (firstPositive < 0) throw new Error('sales CSV contains no non-zero sales history');
const rows = allRows.slice(firstPositive);
for (let index = 1; index < rows.length; index++) {
  if (rows[index]!.date !== addDays(rows[index - 1]!.date, 1)) {
    throw new Error(`sales history is not daily-contiguous at ${rows[index]!.date}`);
  }
}
if (rows.length < 180)
  throw new Error('at least 180 daily rows are required for matched 90-day comparisons');

const scores = scoreModels(rows);
const selected = scores[0]!;
if (!Number.isFinite(selected.wape)) throw new Error('backtest has no finite WAPE result');
const absoluteError80 = quantile(selected.errors, 0.8);
const forecast: ForecastRow[] = [];
const actualRecent28 = sum(rows.slice(-28).map((row) => row.netSales));
const actualPrevious28 = sum(rows.slice(-56, -28).map((row) => row.netSales));
const fixedTrendScale =
  actualPrevious28 > 0 ? Math.max(0.8, Math.min(1.2, actualRecent28 / actualPrevious28)) : 1;
const seasonalValues = new Map(rows.map((row) => [row.date, row.netSales]));
let nextDate = addDays(rows.at(-1)!.date, 1);
for (let day = 0; day < 56; day++) {
  const base = Math.max(
    0,
    (() => {
      if (selected.id !== 'seasonal_7') {
        // Weekday averages always use immutable actual history. The bounded trend
        // factor is applied exactly once instead of feeding scaled forecasts back
        // into the next prediction window.
        return modelPrediction(selected.id, rows, nextDate, fixedTrendScale);
      }

      const referenceDate = addDays(nextDate, -7);
      const referenceValue = seasonalValues.get(referenceDate);
      if (referenceValue === undefined) {
        throw new Error(`seasonal forecast is missing reference date ${referenceDate}`);
      }
      return referenceValue;
    })(),
  );
  forecast.push({
    date: nextDate,
    base,
    low: Math.max(0, base - absoluteError80),
    high: base + absoluteError80,
  });
  seasonalValues.set(nextDate, base);
  nextDate = addDays(nextDate, 1);
}

const forecastCsv = [
  ['Date', 'Forecast net sales THB', 'Low scenario THB', 'High scenario THB'],
  ...forecast.map((row) => [
    row.date,
    Math.round(row.base),
    Math.round(row.low),
    Math.round(row.high),
  ]),
]
  .map((line) => line.map(csvCell).join(','))
  .join('\n');
const forecastMetadata = `${JSON.stringify(
  {
    sourceDataThrough: rows.at(-1)!.date,
    selectedModel: selected.id,
    selectedModelLabel: selected.label,
    backtestObservations: selected.errors.length,
    backtestWapePct: Number((selected.wape * 100).toFixed(1)),
    intervalMethod: 'selected-model absolute error 80th percentile',
  },
  null,
  2,
)}\n`;

const actionLogHeader = [
  'action_id',
  'start_date',
  'end_date',
  'channel',
  'action_type',
  'hypothesis',
  'primary_metric',
  'secondary_metric',
  'cost_thb',
  'expected_direction',
  'affected_items_or_hours',
  'baseline_start',
  'baseline_end',
  'status',
  'notes',
];
const dailyJoinHeader = [
  'date',
  'grab_net_sales_thb',
  'grab_transactions',
  'grab_aov_thb',
  'grab_offline_minutes',
  'grab_cancelled_orders',
  'ga4_sessions',
  'ga4_menu_views',
  'ga4_order_clicks',
  'ga4_phone_clicks',
  'ga4_directions_clicks',
  'gsc_clicks',
  'gsc_impressions',
  'gsc_jay_impressions',
  'gbp_website_clicks',
  'gbp_calls',
  'gbp_directions',
  'gbp_search_impressions',
  'review_count',
  'review_average_rating',
  'google_trends_jay',
  'rain_mm',
  'holiday_or_event',
  'open_minutes',
  'action_ids',
];

const latest28 = rows.slice(-28);
const previous28 = rows.slice(-56, -28);
const latest90 = rows.slice(-90);
const previous90 = rows.slice(-180, -90);
const totals = (period: DailySale[]) => {
  const netSales = sum(period.map((row) => row.netSales));
  const transactions = sum(period.map((row) => row.transactions));
  return { netSales, transactions, aov: transactions > 0 ? netSales / transactions : null };
};
const current28 = totals(latest28);
const prior28 = totals(previous28);
const current90 = totals(latest90);
const prior90 = totals(previous90);
const forecastTotal = sum(forecast.map((row) => row.base));
const prior56Total = sum(rows.slice(-56).map((row) => row.netSales));
const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const weekdayRows = weekdays.map((label, index) => {
  const matching = rows.slice(-84).filter((row) => weekday(row.date) === index);
  return {
    label,
    average: mean(matching.map((row) => row.netSales)),
    transactions: mean(matching.map((row) => row.transactions)),
  };
});
const bestWeekday = [...weekdayRows].sort((left, right) => right.average - left.average)[0]!;
const weakestWeekday = [...weekdayRows].sort((left, right) => left.average - right.average)[0]!;

const weeklyForecast = Array.from({ length: 8 }, (_, index) => {
  const week = forecast.slice(index * 7, index * 7 + 7);
  return {
    start: week[0]!.date,
    end: week.at(-1)!.date,
    base: sum(week.map((row) => row.base)),
    low: sum(week.map((row) => row.low)),
    high: sum(week.map((row) => row.high)),
  };
});

const report = `# Куда идёт Grab-канал — срез ${rows.at(-1)!.date}

## Сигнал сейчас

- Последние 28 дней: **${baht(current28.netSales)}**, ${current28.transactions} заказов, средний чек ${baht(current28.aov)}. К предыдущим 28 дням: продажи **${formatPercent(percentChange(current28.netSales, prior28.netSales))}**, заказы **${formatPercent(percentChange(current28.transactions, prior28.transactions))}**, чек **${formatPercent(percentChange(current28.aov, prior28.aov))}**.
- Последние 90 дней: **${baht(current90.netSales)}**, ${current90.transactions} заказов, средний чек ${baht(current90.aov)}. К предыдущим 90 дням: продажи **${formatPercent(percentChange(current90.netSales, prior90.netSales))}**, заказы **${formatPercent(percentChange(current90.transactions, prior90.transactions))}**, чек **${formatPercent(percentChange(current90.aov, prior90.aov))}**.
- 28- и 90-дневные сравнения выше описывают разные окна. Их расхождение — сигнал проверить сезонность и action-log, а не готовый вывод о росте или падении.
- За последние 12 недель лучший средний день — **${bestWeekday.label} (${baht(bestWeekday.average)}/день)**, слабейший — **${weakestWeekday.label} (${baht(weakestWeekday.average)}/день)**. Это сигнал для проверки расписания и промо, а не готовая причина: погода, закрытия и праздники пока не присоединены.

## 8-недельный операционный прогноз

- Выбрана модель: **${selected.label}**. Она победила две простые альтернативы на скользящем backtest последних ${selected.errors.length} дней; WAPE **${(selected.wape * 100).toFixed(1)}%**.
- Базовый сценарий на ${forecast[0]!.date}—${forecast.at(-1)!.date}: **${baht(forecastTotal)}**, против ${baht(prior56Total)} за предыдущие 56 фактических дней: **${formatPercent(percentChange(forecastTotal, prior56Total))}**.
- Диапазон low/high — операционный коридор из исторической ошибки, не финансовая гарантия. Годовую сезонность можно оценивать только после полных сопоставимых циклов; этот отчёт её не утверждает.

| Неделя | Base | Low | High |
| --- | ---: | ---: | ---: |
${weeklyForecast.map((week) => `| ${week.start}—${week.end} | ${baht(week.base)} | ${baht(week.low)} | ${baht(week.high)} |`).join('\n')}

## Что измерять ради ROI

1. **Доступность магазина.** Сначала связывать offline minutes, отмены и часы работы с потерянными заказами. Это самый дешёвый рычаг: не требуется покупать трафик.
2. **Меню и комплекты.** Для каждого изменения цены, фотографии, позиции в меню или combo фиксировать дату, затронутые ItemID, стоимость и primary metric. Сравнивать не только продажи, но и количество, AOV и маржу после комиссии.
3. **Grab promo/ads.** Брать Spend, attributed revenue и Grab ROI, но проверять incremental lift относительно похожих недель без кампании. Атрибутированная выручка сама по себе не равна приросту.
4. **Сайт → заказ/визит.** GA4 должен хранить menu_view/order_click/phone_click/directions_click; заказ внутри Grab обратно не атрибутируется, поэтому это верх воронки, а не доказанный доход.
5. **Поиск Jay/vegan/Pattaya.** GSC даёт показы, клики, CTR и позицию сайта; GBP — показы профиля, звонки, маршруты и клики меню/сайта. Сопоставлять по дню/неделе с Grab-заказами, но считать корреляцией до проведения контролируемого изменения.
6. **Отзывы.** LLM полезна для кластеризации тем (вкус, упаковка, ошибка блюда, порция, скорость) и перевода, но числовой тренд и прогноз должен считать обычный временной ряд с backtest.

## Минимальная аналитическая система

- Grain: один день в Asia/Bangkok; PII и тексты отзывов хранятся отдельно.
- Источники: Grab sales/transactions/items/operations/customers/marketing + GA4 + Search Console + Google Business Profile + погода/праздники + журнал действий.
- Файл \`daily-business-join-template.csv\` фиксирует контракт объединения; \`business-action-log-template.csv\` не даёт объяснять каждый скачок задним числом.
- Решение принимается по 4-недельному rolling окну, прогноз обновляется еженедельно, ROI эксперимента — после заранее выбранного окна и метрики.

## Ограничения

- Полнота Finance, зависшие отчёты и границы retention берутся из приватного coverage-отчёта конкретного снимка; отсутствующие файлы не превращаются в нули.
- Без себестоимости, офлайн-кассы и журнала действий можно видеть направление Grab-канала, но нельзя честно назвать прибыль или причинный ROI.
`;

const reportsDir = await ensurePrivateOutputDirectory(backupRoot, 'reports');
await writePrivateFileAtomic(normalizedDir, 'sales-forecast-8-weeks.csv', `${forecastCsv}\n`);
await writePrivateFileAtomic(normalizedDir, 'sales-forecast-metadata.json', forecastMetadata);
await writePrivateFileIfMissing(
  normalizedDir,
  'business-action-log-template.csv',
  `${actionLogHeader.join(',')}\n`,
);
await writePrivateFileIfMissing(
  normalizedDir,
  'daily-business-join-template.csv',
  `${dailyJoinHeader.join(',')}\n`,
);
await writePrivateFileAtomic(reportsDir, 'FORWARD-LOOKING-ANALYSIS.md', report);

console.log(`Grab business analysis written to ${backupRoot}`);
console.log(`selected model: ${selected.id}, backtest WAPE ${(selected.wape * 100).toFixed(1)}%`);
console.log(`8-week base forecast: ${Math.round(forecastTotal)} THB`);
