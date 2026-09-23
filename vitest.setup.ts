import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Komponententests laufen per "@vitest-environment jsdom"-Docblock in jsdom,
// reine Logik-Tests bleiben in Node - cleanup ist dort ein No-Op.
afterEach(() => {
  cleanup()
})
