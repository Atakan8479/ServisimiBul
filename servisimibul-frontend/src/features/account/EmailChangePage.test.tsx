import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '../../app/router'
import { server } from '../../test/server'
import { knownAuthRole } from '../auth/auth-api'

const parentUser = {
  id: 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd',
  email: 'parent@example.com',
  role: 'PARENT',
  operatorApprovalRequired: true,
  approvalStatus: null,
  emailChangeAvailable: true,
}

describe('email change', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('shows the honest unavailable state when delivery is disabled', async () => {
    useAuthenticatedUser({ ...parentUser, emailChangeAvailable: false })
    renderRoute('/parent/account')

    expect(
      await screen.findByText(
        /E-posta teslimi ve gerekli hukuki kararlar tamamlanana kadar/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Değiştir' })).toHaveAttribute(
      'href',
      '/parent/account/password',
    )
  })

  it('submits a generic pending request without changing the displayed email', async () => {
    let requestedEmail: string | undefined
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/email-change', async ({ request }) => {
        requestedEmail = ((await request.json()) as { email: string }).email
        return new HttpResponse(null, { status: 202 })
      }),
    )
    renderRoute('/parent/account/email')

    fireEvent.change(await screen.findByLabelText('Yeni e-posta adresi'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Doğrulama isteği oluştur' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'İstek alındı' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/mevcut e-postanız değişmez/)).toBeInTheDocument()
    expect(requestedEmail).toBe('new@example.com')
  })

  it('keeps the form retryable after an unavailable response', async () => {
    useAuthenticatedUser(parentUser)
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/email-change', () =>
        HttpResponse.json(
          {
            title: 'Email unavailable',
            status: 503,
            detail: 'Email delivery is unavailable',
            code: 'EMAIL_UNAVAILABLE',
          },
          { status: 503 },
        ),
      ),
    )
    renderRoute('/parent/account/email')

    fireEvent.change(await screen.findByLabelText('Yeni e-posta adresi'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Doğrulama isteği oluştur' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu işlem şu anda tamamlanamıyor.',
    )
    expect(
      screen.getByRole('button', { name: 'Doğrulama isteği oluştur' }),
    ).toBeEnabled()
  })

  it('confirms once, clears the remembered role, and shows new-login guidance', async () => {
    sessionStorage.setItem('servisimibul.auth-role', 'PARENT')
    server.use(
      csrfHandler(),
      http.post(
        '/api/v1/auth/email-change/confirm',
        () => new HttpResponse(null, { status: 204 }),
      ),
      unreadCountHandler(),
    )
    renderRoute('/verify-email-change?token=opaque-token')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'E-posta değişikliğini doğrula',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'E-posta adresiniz değiştirildi',
      }),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBeUndefined()
    expect(
      screen
        .getAllByRole('link', { name: 'Veli girişi' })
        .some((link) => link.getAttribute('href') === '/parent/login'),
    ).toBe(true)
  })

  it('shows an expired or replayed token as a safe retryable failure', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/email-change/confirm', () =>
        HttpResponse.json(
          {
            title: 'Invalid token',
            status: 400,
            detail: 'Invalid token',
            code: 'TOKEN_INVALID_OR_EXPIRED',
          },
          { status: 400 },
        ),
      ),
      unreadCountHandler(),
    )
    renderRoute('/verify-email-change?token=expired-token')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'E-posta değişikliğini doğrula',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Doğrulama bağlantısı geçersiz, süresi dolmuş veya daha önce kullanılmış.',
    )
  })
})

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function useAuthenticatedUser(user: typeof parentUser) {
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(user)),
    unreadCountHandler(),
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
