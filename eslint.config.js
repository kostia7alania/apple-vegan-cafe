import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    ignores: [
      'dist/',
      '.astro/',
      '.pnpm-store/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      '**/*.local/**',
    ],
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      // scripts are CLI tools: console output is their UI
      'no-console': 'off',
    },
  },
);
