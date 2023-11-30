module.exports = {
  root: true,
  env: {
    browser: true
  },
  globals: {
    niivue: true
  },
  ignorePatterns: ['dist/**/*', 'devdocs/**/*'],
  extends: ['standard', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'no-unreachable': 'error',
    curly: ['error', 'all'],
    camelcase: 'off',
    'import/order': 'error',
    'no-use-before-define': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/no-use-before-define': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prettier/prettier': [
      'error',
      {
        tabWidth: 2,
        printWidth: 120,
        singleQuote: true,
        trailingComma: 'none',
        semi: false
      }
    ]
  }
}
