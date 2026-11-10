import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'
import { resetAuthStateForTests } from '../features/auth/auth-api'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Each test starts like a fresh page load.
  sessionStorage.clear()
  resetAuthStateForTests()
})
afterAll(() => server.close())
