import React from 'react'
import { render } from 'react-dom'

const requireTests = require.context('../components', true, /js$/)
const tests = requireTests.keys().map(path => {
  const [suite, name] = path.replace('./', '').replace(/.js$/, '').split('/')
  return {
    suite,
    name,
    case: requireTests(path),
  }
})

tests.forEach(test => {
  happo.define(
    `${test.suite}-${test.name}`,
    () => {
      const div = document.createElement('div')
      div.style.padding = '8px'
      div.style.display = 'inline-block'
      document.body.appendChild(div)
      const TestCase = test.case.default
      render(<TestCase />, div)
    },
    { viewports: ['desktop', 'mobile'] }
  )
})
