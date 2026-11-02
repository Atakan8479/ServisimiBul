import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '../../app/router'
import { server } from '../../test/server'

const parentUser = {
  id: 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd',
  email: 'parent@example.com',
  role: 'PARENT',
  operatorApprovalRequired: true,
  approvalStatus: null,
}

const operatorUser = {
  id: '6e2973ac-0302-49a8-b519-563ec9861272',
  email: 'operator@example.com',
  role: 'OPERATOR',
  operatorApprovalRequired: true,
  approvalStatus: 'APPROVED',
}

const adminUser = {
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

  it('keeps every future account and privacy operation unavailable', async () => {
    useAuthenticatedUser(parentUser)
    renderRoute('/parent/account')

    await screen.findByText('parent@example.com')
    const unavailable = screen.getAllByRole('button', {
      name: 'Kullanılamıyor',
    })
    expect(unavailable).toHaveLength(6)
    unavailable.forEach((button) => expect(button).toBeDisabled())
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
  })
})

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function useAuthenticatedUser(
  user: typeof parentUser | typeof operatorUser | typeof adminUser,
) {
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
