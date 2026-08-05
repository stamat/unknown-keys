import neostandard from 'neostandard'

export default [
  ...neostandard(),
  {
    rules: {
      '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }]
    }
  }
]
