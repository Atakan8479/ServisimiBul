import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

afterEach(() => {
  resetCsrfToken()
  vi.unstubAllEnvs()
})

describe('parent account onboarding', () => {
  it('separates parent and operator signup without auto-registering a parent', async () => {
    renderRoute('/register?next=%2Fdemands')
    expect(
      await screen.findByRole('heading', {
        name: 'Nasıl kullanmak istiyorsunuz?',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Veliyim/ })).toHaveAttribute(
      'href',
      '/parent/register?next=%2Fdemands',
    )
    expect(screen.getByRole('link', { name: /İşletmeciyim/ })).toHaveAttribute(
      'href',
      '/operator/register',
    )
  })

  it('gives safe pilot guidance instead of submitting a public parent account', async () => {
    renderRoute('/parent/register?next=%2Fdemands')
    expect(
      await screen.findByRole('heading', {
        name: 'Veli kaydı henüz açık değil',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Hesap oluştur/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Veli hesabımla giriş yap' }),
    ).toHaveAttribute('href', '/operator/login?next=%2Fdemands')
  })
})

describe('operator authentication screens', () => {
  it('explains public profile visibility without requiring consent', async () => {
    renderRoute('/operator/register')

    expect(
      await screen.findByText('İşletme profilinizin görünürlüğü'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/işletme profiliniz herkese açık arama sonuçlarında/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/İletişim telefonunuz.*ziyaretçiler tarafından/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hesap oluştur' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('registers an operator without an optional business name', async () => {
    let requestBody: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/register', async ({ request }) => {
        requestBody = await request.json()
        return new HttpResponse(null, { status: 202 })
      }),
    )

    renderRoute('/operator/register')

    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.change(screen.getByLabelText('Herkese açık iletişim telefonu'), {
      target: { value: '0532 123 45 67' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))

    expect(
      await screen.findByRole('heading', { name: 'E-postanızı kontrol edin' }),
    ).toBeInTheDocument()
    expect(requestBody).toEqual({
      email: 'operator@example.com',
      password: 'long password value',
      businessName: '',
      contactPhone: '0532 123 45 67',
    })
  })

  it('shows immediate login guidance when local email verification is disabled', async () => {
    vi.stubEnv('VITE_EMAIL_VERIFICATION_REQUIRED', 'false')
    server.use(
      csrfHandler(),
      http.post(
        '/api/v1/auth/register',
        () => new HttpResponse(null, { status: 202 }),
      ),
    )

    renderRoute('/operator/register')

    await screen.findByLabelText('E-posta')
    expect(screen.queryByText(/E-posta doğrulamanız/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('E-posta'), {
      target: { value: 'local-operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.change(screen.getByLabelText('Herkese açık iletişim telefonu'), {
      target: { value: '0532 123 45 67' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))

    expect(
      await screen.findByRole('heading', { name: 'Hesabınız hazır' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Kayıt tamamlandı. Şimdi giriş yapabilirsiniz.'),
    ).toBeInTheDocument()
  })

  it('verifies the token supplied by the email link', async () => {
    let token: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/verify-email', async ({ request }) => {
        token = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderRoute('/operator/verify-email?token=email-token')
    fireEvent.click(
      await screen.findByRole('button', { name: 'E-postayı doğrula' }),
    )

    expect(
      await screen.findByText(
        'E-posta adresiniz doğrulandı. Artık güvenli şekilde giriş yapabilirsiniz.',
      ),
    ).toBeInTheDocument()
    expect(token).toEqual({ token: 'email-token' })
  })

  it('logs in with remember me and enters the operator workspace', async () => {
    let loginBody: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', async ({ request }) => {
        loginBody = await request.json()
        return HttpResponse.json(operatorUser)
      }),
      http.get('/api/v1/auth/me', () => HttpResponse.json(operatorUser)),
      http.get('/api/v1/operator/discovery-readiness', () =>
        HttpResponse.json({
          discoveryEligible: false,
          emailVerified: true,
          accountEnabled: true,
          profileActive: true,
          publiclyVisible: true,
          approvalRequired: true,
          approvalSatisfied: true,
          hasActiveSchoolRelationship: false,
          hasEligibleSchoolCoverage: false,
          schools: [],
        }),
      ),
    )

    renderRoute('/operator/login')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /Beni hatırla/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Aramalarda görünmeye hazır mısınız?',
      }),
    ).toBeInTheDocument()
    expect(loginBody).toEqual({
      email: 'operator@example.com',
      password: 'long password value',
      rememberMe: true,
    })
    // Avoid leaving the overview's readiness request in flight after teardown.
    expect(
      await screen.findByText(
        'Profiliniz henüz ebeveyn aramalarına uygun değil.',
      ),
    ).toBeInTheDocument()
  })

  it('returns a parent account to the demand board after login', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', () => HttpResponse.json(parentUser)),
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      http.get('/api/v1/demands', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    renderRoute('/operator/login')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('heading', { name: 'Servis talep panosu' }),
    ).toBeInTheDocument()
  })

  it('preserves a safe demand return path for a parent account', async () => {
    const demandId = '481be36b-c8ee-4c03-868e-47bbc19b7735'
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', () => HttpResponse.json(parentUser)),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json({
          id: demandId,
          status: 'OPEN',
          closureReason: null,
          closedAt: null,
          academicYear: '2026-2027',
          createdAt: '2026-10-20T09:00:00Z',
          updatedAt: '2026-10-20T09:00:00Z',
          school: {
            id: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
            name: 'Örnek İlkokulu',
          },
          neighborhood: {
            id: 201,
            name: 'Acıbadem',
            districtId: 11,
            districtName: 'Üsküdar',
            provinceId: 34,
            provinceCode: '34',
            provinceName: 'İstanbul',
          },
          supporterCount: 1,
          morningCount: 1,
          afternoonCount: 0,
          reasonCounts: [],
          currentUserSupport: null,
        }),
      ),
      http.get(`/api/v1/demands/${demandId}/responses`, () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/auth/me', () => HttpResponse.json(parentUser)),
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
    )

    renderRoute(
      `/operator/login?next=${encodeURIComponent(`/demands/${demandId}?action=support`)}`,
    )
    expect(
      await screen.findByText(/Veli hesapları pilot kapsamında/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('button', { name: 'Talebe katıl' }),
    ).toBeInTheDocument()
  })

  it('shows server field errors next to the matching registration input', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json(
          {
            title: 'Bad Request',
            status: 400,
            detail: 'Request validation failed',
            code: 'validation_error',
            fieldErrors: { contactPhone: 'must be a valid E.164 phone' },
          },
          { status: 400 },
        ),
      ),
    )

    renderRoute('/operator/register')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.change(screen.getByLabelText('İşletme adı (isteğe bağlı)'), {
      target: { value: 'Örnek Servis' },
    })
    fireEvent.change(screen.getByLabelText('Herkese açık iletişim telefonu'), {
      target: { value: '12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))

    await waitFor(() =>
      expect(
        screen.getByLabelText('Herkese açık iletişim telefonu'),
      ).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(screen.getByText('must be a valid E.164 phone')).toBeInTheDocument()
  })
})

const operatorUser = {
  id: '6e2973ac-0302-49a8-b519-563ec9861272',
  email: 'operator@example.com',
  role: 'OPERATOR',
  operatorApprovalRequired: true,
  approvalStatus: 'APPROVED',
}

const parentUser = {
  id: 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd',
  email: 'parent@example.test',
  role: 'PARENT',
  operatorApprovalRequired: true,
  approvalStatus: null,
}

function csrfHandler() {
  return http.get('/api/v1/auth/csrf', () =>
    HttpResponse.json({
      headerName: 'X-CSRF-TOKEN',
      parameterName: '_csrf',
      token: 'csrf-token',
    }),
  )
}

function renderRoute(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )
}
