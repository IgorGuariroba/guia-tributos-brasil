// Configuração flat do ESLint.
// Foco: erros reais + padrão consistente (imports, nomes, uso de const/let).
// Formatação (indentação, aspas, espaços) é responsabilidade do Prettier —
// aqui não duplicamos regras estilísticas para evitar conflito entre as duas.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'audit/reports/**',
      '.lighthouseci/**',
      'evidencias-e2e/**',
      'public/fonts/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // Imports: sem duplicatas e sempre no topo do módulo.
      'no-duplicate-imports': 'error',
      'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],

      // Padrão de código.
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'multi-line'],
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',
      'no-else-return': ['error', { allowElseIf: false }],

      // Ruído / erros silenciosos.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-await-in-loop': 'off',
      'require-atomic-updates': 'off',
    },
  },

  {
    // Código executado dentro do navegador via page.evaluate().
    files: ['audit/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
