import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  localePath,
  normalizePath,
  splitLocaleFromPath,
  structuralAlternates,
} from '../../src/lib/urls';

describe('normalizePath', () => {
  it('adds leading and trailing slashes', () => {
    expect(normalizePath('menu')).toBe('/menu/');
    expect(normalizePath('/menu')).toBe('/menu/');
    expect(normalizePath('/menu/')).toBe('/menu/');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('localePath', () => {
  it('keeps the default locale at the root', () => {
    expect(localePath('en', '/menu/')).toBe('/menu/');
    expect(localePath('en')).toBe('/');
  });
  it('prefixes non-default locales', () => {
    expect(localePath('th', '/menu/')).toBe('/th/menu/');
    expect(localePath('ru', '/')).toBe('/ru/');
  });
});

describe('structuralAlternates', () => {
  it('returns one path per locale', () => {
    expect(structuralAlternates('/contact/')).toEqual({
      en: '/contact/',
      th: '/th/contact/',
      ru: '/ru/contact/',
    });
  });
});

describe('splitLocaleFromPath', () => {
  it('detects prefixed locales', () => {
    expect(splitLocaleFromPath('/th/menu/')).toEqual(['th', '/menu/']);
    expect(splitLocaleFromPath('/ru/')).toEqual(['ru', '/']);
  });
  it('falls back to the default locale', () => {
    expect(splitLocaleFromPath('/menu/')).toEqual(['en', '/menu/']);
  });
});

describe('absoluteUrl', () => {
  it('joins site origin with a normalized path', () => {
    expect(absoluteUrl('https://apple-vegan-cafe.com', 'menu')).toBe(
      'https://apple-vegan-cafe.com/menu/',
    );
    expect(absoluteUrl(new URL('https://apple-vegan-cafe.com'), '/th/menu/')).toBe(
      'https://apple-vegan-cafe.com/th/menu/',
    );
  });

  it('percent-encodes Thai script when the URL is serialized', () => {
    const href = absoluteUrl('https://apple-vegan-cafe.com', '/th/ร้านอาหารเจ-พัทยา/');
    expect(href).toBe(
      'https://apple-vegan-cafe.com/th/%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%88-%E0%B8%9E%E0%B8%B1%E0%B8%97%E0%B8%A2%E0%B8%B2/',
    );
    expect(decodeURIComponent(href)).toContain('ร้านอาหารเจ-พัทยา');
  });
});
