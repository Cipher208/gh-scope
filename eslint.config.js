import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * The project already typechecks with `tsc` and tests with node:test; ESLint is
 * here for the class of problems neither catches: a hook called conditionally,
 * a dependency array that lies, a variable that is declared and never used.
 *
 * Deliberately not enabled: type-aware rules. They need a full program for
 * every file, which slows CI noticeably for rules that mostly repeat what tsc
 * already says.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'test-build/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // The plugin ships both shapes under similar names; `configs.flat` is the one
  // that plugs into a flat config without the compatibility layer.
  reactHooks.configs.flat.recommended,
  {
    rules: {
      // The crash boundary logs the error on purpose; that log is the only way
      // a failed render leaves a trace in the console.
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Runs before React, in the browser: storage and document, nothing else.
    files: ['public/**/*.js'],
    languageOptions: {
      globals: { localStorage: 'readonly', document: 'readonly' },
    },
  },
  {
    // Node scripts: console and process are their whole environment. The e2e
    // file also mixes in page-side callbacks for page.evaluate(), where
    // `location` is the browser's.
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        location: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      // Tests reach into the DOM and into fixtures; the assertions make the
      // non-null claims explicit, so the `!` operator is not a shortcut here.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
