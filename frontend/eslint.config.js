/** @type {import('eslint').Linter.Config} */
const config = {
  extends: [
    'next/core-web-vitals',
    'next/typescript',
  ],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
  ],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      extends: [
        'plugin:@typescript-eslint/recommended',
      ],
    },
  ],
};

export default config;