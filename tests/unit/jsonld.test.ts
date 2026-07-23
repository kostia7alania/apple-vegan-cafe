import { describe, expect, it } from 'vitest';
import { buildArticle, buildBreadcrumb, buildMenu, buildRestaurant } from '../../src/lib/jsonld';

const restaurantInput = {
  name: 'Apple Vegan Cafe & Restaurant',
  url: 'https://apple-vegan-cafe.com/',
  menuUrl: 'https://apple-vegan-cafe.com/menu/',
  telephone: '+66 82 679 7797',
  address: '414/39 Moo 9, Bang Lamung, Chonburi 20150, Thailand',
  geo: null,
  images: [],
  sameAs: ['https://www.instagram.com/apple.vegan.restaurant/'],
  hours: [{ days: ['mon', 'sat'], open: '07:30', close: '22:30' }],
};

describe('buildRestaurant', () => {
  it('includes the required and recommended fields', () => {
    const jsonld = buildRestaurant(restaurantInput);
    expect(jsonld['@type']).toBe('Restaurant');
    expect(jsonld.name).toBeTruthy();
    expect(jsonld.address).toBeTruthy();
    expect(jsonld.menu).toBe('https://apple-vegan-cafe.com/menu/');
    expect(jsonld.servesCuisine).toContain('Vegan');
    expect(jsonld.openingHoursSpecification).toHaveLength(1);
  });

  it('NEVER emits self-serving review markup (Google policy)', () => {
    const jsonld = buildRestaurant(restaurantInput);
    expect(jsonld).not.toHaveProperty('aggregateRating');
    expect(jsonld).not.toHaveProperty('review');
  });

  it('omits geo when the exact pin is unknown', () => {
    expect(buildRestaurant(restaurantInput)).not.toHaveProperty('geo');
    expect(
      buildRestaurant({ ...restaurantInput, geo: { lat: 12.93, lng: 100.88 } }),
    ).toHaveProperty('geo');
  });

  it('emits OrderAction only when an ordering URL exists', () => {
    expect(buildRestaurant(restaurantInput)).not.toHaveProperty('potentialAction');
    const withOrder = buildRestaurant({
      ...restaurantInput,
      orderUrl: 'https://r.grab.com/o/Fj6Zvya2',
    });
    expect(withOrder.potentialAction).toEqual({
      '@type': 'OrderAction',
      target: 'https://r.grab.com/o/Fj6Zvya2',
    });
  });
});

describe('buildMenu', () => {
  const menu = buildMenu({
    url: 'https://apple-vegan-cafe.com/menu/',
    locale: 'th',
    sections: [
      {
        name: 'อาหารจานเดียว',
        items: [
          { name: 'ผัดไทยเจ', price: 149, description: 'ไม่ใส่น้ำปลา' },
          { name: 'ข้าวสวย', price: 40 },
        ],
      },
      { name: 'เครื่องดื่ม', items: [{ name: 'ลาเต้เย็น', price: 110 }] },
    ],
  });
  const sections = menu.hasMenuSection as {
    name: string;
    hasMenuItem: { name: string; description?: string; offers: { price: number } }[];
  }[];

  it('maps sections and items with THB offers', () => {
    expect(menu['@type']).toBe('Menu');
    expect(menu.inLanguage).toBe('th');
    expect(sections).toHaveLength(2);
    expect(sections[0]!.hasMenuItem).toHaveLength(2);
    expect(sections[0]!.hasMenuItem[0]!.offers).toEqual({
      '@type': 'Offer',
      price: 149,
      priceCurrency: 'THB',
    });
  });

  it('omits description when a dish has none', () => {
    expect(sections[0]!.hasMenuItem[0]).toHaveProperty('description');
    expect(sections[0]!.hasMenuItem[1]).not.toHaveProperty('description');
  });

  it('never smuggles rating markup into the menu', () => {
    expect(JSON.stringify(menu)).not.toContain('aggregateRating');
  });
});

describe('buildBreadcrumb', () => {
  it('numbers positions from 1', () => {
    const jsonld = buildBreadcrumb([
      { name: 'Home', url: 'https://apple-vegan-cafe.com/' },
      { name: 'Menu', url: 'https://apple-vegan-cafe.com/menu/' },
    ]);
    const items = jsonld.itemListElement as { position: number }[];
    expect(items.map((i) => i.position)).toEqual([1, 2]);
  });
});

describe('buildArticle', () => {
  it('emits Article with language and dates', () => {
    const jsonld = buildArticle({
      title: 'Welcome',
      description: 'Our site is live',
      url: 'https://apple-vegan-cafe.com/blog/welcome/',
      locale: 'en',
      authorName: 'Family',
      publishedAt: new Date('2026-07-15'),
    });
    expect(jsonld['@type']).toBe('Article');
    expect(jsonld.inLanguage).toBe('en');
    expect(jsonld.datePublished).toMatch(/^2026-07-15/);
    expect(jsonld).not.toHaveProperty('dateModified');
  });
});
