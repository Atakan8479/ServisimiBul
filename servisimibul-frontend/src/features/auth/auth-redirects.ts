export function isDemandPath(path: string | null): path is string {
  return Boolean(
    path &&
    (path === '/demands' ||
      path.startsWith('/demands?') ||
      path.startsWith('/demands/')),
  )
}

export function demandDestination(path: string | null): string {
  return isDemandPath(path) ? path : '/demands'
}

export function parentDestination(path: string | null): string {
  if (path === '/notifications' || path?.startsWith('/notifications?')) {
    return path
  }
  if (!isCanonicalPathUnder(path, '/demands')) return '/demands'

  try {
    const url = new URL(path, window.location.origin)
    const action = url.searchParams.get('action')
    return isDemandPath(url.pathname) &&
      (action === null || action === 'support' || action === 'comment')
      ? path
      : '/demands'
  } catch {
    return '/demands'
  }
}

// Only a same-origin path that is already canonical can pass the prefix check,
// so `..`, `%2e%2e`, `%252e%252e`, `..%2F`, backslashes and `//host` never
// escape `root`.
export function isCanonicalPathUnder(
  path: string | null,
  root: string,
): path is string {
  if (!path?.startsWith('/')) return false
  try {
    const url = new URL(path, window.location.origin)
    // Decode until stable so nested encodings cannot hide `..` or `\`; each
    // pass that changes the string shortens it, so the loop terminates.
    let decoded = url.pathname
    for (let previous = ''; decoded !== previous;) {
      previous = decoded
      decoded = decodeURIComponent(decoded)
    }
    return (
      url.origin === window.location.origin &&
      url.pathname === path.split(/[?#]/, 1)[0] &&
      !decoded.includes('\\') &&
      !decoded.split('/').includes('..') &&
      (url.pathname === root || url.pathname.startsWith(`${root}/`))
    )
  } catch {
    return false
  }
}

// Operators resume a demand service response or comment; anything else that
// is not under /operator falls back to the operator home.
export function operatorDestination(path: string | null): string {
  if (isCanonicalPathUnder(path, '/operator')) return path
  return operatorDemandDestination(path) ?? '/operator'
}

export function operatorDemandDestination(path: string | null): string | null {
  if (!isCanonicalPathUnder(path, '/demands')) return null
  const url = new URL(path, window.location.origin)
  const action = url.searchParams.get('action')
  return isDemandPath(url.pathname) &&
    (action === 'response' || action === 'comment')
    ? path
    : null
}

export function isDemandResponsePath(path: string | null): path is string {
  if (!isCanonicalPathUnder(path, '/demands')) return false
  const url = new URL(path, window.location.origin)
  return url.searchParams.get('action') === 'response'
}

export function isDemandCommentPath(path: string | null): path is string {
  if (!isCanonicalPathUnder(path, '/demands')) return false
  const url = new URL(path, window.location.origin)
  return url.searchParams.get('action') === 'comment'
}
