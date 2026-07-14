import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends('next/core-web-vitals'),
  {
    // Guardrail: all currency formatting must go through formatCurrency in
    // src/lib/currency.ts. Inline Intl.NumberFormat calls with hardcoded
    // 'USD'/'UGX' were the source of wrong-symbol bugs across ~20 pages.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'NewExpression[callee.object.name="Intl"][callee.property.name="NumberFormat"]',
          message:
            'Do not use new Intl.NumberFormat directly — import formatCurrency from @/lib/currency instead.',
        },
      ],
    },
  },
  {
    // The shared formatter itself and regional pricing legitimately use Intl.
    files: ['src/lib/currency.ts', 'src/lib/regional-pricing.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
