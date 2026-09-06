// @ts-check
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['fetch/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { sourceType: 'module' },
      globals: globals.node,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
  {
    files: ['frontend/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { sourceType: 'module' },
      globals: globals.browser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Untrusted league-member data (team/first/last/username) is rendered into
      // the DOM. Only textContent is safe; innerHTML/outerHTML would allow stored XSS.
      'no-restricted-properties': [
        'error',
        {
          object: '*',
          property: 'innerHTML',
          message:
            'Use textContent (or createElement) instead of innerHTML to avoid XSS from league data.',
        },
        {
          object: '*',
          property: 'outerHTML',
          message:
            'Use textContent (or createElement) instead of outerHTML to avoid XSS from league data.',
        },
      ],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/public/data/**'],
  },
  prettier,
];
