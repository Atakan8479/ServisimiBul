import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { ApiError, apiRequest, resetCsrfToken } from './client'
import { normalizeApiProblem } from './contracts'

afterEach(resetCsrfToken)

describe('apiRequest', () => {
  it('uses same-origin credentials and the server-provided CSRF header', async () => {
    let csrfRequests = 0

    server.use(
      http.get('/api/v1/auth/csrf', () => {
        csrfRequests += 1
        return HttpResponse.json({
          headerName: 'X-CSRF-TOKEN',
          parameterName: '_csrf',
          token: 'test-token',
        })
      }),
      http.post('/api/v1/operator/profile', async ({ request }) => {
        expect(request.credentials).toBe('same-origin')
        expect(request.headers.get('X-CSRF-TOKEN')).toBe('test-token')
        expect(await request.json()).toEqual({ public: true })
        return HttpResponse.json({ saved: true })
      }),
    )

    const result = await apiRequest('/operator/profile', {
      method: 'POST',
      json: { public: true },
      schema: z.object({ saved: z.boolean() }),
      requiresSession: true,
    })

    expect(result).toEqual({ saved: true })
    expect(csrfRequests).toBe(1)
  })

  it('normalizes list-shaped validation errors into a field map', async () => {
    server.use(
      http.get('/api/v1/schools', () =>
        HttpResponse.json(
          {
            title: 'Validation failed',
            status: 400,
            detail: 'Invalid request',
            code: 'VALIDATION_FAILED',
            fieldErrors: [{ field: 'query', message: 'is too short' }],
          },
          { status: 400 },
        ),
      ),
    )

    const error = await apiRequest('/schools', {
      schema: z.unknown(),
    }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).problem.fieldErrors).toEqual({
      query: 'is too short',
    })
  })

  it('marks only authenticated 401 responses as expired sessions', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(
          {
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication is required',
            code: 'UNAUTHENTICATED',
          },
          { status: 401 },
        ),
      ),
    )

    const error = await apiRequest('/auth/me', {
      requiresSession: true,
      schema: z.unknown(),
    }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).sessionExpired).toBe(true)
  })
})

describe('user-facing API messages', () => {
  it('keeps machine codes while localizing known authentication failures', () => {
    const error = normalizeApiProblem(
      {
        title: 'Authentication failed',
        detail: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      },
      401,
    )
    expect(error.code).toBe('INVALID_CREDENTIALS')
    expect(error.status).toBe(401)
    expect(error.detail).toBe('E-posta veya şifre yanlış.')
  })

  it('uses concise Turkish descriptions for registration, session and conflicts', () => {
    expect(
      normalizeApiProblem({ code: 'PARENT_REGISTRATION_UNAVAILABLE' }, 503)
        .detail,
    ).toBe('Şu anda veli hesabı oluşturulamıyor.')
    expect(normalizeApiProblem({ code: 'CSRF_INVALID' }, 403).detail).toContain(
      'Sayfayı yenileyin.',
    )
    expect(
      normalizeApiProblem({ code: 'demand_update_conflict' }, 409).detail,
    ).toContain('Talep bu sırada değişti.')
  })

  it('preserves field-specific validation errors and unknown API codes', () => {
    const error = normalizeApiProblem(
      {
        code: 'VALIDATION_FAILED',
        detail: 'Validation failed',
        fieldErrors: [{ field: 'email', message: 'Geçerli adres girin.' }],
      },
      400,
    )
    expect(error.detail).toBe('Girilen bilgileri kontrol edin.')
    expect(error.fieldErrors).toEqual({ email: 'Geçerli adres girin.' })
    expect(
      normalizeApiProblem(
        { code: 'CUSTOM_ERROR', detail: 'Güncel bir kullanıcı uyarısı' },
        409,
      ).detail,
    ).toBe('Güncel bir kullanıcı uyarısı')
  })
})
