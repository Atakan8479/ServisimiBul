import type { ConsoleMessage } from '@playwright/test'

/**
 * The browser logs a 401 from GET /api/v1/auth/me as a console error. The public
 * header asks once per page load, so a guest gets exactly this 401; any other
 * console error is still a real problem.
 */
export function isSessionCheck401(message: ConsoleMessage): boolean {
  if (message.type() !== 'error') return false
  if (!message.text().includes('401 (Unauthorized)')) return false
  try {
    return new URL(message.location().url).pathname === '/api/v1/auth/me'
  } catch {
    return false
  }
}
