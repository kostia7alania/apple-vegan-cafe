import { describe, expect, it } from 'vitest';
import { buildArticle, buildBreadcrumb, buildRestaurant } from '../../src/lib/jsonld';

const restaurantInput = {
  name: 'Apple Vegan Cafe & Restaurant',
  url: 'https://applevegancafe.com/',
  menuUrl: 'https://applevegancafe.com/menu/',
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
    expect(jsonld.menu).toBe('https://applevegancafe.com/menu/');
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
});

describe('buildBreadcrumb', () => {
  it('numbers positions from 1', () => {
    const jsonld = buildBreadcrumb([
      { name: 'Home', url: 'https://applevegancafe.com/' },
      { name: 'Menu', url: 'https://applevegancafe.com/menu/' },
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
      url: 'https://applevegancafe.com/blog/welcome/',
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
