import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt()
  .append({
    // Markdown is not linted (no markdown processor configured; .md is otherwise
    // parsed as JS and fails). `docs/**` and `.github/**` are likewise excluded.
    ignores: ['.github/**', '**/*.md']
  })
  .overrideRules({
    'import/first': 'off',
    'import/order': 'off',
    'vue/max-attributes-per-line': ['error', { singleline: 5 }],
    'vue/no-multiple-template-root': 'off',
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'comma-dangle': 'off'
  })
