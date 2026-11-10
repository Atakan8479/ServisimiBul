import { act, fireEvent, render, screen, within } from '@testing-library/react'
import {
  MemoryRouter,
  RouterProvider,
  Route,
  Routes,
  createMemoryRouter,
} from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../test/server'
import {
  AUTH_SESSION_HINT_KEY,
  knownAuthRole,
  login,
  refreshAuthRole,
  type AuthRole,
  type AuthUser,
} from '../features/auth/auth-api'
import { PublicLayout } from './layouts'

const users: Record<AuthRole, AuthUser> = {
  PARENT: {
    id: 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd',
    email: 'parent@example.com',
    role: 'PARENT',
    operatorApprovalRequired: true,
    approvalStatus: null,
  },
  OPERATOR: {
    id: '6e2973ac-0302-49a8-b519-563ec9861272',
    email: 'operator@example.com',
    role: 'OPERATOR',
    operatorApprovalRequired: true,
    approvalStatus: 'APPROVED',
  },
  ADMIN: {
    id: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
    email: 'admin@example.com',
    role: 'ADMIN',
    operatorApprovalRequired: true,
    approvalStatus: null,
  },
}

const problem = (status: number) => ({
  title: status === 401 ? 'Unauthorized' : 'Server error',
  status,
  detail: status === 401 ? 'Authentication is required' : 'Server error',
  code: status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR',
})

let sessionRole: AuthRole | undefined
let meStatus = 200
let meRequests = 0

function signIn(role: AuthRole) {
  sessionRole = role
  localStorage.setItem(AUTH_SESSION_HINT_KEY, '1')
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  sessionRole = undefined
  meStatus = 200
  meRequests = 0
  server.use(
    http.get('/api/v1/auth/me', () => {
      meRequests += 1
      if (meStatus !== 200) {
        return HttpResponse.json(problem(meStatus), { status: meStatus })
      }
      return sessionRole
        ? HttpResponse.json(users[sessionRole])
        : HttpResponse.json(problem(401), { status: 401 })
    }),
    http.get('/api/v1/auth/csrf', () =>
      HttpResponse.json({
        headerName: 'X-CSRF-TOKEN',
        parameterName: '_csrf',
        token: 'csrf-token',
      }),
    ),
    http.get('/api/v1/notifications/unread-count', () =>
      HttpResponse.json({ unreadCount: 0 }),
    ),
    http.post('/api/v1/auth/login', () => {
      sessionRole = 'PARENT'
      return HttpResponse.json(users.PARENT)
    }),
  )
})

function renderLayout(initialEntry = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: PublicLayout,
        children: [
          { index: true, element: <h1>Okulunu seç</h1> },
          {
            path: 'parent/login',
            element: (
              <button
                type="button"
                onClick={() =>
                  void login({
                    email: 'parent@example.com',
                    password: 'password value',
                    rememberMe: false,
                  })
                }
              >
                Test girişi
              </button>
            ),
          },
          { path: 'login', element: <h1>Ortak giriş</h1> },
          { path: 'operator/login', element: <h1>İşletmeci girişi</h1> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const mainMenu = () =>
  within(screen.getByRole('navigation', { name: 'Ana menü' }))

describe('PublicLayout', () => {
  it('contains mobile menu focus and restores it after dismissal', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<h1>Okulunu seç</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('link', { name: 'İşletmeci kaydı' })

    const toggle = screen.getByRole('button', { name: 'Menü' })
    fireEvent.click(toggle)

    const dialog = screen.getByRole('dialog', { name: 'Ana menü' })
    const navigation = screen.getByRole('navigation', { name: 'Ana menü' })
    const firstLink = within(navigation).getByRole('link', {
      name: 'Ana sayfa',
    })
    const lastLink = within(navigation).getByRole('link', {
      name: 'İşletmeci kaydı',
    })
    expect(firstLink).toHaveFocus()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.querySelector('main')).toHaveAttribute('inert')
    expect(screen.getByRole('contentinfo', { hidden: true })).toHaveAttribute(
      'inert',
    )

    firstLink.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(lastLink).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })

  it('never shows a stale cached role before the server answers', async () => {
    sessionStorage.setItem('servisimibul.auth-role', 'PARENT')
    renderLayout()

    expect(screen.queryByText('Veli oturumu açık')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Çıkış yap' }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBeUndefined()
    expect(screen.queryByText('Veli oturumu açık')).not.toBeInTheDocument()
  })

  it.each([
    ['OPERATOR', 'İşletmeci paneli', '/operator', '/operator/notifications'],
    ['ADMIN', 'Yönetim paneli', '/admin', '/admin/notifications'],
  ] as const)(
    'shows the %s workspace instead of guest links',
    async (role, homeLabel, homePath, notifications) => {
      signIn(role)
      renderLayout()

      expect(
        await screen.findByRole('link', { name: homeLabel }),
      ).toHaveAttribute('href', homePath)
      expect(
        mainMenu().getByRole('link', { name: 'Bildirim merkezi' }),
      ).toHaveAttribute('href', notifications)
      expect(
        mainMenu().queryByRole('link', { name: 'Veli girişi' }),
      ).not.toBeInTheDocument()
      expect(
        mainMenu().queryByRole('link', { name: 'İşletmeci kaydı' }),
      ).not.toBeInTheDocument()
      expect(
        mainMenu().getByRole('button', { name: 'Çıkış yap' }),
      ).toBeEnabled()
    },
  )

  it('re-enables sign out after parent logout and a new login in the same tab', async () => {
    signIn('PARENT')
    server.use(
      http.post('/api/v1/auth/logout', async () => {
        await delay(20)
        sessionRole = undefined
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const router = renderLayout()

    fireEvent.click(await screen.findByRole('button', { name: 'Çıkış yap' }))
    expect(
      screen.getByRole('button', { name: 'Çıkış yapılıyor…' }),
    ).toBeDisabled()
    fireEvent.click(await screen.findByRole('button', { name: 'Test girişi' }))
    expect(router.state.location.pathname).toBe('/parent/login')

    const signOut = await screen.findByRole('button', { name: 'Çıkış yap' })
    expect(signOut).toBeEnabled()
    expect(screen.getByText('Veli oturumu açık')).toBeInTheDocument()
    expect(knownAuthRole()).toBe('PARENT')
  })

  it('sends an expired logout to the role login with a session reason', async () => {
    signIn('ADMIN')
    server.use(
      http.post('/api/v1/auth/logout', () =>
        HttpResponse.json(problem(401), { status: 401 }),
      ),
    )
    const router = renderLayout()

    fireEvent.click(await screen.findByRole('button', { name: 'Çıkış yap' }))

    expect(
      await screen.findByRole('heading', { name: 'Ortak giriş' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?reason=session')
    expect(knownAuthRole()).toBeUndefined()
    expect(
      await screen.findByRole('link', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
  })

  it('keeps the session and allows retry when logout fails', async () => {
    signIn('OPERATOR')
    let attempts = 0
    server.use(
      http.post('/api/v1/auth/logout', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        sessionRole = undefined
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const router = renderLayout()

    fireEvent.click(await screen.findByRole('button', { name: 'Çıkış yap' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Çıkış yapılamadı. Lütfen tekrar deneyin.',
    )
    const retry = screen.getByRole('button', { name: 'Çıkış yap' })
    expect(retry).toBeEnabled()
    expect(knownAuthRole()).toBe('OPERATOR')

    fireEvent.click(retry)
    expect(
      await screen.findByRole('heading', { name: 'İşletmeci girişi' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/operator/login')
    expect(knownAuthRole()).toBeUndefined()
  })

  it('follows an account switch made in another tab when focused', async () => {
    signIn('PARENT')
    renderLayout()
    await screen.findByText('Veli oturumu açık')

    signIn('OPERATOR')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(
      await screen.findByRole('link', { name: 'İşletmeci paneli' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Veli oturumu açık')).not.toBeInTheDocument()
  })

  it('does not ask the server for a browser with no session hint', async () => {
    renderLayout()

    expect(
      await screen.findByRole('link', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(meRequests).toBe(0)
  })

  it('verifies when another tab signs in or out', async () => {
    renderLayout()
    await screen.findByRole('link', { name: 'Veli girişi' })

    sessionRole = 'OPERATOR'
    localStorage.setItem(AUTH_SESSION_HINT_KEY, '1')
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: AUTH_SESSION_HINT_KEY }),
      )
    })
    expect(
      await screen.findByRole('link', { name: 'İşletmeci paneli' }),
    ).toBeInTheDocument()

    sessionRole = undefined
    localStorage.removeItem(AUTH_SESSION_HINT_KEY)
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: AUTH_SESSION_HINT_KEY }),
      )
    })
    expect(
      await screen.findByRole('link', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
    expect(localStorage.getItem(AUTH_SESSION_HINT_KEY)).toBeNull()
  })

  it('does not turn a server error into a guest, and clears on a later 401', async () => {
    sessionStorage.setItem('servisimibul.auth-role', 'PARENT')
    meStatus = 503
    renderLayout()

    expect(await screen.findByText('Veli oturumu açık')).toBeInTheDocument()
    expect(knownAuthRole()).toBe('PARENT')

    meStatus = 200
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(
      await screen.findByRole('link', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBeUndefined()
  })
})

describe('refreshAuthRole', () => {
  it('shares one request between concurrent checks', async () => {
    signIn('PARENT')
    await Promise.all([refreshAuthRole(), refreshAuthRole()])
    expect(meRequests).toBe(1)
    expect(knownAuthRole()).toBe('PARENT')
  })

  it('ignores a stale 401 that resolves after a newer login', async () => {
    let release: () => void = () => undefined
    server.use(
      http.get('/api/v1/auth/me', async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json(problem(401), { status: 401 })
      }),
    )
    const staleCheck = refreshAuthRole()
    await delay(10)
    await login({
      email: 'parent@example.com',
      password: 'password value',
      rememberMe: false,
    })
    release()
    await staleCheck

    expect(knownAuthRole()).toBe('PARENT')
  })
})
