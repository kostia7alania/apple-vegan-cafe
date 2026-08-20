/**
 * Extracts selected payment and payout rows from downloaded GrabMerchant Financial
 * Report XLSX files without modifying the original workbooks.
 *
 * Requires the system `unzip` command.
 *
 * Usage:
 *   pnpm grab:extract-gmfr -- grab-backup.local/YYYY-MM-DD
 */
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  ensurePrivateOutputDirectory,
  resolvePrivateBackupRoot,
  writePrivateFileAtomic,
} from './private-backup-path';

interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

interface PaymentRow {
  report_date: string;
  source_file: string;
  store_name: string;
  merchant_id: string;
  store_id: string;
  updated_at: string;
  created_at: string;
  type: string;
  category: string;
  status: string;
  transaction_id: string;
  long_order_id: string;
  short_order_id: string;
  booking_id: string;
  order_channel: string;
  order_type: string;
  payment_method: string;
  promotion_type: string;
  grab_fee_pct: string;
  amount_thb: string;
  promotion_thb: string;
  net_sales_thb: string;
  grab_fee_thb: string;
  marketing_fee_thb: string;
  delivery_commission_thb: string;
  platform_commission_thb: string;
  order_commission_thb: string;
  other_commission_thb: string;
  withholding_tax_thb: string;
  total_thb: string;
  commission_tax_thb: string;
  cancellation_reason: string;
  cancelled_by: string;
  refund_reason: string;
  event_group: string;
  event_alias: string;
  affected_items: string;
}

interface PayoutRow {
  report_date: string;
  source_file: string;
  payout_date: string;
  store_name: string;
  store_id: string;
  payout_id: string;
  net_amount_thb: string;
  status: string;
  transfer_date: string;
  bank_statement_id: string;
}

const monthNumbers: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

const sheetAliases: Record<string, string> = {
  รายการชำระเงิน: 'Transactions',
  การจ่ายรายได้: 'Transfers',
};

const headerAliases: Record<string, string> = {
  ชื่อร้าน: 'Merchant Name',
  รหัสร้านค้า: 'Store ID',
  วันที่สร้าง: 'Created On',
  ประเภท: 'Type',
  หมวดหมู่: 'Category',
  สถานะ: 'Status',
  รหัสคำสั่งซื้อยาว: 'Long Order ID',
  รหัสคำสั่งซื้อสั้น: 'Short Order ID',
  รหัสการจอง: 'Booking ID',
  ช่องทางการสั่งซื้อ: 'Order Channel',
  ประเภทคำสั่งซื้อ: 'Order Type',
  วิธีการชำระเงิน: 'Payment Method',
  ประเภทโปรโมชัน: 'Offer Type',
  'ค่าธรรมเนียม Grab (%)': 'Grab fee (%)',
  ยอด: 'Amount',
  โปรโมชัน: 'Offer',
  ยอดขายสุทธิ: 'Net Sales',
  'ค่าธรรมเนียม Grab': 'Grab Fee',
  ค่าธรรมเนียมการตลาด: 'Marketing Success Fee',
  ค่าคอมมิชชันการจัดส่ง: 'Delivery Commission',
  ค่าคอมมิชชันแพลตฟอร์ม: 'Channel Commission',
  ค่าคอมมิชชันคำสั่งซื้อ: 'Custom Commission',
  'ค่าคอมมิชชันอื่นของ GrabFood / GrabMart': 'GrabFood / GrabMart Other Commission',
  'ภาษีหัก ณ ที่จ่าย': 'Withholding Tax',
  ทั้งหมด: 'Total',
  'ภาษีค่าคอมมิชชัน, การปรับรายได้, โฆษณา GrabFood / GrabMart':
    'Tax on GrabFood / GrabMart Commission, Adjustments, Ads',
  สาเหตุที่ยกเลิก: 'Cancellation Reason',
  ยกเลิกโดย: 'Cancelled by',
  สาเหตุที่คืนเงิน: 'Reason for Refund',
  กลุ่มเหตุการณ์: 'Incident group',
  นามแฝงเหตุการณ์: 'Incident alias',
  รายการที่ได้รับผลกระทบ: 'Customer refunded item',
  วันที่: 'Date',
  รหัสการจ่ายรายได้: 'Settlement ID',
  ยอดสุทธิ: 'Net Total',
  วันที่โอน: 'Transfer Date',
  รหัสใบแจ้งยอดธนาคาร: 'Bank Statement Code',
};

function unzipEntry(path: string, entry: string): string {
  try {
    return execFileSync('unzip', ['-p', path, entry], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : 'unzip failed';
    throw new Error(`${basename(path)}: could not read ${entry}: ${message}`, { cause: error });
  }
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    );
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...match[1]!.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => text[1]!).join(''),
    ),
  );
}

function worksheetEntry(path: string, sheetName: string): string {
  const workbook = unzipEntry(path, 'xl/workbook.xml');
  const acceptedNames = new Set([sheetName, sheetAliases[sheetName]].filter(Boolean));
  const sheet = [...workbook.matchAll(/<sheet\s([^>]+)>?/g)].find((match) => {
    const name = match[1]!.match(/name="([^"]+)"/)?.[1] ?? '';
    return acceptedNames.has(decodeXml(name));
  });
  const relationshipId = sheet?.[1]?.match(/r:id="([^"]+)"/)?.[1];
  if (!relationshipId) throw new Error(`${basename(path)}: missing sheet ${sheetName}`);

  const relationships = unzipEntry(path, 'xl/_rels/workbook.xml.rels');
  const relationship = [...relationships.matchAll(/<Relationship\s([^>]+)>?/g)].find(
    (match) => match[1]!.match(/Id="([^"]+)"/)?.[1] === relationshipId,
  );
  const target = relationship?.[1]?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error(`${basename(path)}: missing target for ${sheetName}`);
  return target.replace(/^\//, '').replace(/^worksheets\//, 'xl/worksheets/');
}

function columnIndex(reference: string): number {
  let result = 0;
  for (const character of reference) result = result * 26 + character.charCodeAt(0) - 64;
  return result - 1;
}

function parseSheet(path: string, sheetName: string, sharedStrings: string[]): ParsedSheet {
  const xml = unzipEntry(path, worksheetEntry(path, sheetName));
  const records: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\s[^>]*>([\s\S]*?)<\/row>/g)) {
    const values: string[] = [];
    for (const cellMatch of rowMatch[1]!.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1]!;
      const body = cellMatch[2]!;
      const reference = attributes.match(/r="([A-Z]+)\d+"/)?.[1];
      if (!reference) continue;
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      const inline = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
        .map((match) => match[1]!)
        .join('');
      const value = /\bt="s"/.test(attributes)
        ? (sharedStrings[Number(raw)] ?? '')
        : inline
          ? decodeXml(inline)
          : decodeXml(raw);
      values[columnIndex(reference)] = value;
    }
    if (values.some((value) => value !== '')) records.push(values);
  }
  const headers = records.shift();
  if (!headers) throw new Error(`${basename(path)}: ${sheetName} is empty`);
  return { headers, rows: records };
}

function cell(sheet: ParsedSheet, row: string[], header: string, occurrence = 0): string {
  const acceptedHeaders = new Set([header, headerAliases[header]].filter(Boolean));
  if (header === 'ชื่อร้าน') acceptedHeaders.add('Store Name');
  const indexes = sheet.headers
    .map((value, index) => (acceptedHeaders.has(value) ? index : -1))
    .filter((index) => index >= 0);
  const index = indexes[occurrence];
  if (index === undefined) throw new Error(`missing column ${header}`);
  return row[index] ?? '';
}

function reportDate(filename: string): string {
  const match = filename.match(
    /^GrabMerchant_Reports_(\d{2})-([A-Z][a-z]{2})-(\d{4})_to_(\d{2})-([A-Z][a-z]{2})-(\d{4})\.xlsx$/,
  );
  if (!match || !monthNumbers[match[2]!] || !monthNumbers[match[5]!]) {
    throw new Error(`invalid GMFR filename: ${filename}`);
  }
  const start = `${match[3]}-${monthNumbers[match[2]!]}-${match[1]}`;
  const end = `${match[6]}-${monthNumbers[match[5]!]}-${match[4]}`;
  if (start !== end) {
    throw new Error(`${filename}: expected a one-day GMFR workbook, found ${start} to ${end}`);
  }
  return start;
}

function csvCell(value: string | number): string {
  let text = String(value ?? '');
  if (/^[=+@]/.test(text) || (/^-/.test(text) && !/^-?\d+(?:\.\d+)?$/.test(text))) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv<T extends object>(rows: T[], columns: Array<[keyof T, string]>): string {
  return `${[
    columns.map(([, label]) => csvCell(label)).join(','),
    ...rows.map((row) => columns.map(([key]) => csvCell(String(row[key] ?? ''))).join(',')),
  ].join('\n')}\n`;
}

function numeric(value: string, label: string, allowPercent = false): number | null {
  if (value.trim() === '') return null;
  const normalized = allowPercent && value.trim().endsWith('%') ? value.trim().slice(0, -1) : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed))
    throw new Error(`invalid numeric ${label}: ${JSON.stringify(value)}`);
  return parsed;
}

function sumNumeric(rows: PaymentRow[], key: keyof PaymentRow, label: string): number | null {
  let total = 0;
  for (const row of rows) {
    const value = numeric(row[key], `${row.source_file} ${label}`);
    if (value === null) return null;
    total += value;
  }
  return total;
}

function formatThb(value: number | null): string {
  return value === null ? 'unknown (blank source values present)' : `฿${value.toFixed(2)}`;
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
if (args.length !== 1 || args[0] === '--help' || args[0] === '-h') {
  const output = args.length === 1 ? console.log : console.error;
  output('usage: pnpm grab:extract-gmfr -- <grab-backup-directory>');
  process.exit(args.length === 1 ? 0 : 1);
}

const backupRoot = await resolvePrivateBackupRoot(args[0]!);
const reportsSource = join(backupRoot, 'raw', 'finance-documents', 'reports');
const normalizedDir = join(backupRoot, 'normalized');
const filenames = (await readdir(reportsSource))
  .filter((filename) => filename.endsWith('.xlsx'))
  .sort((left, right) => reportDate(left).localeCompare(reportDate(right)));
if (filenames.length === 0) throw new Error(`no GMFR XLSX files found in ${reportsSource}`);

const payments: PaymentRow[] = [];
const payouts: PayoutRow[] = [];
for (const filename of filenames) {
  const path = join(reportsSource, filename);
  const sharedStrings = parseSharedStrings(unzipEntry(path, 'xl/sharedStrings.xml'));
  const paymentSheet = parseSheet(path, 'รายการชำระเงิน', sharedStrings);
  const payoutSheet = parseSheet(path, 'การจ่ายรายได้', sharedStrings);
  const date = reportDate(filename);

  for (const row of paymentSheet.rows) {
    payments.push({
      report_date: date,
      source_file: filename,
      store_name: cell(paymentSheet, row, 'ชื่อร้าน'),
      merchant_id: cell(paymentSheet, row, 'Merchant ID'),
      store_id: cell(paymentSheet, row, 'รหัสร้านค้า'),
      updated_at: cell(paymentSheet, row, 'Updated On'),
      created_at: cell(paymentSheet, row, 'วันที่สร้าง'),
      type: cell(paymentSheet, row, 'ประเภท'),
      category: cell(paymentSheet, row, 'หมวดหมู่'),
      status: cell(paymentSheet, row, 'สถานะ'),
      transaction_id: cell(paymentSheet, row, 'Transaction ID'),
      long_order_id: cell(paymentSheet, row, 'รหัสคำสั่งซื้อยาว'),
      short_order_id: cell(paymentSheet, row, 'รหัสคำสั่งซื้อสั้น'),
      booking_id: cell(paymentSheet, row, 'รหัสการจอง'),
      order_channel: cell(paymentSheet, row, 'ช่องทางการสั่งซื้อ'),
      order_type: cell(paymentSheet, row, 'ประเภทคำสั่งซื้อ'),
      payment_method: cell(paymentSheet, row, 'วิธีการชำระเงิน'),
      promotion_type: cell(paymentSheet, row, 'ประเภทโปรโมชัน'),
      grab_fee_pct: cell(paymentSheet, row, 'ค่าธรรมเนียม Grab (%)'),
      amount_thb: cell(paymentSheet, row, 'ยอด'),
      promotion_thb: cell(paymentSheet, row, 'โปรโมชัน'),
      net_sales_thb: cell(paymentSheet, row, 'ยอดขายสุทธิ'),
      grab_fee_thb: cell(paymentSheet, row, 'ค่าธรรมเนียม Grab'),
      marketing_fee_thb: cell(paymentSheet, row, 'ค่าธรรมเนียมการตลาด'),
      delivery_commission_thb: cell(paymentSheet, row, 'ค่าคอมมิชชันการจัดส่ง'),
      platform_commission_thb: cell(paymentSheet, row, 'ค่าคอมมิชชันแพลตฟอร์ม'),
      order_commission_thb: cell(paymentSheet, row, 'ค่าคอมมิชชันคำสั่งซื้อ'),
      other_commission_thb: cell(paymentSheet, row, 'ค่าคอมมิชชันอื่นของ GrabFood / GrabMart'),
      withholding_tax_thb: cell(paymentSheet, row, 'ภาษีหัก ณ ที่จ่าย'),
      total_thb: cell(paymentSheet, row, 'ทั้งหมด'),
      commission_tax_thb: cell(
        paymentSheet,
        row,
        'ภาษีค่าคอมมิชชัน, การปรับรายได้, โฆษณา GrabFood / GrabMart',
      ),
      cancellation_reason: cell(paymentSheet, row, 'สาเหตุที่ยกเลิก'),
      cancelled_by: cell(paymentSheet, row, 'ยกเลิกโดย'),
      refund_reason: cell(paymentSheet, row, 'สาเหตุที่คืนเงิน'),
      event_group: cell(paymentSheet, row, 'กลุ่มเหตุการณ์'),
      event_alias: cell(paymentSheet, row, 'นามแฝงเหตุการณ์'),
      affected_items: cell(paymentSheet, row, 'รายการที่ได้รับผลกระทบ'),
    });
  }

  for (const row of payoutSheet.rows) {
    payouts.push({
      report_date: date,
      source_file: filename,
      payout_date: cell(payoutSheet, row, 'วันที่'),
      store_name: cell(payoutSheet, row, 'ชื่อร้าน'),
      store_id: cell(payoutSheet, row, 'รหัสร้านค้า'),
      payout_id: cell(payoutSheet, row, 'รหัสการจ่ายรายได้'),
      net_amount_thb: cell(payoutSheet, row, 'ยอดสุทธิ'),
      status: cell(payoutSheet, row, 'สถานะ'),
      transfer_date: cell(payoutSheet, row, 'วันที่โอน'),
      bank_statement_id: cell(payoutSheet, row, 'รหัสใบแจ้งยอดธนาคาร'),
    });
  }
}

const paymentColumns: Array<[keyof PaymentRow, string]> = [
  ['report_date', 'Report date'],
  ['source_file', 'Source XLSX'],
  ['store_name', 'Store name'],
  ['merchant_id', 'Merchant ID'],
  ['store_id', 'Store ID'],
  ['updated_at', 'Updated On'],
  ['created_at', 'Created at'],
  ['type', 'Type'],
  ['category', 'Category'],
  ['status', 'Status'],
  ['transaction_id', 'Transaction ID'],
  ['long_order_id', 'Long order ID'],
  ['short_order_id', 'Short order ID'],
  ['booking_id', 'Booking ID'],
  ['order_channel', 'Order channel'],
  ['order_type', 'Order type'],
  ['payment_method', 'Payment method'],
  ['promotion_type', 'Promotion type'],
  ['grab_fee_pct', 'Grab fee %'],
  ['amount_thb', 'Amount THB'],
  ['promotion_thb', 'Promotion THB'],
  ['net_sales_thb', 'Net sales THB'],
  ['grab_fee_thb', 'Grab fee THB'],
  ['marketing_fee_thb', 'Marketing fee THB'],
  ['delivery_commission_thb', 'Delivery commission THB'],
  ['platform_commission_thb', 'Platform commission THB'],
  ['order_commission_thb', 'Order commission THB'],
  ['other_commission_thb', 'Other commission THB'],
  ['withholding_tax_thb', 'Withholding tax THB'],
  ['total_thb', 'Total THB'],
  ['commission_tax_thb', 'Commission tax THB'],
  ['cancellation_reason', 'Cancellation reason'],
  ['cancelled_by', 'Cancelled by'],
  ['refund_reason', 'Refund reason'],
  ['event_group', 'Event group'],
  ['event_alias', 'Event alias'],
  ['affected_items', 'Affected items'],
];
const payoutColumns: Array<[keyof PayoutRow, string]> = [
  ['report_date', 'Report date'],
  ['source_file', 'Source XLSX'],
  ['payout_date', 'Payout date'],
  ['store_name', 'Store name'],
  ['store_id', 'Store ID'],
  ['payout_id', 'Payout ID'],
  ['net_amount_thb', 'Net amount THB'],
  ['status', 'Status'],
  ['transfer_date', 'Transfer date'],
  ['bank_statement_id', 'Bank statement ID'],
];

const numericPaymentColumns: Array<[keyof PaymentRow, string, boolean?]> = [
  ['grab_fee_pct', 'Grab fee %', true],
  ['amount_thb', 'Amount'],
  ['promotion_thb', 'Promotion'],
  ['net_sales_thb', 'Net Sales'],
  ['grab_fee_thb', 'Grab Fee'],
  ['marketing_fee_thb', 'Marketing Success Fee'],
  ['delivery_commission_thb', 'Delivery Commission'],
  ['platform_commission_thb', 'Channel Commission'],
  ['order_commission_thb', 'Custom Commission'],
  ['other_commission_thb', 'Other Commission'],
  ['withholding_tax_thb', 'Withholding Tax'],
  ['total_thb', 'Total'],
  ['commission_tax_thb', 'Commission Tax'],
];
for (const row of payments) {
  for (const [key, label, allowPercent] of numericPaymentColumns) {
    numeric(row[key], `${row.source_file} ${label}`, allowPercent);
  }
}
for (const row of payouts) {
  numeric(row.net_amount_thb, `${row.source_file} Net Total`);
}

const orderRows = payments.filter((row) => row.long_order_id !== '');
const uniqueOrderIds = new Set(orderRows.map((row) => row.long_order_id));
const uniqueTransactionIds = new Set(
  payments.map((row) => row.transaction_id).filter((value) => value !== ''),
);
const amount = sumNumeric(orderRows, 'amount_thb', 'Amount');
const netSales = sumNumeric(orderRows, 'net_sales_thb', 'Net Sales');
const platformCommission = sumNumeric(orderRows, 'platform_commission_thb', 'Channel Commission');
const commissionTax = sumNumeric(orderRows, 'commission_tax_thb', 'Commission Tax');
const total = sumNumeric(orderRows, 'total_thb', 'Total');
let apiDetailStart = '';
try {
  const apiRows = (
    await readFile(join(normalizedDir, 'finance-transactions-detailed-available.csv'), 'utf8')
  ).split(/\r?\n/);
  if (apiRows[0]?.replace(/^\ufeff/, '').split(',')[0] !== 'Date') {
    throw new Error('finance-transactions-detailed-available.csv must start with a Date column');
  }
  apiDetailStart = apiRows[1]?.split(',')[0]?.slice(0, 10) ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiDetailStart)) {
    throw new Error('finance-transactions-detailed-available.csv has no valid first data date');
  }
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}
const preApiOrderRows = apiDetailStart
  ? orderRows.filter((row) => row.report_date < apiDetailStart)
  : [];
const preApiUniqueOrders = new Set(preApiOrderRows.map((row) => row.long_order_id)).size;
const preApiNetSales = sumNumeric(preApiOrderRows, 'net_sales_thb', 'Net Sales');
const preApiPlatformCommission = sumNumeric(
  preApiOrderRows,
  'platform_commission_thb',
  'Channel Commission',
);
const preApiCommissionTax = sumNumeric(preApiOrderRows, 'commission_tax_thb', 'Commission Tax');

const report = `# GMFR XLSX extraction

- Source XLSX files parsed: **${filenames.length}** (${reportDate(filenames[0]!)}—${reportDate(filenames.at(-1)!)} by filename order).
- Payment-sheet rows: **${payments.length}**; non-empty Transaction IDs: **${uniqueTransactionIds.size}**.
- Rows with a long Grab order ID: **${orderRows.length}**; unique long order IDs: **${uniqueOrderIds.size}**.
- Payout-sheet rows: **${payouts.length}**.
${apiDetailStart ? `- Recovered before the current Finance API detail boundary (${apiDetailStart}): **${preApiUniqueOrders} unique orders**, source-labelled net sales **${formatThb(preApiNetSales)}**, platform commission **${formatThb(preApiPlatformCommission)}**, commission tax **${formatThb(preApiCommissionTax)}**.` : ''}

Exact selected rows are stored in:

- \`normalized/gmfr-payment-rows-available.csv\`;
- \`normalized/gmfr-payout-rows-available.csv\`.

Order-linked column totals from the source labels (not an accounting interpretation):

| Source column | Total |
| --- | ---: |
| Amount | ${formatThb(amount)} |
| Net sales | ${formatThb(netSales)} |
| Platform commission | ${formatThb(platformCommission)} |
| Commission tax | ${formatThb(commissionTax)} |
| Total | ${formatThb(total)} |

Only workbooks present in the private snapshot are parsed. Compare this report with the
snapshot's private coverage manifest before treating the date range as complete; Grab
metadata in READY/PROCESS state without downloaded bytes remains a coverage gap. These
CSVs are private because they contain transaction/order/store identifiers. The Amount,
Total and commission fields are preserved exactly as Grab labels them; cash collection,
refunds and adjustments mean they must not be treated as profit without reconciliation.
`;

const safeNormalizedDir = await ensurePrivateOutputDirectory(backupRoot, 'normalized');
const safeReportsDir = await ensurePrivateOutputDirectory(backupRoot, 'reports');
await writePrivateFileAtomic(
  safeNormalizedDir,
  'gmfr-payment-rows-available.csv',
  csv(payments, paymentColumns),
);
await writePrivateFileAtomic(
  safeNormalizedDir,
  'gmfr-payout-rows-available.csv',
  csv(payouts, payoutColumns),
);
await writePrivateFileAtomic(safeReportsDir, 'GMFR-EXTRACTION.md', report);

console.log(`parsed ${filenames.length} GMFR workbooks`);
console.log(`payment rows: ${payments.length}, unique long order IDs: ${uniqueOrderIds.size}`);
console.log(`payout rows: ${payouts.length}`);
