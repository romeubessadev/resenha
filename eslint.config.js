const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
});

module.exports = [
  ...compat.extends('expo'),
  {
    // `coverage/` é saída gerada pelo vitest (HTML) — o parser do eslint
    // engasga nela e derrubava `npm run lint` inteiro. Já ignorada no git.
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'supabase/functions/**', 'coverage/**'],
  },
];
