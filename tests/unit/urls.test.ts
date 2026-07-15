import { describe, expect, it } from 'vitest';
import {
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
