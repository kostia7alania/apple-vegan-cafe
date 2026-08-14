/**
 * Read-only checker for an owner's filled copy of docs/MVP-FACTS-LOCK.md.
 * It never imports values into content: output is a review queue for a human publisher.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type FieldKind = 'text' | 'enum' | 'list-enum' | 'url' | 'date' | 'integer' | 'checkbox';

interface FieldSpec {
  key: string;
  kind: FieldKind;
  values?: readonly string[];
  hosts?: readonly string[];
  target?: string;
}

interface Mapping {
  source: string;
  target: string;
}

interface RawDishBlock {
  lineNumber: number;
  values: Map<string, string>;
}

const MEDIA_KINDS = ['hero', 'exterior', 'family', 'interior'] as const;

const TARGETS = {
  mapsUrl: 'src/content/locations.json:pattaya.mapsUrl',
  geo: 'src/content/locations.json:pattaya.geo',
  lineUrl: 'src/content/settings.json:site.lineUrl',
  whatsappUrl: 'src/content/settings.json:site.whatsappUrl',
  primaryContact: 'src/content/settings.json:site.primaryContact',
  responseHours: 'src/content/settings.json:site.responseHours',
  paymentMethods: 'src/content/operations.json:pattaya.paymentMethods',
  paymentNote: 'src/content/operations.json:pattaya.paymentNote',
  address: 'src/content/locations.json:pattaya.address',
  hours: 'src/content/locations.json:pattaya.hours',
  landmark: 'src/content/locations.json:pattaya.landmark',
  parking: 'src/content/locations.json:pattaya.parking',
  arrivalNote: 'src/content/locations.json:pattaya.arrivalNote',
  pricePolicy: 'src/content/operations.json:pattaya.pricePolicy',
  pickup: 'src/content/operations.json:pattaya.pickup',
  reservations: 'src/content/operations.json:pattaya.reservations',
  spiceRequests: 'src/content/operations.json:pattaya.spiceRequests',
  dietaryQuestionsContact: 'src/content/operations.json:pattaya.dietaryQuestionsContact',
  halalGuidance: 'src/content/operations.json:pattaya.halalGuidance',
  googleProfile: 'src/content/settings.json:site.reviewLinks.googleProfile',
  googleReview: 'src/content/settings.json:site.reviewLinks.googleReview',
  siteMedia: 'src/content/site-media.json:site.assets',
} as const;

const allowedHosts = {
  maps: ['maps.app.goo.gl', 'google.com', 'www.google.com'],
  grab: ['r.grab.com', 'grab.com', 'food.grab.com', 'www.grab.com'],
  lineMan: ['lineman.line.me', 'lineman.onelink.me', 'wongnai.com', 'www.wongnai.com'],
  googleProfile: ['maps.app.goo.gl', 'g.page', 'google.com', 'www.google.com'],
  googleReview: ['g.page', 'search.google.com', 'google.com', 'www.google.com'],
  line: ['line.me', 'lin.ee'],
  whatsapp: ['wa.me', 'api.whatsapp.com'],
} as const;

const yesNo = ['yes', 'no', 'unknown'] as const;
const contactChannels = ['phone', 'line', 'whatsapp'] as const;
const locales = ['en', 'th', 'ru'] as const;
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const dishFieldNames = [
  'dish_name_or_slug',
  'spicyLevel',
  'allergens_status',
  'allergens_contains',
  'noGlutenIngredients',
  'jainFriendly',
  'verifiedBy',
  'verifiedAt_yyyy_mm_dd',
] as const;
const dishFieldNameSet = new Set<string>(dishFieldNames);

const fieldSpecs: FieldSpec[] = [
  { key: 'maps_share_url', kind: 'url', hosts: allowedHosts.maps, target: TARGETS.mapsUrl },
  { key: 'address_en_th_ru_correct', kind: 'enum', values: yesNo },
  { key: 'address_correction_en', kind: 'text' },
  { key: 'address_correction_th', kind: 'text' },
  { key: 'address_correction_ru', kind: 'text' },
  { key: 'open_days', kind: 'list-enum', values: days },
  { key: 'dine_in_hours', kind: 'text' },
  { key: 'last_kitchen_order', kind: 'text' },
  { key: 'regular_closed_days', kind: 'list-enum', values: [...days, 'none'] },
  { key: 'special_hours_notice_process', kind: 'text' },
  { key: 'line_url_full_https', kind: 'url', hosts: allowedHosts.line, target: TARGETS.lineUrl },
  {
    key: 'whatsapp_url_full_https',
    kind: 'url',
    hosts: allowedHosts.whatsapp,
    target: TARGETS.whatsappUrl,
  },
  { key: 'preferred_channel', kind: 'enum', values: [...contactChannels, 'unknown'] },
  { key: 'response_hours_en', kind: 'text' },
  { key: 'response_hours_th', kind: 'text' },
  { key: 'response_hours_ru', kind: 'text' },
  { key: 'payment_methods_status_if_none_ticked', kind: 'enum', values: ['unknown'] },
  { key: 'payment_note_en', kind: 'text' },
  { key: 'payment_note_th', kind: 'text' },
  { key: 'payment_note_ru', kind: 'text' },
  { key: 'landmark_en', kind: 'text' },
  { key: 'landmark_th', kind: 'text' },
  { key: 'landmark_ru', kind: 'text' },
  { key: 'parking_en', kind: 'text' },
  { key: 'parking_th', kind: 'text' },
  { key: 'parking_ru', kind: 'text' },
  { key: 'arrival_note_en', kind: 'text' },
  { key: 'arrival_note_th', kind: 'text' },
  { key: 'arrival_note_ru', kind: 'text' },
  { key: 'pickup_status', kind: 'enum', values: ['unknown', 'yes', 'no'] },
  { key: 'pickup_channel', kind: 'enum', values: [...contactChannels, 'unknown'] },
  { key: 'pickup_lead_time_en', kind: 'text' },
  { key: 'pickup_lead_time_th', kind: 'text' },
  { key: 'pickup_lead_time_ru', kind: 'text' },
  { key: 'pickup_price_note_en', kind: 'text' },
  { key: 'pickup_price_note_th', kind: 'text' },
  { key: 'pickup_price_note_ru', kind: 'text' },
  {
    key: 'price_policy',
    kind: 'enum',
    values: [
      'unknown',
      'same_everywhere',
      'website_matches_counter',
      'website_matches_grab',
      'channels_differ',
    ],
    target: TARGETS.pricePolicy,
  },
  {
    key: 'active_platforms',
    kind: 'enum',
    values: ['unknown', 'none', 'grabfood', 'line man', 'grabfood + line man'],
  },
  {
    key: 'grabfood_share_url_full_https',
    kind: 'url',
    hosts: allowedHosts.grab,
  },
  {
    key: 'line_man_share_url_full_https',
    kind: 'url',
    hosts: allowedHosts.lineMan,
  },
  {
    key: 'website_may_list_only_these_confirmed_platforms',
    kind: 'enum',
    values: yesNo,
  },
  { key: 'delivery_hours_or_app_only', kind: 'text' },
  { key: 'confirmed_delivery_area_if_any', kind: 'text' },
  {
    key: 'reservations',
    kind: 'enum',
    values: ['unknown', 'not-accepted', 'accepted', 'large-groups-only'],
  },
  { key: 'reservation_channel', kind: 'enum', values: [...contactChannels, 'unknown'] },
  { key: 'reservation_minimum_party_size', kind: 'integer' },
  { key: 'reservation_lead_time_en', kind: 'text' },
  { key: 'reservation_lead_time_th', kind: 'text' },
  { key: 'reservation_lead_time_ru', kind: 'text' },
  { key: 'reservation_note_en', kind: 'text' },
  { key: 'reservation_note_th', kind: 'text' },
  { key: 'reservation_note_ru', kind: 'text' },
  { key: 'spice_requests', kind: 'enum', values: ['unknown', 'not-offered', 'offered'] },
  {
    key: 'spice_request_levels_if_offered',
    kind: 'list-enum',
    values: ['not-spicy', 'mild', 'medium', 'hot'],
  },
  { key: 'spice_request_scope_en', kind: 'text' },
  { key: 'spice_request_scope_th', kind: 'text' },
  { key: 'spice_request_scope_ru', kind: 'text' },
  { key: 'spice_policy_verified_by', kind: 'text' },
  { key: 'spice_policy_verified_at_yyyy_mm_dd', kind: 'date' },
  {
    key: 'dietary_questions_contact',
    kind: 'enum',
    values: [...contactChannels, 'unknown'],
  },
  { key: 'owner_verified_allergen_dishes', kind: 'text' },
  { key: 'verified_no_gluten_ingredient_dishes', kind: 'text' },
  { key: 'confirmed_cross_contact_copy', kind: 'text' },
  { key: 'other_real_kitchen_adjustments', kind: 'text' },
  { key: 'halal_guidance', kind: 'enum', values: ['unknown', 'verified'] },
  {
    key: 'halal_certification_status',
    kind: 'enum',
    values: ['not-certified', 'certified'],
  },
  { key: 'halal_certification_detail_en_if_certified', kind: 'text' },
  { key: 'halal_certification_detail_th_if_certified', kind: 'text' },
  { key: 'halal_certification_detail_ru_if_certified', kind: 'text' },
  { key: 'cooking_alcohol', kind: 'enum', values: ['used', 'not-used'] },
  { key: 'halal_note_en', kind: 'text' },
  { key: 'halal_note_th', kind: 'text' },
  { key: 'halal_note_ru', kind: 'text' },
  { key: 'halal_guidance_verified_by', kind: 'text' },
  { key: 'halal_guidance_verified_at_yyyy_mm_dd', kind: 'date' },
  { key: 'reshoot_date_and_approver_if_needed', kind: 'text' },
  {
    key: 'google_business_profile_url',
    kind: 'url',
    hosts: allowedHosts.googleProfile,
    target: TARGETS.googleProfile,
  },
  {
    key: 'google_direct_review_url',
    kind: 'url',
    hosts: allowedHosts.googleReview,
    target: TARGETS.googleReview,
  },
  { key: 'google_owner_or_manager', kind: 'text' },
  { key: 'happycow_claimed_and_account_owner', kind: 'text' },
  { key: 'permission_to_sync_pin_address_hours_phone_website_menu_and_grab', kind: 'checkbox' },
  { key: 'final.confirmed_by', kind: 'text' },
  { key: 'final.confirmation_date', kind: 'date' },
  { key: 'final.change_contact', kind: 'text' },
  { key: 'final.permission_to_publish_confirmed_information', kind: 'checkbox' },
];

const mediaFieldSpecs: Omit<FieldSpec, 'key'>[] = [
  { kind: 'text' },
  { kind: 'text' },
  { kind: 'enum', values: ['pending', 'unknown', 'denied', 'granted'] },
  { kind: 'enum', values: ['unknown', 'website_and_derivatives'] },
  { kind: 'text' },
  { kind: 'date' },
  { kind: 'enum', values: ['unknown', 'yes', 'no'] },
  {
    kind: 'enum',
    values: ['not_applicable', 'pending', 'unknown', 'denied', 'granted'],
  },
  { kind: 'text' },
  { kind: 'text' },
  { kind: 'text' },
  { kind: 'enum', values: ['unknown', 'yes', 'no'] },
  { kind: 'text' },
];
const mediaFieldNames = [
  'candidate_filename',
  'rights_holder',
  'permission',
  'permission_scope',
  'confirmed_by',
  'confirmed_at_yyyy_mm_dd',
  'identifiable_people',
  'people_consent',
  'alt_en',
  'alt_th',
  'alt_ru',
  'credit_required',
  'credit_text_if_required',
] as const;

for (const kind of MEDIA_KINDS) {
  mediaFieldNames.forEach((name, index) => {
    fieldSpecs.push({ key: `media.${kind}.${name}`, ...mediaFieldSpecs[index]! });
  });
}

const unsupportedKeys = [
  'last_kitchen_order, special_hours_notice_process',
  'delivery_hours_or_app_only, confirmed_delivery_area_if_any',
  'owner_verified_allergen_dishes, verified_no_gluten_ingredient_dishes',
  'confirmed_cross_contact_copy, other_real_kitchen_adjustments',
  'reshoot_date_and_approver_if_needed',
  'google_owner_or_manager, happycow_claimed_and_account_owner (external access records)',
  'media origin, intrinsic width/height and upload path (complete in CMS during asset prep)',
] as const;

const specByKey = new Map(fieldSpecs.map((spec) => [spec.key, spec]));
const rawValues = new Map<string, string>();
const rawDishBlocks: RawDishBlock[] = [];
const parsingErrors: string[] = [];
const selectedPaymentMethods = new Set<string>();
let paymentOther: string | null = null;

function stripInlineComment(value: string): string {
  return value.replace(/\s+(?:#|\/\/).*$/, '').trim();
}

function namespaceKey(section: string, key: string): string {
  if (key === 'reshoot_date_and_approver_if_needed') return key;
  if (section.startsWith('media.')) return `${section}.${key}`;
  if (section === 'final') return `final.${key}`;
  return key;
}

function remember(key: string, value: string, lineNumber: number) {
  if (rawValues.has(key)) {
    parsingErrors.push(`${key}: duplicate key at line ${lineNumber}`);
    return;
  }
  rawValues.set(key, stripInlineComment(value));
}

function newDishBlock(lineNumber: number): RawDishBlock {
  const block = { lineNumber, values: new Map<string, string>() };
  rawDishBlocks.push(block);
  return block;
}

function rememberDish(block: RawDishBlock, key: string, value: string, lineNumber: number) {
  if (block.values.has(key)) {
    parsingErrors.push(
      `dish block at line ${block.lineNumber}: duplicate ${key} at line ${lineNumber}`,
    );
    return;
  }
  block.values.set(key, stripInlineComment(value));
}

function parseSource(source: string) {
  let section = '';
  let activeDishBlock: RawDishBlock | null = null;

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('#')) return;
    if (trimmed.startsWith('<!--') || trimmed.startsWith('//') || trimmed.startsWith('>')) return;

    if (/^PRIORITY DISH FACTS\b/i.test(trimmed)) {
      section = 'dish';
      activeDishBlock = newDishBlock(lineNumber);
      return;
    }

    const mediaHeading = trimmed.match(/^MEDIA ASSET:\s*(HERO|EXTERIOR|FAMILY|INTERIOR)\b/i);
    if (mediaHeading?.[1]) {
      section = `media.${mediaHeading[1].toLowerCase()}`;
      activeDishBlock = null;
      return;
    }
    if (/^FINAL CONFIRMATION\b/i.test(trimmed)) {
      section = 'final';
      activeDishBlock = null;
      return;
    }
    if (/^PAYMENT\b/i.test(trimmed)) {
      section = 'payment';
      activeDishBlock = null;
      return;
    }
    if (/^[A-Z][A-Z +/&-]+(?:\s*\/.*)?$/.test(trimmed)) {
      section = '';
      activeDishBlock = null;
      return;
    }

    const checkbox = trimmed.match(/^\[([ xX])\]\s*(.+)$/);
    if (checkbox?.[1] !== undefined && checkbox[2]) {
      const checked = checkbox[1].toLowerCase() === 'x';
      const label = stripInlineComment(checkbox[2].trim());
      if (section === 'payment') {
        const methodMatch = label.match(/^(cash|promptpay|card|bank_transfer)\b/);
        if (checked && methodMatch?.[1]) selectedPaymentMethods.add(methodMatch[1]);
        const otherMatch = label.match(/^other:\s*(.*)$/);
        if (checked && otherMatch) paymentOther = stripInlineComment(otherMatch[1] ?? '');
        return;
      }
      const checkboxKey = namespaceKey(section, label);
      remember(checkboxKey, checked ? 'checked' : 'unchecked', lineNumber);
      return;
    }

    const pair = trimmed.match(/^([A-Za-z][A-Za-z0-9_.-]*):\s*(.*)$/);
    if (!pair?.[1]) return;
    if (pair[1] === 'payment_methods_confirmed') return;
    if (section === 'dish' && dishFieldNameSet.has(pair[1])) {
      if (pair[1] === 'dish_name_or_slug' && activeDishBlock?.values.has('dish_name_or_slug')) {
        activeDishBlock = newDishBlock(lineNumber);
      }
      activeDishBlock ??= newDishBlock(lineNumber);
      rememberDish(activeDishBlock, pair[1], pair[2] ?? '', lineNumber);
      return;
    }
    remember(namespaceKey(section, pair[1]), pair[2] ?? '', lineNumber);
  });
}

function isBlockedValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === 'unknown' ||
    normalized === 'ไม่ทราบ' ||
    /^_+$/.test(normalized) ||
    normalized.includes('____') ||
    normalized.includes(' | ')
  );
}

function bangkokDate(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseTimeRange(value: string): { open: string; close: string } | null {
  const match = value.match(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/);
  if (!match?.[1] || !match[2] || match[1] === match[2]) return null;
  return { open: match[1], close: match[2] };
}

function parseHoursSchedule(
  value: string,
  expectedOpenDays: readonly string[],
): Array<{ days: string[]; open: string; close: string }> | null {
  const singleRange = parseTimeRange(value);
  if (singleRange) return [{ days: [...expectedOpenDays], ...singleRange }];

  const periods: Array<{ days: string[]; open: string; close: string }> = [];
  const covered = new Set<string>();
  for (const rawPeriod of value.split(';')) {
    const match = rawPeriod.trim().match(/^([a-z,]+)\s*=\s*(.+)$/i);
    if (!match?.[1] || !match[2]) return null;
    const periodDays = normalizeList(match[1]);
    const range = parseTimeRange(match[2].trim());
    if (
      !range ||
      periodDays.length === 0 ||
      periodDays.some((day) => !days.includes(day as (typeof days)[number]) || covered.has(day))
    ) {
      return null;
    }
    periodDays.forEach((day) => covered.add(day));
    periods.push({ days: periodDays, ...range });
  }
  return periods.length > 0 &&
    covered.size === expectedOpenDays.length &&
    expectedOpenDays.every((day) => covered.has(day))
    ? periods
    : null;
}

function coordinateSpec(key: string): FieldSpec | null {
  return /^coordinates_-?\d+(?:\.\d+)?_-?\d+(?:\.\d+)?$/.test(key)
    ? { key, kind: 'enum', values: yesNo, target: TARGETS.geo }
    : null;
}

function normalizeList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function main() {
  const inputArg = process.argv.slice(2).find((argument) => argument !== '--');
  if (!inputArg) {
    console.error('Usage: pnpm intake:check -- <filled-facts-lock.md-or-txt>');
    process.exitCode = 1;
    return;
  }

  let source: string;
  try {
    source = readFileSync(resolve(process.cwd(), inputArg), 'utf8');
  } catch (error) {
    console.error(
      `Cannot read intake file: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  parseSource(source);

  const errors = [...parsingErrors];
  const blocked = new Map<string, string>();
  const confirmed = new Map<string, string>();
  const normalized = new Map<string, string | string[]>();
  let existingDishSlugs = new Set<string>();
  let allowedAllergenIds = new Set<string>();

  try {
    existingDishSlugs = new Set(
      readdirSync(resolve(process.cwd(), 'src/content/dishes'))
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -'.json'.length)),
    );
    const allergenRows = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/content/allergens.json'), 'utf8'),
    ) as unknown;
    if (!Array.isArray(allergenRows)) throw new Error('expected a JSON array');
    const allergenIds = allergenRows.map((row) =>
      typeof row === 'object' && row !== null && typeof row.id === 'string' ? row.id : null,
    );
    if (allergenIds.some((id) => id === null)) throw new Error('every allergen needs a string id');
    allowedAllergenIds = new Set(allergenIds as string[]);
  } catch (error) {
    errors.push(
      `repository dish references: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  for (const [key] of rawValues) {
    if (!specByKey.has(key) && !coordinateSpec(key)) errors.push(`${key}: unrecognized intake key`);
  }

  const specs = [...fieldSpecs];
  for (const key of rawValues.keys()) {
    const dynamicSpec = coordinateSpec(key);
    if (dynamicSpec && !specByKey.has(key)) specs.push(dynamicSpec);
  }

  for (const spec of specs) {
    const raw = rawValues.get(spec.key);
    if (raw === undefined || isBlockedValue(raw)) {
      blocked.set(spec.key, raw === undefined ? 'missing from intake' : 'unknown or empty');
      continue;
    }

    const value = raw.trim();
    const lower = value.toLowerCase();
    if (spec.kind === 'enum') {
      if (!spec.values?.includes(lower)) {
        errors.push(`${spec.key}: expected one of ${spec.values?.join(', ')}`);
        continue;
      }
      normalized.set(spec.key, lower);
      confirmed.set(spec.key, lower);
      continue;
    }
    if (spec.kind === 'list-enum') {
      const values = normalizeList(value);
      const invalid = values.filter((item) => !spec.values?.includes(item));
      if (values.length === 0 || invalid.length > 0) {
        errors.push(
          `${spec.key}: expected a comma-separated subset of ${spec.values?.join(', ')}${
            invalid.length > 0 ? `; invalid: ${invalid.join(', ')}` : ''
          }`,
        );
        continue;
      }
      if (new Set(values).size !== values.length) {
        errors.push(`${spec.key}: duplicate list value`);
        continue;
      }
      normalized.set(spec.key, values);
      confirmed.set(spec.key, values.join(', '));
      continue;
    }
    if (spec.kind === 'url') {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        errors.push(`${spec.key}: expected a full HTTPS URL`);
        continue;
      }
      if (url.protocol !== 'https:' || url.username || url.password) {
        errors.push(`${spec.key}: expected a credential-free full HTTPS URL`);
        continue;
      }
      if (spec.hosts && !spec.hosts.includes(url.hostname.toLowerCase())) {
        errors.push(`${spec.key}: unsupported host ${url.hostname}`);
        continue;
      }
      normalized.set(spec.key, url.href);
      confirmed.set(spec.key, url.href);
      continue;
    }
    if (spec.kind === 'date') {
      if (!validCalendarDate(value) || value > bangkokDate()) {
        errors.push(`${spec.key}: expected a real non-future YYYY-MM-DD date`);
        continue;
      }
      normalized.set(spec.key, value);
      confirmed.set(spec.key, value);
      continue;
    }
    if (spec.kind === 'integer') {
      if (!/^\d+$/.test(value)) {
        errors.push(`${spec.key}: expected an integer`);
        continue;
      }
      normalized.set(spec.key, value);
      confirmed.set(spec.key, value);
      continue;
    }
    if (spec.kind === 'checkbox') {
      if (lower !== 'checked') {
        blocked.set(spec.key, 'checkbox is not checked');
        continue;
      }
      normalized.set(spec.key, 'checked');
      confirmed.set(spec.key, 'checked');
      continue;
    }

    const text = value.replace(/\s+/g, ' ').trim();
    if (!text) {
      blocked.set(spec.key, 'unknown or empty');
      continue;
    }
    normalized.set(spec.key, text);
    confirmed.set(spec.key, text);
  }

  const get = (key: string): string | string[] | undefined => normalized.get(key);
  const has = (key: string): boolean => normalized.has(key);
  const blockGroup = (key: string, reason: string) => blocked.set(key, reason);
  const mappings: Mapping[] = [];
  const addMapping = (sourceKey: string, target: string) =>
    mappings.push({ source: sourceKey, target });

  function requireFields(group: string, keys: readonly string[]): boolean {
    const missing = keys.filter((key) => !has(key));
    if (missing.length === 0) return true;
    blockGroup(group, `requires ${missing.join(', ')}`);
    return false;
  }

  function messengerReady(group: string, channel: string): boolean {
    if (channel === 'line' && !has('line_url_full_https')) {
      blockGroup(group, 'LINE requires line_url_full_https');
      return false;
    }
    if (channel === 'whatsapp' && !has('whatsapp_url_full_https')) {
      blockGroup(group, 'WhatsApp requires whatsapp_url_full_https');
      return false;
    }
    return true;
  }

  function localizedMapping(prefix: string, target: string): boolean {
    const keys = locales.map((locale) => `${prefix}_${locale}`);
    if (!requireFields(`${prefix}.publish`, keys)) return false;
    keys.forEach((key, index) => addMapping(key, `${target}.${locales[index]}`));
    return true;
  }

  const seenDishSlugs = new Set<string>();
  rawDishBlocks.forEach((block, index) => {
    const rawSlug = block.values.get('dish_name_or_slug');
    const candidateSlug = rawSlug && !isBlockedValue(rawSlug) ? rawSlug.trim() : null;
    const displaySlug =
      candidateSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidateSlug)
        ? candidateSlug
        : `block-${index + 1}`;
    const sourceKey = (field: string) => `dish[${displaySlug}].${field}`;
    const rawValue = (field: string) => block.values.get(field);
    const hasValue = (field: string) => {
      const value = rawValue(field);
      return value !== undefined && !isBlockedValue(value);
    };
    const blockIsEmpty = dishFieldNames.every((field) => !hasValue(field));

    if (blockIsEmpty) {
      dishFieldNames.forEach((field) => blocked.set(sourceKey(field), 'unknown or empty'));
      return;
    }

    let slugReady = false;
    if (!candidateSlug) {
      blocked.set(sourceKey('dish_name_or_slug'), 'exact existing dish slug is required');
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidateSlug)) {
      errors.push(`${sourceKey('dish_name_or_slug')}: expected an exact lowercase dish file stem`);
    } else if (!existingDishSlugs.has(candidateSlug)) {
      errors.push(`${sourceKey('dish_name_or_slug')}: no matching src/content/dishes JSON file`);
    } else if (seenDishSlugs.has(candidateSlug)) {
      errors.push(`${sourceKey('dish_name_or_slug')}: duplicate dish block`);
    } else {
      seenDishSlugs.add(candidateSlug);
      confirmed.set(sourceKey('dish_name_or_slug'), candidateSlug);
      slugReady = true;
    }

    function dishEnum(field: string, allowed: readonly string[]): string | undefined {
      const raw = rawValue(field);
      if (raw === undefined || isBlockedValue(raw)) {
        blocked.set(sourceKey(field), 'unknown or empty');
        return undefined;
      }
      const value = raw.trim().toLowerCase();
      if (!allowed.includes(value)) {
        errors.push(`${sourceKey(field)}: expected one of ${allowed.join(', ')}`);
        return undefined;
      }
      confirmed.set(sourceKey(field), value);
      return value;
    }

    const spicyLevel = dishEnum('spicyLevel', ['0', '1', '2', '3']);
    const allergenStatus = dishEnum('allergens_status', ['verified']);
    const noGlutenIngredients = dishEnum('noGlutenIngredients', ['yes', 'no']);
    const jainFriendly = dishEnum('jainFriendly', ['yes', 'no']);
    const containsRaw = rawValue('allergens_contains');
    let allergensReady = false;

    if (allergenStatus === 'verified') {
      if (containsRaw === undefined || isBlockedValue(containsRaw)) {
        blocked.set(
          sourceKey('allergens_contains'),
          'verified allergens require explicit none or allowlisted ids',
        );
      } else {
        const lower = containsRaw.trim().toLowerCase();
        const contains =
          lower === 'none'
            ? []
            : lower
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        const invalid = contains.filter((id) => !allowedAllergenIds.has(id));
        if (
          lower.includes(';') ||
          contains.length !== new Set(contains).size ||
          (contains.length === 0 && lower !== 'none') ||
          invalid.length > 0
        ) {
          errors.push(
            `${sourceKey('allergens_contains')}: expected explicit none or unique comma-separated ids from ${[
              ...allowedAllergenIds,
            ]
              .sort()
              .join(', ')}`,
          );
        } else {
          confirmed.set(
            sourceKey('allergens_contains'),
            contains.length > 0 ? contains.join(', ') : 'none',
          );
          allergensReady = true;
        }
      }
    } else if (hasValue('allergens_contains')) {
      errors.push(`${sourceKey('allergens_contains')}: values require allergens_status: verified`);
    } else {
      blocked.set(sourceKey('allergens_contains'), 'unknown or empty');
    }

    const hasConfirmedFact =
      spicyLevel !== undefined ||
      allergenStatus === 'verified' ||
      noGlutenIngredients !== undefined ||
      jainFriendly !== undefined;
    const verifiedByRaw = rawValue('verifiedBy');
    const verifiedAtRaw = rawValue('verifiedAt_yyyy_mm_dd');
    let verifiedBy: string | undefined;
    let verifiedAt: string | undefined;

    if (hasConfirmedFact) {
      if (verifiedByRaw === undefined || isBlockedValue(verifiedByRaw)) {
        blocked.set(sourceKey('verifiedBy'), 'confirmed food facts require verifiedBy');
      } else {
        verifiedBy = verifiedByRaw.replace(/\s+/g, ' ').trim();
        confirmed.set(sourceKey('verifiedBy'), verifiedBy);
      }
      if (verifiedAtRaw === undefined || isBlockedValue(verifiedAtRaw)) {
        blocked.set(
          sourceKey('verifiedAt_yyyy_mm_dd'),
          'confirmed food facts require verifiedAt_yyyy_mm_dd',
        );
      } else if (!validCalendarDate(verifiedAtRaw) || verifiedAtRaw > bangkokDate()) {
        errors.push(
          `${sourceKey('verifiedAt_yyyy_mm_dd')}: expected a real non-future YYYY-MM-DD date`,
        );
      } else {
        verifiedAt = verifiedAtRaw;
        confirmed.set(sourceKey('verifiedAt_yyyy_mm_dd'), verifiedAt);
      }
    } else {
      blocked.set(sourceKey('verifiedBy'), 'no confirmed food fact');
      blocked.set(sourceKey('verifiedAt_yyyy_mm_dd'), 'no confirmed food fact');
      if (hasValue('verifiedBy') || hasValue('verifiedAt_yyyy_mm_dd')) {
        errors.push(
          `${sourceKey('verifiedBy')}: verification metadata requires at least one confirmed food fact`,
        );
      }
    }

    if (!slugReady || !verifiedBy || !verifiedAt) return;
    const target = `src/content/dishes/${candidateSlug}.json:foodFacts`;
    let mappedFact = false;
    if (spicyLevel !== undefined) {
      addMapping(sourceKey('spicyLevel'), `${target}.spicyLevel`);
      mappedFact = true;
    }
    if (allergenStatus === 'verified' && allergensReady) {
      addMapping(sourceKey('allergens_status'), `${target}.allergens.status`);
      addMapping(sourceKey('allergens_contains'), `${target}.allergens.contains`);
      mappedFact = true;
    }
    if (noGlutenIngredients !== undefined) {
      addMapping(sourceKey('noGlutenIngredients'), `${target}.noGlutenIngredients`);
      mappedFact = true;
    }
    if (jainFriendly !== undefined) {
      addMapping(sourceKey('jainFriendly'), `${target}.jainFriendly`);
      mappedFact = true;
    }
    if (mappedFact) {
      addMapping(sourceKey('verifiedBy'), `${target}.verifiedBy`);
      addMapping(sourceKey('verifiedAt_yyyy_mm_dd'), `${target}.verifiedAt`);
    }
  });

  if (has('maps_share_url')) addMapping('maps_share_url', TARGETS.mapsUrl);
  const coordinateKeys = [...normalized.keys()].filter((key) => coordinateSpec(key));
  for (const key of coordinateKeys) {
    const match = key.match(/^coordinates_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/);
    const latitude = Number(match?.[1]);
    const longitude = Number(match?.[2]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.push(`${key}: latitude in the key must be between -90 and 90`);
      continue;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push(`${key}: longitude in the key must be between -180 and 180`);
      continue;
    }
    if (get(key) === 'yes') {
      if (has('maps_share_url')) addMapping(key, TARGETS.geo);
      else blockGroup(`${key}.publish`, 'confirmed coordinates require maps_share_url');
    } else if (get(key) === 'no') {
      blockGroup(`${key}.publish`, 'candidate coordinates were rejected; supply a corrected pin');
    }
  }

  const addressStatus = get('address_en_th_ru_correct');
  const addressCorrectionKeys = locales.map((locale) => `address_correction_${locale}`);
  const presentAddressCorrections = addressCorrectionKeys.filter(has);
  if (addressStatus === 'no') {
    if (requireFields('address.publish', addressCorrectionKeys)) {
      addressCorrectionKeys.forEach((key, index) =>
        addMapping(key, `${TARGETS.address}.${locales[index]}`),
      );
    }
  } else if (addressStatus === 'yes' && presentAddressCorrections.length > 0) {
    errors.push('address_en_th_ru_correct: yes must leave address_correction_en/th/ru empty');
  } else if (presentAddressCorrections.length > 0) {
    blockGroup('address.publish', 'address corrections require address_en_th_ru_correct: no');
  }

  const hoursKeys = ['open_days', 'dine_in_hours', 'regular_closed_days'] as const;
  const presentHoursKeys = hoursKeys.filter(has);
  if (presentHoursKeys.length > 0) {
    let hoursReady = requireFields('regular_hours.publish', hoursKeys);
    const openDays = get('open_days');
    const closedDays = get('regular_closed_days');
    const schedule =
      Array.isArray(openDays) && typeof get('dine_in_hours') === 'string'
        ? parseHoursSchedule(String(get('dine_in_hours')), openDays)
        : null;
    if (!schedule) {
      errors.push(
        'dine_in_hours: expected HH:MM-HH:MM or disjoint day groups like mon,tue=07:00-22:00;wed=08:00-21:00 covering every open day once',
      );
      hoursReady = false;
    }
    if (Array.isArray(closedDays) && closedDays.includes('none') && closedDays.length > 1) {
      errors.push('regular_closed_days: none cannot be combined with weekdays');
      hoursReady = false;
    }
    if (Array.isArray(openDays) && Array.isArray(closedDays)) {
      const normalizedClosed = closedDays.includes('none') ? [] : closedDays;
      const overlap = openDays.filter((day) => normalizedClosed.includes(day));
      const covered = new Set([...openDays, ...normalizedClosed]);
      if (overlap.length > 0 || days.some((day) => !covered.has(day))) {
        errors.push(
          'open_days/regular_closed_days: lists must be disjoint and cover mon through sun',
        );
        hoursReady = false;
      }
    }
    if (hoursReady && schedule) {
      addMapping('open_days', `${TARGETS.hours}[].days (coverage evidence)`);
      addMapping('regular_closed_days', `${TARGETS.hours}[].days (complement evidence)`);
      addMapping('dine_in_hours', `${TARGETS.hours}[]`);
    }
  }

  if (has('line_url_full_https')) addMapping('line_url_full_https', TARGETS.lineUrl);
  if (has('whatsapp_url_full_https')) addMapping('whatsapp_url_full_https', TARGETS.whatsappUrl);
  const preferredChannel = get('preferred_channel');
  if (
    typeof preferredChannel === 'string' &&
    messengerReady('preferred_channel.publish', preferredChannel)
  ) {
    addMapping('preferred_channel', TARGETS.primaryContact);
  }
  localizedMapping('response_hours', TARGETS.responseHours);

  const paymentMap: Record<string, string> = {
    cash: 'cash',
    promptpay: 'thai-qr',
    card: 'card',
    bank_transfer: 'bank-transfer',
  };
  if (selectedPaymentMethods.size > 0) {
    const methods = [...selectedPaymentMethods].map((method) => paymentMap[method]!).sort();
    confirmed.set('payment_methods_confirmed', methods.join(', '));
    normalized.set('payment_methods_confirmed', methods);
    addMapping('payment_methods_confirmed', TARGETS.paymentMethods);
  } else {
    blockGroup('payment_methods_confirmed', 'no confirmed payment checkbox is checked');
  }
  if (paymentOther !== null) {
    errors.push(
      isBlockedValue(paymentOther)
        ? 'payment_methods_confirmed.other: checked but its value is empty'
        : 'payment_methods_confirmed.other: unsupported by the current operations schema',
    );
  }
  const paymentNoteKeys = locales.map((locale) => `payment_note_${locale}`);
  const presentPaymentNotes = paymentNoteKeys.filter(has);
  if (presentPaymentNotes.length > 0) {
    if (selectedPaymentMethods.size === 0) {
      blockGroup('payment_note.publish', 'payment note requires confirmed payment methods');
    } else if (requireFields('payment_note.publish', paymentNoteKeys)) {
      paymentNoteKeys.forEach((key, index) =>
        addMapping(key, `${TARGETS.paymentNote}.${locales[index]}`),
      );
    }
  }

  localizedMapping('landmark', TARGETS.landmark);
  localizedMapping('parking', TARGETS.parking);
  localizedMapping('arrival_note', TARGETS.arrivalNote);

  const activePlatforms = get('active_platforms');
  const platformUrlKeys = {
    grabfood: 'grabfood_share_url_full_https',
    'line man': 'line_man_share_url_full_https',
  } as const;
  const expectedPlatforms: Array<keyof typeof platformUrlKeys> =
    activePlatforms === 'grabfood + line man'
      ? ['grabfood', 'line man']
      : activePlatforms === 'grabfood' || activePlatforms === 'line man'
        ? [activePlatforms]
        : [];
  let deliveryReady = typeof activePlatforms === 'string';
  if (activePlatforms === 'none') {
    const unexpected = Object.values(platformUrlKeys).filter(has);
    if (unexpected.length > 0) {
      errors.push(`active_platforms: none must leave ${unexpected.join(', ')} empty`);
      deliveryReady = false;
    }
  } else if (expectedPlatforms.length > 0) {
    const missingUrls = expectedPlatforms
      .map((platform) => platformUrlKeys[platform])
      .filter((key) => !has(key));
    if (missingUrls.length > 0) {
      blockGroup('active_platforms.publish', `requires ${missingUrls.join(', ')}`);
      deliveryReady = false;
    }
    const unexpected = Object.entries(platformUrlKeys)
      .filter(
        ([platform, key]) =>
          !expectedPlatforms.includes(platform as keyof typeof platformUrlKeys) && has(key),
      )
      .map(([, key]) => key);
    if (unexpected.length > 0) {
      errors.push(`active_platforms: unlisted platform URL(s): ${unexpected.join(', ')}`);
      deliveryReady = false;
    }
  }
  if (has('line_man_share_url_full_https')) {
    const lineManUrl = new URL(String(get('line_man_share_url_full_https')));
    if (
      ['wongnai.com', 'www.wongnai.com'].includes(lineManUrl.hostname.toLowerCase()) &&
      !/\/delivery\/.+\/order\/?$/.test(lineManUrl.pathname)
    ) {
      errors.push('line_man_share_url_full_https: Wongnai URL must use a /delivery/.../order path');
      deliveryReady = false;
    }
  }
  if (
    typeof activePlatforms === 'string' &&
    get('website_may_list_only_these_confirmed_platforms') !== 'yes'
  ) {
    blockGroup(
      'active_platforms.publish',
      'requires website_may_list_only_these_confirmed_platforms: yes',
    );
    deliveryReady = false;
  }
  if (deliveryReady && typeof activePlatforms === 'string') {
    addMapping('active_platforms', 'src/content/settings.json:site.orderingLinks');
    for (const platform of expectedPlatforms) {
      addMapping(
        platformUrlKeys[platform],
        `src/content/settings.json:site.orderingLinks[provider=${
          platform === 'grabfood' ? 'GrabFood' : 'LINE MAN'
        }].url`,
      );
    }
  }

  const grabConfirmed =
    expectedPlatforms.includes('grabfood') && has('grabfood_share_url_full_https');
  if (has('price_policy')) {
    if (get('price_policy') === 'website_matches_grab' && !grabConfirmed) {
      blockGroup(
        'price_policy.publish',
        'website_matches_grab requires an active GrabFood platform with a confirmed URL',
      );
    } else {
      addMapping('price_policy', TARGETS.pricePolicy);
    }
  }

  const pickupStatus = get('pickup_status');
  const pickupChannel = get('pickup_channel');
  const pickupLeadKeys = locales.map((locale) => `pickup_lead_time_${locale}`);
  const pickupPriceKeys = locales.map((locale) => `pickup_price_note_${locale}`);
  const pickupOptionalKeys = [...pickupLeadKeys, ...pickupPriceKeys];
  if (typeof pickupStatus === 'string') {
    if (pickupStatus === 'no') {
      const forbiddenPickupFields = ['pickup_channel', ...pickupOptionalKeys].filter(has);
      if (forbiddenPickupFields.length > 0) {
        errors.push(`pickup_status: no must leave ${forbiddenPickupFields.join(', ')} empty`);
      } else {
        addMapping('pickup_status', `${TARGETS.pickup}.enabled`);
      }
    } else {
      let pickupReady = true;
      if (typeof pickupChannel !== 'string' || !messengerReady('pickup.publish', pickupChannel)) {
        blockGroup('pickup.publish', 'available pickup requires a usable pickup_channel');
        pickupReady = false;
      }
      const presentLead = pickupLeadKeys.filter(has);
      const presentPrice = pickupPriceKeys.filter(has);
      if (presentLead.length > 0 && !requireFields('pickup.publish', pickupLeadKeys)) {
        pickupReady = false;
      }
      if (presentPrice.length > 0 && !requireFields('pickup.publish', pickupPriceKeys)) {
        pickupReady = false;
      }
      if (presentPrice.length > 0 && !has('price_policy')) {
        blockGroup('pickup.publish', 'pickup price note requires a confirmed price_policy');
        pickupReady = false;
      }
      if (pickupReady) {
        addMapping('pickup_status', `${TARGETS.pickup}.enabled`);
        addMapping('pickup_channel', `${TARGETS.pickup}.contact`);
        if (presentLead.length === pickupLeadKeys.length) {
          pickupLeadKeys.forEach((key, index) =>
            addMapping(key, `${TARGETS.pickup}.leadTime.${locales[index]}`),
          );
        }
        if (presentPrice.length === pickupPriceKeys.length) {
          pickupPriceKeys.forEach((key, index) =>
            addMapping(key, `${TARGETS.pickup}.priceNote.${locales[index]}`),
          );
        }
      }
    }
  }

  const reservationStatus = get('reservations');
  const reservationChannel = get('reservation_channel');
  const reservationLeadKeys = locales.map((locale) => `reservation_lead_time_${locale}`);
  const reservationNoteKeys = locales.map((locale) => `reservation_note_${locale}`);
  if (typeof reservationStatus === 'string') {
    let reservationReady = true;
    if (reservationStatus === 'not-accepted') {
      const forbidden = [
        'reservation_channel',
        'reservation_minimum_party_size',
        ...reservationLeadKeys,
      ].filter(has);
      if (forbidden.length > 0) {
        errors.push(`reservations: not-accepted must leave ${forbidden.join(', ')} empty`);
        reservationReady = false;
      }
    } else {
      if (
        typeof reservationChannel !== 'string' ||
        !messengerReady('reservations.publish', reservationChannel)
      ) {
        blockGroup(
          'reservations.publish',
          'accepted reservations require a usable reservation_channel',
        );
        reservationReady = false;
      }
      if (!requireFields('reservations.publish', reservationLeadKeys)) reservationReady = false;
      if (reservationStatus === 'large-groups-only') {
        const minimum = Number(get('reservation_minimum_party_size'));
        if (!has('reservation_minimum_party_size') || minimum < 2) {
          blockGroup('reservations.publish', 'large-groups-only requires minimum party size >= 2');
          reservationReady = false;
        }
      } else if (has('reservation_minimum_party_size')) {
        errors.push('reservations: minimum party size belongs only to large-groups-only');
        reservationReady = false;
      }
    }
    const presentNotes = reservationNoteKeys.filter(has);
    if (presentNotes.length > 0 && presentNotes.length !== reservationNoteKeys.length) {
      blockGroup('reservation_note.publish', 'reservation note must be complete in EN/TH/RU');
      reservationReady = false;
    }
    if (reservationReady) {
      addMapping('reservations', `${TARGETS.reservations}.status`);
      if (reservationStatus !== 'not-accepted') {
        addMapping('reservation_channel', `${TARGETS.reservations}.contact`);
        reservationLeadKeys.forEach((key, index) =>
          addMapping(key, `${TARGETS.reservations}.leadTime.${locales[index]}`),
        );
        if (reservationStatus === 'large-groups-only') {
          addMapping('reservation_minimum_party_size', `${TARGETS.reservations}.minimumPartySize`);
        }
      }
      if (presentNotes.length === reservationNoteKeys.length) {
        reservationNoteKeys.forEach((key, index) =>
          addMapping(key, `${TARGETS.reservations}.note.${locales[index]}`),
        );
      }
    }
  }

  const spiceStatus = get('spice_requests');
  const spiceLevels = get('spice_request_levels_if_offered');
  const spiceScopeKeys = locales.map((locale) => `spice_request_scope_${locale}`);
  const spiceVerificationKeys = ['spice_policy_verified_by', 'spice_policy_verified_at_yyyy_mm_dd'];
  if (typeof spiceStatus === 'string') {
    let spiceReady = requireFields('spice_requests.publish', spiceVerificationKeys);
    if (spiceStatus === 'offered') {
      if (!Array.isArray(spiceLevels) || spiceLevels.length === 0) {
        blockGroup('spice_requests.publish', 'offered requires at least one request level');
        spiceReady = false;
      }
      if (!requireFields('spice_requests.publish', spiceScopeKeys)) spiceReady = false;
    } else {
      const forbidden = ['spice_request_levels_if_offered', ...spiceScopeKeys].filter(has);
      if (forbidden.length > 0) {
        errors.push(`spice_requests: not-offered must leave ${forbidden.join(', ')} empty`);
        spiceReady = false;
      }
    }
    if (spiceReady) {
      addMapping('spice_requests', `${TARGETS.spiceRequests}.status`);
      addMapping('spice_policy_verified_by', `${TARGETS.spiceRequests}.verifiedBy`);
      addMapping('spice_policy_verified_at_yyyy_mm_dd', `${TARGETS.spiceRequests}.verifiedAt`);
      if (spiceStatus === 'offered') {
        addMapping('spice_request_levels_if_offered', `${TARGETS.spiceRequests}.levels`);
        spiceScopeKeys.forEach((key, index) =>
          addMapping(key, `${TARGETS.spiceRequests}.scopeNote.${locales[index]}`),
        );
      }
    }
  }

  const dietaryChannel = get('dietary_questions_contact');
  if (
    typeof dietaryChannel === 'string' &&
    messengerReady('dietary_questions_contact.publish', dietaryChannel)
  ) {
    addMapping('dietary_questions_contact', TARGETS.dietaryQuestionsContact);
  }

  const halalStatus = get('halal_guidance');
  const halalDetailKeys = locales.map(
    (locale) => `halal_certification_detail_${locale}_if_certified`,
  );
  const halalNoteKeys = locales.map((locale) => `halal_note_${locale}`);
  const halalRequired = [
    'halal_certification_status',
    'cooking_alcohol',
    ...halalNoteKeys,
    'halal_guidance_verified_by',
    'halal_guidance_verified_at_yyyy_mm_dd',
  ];
  if (halalStatus === 'verified') {
    let halalReady = requireFields('halal_guidance.publish', halalRequired);
    if (get('halal_certification_status') === 'certified') {
      if (!requireFields('halal_guidance.publish', halalDetailKeys)) halalReady = false;
    } else {
      const unexpected = halalDetailKeys.filter(has);
      if (unexpected.length > 0) {
        errors.push(`halal_guidance: not-certified must leave ${unexpected.join(', ')} empty`);
        halalReady = false;
      }
    }
    if (halalReady) {
      addMapping('halal_certification_status', `${TARGETS.halalGuidance}.certificationStatus`);
      addMapping('cooking_alcohol', `${TARGETS.halalGuidance}.cookingAlcohol`);
      halalNoteKeys.forEach((key, index) =>
        addMapping(key, `${TARGETS.halalGuidance}.note.${locales[index]}`),
      );
      addMapping('halal_guidance_verified_by', `${TARGETS.halalGuidance}.verifiedBy`);
      addMapping('halal_guidance_verified_at_yyyy_mm_dd', `${TARGETS.halalGuidance}.verifiedAt`);
      if (get('halal_certification_status') === 'certified') {
        halalDetailKeys.forEach((key, index) =>
          addMapping(key, `${TARGETS.halalGuidance}.certificationDetail.${locales[index]}`),
        );
      }
    }
  }

  const googleProfile = get('google_business_profile_url');
  const googleReview = get('google_direct_review_url');
  if (typeof googleProfile === 'string' && googleProfile === googleReview) {
    errors.push('google_direct_review_url: must be verified separately from Google profile URL');
  } else {
    if (has('google_business_profile_url')) {
      addMapping('google_business_profile_url', TARGETS.googleProfile);
    }
    if (has('google_direct_review_url'))
      addMapping('google_direct_review_url', TARGETS.googleReview);
  }

  for (const kind of MEDIA_KINDS) {
    const prefix = `media.${kind}`;
    const permission = get(`${prefix}.permission`);
    if (permission !== 'granted') {
      blockGroup(`${prefix}.publish`, `permission is ${String(permission ?? 'unknown')}`);
      continue;
    }
    const required = [
      `${prefix}.candidate_filename`,
      `${prefix}.rights_holder`,
      `${prefix}.permission_scope`,
      `${prefix}.confirmed_by`,
      `${prefix}.confirmed_at_yyyy_mm_dd`,
      `${prefix}.identifiable_people`,
      `${prefix}.people_consent`,
      `${prefix}.alt_en`,
      `${prefix}.alt_th`,
      `${prefix}.alt_ru`,
      `${prefix}.credit_required`,
    ];
    let mediaReady = requireFields(`${prefix}.publish`, required);
    if (get(`${prefix}.permission_scope`) !== 'website_and_derivatives') {
      blockGroup(`${prefix}.publish`, 'granted permission requires website_and_derivatives scope');
      mediaReady = false;
    }
    const people = get(`${prefix}.identifiable_people`);
    const consent = get(`${prefix}.people_consent`);
    if (people === 'yes' && consent !== 'granted') {
      errors.push(`${prefix}: identifiable people require granted consent`);
      mediaReady = false;
    }
    if (people === 'no' && consent !== 'not_applicable') {
      errors.push(`${prefix}: no identifiable people requires not_applicable consent`);
      mediaReady = false;
    }
    if (get(`${prefix}.credit_required`) === 'yes' && !has(`${prefix}.credit_text_if_required`)) {
      blockGroup(`${prefix}.publish`, 'credit_required yes requires credit_text_if_required');
      mediaReady = false;
    }
    if (!mediaReady) continue;

    addMapping(
      `${prefix}.candidate_filename`,
      `${TARGETS.siteMedia}[kind=${kind}].src-after-upload`,
    );
    addMapping(`${prefix}.rights_holder`, `${TARGETS.siteMedia}[kind=${kind}].rightsHolder`);
    addMapping(`${prefix}.permission`, `${TARGETS.siteMedia}[kind=${kind}].permission`);
    addMapping(`${prefix}.permission_scope`, `${TARGETS.siteMedia}[kind=${kind}].permissionScope`);
    addMapping(`${prefix}.confirmed_by`, `${TARGETS.siteMedia}[kind=${kind}].confirmedBy`);
    addMapping(
      `${prefix}.confirmed_at_yyyy_mm_dd`,
      `${TARGETS.siteMedia}[kind=${kind}].confirmedAt`,
    );
    addMapping(
      `${prefix}.identifiable_people`,
      `${TARGETS.siteMedia}[kind=${kind}].peopleVisibility`,
    );
    addMapping(`${prefix}.people_consent`, `${TARGETS.siteMedia}[kind=${kind}].peopleConsent`);
    locales.forEach((locale) =>
      addMapping(`${prefix}.alt_${locale}`, `${TARGETS.siteMedia}[kind=${kind}].alt.${locale}`),
    );
    if (has(`${prefix}.credit_text_if_required`)) {
      addMapping(`${prefix}.credit_text_if_required`, `${TARGETS.siteMedia}[kind=${kind}].credit`);
    }
  }

  const finalReady = requireFields('final.publish', [
    'final.confirmed_by',
    'final.confirmation_date',
    'final.change_contact',
    'final.permission_to_publish_confirmed_information',
  ]);
  const publishableMappings = finalReady && errors.length === 0 ? mappings : [];
  if (!finalReady) {
    blockGroup('publishable_mappings', 'withheld until FINAL permission and metadata are complete');
  } else if (errors.length > 0) {
    blockGroup('publishable_mappings', 'withheld until all validation errors are resolved');
  }

  const sortedErrors = [...new Set(errors)].sort();
  const sortedConfirmed = [...confirmed.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const sortedBlocked = [...blocked.entries()].sort(([left], [right]) => left.localeCompare(right));
  const sortedMappings = [...publishableMappings]
    .filter(
      (mapping, index, array) =>
        array.findIndex(
          (candidate) => candidate.source === mapping.source && candidate.target === mapping.target,
        ) === index,
    )
    .sort((left, right) =>
      `${left.source}\0${left.target}`.localeCompare(`${right.source}\0${right.target}`),
    );

  function printSection(title: string, rows: readonly string[]) {
    console.log(`${title} (${rows.length})`);
    console.log(rows.length > 0 ? rows.map((row) => `- ${row}`).join('\n') : '- none');
  }

  console.log(`INTAKE CHECK: ${inputArg}`);
  printSection('ERRORS', sortedErrors);
  printSection(
    'CONFIRMED',
    sortedConfirmed.map(([key, value]) => `${key} = ${value}`),
  );
  printSection(
    'BLOCKED',
    sortedBlocked.map(([key, reason]) => `${key}: ${reason}`),
  );
  printSection(
    'PUBLISHABLE MAPPINGS',
    sortedMappings.map(({ source: sourceKey, target }) => `${sourceKey} -> ${target}`),
  );
  printSection('UNSUPPORTED / MANUAL', unsupportedKeys);

  if (sortedErrors.length > 0) process.exitCode = 2;
}

main();
