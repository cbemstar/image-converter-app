const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['tools/layout-tool/vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    plugins: { '@typescript-eslint': tsPlugin, react },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off'
    }
  }
];
