import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  MemoryRouter,
  RouterProvider,
  Route,
  Routes,
  createMemoryRouter,
} from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../test/server'
import {
  knownAuthRole,
  login,
  refreshAuthRole,
  resetAuthStateForTests,
  type AuthRole,
  type AuthUser,
} from '../features/auth/auth-api'
import { PublicLayout, RouteAccessibility } from './layouts'

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
}

// Another tab of the same browser announcing a login or logout.
function announceFromOtherTab() {
  const otherTab = new BroadcastChannel('servisimibul.auth')
  otherTab.postMessage('changed')
  otherTab.close()
}

beforeEach(() => {
  sessionStorage.clear()
  resetAuthStateForTests()
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

async function openAccountMenu() {
  const trigger = await screen.findByRole('button', { name: 'Hesabım' })
  if (trigger.getAttribute('aria-expanded') === 'false')
    fireEvent.click(trigger)
  return within(screen.getByRole('group', { name: 'Hesabım' }))
}

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
    await screen.findByRole('link', { name: 'Kayıt Ol' })

    const toggle = screen.getByRole('button', { name: 'Menü' })
    fireEvent.click(toggle)

    const dialog = screen.getByRole('dialog', { name: 'Ana menü' })
    const navigation = screen.getByRole('navigation', { name: 'Ana menü' })
    const firstLink = within(navigation).getByRole('link', {
      name: 'Ana sayfa',
    })
    const lastLink = within(navigation).getByRole('link', {
      name: 'Kayıt Ol',
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

    expect(
      screen.queryByRole('button', { name: 'Hesabım' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Çıkış yap' }),
    ).not.toBeInTheDocument()
    expect(
      await mainMenu().findByRole('link', { name: 'Giriş Yap' }),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBeUndefined()
    expect(
      screen.queryByRole('button', { name: 'Hesabım' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    [
      'PARENT',
      'Veli oturumu açık',
      undefined,
      undefined,
      '/notifications',
      '/parent/account',
    ],
    [
      'OPERATOR',
      'İşletmeci oturumu açık',
      'İşletmeci paneli',
      '/operator',
      '/operator/notifications',
      '/operator/account',
    ],
    [
      'ADMIN',
      'Yönetici oturumu açık',
      'Yönetim paneli',
      '/admin',
      '/admin/notifications',
      undefined,
    ],
  ] as const)(
    'shows the correct %s navigation and account menu',
    async (role, status, homeLabel, homePath, notifications, account) => {
      signIn(role)
      renderLayout()

      if (homeLabel) {
        expect(
          await screen.findByRole('link', { name: homeLabel }),
        ).toHaveAttribute('href', homePath)
      }
      expect(
        await mainMenu().findByRole('link', { name: 'Bildirim merkezi' }),
      ).toHaveAttribute('href', notifications)
      expect(
        mainMenu().queryByRole('link', { name: 'Giriş Yap' }),
      ).not.toBeInTheDocument()
      expect(
        mainMenu().queryByRole('link', { name: 'Kayıt Ol' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(status)).not.toBeInTheDocument()

      const menu = await openAccountMenu()
      expect(menu.getByText(status)).toBeInTheDocument()
      expect(menu.getByRole('button', { name: 'Çıkış yap' })).toBeEnabled()
      if (account) {
        expect(
          menu.getByRole('link', { name: 'Hesap ve gizlilik' }),
        ).toHaveAttribute('href', account)
      } else {
        expect(
          menu.queryByRole('link', { name: 'Hesap ve gizlilik' }),
        ).not.toBeInTheDocument()
      }
    },
  )

  it('closes the account menu on Escape or outside click and restores Escape focus', async () => {
    signIn('PARENT')
    renderLayout()

    const trigger = await screen.findByRole('button', { name: 'Hesabım' })
    let menu = await openAccountMenu()
    menu.getByRole('link', { name: 'Hesap ve gizlilik' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger).toHaveFocus()
    const closingPanel = document.getElementById('account-menu-panel')
    expect(closingPanel).toHaveAttribute('data-state', 'closed')
    expect(closingPanel).toHaveAttribute('aria-hidden', 'true')
    expect(closingPanel).toHaveAttribute('inert')
    expect(
      screen.queryByRole('group', { name: 'Hesabım' }),
    ).not.toBeInTheDocument()
    fireEvent.transitionEnd(closingPanel!, { propertyName: 'opacity' })
    expect(closingPanel).not.toBeInTheDocument()

    menu = await openAccountMenu()
    expect(menu.getByText('Veli oturumu açık')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Okulunu seç' }))
    expect(
      screen.queryByRole('group', { name: 'Hesabım' }),
    ).not.toBeInTheDocument()
  })

  it('reverses an interrupted close without stale account controls', async () => {
    signIn('PARENT')
    renderLayout()

    const trigger = await screen.findByRole('button', { name: 'Hesabım' })
    const menu = await openAccountMenu()
    const panel = menu.getByText('Veli oturumu açık').parentElement!

    expect(panel).toHaveAttribute('data-state', 'open')
    expect(panel).not.toHaveAttribute('inert')

    fireEvent.click(trigger)
    expect(panel).toHaveAttribute('data-state', 'closed')
    expect(panel).toHaveAttribute('inert')

    fireEvent.click(trigger)
    expect(panel).toHaveAttribute('data-state', 'open')
    expect(panel).not.toHaveAttribute('inert')
    expect(screen.getByRole('group', { name: 'Hesabım' })).toBeInTheDocument()
  })

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

    fireEvent.click(
      (await openAccountMenu()).getByRole('button', { name: 'Çıkış yap' }),
    )
    expect(
      screen.getByRole('button', { name: 'Çıkış yapılıyor…' }),
    ).toBeDisabled()
    fireEvent.click(await screen.findByRole('button', { name: 'Test girişi' }))
    expect(router.state.location.pathname).toBe('/parent/login')

    const nextMenu = await openAccountMenu()
    const signOut = nextMenu.getByRole('button', { name: 'Çıkış yap' })
    expect(signOut).toBeEnabled()
    expect(nextMenu.getByText('Veli oturumu açık')).toBeInTheDocument()
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

    fireEvent.click(
      (await openAccountMenu()).getByRole('button', { name: 'Çıkış yap' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Ortak giriş' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?reason=session')
    expect(knownAuthRole()).toBeUndefined()
    expect(
      await mainMenu().findByRole('link', { name: 'Giriş Yap' }),
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

    const navigationToggle = screen.getByRole('button', { name: 'Menü' })
    fireEvent.click(navigationToggle)
    const menu = await openAccountMenu()
    fireEvent.click(menu.getByRole('button', { name: 'Çıkış yap' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Çıkış yapılamadı. Lütfen tekrar deneyin.')
    expect(alert).not.toHaveAttribute('inert')
    expect(navigationToggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(navigationToggle)
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
    const parentMenu = await openAccountMenu()
    expect(parentMenu.getByText('Veli oturumu açık')).toBeInTheDocument()

    signIn('OPERATOR')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(
      await screen.findByRole('link', { name: 'İşletmeci paneli' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Hesabım' }),
    ).not.toBeInTheDocument()
    expect(
      (await openAccountMenu()).getByText('İşletmeci oturumu açık'),
    ).toBeInTheDocument()
  })

  it('asks once per page load for a guest and not again on focus or remount', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<h1>Okulunu seç</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    await mainMenu().findByRole('link', { name: 'Giriş Yap' })
    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    unmount()
    renderLayout()

    expect(
      await mainMenu().findByRole('link', { name: 'Giriş Yap' }),
    ).toBeInTheDocument()
    expect(meRequests).toBe(1)
  })

  it('verifies when another tab signs in or out', async () => {
    renderLayout()
    await mainMenu().findByRole('link', { name: 'Giriş Yap' })

    sessionRole = 'OPERATOR'
    announceFromOtherTab()
    expect(
      await screen.findByRole('link', { name: 'İşletmeci paneli' }),
    ).toBeInTheDocument()

    sessionRole = undefined
    announceFromOtherTab()
    expect(
      await mainMenu().findByRole('link', { name: 'Giriş Yap' }),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBeUndefined()
  })

  it('reuses the answer a workspace loader already received', async () => {
    signIn('OPERATOR')
    await refreshAuthRole()
    const before = meRequests
    renderLayout()

    expect(
      screen.getByRole('link', { name: 'İşletmeci paneli' }),
    ).toBeInTheDocument()
    expect(meRequests).toBe(before)
  })

  it('does not turn a server error into a guest, and clears on a later 401', async () => {
    sessionStorage.setItem('servisimibul.auth-role', 'PARENT')
    meStatus = 503
    renderLayout()

    expect(
      (await openAccountMenu()).getByText('Veli oturumu açık'),
    ).toBeInTheDocument()
    expect(knownAuthRole()).toBe('PARENT')

    meStatus = 200
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(
      await mainMenu().findByRole('link', { name: 'Giriş Yap' }),
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

function LateHeadingPage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 80)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <>
      <button type="button">Yorum yaz</button>
      {ready && <h1>Geç başlık</h1>}
    </>
  )
}

function renderAccessibleRoutes() {
  const router = createMemoryRouter(
    [
      {
        Component: RouteAccessibility,
        children: [
          {
            path: '/',
            Component: PublicLayout,
            children: [
              { index: true, element: <h1>Okulunu seç</h1> },
              { path: 'late', element: <LateHeadingPage /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('RouteAccessibility', () => {
  it('focuses a late page heading after genuine navigation', async () => {
    const router = renderAccessibleRoutes()
    await screen.findByRole('heading', { name: 'Okulunu seç' })
    await act(() => router.navigate('/late'))

    const heading = await screen.findByRole('heading', { name: 'Geç başlık' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it.each([
    ['pointer', (target: HTMLElement) => fireEvent.pointerDown(target)],
    [
      'keyboard',
      (target: HTMLElement) => fireEvent.keyDown(target, { key: 'Tab' }),
    ],
  ])(
    'does not steal focus from a %s interaction made before the heading loads',
    async (_, interact) => {
      const router = renderAccessibleRoutes()
      await screen.findByRole('heading', { name: 'Okulunu seç' })
      await act(() => router.navigate('/late'))

      const button = screen.getByRole('button', { name: 'Yorum yaz' })
      interact(button)
      button.focus()

      await screen.findByRole('heading', { name: 'Geç başlık' })
      await new Promise((resolve) => window.setTimeout(resolve, 20))
      expect(button).toHaveFocus()
    },
  )
})
