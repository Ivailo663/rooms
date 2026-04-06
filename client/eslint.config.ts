import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'array-callback-return': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: 'error',
      'no-constant-condition': 'off',
      'max-depth': [
        'error',
        {
          max: 3,
        },
      ],
    },
  },
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
])
