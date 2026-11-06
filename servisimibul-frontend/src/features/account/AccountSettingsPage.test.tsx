import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '../../app/router'
import { server } from '../../test/server'
import { knownAuthRole, type AuthUser } from '../auth/auth-api'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

const parentUser: AuthUser = {
  id: 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd',
  email: 'parent@example.com',
  role: 'PARENT',
  operatorApprovalRequired: true,
  approvalStatus: null,
}

const operatorUser: AuthUser = {
  id: '6e2973ac-0302-49a8-b519-563ec9861272',
  email: 'operator@example.com',
  role: 'OPERATOR',
  operatorApprovalRequired: true,
  approvalStatus: 'APPROVED',
}

const adminUser: AuthUser = {
  id: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
  email: 'admin@example.com',
  role: 'ADMIN',
  operatorApprovalRequired: true,
  approvalStatus: null,
}

describe('account settings', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('renders the parent account from the authenticated-user API', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    expect(
      await screen.findByRole('heading', { name: 'Hesap ve gizlilik' }),
    ).toBeInTheDocument()
    expect(screen.getByText('parent@example.com')).toBeInTheDocument()
    expect(screen.getByText('Veli', { selector: 'dd' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Talep panosuna dön' }),
    ).toHaveAttribute('href', '/demands')
    expect(
      screen.getByRole('navigation', { name: 'Ana menü' }),
    ).toHaveTextContent('Hesap ve gizlilik')
  })

  it('lets operators turn the optional new-demand notification off and on', async () => {
    useAuthenticatedUser(operatorUser)
    const updates: unknown[] = []
    server.use(
      csrfHandler(),
      http.put(
        '/api/v1/notifications/preferences/DEMAND_CREATED',
        async ({ request }) => {
          expect(request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token')
          const body = (await request.json()) as { enabled: boolean }
          updates.push(body)
          return HttpResponse.json({ type: 'DEMAND_CREATED', ...body })
        },
      ),
    )
    renderRoute('/operator/account')

    const toggle = await screen.findByRole('switch', {
      name: 'Yeni servis talepleri',
    })
    expect(toggle).toBeChecked()
    expect(
      screen.getByRole('heading', { name: 'Bildirimler' }),
    ).toBeInTheDocument()

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    await waitFor(() => expect(toggle).toBeEnabled())
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toBeChecked())
    expect(updates).toEqual([{ enabled: false }, { enabled: true }])
  })

  it('keeps the preference unchanged and announces a failed save', async () => {
    useAuthenticatedUser(operatorUser)
    server.use(
      csrfHandler(),
      http.put('/api/v1/notifications/preferences/DEMAND_CREATED', () =>
        HttpResponse.json(problem(503), { status: 503 }),
      ),
    )
    renderRoute('/operator/account')

    const toggle = await screen.findByRole('switch', {
      name: 'Yeni servis talepleri',
    })
    fireEvent.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hesap bilgileri şu anda yüklenemiyor.',
    )
    expect(toggle).toBeChecked()
  })

  it('shows no notification preferences to parents', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    expect(
      await screen.findByRole('heading', { name: 'Hesap ve gizlilik' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bildirimler' })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('renders the operator account without duplicating profile editing', async () => {
    useAuthenticatedUser(operatorUser)
    renderRoute('/operator/account')

    expect(
      await screen.findByRole('heading', { name: 'Hesap ve gizlilik' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('operator@example.com').length).toBeGreaterThan(
      0,
    )
    expect(
      screen.getByText('İşletmeci', { selector: 'dd' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'İşletme profiline git' }),
    ).toHaveAttribute('href', '/operator/profile')
    expect(
      screen.getByRole('link', { name: 'Profil ve başvuru' }),
    ).toHaveAttribute('href', '/operator/profile')
  })

  it('redirects anonymous parent access to login with the local return path', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(problem(401), { status: 401 }),
      ),
    )
    const router = renderRoute('/parent/account')

    expect(
      await screen.findByRole('heading', { name: 'Yeniden hoş geldiniz.' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/parent/login')
    expect(router.state.location.search).toContain('next=%2Fparent%2Faccount')
  })

  it('denies cross-role and admin access without rendering private data', async () => {
    useAuthenticatedUser(adminUser)
    renderRoute('/parent/account')

    expect(
      await screen.findByRole('heading', { name: 'Bu alana erişiminiz yok' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument()
  })

  it('shows a deterministic loading state', async () => {
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('/api/v1/auth/me', async () => {
        await pending
        return HttpResponse.json(parentUser)
      }),
      unreadCountHandler(),
    )
    renderRoute('/parent/account')

    expect(
      await screen.findByRole('heading', { name: 'Yükleniyor' }),
    ).toBeInTheDocument()
    release?.()
    expect(await screen.findByText('parent@example.com')).toBeInTheDocument()
  })

  it('recovers from an API failure with retry', async () => {
    let attempts = 0
    server.use(
      http.get('/api/v1/auth/me', () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json(problem(503), { status: 503 })
          : HttpResponse.json(parentUser)
      }),
      unreadCountHandler(),
    )
    renderRoute('/parent/account')

    fireEvent.click(await screen.findByRole('button', { name: 'Yeniden dene' }))
    expect(await screen.findByText('parent@example.com')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('handles an expired account session through the parent login flow', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(problem(401), { status: 401 }),
      ),
    )
    const router = renderRoute('/parent/account')

    expect(
      await screen.findByText(
        'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
      ),
    ).toBeInTheDocument()
    expect(router.state.location.search).toContain('reason=session')
  })

  it('keeps every unfinished account and privacy operation unavailable', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    await screen.findByText('parent@example.com')
    const unavailable = screen.getAllByRole('button', {
      name: 'Kullanılamıyor',
    })
    expect(unavailable).toHaveLength(3)
    unavailable.forEach((button) => expect(button).toBeDisabled())
    expect(screen.getByRole('link', { name: 'Değiştir' })).toHaveAttribute(
      'href',
      '/parent/account/password',
    )
    expect(
      screen.getByRole('link', { name: 'Formu görüntüle' }),
    ).toHaveAttribute('href', '/parent/privacy/requests/new')
    expect(
      screen.getByRole('button', { name: 'Oturumları sonlandır' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/başar/i)).not.toBeInTheDocument()
  })

  it('keeps account and profile destinations separate in operator navigation', async () => {
    useAuthenticatedUser(operatorUser)
    renderRoute('/operator/account')

    const accountLinks = await screen.findAllByRole('link', {
      name: 'Hesap ve gizlilik',
    })
    expect(
      accountLinks.some(
        (link) => link.getAttribute('href') === '/operator/account',
      ),
    ).toBe(true)
    expect(
      screen.getByRole('link', { name: 'Profil ve başvuru' }),
    ).toHaveAttribute('href', '/operator/profile')
    expect(
      screen.getByRole('link', { name: 'Formu görüntüle' }),
    ).toHaveAttribute('href', '/operator/privacy/requests/new')
  })

  it('renders the gated request form in each authenticated role shell', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/privacy/requests/new')

    expect(
      await screen.findByRole('heading', { name: 'Kişisel veri başvurusu' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Ana menü' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Hesap ve gizlilik sayfasına dön' }),
    ).toHaveAttribute('href', '/parent/account')

    cleanup()
    useAuthenticatedUser(operatorUser)
    renderRoute('/operator/privacy/requests/new')

    expect(
      await screen.findByRole('heading', { name: 'Kişisel veri başvurusu' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'İşletmeci alanı menüsü' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Hesap ve gizlilik sayfasına dön' }),
    ).toHaveAttribute('href', '/operator/account')
  })

  it('submits and tracks an enabled erasure request without claiming deletion', async () => {
    useAuthenticatedUser({ ...parentUser, dataRightsRequestsAvailable: true })
    const id = '3a83c5aa-acde-4f7e-a191-b4fd2c792397'
    server.use(
      csrfHandler(),
      http.get('/api/v1/data-rights-requests', () => HttpResponse.json([])),
      http.post('/api/v1/data-rights-requests', async ({ request }) => {
        expect(request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token')
        expect(await request.json()).toEqual({
          type: 'ERASURE',
          details: 'Hesabım ve ilişkili kayıtlar incelensin.',
        })
        return HttpResponse.json(
          {
            id,
            type: 'ERASURE',
            status: 'RECEIVED',
            receivedAt: '2026-11-06T12:30:00Z',
            closedAt: null,
          },
          { status: 201 },
        )
      }),
    )
    renderRoute('/parent/privacy/erasure')

    fireEvent.change(await screen.findByLabelText('Başvuru açıklaması'), {
      target: { value: 'Hesabım ve ilişkili kayıtlar incelensin.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'İnceleme talebi gönder' }),
    )

    expect(await screen.findByText('Başvurunuz kaydedildi')).toBeInTheDocument()
    expect(screen.getByText(id)).toBeInTheDocument()
    expect(screen.getByText(`Başvuru numaranız: ${id}`)).toBeInTheDocument()
    expect(screen.getByText('Alındı')).toBeInTheDocument()
    expect(screen.queryByText(/verileriniz silindi/i)).toBeNull()
    expect(screen.queryByLabelText('Başvuru açıklaması')).toBeNull()
  })

  it('links enabled accounts to erasure request tracking', async () => {
    useAuthenticatedUser({
      ...operatorUser,
      dataRightsRequestsAvailable: true,
    })
    renderRoute('/operator/account')

    expect(
      await screen.findByRole('link', { name: 'Başvuruları yönet' }),
    ).toHaveAttribute('href', '/operator/privacy/erasure')
  })
})

describe('password change', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('renders from both account routes and preserves cancel navigation', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account/password')

    expect(
      await screen.findByRole('heading', { name: 'Şifreyi değiştir' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Mevcut şifre')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(screen.getByRole('link', { name: 'Vazgeç' })).toHaveAttribute(
      'href',
      '/parent/account',
    )

    cleanup()
    useAuthenticatedUser(operatorUser)
    renderRoute('/operator/account/password')
    expect(await screen.findByRole('link', { name: 'Vazgeç' })).toHaveAttribute(
      'href',
      '/operator/account',
    )
  })

  it('validates policy, confirmation and password reuse before submission', async () => {
    let requests = 0
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/change-password', () => {
        requests += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderRoute('/parent/account/password')

    await fillPasswordForm(
      'same password value',
      'same password value',
      'different',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }))

    expect(
      await screen.findByText('Yeni şifre mevcut şifreden farklı olmalıdır.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Yeni şifreler eşleşmiyor.')).toBeInTheDocument()
    expect(requests).toBe(0)
  })

  it('submits once, clears client auth state and redirects to role login', async () => {
    let requestBody: unknown
    useAuthenticatedUser(operatorUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/change-password', async ({ request }) => {
        requestBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const router = renderRoute('/operator/account/password')
    await fillPasswordForm(
      'current password value',
      'new secure password value',
      'new secure password value',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }))

    expect(
      await screen.findByText(/Şifreniz güncellendi ve açık oturumlarınız/),
    ).toBeInTheDocument()
    expect(requestBody).toEqual({
      currentPassword: 'current password value',
      newPassword: 'new secure password value',
    })
    expect(router.state.location.pathname).toBe('/operator/login')
    expect(knownAuthRole()).toBeUndefined()
  })

  it('shows an incorrect-current-password field error and allows retry', async () => {
    let attempts = 0
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/change-password', () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json(
              {
                title: 'Password change failed',
                status: 400,
                detail: 'Current password is incorrect',
                code: 'CURRENT_PASSWORD_INVALID',
                fieldErrors: [
                  {
                    field: 'currentPassword',
                    message: 'Current password is incorrect',
                  },
                ],
              },
              { status: 400 },
            )
          : new HttpResponse(null, { status: 204 })
      }),
    )
    renderRoute('/parent/account/password')
    await fillPasswordForm(
      'incorrect password value',
      'new secure password value',
      'new secure password value',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }))
    expect(
      await screen.findByText('Mevcut şifre doğrulanamadı.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Current password is incorrect'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }))
    expect(
      await screen.findByText(/Şifreniz güncellendi ve açık oturumlarınız/),
    ).toBeInTheDocument()
  })

  it('disables double submission while the request is pending', async () => {
    let requests = 0
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/change-password', async () => {
        requests += 1
        await pending
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderRoute('/parent/account/password')
    await fillPasswordForm(
      'current password value',
      'new secure password value',
      'new secure password value',
    )

    const submit = screen.getByRole('button', { name: 'Şifreyi güncelle' })
    fireEvent.click(submit)
    await waitFor(() => expect(submit).toBeDisabled())
    await waitFor(() => expect(requests).toBe(1))
    fireEvent.click(submit)
    expect(requests).toBe(1)
    release?.()
  })

  it('shows a retryable network error without claiming success', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/change-password', () => HttpResponse.error()),
    )
    renderRoute('/parent/account/password')
    await fillPasswordForm(
      'current password value',
      'new secure password value',
      'new secure password value',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bağlantı kurulamadı',
    )
    expect(screen.queryByText(/Şifreniz güncellendi/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Şifreyi güncelle' }),
    ).toBeEnabled()
  })

  it('redirects an expired submission session to the matching login', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/change-password', () =>
        HttpResponse.json(problem(401), { status: 401 }),
      ),
    )
    const router = renderRoute('/parent/account/password')
    await fillPasswordForm(
      'current password value',
      'new secure password value',
      'new secure password value',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }))
    expect(await screen.findByText(/Oturumunuz sona erdi/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/parent/login')
    expect(router.state.location.search).toBe('?reason=session')
  })
})

describe('sign out of all devices', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('opens a confirmation dialog without calling the backend', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Tüm cihazlardan çıkış yap',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    ).toBeInTheDocument()
  })

  it('cancelling leaves the current session unchanged and sends no request', async () => {
    let requests = 0
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/logout-all', () => {
        requests += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requests).toBe(0)
    expect(knownAuthRole()).toBe('PARENT')
  })

  it('confirms, clears client auth state and redirects a parent to the parent login', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post(
        '/api/v1/auth/logout-all',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/parent/login'),
    )
    expect(router.state.location.search).toContain('loggedOutAll=true')
    expect(knownAuthRole()).toBeUndefined()
  })

  it('confirms and redirects an operator to the operator login', async () => {
    useAuthenticatedUser(operatorUser)
    server.use(
      csrfHandler(),
      http.post(
        '/api/v1/auth/logout-all',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    const router = renderRoute('/operator/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/operator/login'),
    )
    expect(router.state.location.search).toContain('loggedOutAll=true')
  })

  it('disables both dialog actions while the request is pending and ignores a repeat click', async () => {
    let requests = 0
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/logout-all', async () => {
        requests += 1
        await pending
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    const confirm = screen.getByRole('button', {
      name: 'Tüm cihazlardan çıkış yap',
    })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeDisabled(),
    )
    await waitFor(() => expect(requests).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Çıkış yapılıyor…' }))
    expect(requests).toBe(1)
    release?.()
  })

  it('shows a retryable error and keeps the session when the backend reports failure', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/logout-all', () =>
        HttpResponse.json(problem(503), { status: 503 }),
      ),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hesap bilgileri şu anda yüklenemiyor.',
    )
    expect(router.state.location.pathname).toBe('/parent/account')
    expect(knownAuthRole()).toBe('PARENT')
    expect(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    ).toBeEnabled()
  })

  it('shows a retryable network error without claiming success', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/logout-all', () => HttpResponse.error()),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bağlantı kurulamadı',
    )
    expect(router.state.location.pathname).toBe('/parent/account')
    expect(knownAuthRole()).toBe('PARENT')
  })

  it('treats an already-expired session through the existing login flow', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/logout-all', () =>
        HttpResponse.json(problem(401), { status: 401 }),
      ),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Oturumları sonlandır' }),
    )
    await screen.findByRole('heading', { name: 'Tüm cihazlardan çıkış yap' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/parent/login'),
    )
    expect(router.state.location.search).toBe('?reason=session')
    expect(knownAuthRole()).toBeUndefined()
  })

  it('moves focus to the cancel action and restores it to the trigger on close', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    const trigger = await screen.findByRole('button', {
      name: 'Oturumları sonlandır',
    })
    trigger.focus()
    fireEvent.click(trigger)
    const cancel = await screen.findByRole('button', { name: 'Vazgeç' })
    await waitFor(() => expect(cancel).toHaveFocus())

    fireEvent.click(cancel)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })

  it('leaves the other account and privacy actions untouched', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    await screen.findByRole('button', { name: 'Oturumları sonlandır' })
    expect(
      screen.getAllByRole('button', { name: 'Kullanılamıyor' }),
    ).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Değiştir' })).toHaveAttribute(
      'href',
      '/parent/account/password',
    )
  })
})

describe('voluntary account deactivation', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  const deactivatableParent = {
    ...parentUser,
    accountDeactivationAvailable: true,
  }

  it('stays unavailable by default, matching the other unfinished actions', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    await screen.findByText('parent@example.com')
    expect(
      screen.queryByRole('button', { name: 'Hesabı devre dışı bırak' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Kullanılamıyor' }),
    ).toHaveLength(3)
  })

  it('opens a confirmation dialog without calling the backend', async () => {
    useAuthenticatedUser(deactivatableParent)
    renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Hesabı devre dışı bırak' }),
    )

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Hesabı devre dışı bırak',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument()
  })

  it('cancelling leaves the current session unchanged and sends no request', async () => {
    let requests = 0
    useAuthenticatedUser(deactivatableParent)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/deactivate', () => {
        requests += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Hesabı devre dışı bırak' }),
    )
    await screen.findByRole('heading', {
      level: 2,
      name: 'Hesabı devre dışı bırak',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requests).toBe(0)
    expect(knownAuthRole()).toBe('PARENT')
  })

  it('confirms, clears client auth state and redirects to the role login', async () => {
    useAuthenticatedUser(deactivatableParent)
    server.use(
      csrfHandler(),
      http.post(
        '/api/v1/auth/deactivate',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Hesabı devre dışı bırak' }),
    )
    await screen.findByRole('heading', {
      level: 2,
      name: 'Hesabı devre dışı bırak',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Evet, devre dışı bırak' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/parent/login'),
    )
    expect(router.state.location.search).toContain('accountDeactivated=true')
    expect(knownAuthRole()).toBeUndefined()
  })

  it('shows a retryable error and keeps the session when the backend reports failure', async () => {
    useAuthenticatedUser(deactivatableParent)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/deactivate', () =>
        HttpResponse.json(problem(503), { status: 503 }),
      ),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Hesabı devre dışı bırak' }),
    )
    await screen.findByRole('heading', {
      level: 2,
      name: 'Hesabı devre dışı bırak',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Evet, devre dışı bırak' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hesap bilgileri şu anda yüklenemiyor.',
    )
    expect(router.state.location.pathname).toBe('/parent/account')
    expect(knownAuthRole()).toBe('PARENT')
  })

  it('treats an already-expired session through the existing login flow', async () => {
    useAuthenticatedUser(deactivatableParent)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/deactivate', () =>
        HttpResponse.json(problem(401), { status: 401 }),
      ),
    )
    const router = renderRoute('/parent/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Hesabı devre dışı bırak' }),
    )
    await screen.findByRole('heading', {
      level: 2,
      name: 'Hesabı devre dışı bırak',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Evet, devre dışı bırak' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/parent/login'),
    )
    expect(router.state.location.search).toBe('?reason=session')
    expect(knownAuthRole()).toBeUndefined()
  })
})

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function useAuthenticatedUser(user: AuthUser) {
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(user)),
    unreadCountHandler(),
    http.get('/api/v1/notifications/preferences', () =>
      HttpResponse.json(
        user.role === 'OPERATOR'
          ? [{ type: 'DEMAND_CREATED', enabled: true }]
          : [],
      ),
    ),
  )
}

function unreadCountHandler() {
  return http.get('/api/v1/notifications/unread-count', () =>
    HttpResponse.json({ unreadCount: 0 }),
  )
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

async function fillPasswordForm(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  fireEvent.change(await screen.findByLabelText('Mevcut şifre'), {
    target: { value: currentPassword },
  })
  fireEvent.change(screen.getByLabelText('Yeni şifre'), {
    target: { value: newPassword },
  })
  fireEvent.change(screen.getByLabelText('Yeni şifreyi tekrar girin'), {
    target: { value: confirmPassword },
  })
}

function problem(status: number) {
  return {
    title: status === 401 ? 'Unauthorized' : 'Service unavailable',
    status,
    detail:
      status === 401
        ? 'Authentication is required'
        : 'Hesap bilgileri şu anda yüklenemiyor.',
    code: status === 401 ? 'UNAUTHENTICATED' : 'SERVICE_UNAVAILABLE',
  }
}
