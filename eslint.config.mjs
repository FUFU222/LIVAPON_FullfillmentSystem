import nextConfig from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: ['.next', 'node_modules', '.bfg-report']
  },
  ...nextConfig,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'import/no-anonymous-default-export': 'off'
    }
  }
];
