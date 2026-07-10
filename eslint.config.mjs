import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      'import/no-anonymous-default-export': 'off',
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  globalIgnores(['.next/**', 'out/**', 'release/**', 'node_modules/**', 'apple/**'])
]);
