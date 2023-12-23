import matijaoe from '@matijaoe/eslint-config'

export default matijaoe({
  propsDestructure: true,
  rules: {
    'ts/no-use-before-define': 'off',
  }
})
