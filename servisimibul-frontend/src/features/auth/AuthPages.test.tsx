import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'
import { clearKnownAuthRole, knownAuthRole } from './auth-api'
import { LoginPage } from './AuthPages'

afterEach(() => {
  resetCsrfToken()
  window.sessionStorage.clear()
  vi.unstubAllEnvs()
})

describe('parent account onboarding', () => {
  it('separates parent and operator signup routes', async () => {
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

  it('registers a parent with CSRF and returns through login to the intended demand page', async () => {
    let requestBody: unknown
    let csrfHeader: string | null = null
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/parent/register', async ({ request }) => {
        requestBody = await request.json()
        csrfHeader = request.headers.get('X-CSRF-TOKEN')
        return new HttpResponse(null, { status: 202 })
      }),
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
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 3 }),
      ),
      http.post(
        '/api/v1/auth/logout',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    renderRoute('/parent/register?next=%2Fdemands')
    expect(await screen.findByLabelText('E-posta')).toBeInTheDocument()
    expect(screen.queryByText(/pilot/i)).not.toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Veli hesabı oluştur' }))

    expect(
      await screen.findByText('Devam etmek için veli hesabınızla giriş yapın.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Veli hesabınıza giriş yapın' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/doğrulama bağlantısı/i)).not.toBeInTheDocument()
    expect(requestBody).toEqual({
      email: 'parent@example.test',
      password: 'unique parent password',
    })
    expect(csrfHeader).toBe('csrf-token')

    fireEvent.change(screen.getByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('heading', { name: 'Servis talep panosu' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Veli oturumu açık')).toBeInTheDocument()
    expect(
      await screen.findByLabelText('3 okunmamış bildirim'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Veli hesabınıza giriş yapın',
      }),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBeUndefined()
  })

  it('uses the duplicate-safe accepted response without claiming mailbox ownership', async () => {
    server.use(
      csrfHandler(),
      http.post(
        '/api/v1/auth/parent/register',
        () => new HttpResponse(null, { status: 202 }),
      ),
    )

    renderRoute('/parent/register?next=https%3A%2F%2Fevil.example')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'existing@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Veli hesabı oluştur' }))

    expect(
      await screen.findByText(/Devam etmek için veli hesabınızla giriş yapın/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Veli hesabı oluşturun' }),
    ).toHaveAttribute('href', '/parent/register?next=%2Fdemands')
  })

  it.each([
    [429, 'Çok fazla kayıt denemesi yapıldı.'],
    [503, 'Veli kaydı şu anda kullanılamıyor.'],
  ])('shows a recoverable message for HTTP %i', async (status, message) => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/parent/register', () =>
        HttpResponse.json(
          {
            title: 'Registration unavailable',
            status,
            detail: 'Server detail',
            code:
              status === 429
                ? 'RATE_LIMITED'
                : 'PARENT_REGISTRATION_UNAVAILABLE',
          },
          { status },
        ),
      ),
    )

    renderRoute('/parent/register')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Veli hesabı oluştur' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('E-posta')).toHaveValue('parent@example.test')
  })

  it('shows server validation beside the parent field and preserves input', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/parent/register', () =>
        HttpResponse.json(
          {
            title: 'Validation failed',
            status: 400,
            detail: 'One or more request fields are invalid',
            code: 'VALIDATION_FAILED',
            fieldErrors: [
              { field: 'email', message: 'E-posta kabul edilmedi.' },
            ],
          },
          { status: 400 },
        ),
      ),
    )

    renderRoute('/parent/register')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Veli hesabı oluştur' }))

    expect(
      await screen.findByText('E-posta kabul edilmedi.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('E-posta')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByLabelText('E-posta')).toHaveValue('parent@example.test')
  })

  it('shows a retryable network failure without clearing the form', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/parent/register', () => HttpResponse.error()),
    )

    renderRoute('/parent/register')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Veli hesabı oluştur' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bağlantı kurulamadı.',
    )
    expect(screen.getByLabelText('E-posta')).toHaveValue('parent@example.test')
  })

  it('provides a dedicated parent login with password visibility', async () => {
    renderRoute('/parent/login')

    expect(
      await screen.findByRole('heading', {
        name: 'Veli hesabınıza giriş yapın',
      }),
    ).toBeInTheDocument()
    const password = screen.getByLabelText('Şifre')
    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(
      screen.getByRole('link', { name: 'Veli hesabı oluşturun' }),
    ).toHaveAttribute('href', '/parent/register?next=%2Fdemands')
    expect(
      screen.getByRole('link', { name: 'Şifremi unuttum' }),
    ).toHaveAttribute('href', '/forgot-password?from=parent')
  })

  it('requests password recovery without revealing whether the account exists', async () => {
    let requestBody: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/forgot-password', async ({ request }) => {
        requestBody = await request.json()
        return new HttpResponse(null, { status: 202 })
      }),
    )

    renderRoute('/forgot-password?from=parent')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Yenileme bağlantısı gönder' }),
    )

    expect(
      await screen.findByText(/Hesap uygunsa şifre yenileme bağlantısı/),
    ).toBeInTheDocument()
    expect(requestBody).toEqual({ email: 'parent@example.test' })
    expect(
      screen.getByRole('link', { name: 'Giriş sayfasına dön' }),
    ).toHaveAttribute('href', '/parent/login')
  })

  it('resets a password using the token from the recovery link', async () => {
    let requestBody: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/reset-password', async ({ request }) => {
        requestBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderRoute('/reset-password?token=reset-token')
    expect(await screen.findByLabelText('Şifre yenileme kodu')).toHaveValue(
      'reset-token',
    )
    fireEvent.change(screen.getByLabelText('Yeni şifre'), {
      target: { value: 'new secure password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi yenile' }))

    expect(await screen.findByText(/Şifreniz yenilendi/)).toBeInTheDocument()
    expect(requestBody).toEqual({
      token: 'reset-token',
      newPassword: 'new secure password',
    })
    expect(
      screen
        .getAllByRole('link', { name: 'Veli girişi' })
        .some((link) => link.classList.contains('button-link')),
    ).toBe(true)
  })

  it('returns a parent to notifications but rejects an external URL', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', () => HttpResponse.json(parentUser)),
      http.get('/api/v1/auth/me', () => HttpResponse.json(parentUser)),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 0 }),
      ),
    )

    const view = renderRoute('/parent/login?next=%2Fnotifications')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'parent@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'unique parent password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('heading', { name: 'Bildirim merkezi' }),
    ).toBeInTheDocument()

    view.unmount()
    clearKnownAuthRole()
    renderRoute('/parent/login?next=https%3A%2F%2Fevil.example')
    expect(
      await screen.findByRole('link', { name: 'Veli hesabı oluşturun' }),
    ).toHaveAttribute('href', '/parent/register?next=%2Fdemands')
  })

  it.each(['/demands/review-target?action=response', '/demands/../operator'])(
    'rejects an unsafe parent return destination: %s',
    async (next) => {
      renderRoute(`/parent/login?next=${encodeURIComponent(next)}`)

      expect(
        await screen.findByRole('link', { name: 'Veli hesabı oluşturun' }),
      ).toHaveAttribute('href', '/parent/register?next=%2Fdemands')
    },
  )

  it('rejects an operator account on the parent login and closes its session', async () => {
    let logoutCalls = 0
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', () => HttpResponse.json(operatorUser)),
      http.post('/api/v1/auth/logout', () => {
        logoutCalls += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderRoute('/parent/login')
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu giriş yalnızca veli hesapları içindir.',
    )
    expect(logoutCalls).toBe(1)
    expect(knownAuthRole()).toBeUndefined()
  })
})

describe('operator authentication screens', () => {
  it('explains public profile visibility without requiring consent', async () => {
    renderRoute('/operator/register')

    expect(
      await screen.findByText('İşletme profilinizin görünürlüğü'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /E-posta doğrulamanızı tamamlayıp hizmet verdiğiniz okul ve mahalleleri ekleyin/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Telefonunuz ve paylaştığınız işletme bilgileri ziyaretçilere görünebilir/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hesap oluştur' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Veli hesabı oluşturun' }),
    ).toHaveAttribute('href', '/parent/register')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it.each([
    ['/operator/login', '/register'],
    [
      `/operator/login?next=${encodeURIComponent('/demands/review-target?action=response')}`,
      '/operator/register',
    ],
  ])('routes the signup link on %s to %s', async (path, expectedHref) => {
    renderRoute(path)

    expect(
      await screen.findByRole('link', { name: /kayıt olun/i }),
    ).toHaveAttribute('href', expectedHref)
  })

  it('preserves the operator response action after login', async () => {
    const router = createMemoryRouter(
      [
        { path: '/operator/login', Component: LoginPage },
        {
          path: '/demands/:demandId',
          element: <h1>Servis bildirimi dönüşü</h1>,
        },
      ],
      {
        initialEntries: [
          `/operator/login?next=${encodeURIComponent('/demands/review-target?action=response')}`,
        ],
      },
    )
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', () => HttpResponse.json(operatorUser)),
    )

    render(<RouterProvider router={router} />)
    fireEvent.change(await screen.findByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('heading', { name: 'Servis bildirimi dönüşü' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?action=response')
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
        'Profiliniz henüz arama sonuçlarında görünmüyor.',
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

    renderRoute('/parent/login')
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
      http.get(`/api/v1/demands/${demandId}/comments`, () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/auth/me', () => HttpResponse.json(parentUser)),
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
    )

    renderRoute(
      `/parent/login?next=${encodeURIComponent(`/demands/${demandId}?action=support`)}`,
    )
    expect(
      await screen.findByRole('link', { name: 'Veli hesabı oluşturun' }),
    ).toHaveAttribute(
      'href',
      `/parent/register?next=${encodeURIComponent(`/demands/${demandId}?action=support`)}`,
    )
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
