import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js', '*.mjs', 'api/**']
  },
  
  // Base ESLint recommended rules
  eslint.configs.recommended,
  
  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,
  
  // Custom configuration for TypeScript files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      },
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    rules: {
      // Allow unused variables starting with underscore or 'next' (Express convention)
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_|^next$',
        varsIgnorePattern: '^_'
      }],
      // Allow any type (can be stricter later)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow require statements for dynamic imports
      '@typescript-eslint/no-require-imports': 'off',
      // Allow empty functions (e.g., for default callbacks)
      '@typescript-eslint/no-empty-function': 'warn',
      // Allow namespace for Express Request type augmentation
      '@typescript-eslint/no-namespace': 'off',
      // Warn on useless escapes instead of error
      'no-useless-escape': 'warn'
    }
  },
  
  // Configuration for test files
  {
    files: ['tests/**/*.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    },
    rules: {
      // Relax rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_|^next$',
        varsIgnorePattern: '^_'
      }]
    }
  }
);

