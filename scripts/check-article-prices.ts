/**
 * Price guard: every concrete «dish (price)» claim in articles must match the
 * dish collection. Prices drift when the owner updates Grab; articles must
 * never quote stale numbers (this script was born after catching ฿120 pad thai
 * in a Thai draft while the menu said ฿149).
 *
 * Only phrases registered below are checked — range claims («от 90 бат…»)
 * stay prose. Add a pattern when an article starts quoting a new dish.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DISHES_DIR = 'src/content/dishes';
const ARTICLES_DIR = 'src/content/articles';

const price = new Map<string, number>();
for (const f of readdirSync(DISHES_DIR)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(readFileSync(join(DISHES_DIR, f), 'utf8')) as { price_thb: number };
  price.set(f.replace(/\.json$/, ''), d.price_thb);
}

// phrase regex (captures the quoted price) → dish file id
const CLAIMS: [RegExp, string][] = [
  [/pad thai \(฿(\d+)\)/gi, 'vegan-pad-thai'],
  [/пад тай за (\d+)/gi, 'vegan-pad-thai'],
  [/ผัดไทยเจ \((\d+) บาท\)/g, 'vegan-pad-thai'],
  [/red curry \(฿(\d+)\)/gi, 'red-curry-vegan'],
  [/красный карри за (\d+)/gi, 'red-curry-vegan'],
  [/mushroom pad krapao \(฿(\d+)\)/gi, 'eryngii-mushroom-pad-krapao-over-rice'],
  [/mango smoothie is ฿(\d+)/gi, 'mango-smoothie'],
  [/манговый смузи за (\d+)/gi, 'mango-smoothie'],
  [/iced latte ฿(\d+)/gi, 'iced-latte'],
  [/латте за (\d+)/gi, 'iced-latte'],
  [/แกงมัสมั่นเจ \((\d+) บาท\)/g, 'massaman-curry-vegan'],
  [/ต้มยำเจ\s*\((\d+) บาท\)/g, 'vegan-tom-yum-soup'],
];

let checked = 0;
const errors: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
}

for (const file of walk(ARTICLES_DIR)) {
  const text = readFileSync(file, 'utf8');
  for (const [re, id] of CLAIMS) {
    const expected = price.get(id);
    if (expected === undefined) {
      errors.push(`${file}: guard references unknown dish «${id}»`);
      continue;
    }
    for (const m of text.matchAll(re)) {
      checked += 1;
      const quoted = Number(m[1]);
      if (quoted !== expected) {
        errors.push(`${file}: «${m[0]}» quotes ฿${quoted}, but ${id} costs ฿${expected}`);
      }
    }
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`price guard: ${e}`);
  process.exit(1);
}
console.log(`price guard: ${checked} article price claim(s) match the dish collection`);
