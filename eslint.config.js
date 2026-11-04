import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// CLAUDE.md, architecture rules 1 and 2: the engine, content and config are
// pure. No React, no DOM, no wall-clock time and no Math.random, so the same
// seed and the same actions always give the same game.
const PURE_FILES = [
  'src/engine/**/*.{ts,tsx}',
  'src/content/**/*.{ts,tsx}',
  'src/config/**/*.{ts,tsx}',
];
const PURE_MESSAGE = 'src/engine, src/content and src/config must stay pure (CLAUDE.md rule 1).';
const RNG_MESSAGE = 'Use the seeded RNG stored in GameState (CLAUDE.md rule 2).';
const TIME_MESSAGE =
  'Wall-clock time breaks replays. Pass time in through an action (CLAUDE.md rule 2).';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'assets', 'docs', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: PURE_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: PURE_MESSAGE },
            { name: 'react-dom', message: PURE_MESSAGE },
          ],
          patterns: [
            { regex: '^react(-dom)?/', message: PURE_MESSAGE },
            { regex: '(^|/)(ui|store)(/|$)', message: PURE_MESSAGE },
            { regex: '\\.css$', message: PURE_MESSAGE },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: RNG_MESSAGE },
        { object: 'Date', property: 'now', message: TIME_MESSAGE },
        { object: 'performance', property: 'now', message: TIME_MESSAGE },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: TIME_MESSAGE },
        { selector: "CallExpression[callee.name='Date']", message: TIME_MESSAGE },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'navigator',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
        ].map((name) => ({ name, message: PURE_MESSAGE })),
      ],
    },
  },
  prettier,
]);
