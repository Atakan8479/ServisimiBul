import type { ZodType } from 'zod'
import {
  csrfTokenSchema,
  normalizeApiProblem,
  type ApiProblem,
  type CsrfToken,
} from './contracts'

const API_BASE_PATH = '/api/v1'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let csrfTokenRequest: Promise<CsrfToken> | undefined

interface ApiRequestOptions<T> extends Omit<RequestInit, 'body'> {
  json?: unknown
  requiresSession?: boolean
  schema?: ZodType<T>
}

export class ApiError extends Error {
  constructor(
    readonly problem: ApiProblem,
    readonly sessionExpired = false,
  ) {
    super(problem.detail)
    this.name = 'ApiError'
  }
}

export async function apiRequest(
  path: string,
  options?: ApiRequestOptions<never>,
): Promise<void>
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions<T> & { schema: ZodType<T> },
): Promise<T>
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions<T> = {},
): Promise<T | void> {
  const { json, requiresSession = false, schema, ...requestInit } = options
  const method = (requestInit.method || 'GET').toUpperCase()
  const headers = new Headers(requestInit.headers)
  headers.set('Accept', 'application/json')

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = await getCsrfToken()
    headers.set(csrf.headerName, csrf.token)
  }

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...requestInit,
    method,
    headers,
    credentials: 'same-origin',
    body: json === undefined ? undefined : JSON.stringify(json),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      resetCsrfToken()
    }
    throw await toApiError(response, requiresSession && response.status === 401)
  }

  if (!schema || response.status === 204) {
    return
  }

  const body = await readJson(response)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError({
      title: 'Invalid API response',
      status: 502,
      detail: 'The server returned an unexpected response.',
      code: 'INVALID_API_RESPONSE',
    })
  }
  return parsed.data
}

export function resetCsrfToken(): void {
  csrfTokenRequest = undefined
}

async function getCsrfToken(): Promise<CsrfToken> {
  csrfTokenRequest ??= fetch(`${API_BASE_PATH}/auth/csrf`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw await toApiError(response, false)
      }
      return csrfTokenSchema.parse(await readJson(response))
    })
    .catch((error: unknown) => {
      resetCsrfToken()
      throw error
    })

  return csrfTokenRequest
}

async function toApiError(
  response: Response,
  sessionExpired: boolean,
): Promise<ApiError> {
  return new ApiError(
    normalizeApiProblem(await readJson(response), response.status),
    sessionExpired,
  )
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
