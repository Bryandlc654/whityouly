import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next 16 ya no incluye `next lint`: ESLint 9 se ejecuta directamente con
// configuración plana. Se ignoran los artefactos de build y las entregas de
// diseño que viven fuera de `src`.
export default [
  {
    ignores: [
      '.next/**',
      '.next-*/**',
      'node_modules/**',
      'node_modules_old/**',
      '.audit/**',
      'Withyouly_v58/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Reglas nuevas de React Compiler (eslint-plugin-react-hooks 7). El
      // proyecto las cumple en su mayoría, pero hay cargas de datos en efectos
      // que son intencionales y estables; se dejan como aviso para no convertir
      // la lint en un bloqueo de despliegue.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
];
