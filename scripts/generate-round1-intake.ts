/**
 * Prints a short Thai-first owner reply packet to stdout.
 *
 * This command is deliberately read-only. Repository values are context only:
 * every answer stays unknown/unchecked until the owner explicitly confirms it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface SettingsFile {
  site: {
    primaryContact: 'phone' | 'line' | 'whatsapp';
    orderingLinks: Array<{ provider: string; url: string }>;
  };
}

interface LocationsFile {
  pattaya: {
    address: { en: string; th: string; ru: string };
    hours: Array<{ days: Day[]; open: string; close: string }>;
  };
}

const root = resolve(import.meta.dirname, '..');
const allDays: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
}

function commentValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hoursCandidates(hours: LocationsFile['pattaya']['hours']) {
  const openDays = [...new Set(hours.flatMap((period) => period.days))].sort(
    (left, right) => allDays.indexOf(left) - allDays.indexOf(right),
  );
  const closedDays = allDays.filter((day) => !openDays.includes(day));
  const ranges = hours.map((period) => {
    const range = `${period.open}-${period.close}`;
    return hours.length === 1 ? range : `${period.days.join(',')}=${range}`;
  });
  return {
    openDays: openDays.join(','),
    hours: ranges.join(';'),
    closedDays: closedDays.length > 0 ? closedDays.join(',') : 'none',
  };
}

let settings: SettingsFile['site'];
let location: LocationsFile['pattaya'];
try {
  settings = readJson<SettingsFile>('src/content/settings.json').site;
  location = readJson<LocationsFile>('src/content/locations.json').pattaya;
} catch (error) {
  console.error(
    `cannot read current repository facts: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const repoHours = hoursCandidates(location.hours);
const grabFood = settings.orderingLinks.find(({ provider }) => provider === 'GrabFood');
const activePlatforms = settings.orderingLinks.map(({ provider }) => provider).join(' + ');
let answerCount = 0;
const answer = (value: string) => {
  answerCount++;
  return value;
};

const lines = [
  '# OWNER ROUND 1 / คำตอบรอบแรก',
  '# เปลี่ยน unknown เฉพาะข้อมูลที่ยืนยันได้; ข้อมูลเว็บอาจเก่าหรือขัดแย้ง กรุณาแก้ไขหรือคง unknown',
  '# ช่อง [ ] ให้เปลี่ยนเป็น [x] เฉพาะรายการที่ยืนยันแล้ว',
  '',
  'MAP / แผนที่',
  answer(
    'maps_share_url: unknown # เจ้าของร้านเปิดโปรไฟล์/หมุดจริงใน Google Maps กด Share แล้ววางลิงก์; ถ้ายังไม่ยืนยันให้คง unknown — ห้ามใช้ลิงก์/พิกัดจากเว็บไดเรกทอรี',
  ),
  `# ที่อยู่บนเว็บ EN: ${commentValue(location.address.en)}`,
  `# ที่อยู่บนเว็บ TH: ${commentValue(location.address.th)}`,
  `# ที่อยู่บนเว็บ RU: ${commentValue(location.address.ru)}`,
  answer('address_en_th_ru_correct: unknown # เลือก yes | no | unknown'),
  '',
  'REGULAR HOURS / เวลาเปิดปกติ',
  answer(`open_days: unknown # เว็บตอนนี้ ${repoHours.openDays}; ยืนยัน/แก้ไข/unknown`),
  answer(`dine_in_hours: unknown # เว็บตอนนี้ ${repoHours.hours}; รูปแบบ HH:MM-HH:MM`),
  answer(
    `regular_closed_days: unknown # เว็บตอนนี้ ${repoHours.closedDays}; ใช้ mon..sun หรือ none`,
  ),
  '',
  'MESSAGING / ช่องทางข้อความ',
  answer('line_url_full_https: unknown # ใส่ LINE URL เต็มแบบ https://... หรือ unknown'),
  answer('whatsapp_url_full_https: unknown # ใส่ WhatsApp URL เต็มแบบ https://... หรือ unknown'),
  answer(
    `preferred_channel: unknown # เลือก phone | line | whatsapp | unknown; เว็บตอนนี้ ${settings.primaryContact}`,
  ),
  '',
  'PAYMENT / การชำระเงิน',
  answer('[ ] cash / เงินสด'),
  answer('[ ] promptpay / Thai QR'),
  answer('[ ] card / บัตร'),
  answer('[ ] bank_transfer / โอนธนาคาร'),
  answer('payment_methods_status_if_none_ticked: unknown # คง unknown ถ้ายังไม่ติ๊กวิธีใด'),
  '',
  'PICKUP + PRICE / รับเองและราคา',
  answer('pickup_status: unknown # เลือก yes | no | unknown'),
  answer('pickup_channel: unknown # เลือก phone | line | whatsapp | unknown'),
  answer(
    'price_policy: unknown # same_everywhere=เท่ากัน | website_matches_counter=เว็บเท่าหน้าร้าน | website_matches_grab=เว็บเท่า Grab | channels_differ=ต่างกัน',
  ),
  '',
  'DELIVERY / เดลิเวอรี',
  answer(
    `active_platforms: unknown # none | GrabFood | LINE MAN | GrabFood + LINE MAN | unknown${activePlatforms ? `; เว็บตอนนี้ ${activePlatforms}` : ''}`,
  ),
  answer(
    `grabfood_share_url_full_https: unknown # ยืนยัน/แก้ไข URL${grabFood ? ` เว็บตอนนี้ ${grabFood.url}` : ''}`,
  ),
  answer('line_man_share_url_full_https: unknown # ใส่ official share/order URL หรือ unknown'),
  answer('website_may_list_only_these_confirmed_platforms: unknown # เลือก yes | no | unknown'),
  '',
  'RESERVATIONS / การจองโต๊ะ',
  answer('reservations: unknown # not-accepted | accepted | large-groups-only | unknown'),
  '',
  'FINAL CONFIRMATION / ยืนยันครั้งสุดท้าย',
  answer('confirmed_by: unknown # ชื่อผู้ยืนยันคำตอบ Round 1'),
  answer('confirmation_date: unknown # วันที่ยืนยันรูปแบบ YYYY-MM-DD'),
  answer('change_contact: unknown # ช่องทางติดต่อเมื่อข้อมูลต้องแก้ไข เช่น phone/LINE/WhatsApp'),
  answer(
    '[ ] permission_to_publish_confirmed_information # [x] = อนุญาตเผยแพร่เฉพาะค่าที่เจ้าของยืนยันในข้อความนี้',
  ),
];

if (answerCount !== 25) {
  console.error(`round-1 packet invariant failed: expected 25 answer lines, got ${answerCount}`);
  process.exit(1);
}

console.log(lines.join('\n'));
