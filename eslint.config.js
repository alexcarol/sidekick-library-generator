import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_',
      }],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'import/extensions': ['error', 'ignorePackages'],
      'import/no-unresolved': 'error',
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
  },
]; 