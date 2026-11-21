import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
      query: 'Bu alanı kontrol edin.',
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

  it('localizes a session-store failure during sign-out-all', () => {
    const error = normalizeApiProblem(
      {
        title: 'Authentication service unavailable',
        detail: 'The request could not be completed. Try again.',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      },
      503,
    )
    expect(error.code).toBe('AUTH_SERVICE_UNAVAILABLE')
    expect(error.status).toBe(503)
    expect(error.detail).toBe(
      'İşlem şu anda tamamlanamıyor. Lütfen tekrar deneyin.',
    )
  })

  it('localizes known backend field validation messages per field', () => {
    const error = normalizeApiProblem(
      {
        code: 'VALIDATION_FAILED',
        detail: 'One or more request fields are invalid',
        traceId: 'trace-400',
        fieldErrors: [
          { field: 'email', message: 'Enter a valid email address' },
          {
            field: 'newPassword',
            message:
              'Password must be 12-64 characters and at most 72 UTF-8 bytes',
          },
          {
            field: 'businessName',
            message: 'Business name must be 2-120 characters',
          },
          {
            field: 'contactPhone',
            message: 'Enter a valid international phone number',
          },
        ],
      },
      400,
    )
    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      traceId: 'trace-400',
      detail: 'Girilen bilgileri kontrol edin.',
    })
    expect(error.fieldErrors).toEqual({
      email: 'Geçerli bir e-posta adresi girin.',
      newPassword:
        'Şifre 12-64 karakter olmalı ve UTF-8 olarak 72 baytı aşmamalıdır.',
      businessName: 'İşletme adı 2-120 karakter olmalıdır.',
      contactPhone: 'Geçerli bir telefon numarası girin.',
    })
  })

  it('uses a safe Turkish fallback for unknown field messages in both shapes', () => {
    expect(
      normalizeApiProblem(
        {
          code: 'validation_error',
          fieldErrors: { contactPhone: 'must be a valid E.164 phone' },
        },
        400,
      ),
    ).toMatchObject({
      code: 'validation_error',
      detail: 'Girilen bilgileri kontrol edin.',
      fieldErrors: { contactPhone: 'Bu alanı kontrol edin.' },
    })
    expect(
      normalizeApiProblem(
        {
          code: 'VALIDATION_FAILED',
          fieldErrors: [{ field: 'email', message: 'toString' }],
        },
        400,
      ).fieldErrors,
    ).toEqual({ email: 'Bu alanı kontrol edin.' })
    expect(
      normalizeApiProblem({ code: 'VALIDATION_FAILED' }, 400).fieldErrors,
    ).toBeUndefined()
  })

  it.each([
    ['duplicate_comment', 409, 'Bu yorumu kısa süre önce gönderdiniz.'],
    [
      'active_support_required',
      403,
      'Bu talebe yorum yapmak için etkin destek gerekir.',
    ],
    ['demand_not_open', 409, 'Bu talep artık açık değil.'],
    [
      'report_already_open',
      409,
      'Bu içerik için açık bir bildiriminiz zaten var.',
    ],
    [
      'operator_coverage_required',
      409,
      'Servis duyurusu paylaşmak için talebin mahallesini bu okulun mahallelerine ekleyin.',
    ],
    [
      'demand_feedback_not_pending',
      409,
      'Bu servis duyurusu için değerlendirme artık yapılamıyor.',
    ],
    [
      'vehicle_plate_conflict',
      409,
      'Bu plakayla kayıtlı bir aracınız zaten var.',
    ],
    ['operator_school_duplicate', 409, 'Bu okul zaten listenizde.'],
  ])(
    'localizes domain code %s without changing code or status',
    (code, status, detail) => {
      expect(
        normalizeApiProblem(
          { code, status, detail: 'English backend detail', traceId: 't-1' },
          status,
        ),
      ).toMatchObject({ code, status, detail, traceId: 't-1' })
    },
  )

  it('preserves field-specific validation errors', () => {
    const error = normalizeApiProblem(
      {
        code: 'VALIDATION_FAILED',
        detail: 'Validation failed',
        fieldErrors: [
          { field: 'email', message: 'Enter a valid email address' },
        ],
      },
      400,
    )
    expect(error.detail).toBe('Girilen bilgileri kontrol edin.')
    expect(error.fieldErrors).toEqual({
      email: 'Geçerli bir e-posta adresi girin.',
    })
    expect(
      normalizeApiProblem(
        { code: 'CUSTOM_ERROR', detail: 'Güncel bir kullanıcı uyarısı' },
        409,
      ).detail,
    ).toBe('İşlem tamamlanamadı. Tekrar deneyin.')
  })
})

describe('safe API error presentation', () => {
  it.each(['RATE_LIMITED', 'RATE_LIMIT_EXCEEDED'])(
    'localizes %s without changing the HTTP response or retry header',
    async (code) => {
      const response = new Response(
        JSON.stringify({
          title: 'Too Many Requests',
          detail: 'Rate limit exceeded',
          status: 429,
          code,
          traceId: 'trace-429',
        }),
        { status: 429, headers: { 'Retry-After': '60' } },
      )
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(response)
      try {
        const error = await apiRequest('/schools').catch(
          (reason: unknown) => reason,
        )
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).problem).toMatchObject({
          code,
          status: 429,
          traceId: 'trace-429',
          title: 'Too Many Requests',
          detail: 'Çok sık denediniz. Biraz sonra tekrar deneyin.',
        })
        expect((error as ApiError).sessionExpired).toBe(false)
        expect(response.status).toBe(429)
        expect(response.headers.get('Retry-After')).toBe('60')
        expect(fetchMock).toHaveBeenCalledOnce()
      } finally {
        fetchMock.mockRestore()
      }
    },
  )

  it.each(['UNKNOWN_ERROR', 'toString', '__proto__', 'constructor', undefined])(
    'uses a safe fallback for code %s and retains diagnostic metadata',
    (code) => {
      expect(
        normalizeApiProblem(
          {
            type: 'about:blank',
            title: 'Internal Server Error',
            detail: 'SQL connection failed at internal.example',
            code,
            status: 500,
            traceId: 'trace-unknown',
            instance: '/api/v1/schools',
          },
          500,
        ),
      ).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        detail: 'İşlem tamamlanamadı. Tekrar deneyin.',
        code: code ?? 'HTTP_500',
        status: 500,
        traceId: 'trace-unknown',
        instance: '/api/v1/schools',
        fieldErrors: undefined,
      })
    },
  )
})
