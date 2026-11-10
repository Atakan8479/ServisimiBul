import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ApiError } from '../api/client'
import { LoadingPage, RouteErrorPage } from '../components/route-states'
import { server } from '../test/server'
import { routes } from './router'

describe('application routes', () => {
  it('renders the authenticated operator workspace shell', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: '6e2973ac-0302-49a8-b519-563ec9861272',
          email: 'operator@example.com',
          role: 'OPERATOR',
          operatorApprovalRequired: true,
          approvalStatus: 'APPROVED',
        }),
      ),
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

    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/operator'] })}
      />,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Genel bakış',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'İşletmeci alanı menüsü' }),
    ).toBeInTheDocument()
    // Wait for the overview's async GET before this test resets its MSW handlers.
    expect(
      await screen.findByText(
        'Profiliniz henüz arama sonuçlarında görünmüyor.',
      ),
    ).toBeInTheDocument()
  })

  it('renders the admin workspace shell', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
          email: 'admin@example.com',
          role: 'ADMIN',
          operatorApprovalRequired: true,
          approvalStatus: null,
        }),
      ),
      http.get('/api/v1/admin/operators', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/admin'] })}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'İşletmeci başvuruları' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Yönetim alanı menüsü' }),
    ).toBeInTheDocument()
    // Wait for the list request before resetting MSW handlers after the test.
    expect(
      await screen.findByRole('heading', { name: 'Bu durumda başvuru yok' }),
    ).toBeInTheDocument()
  })

  it('redirects an expired operator session to a clear login message', async () => {
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

    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ['/operator/profile'],
        })}
      />,
    )

    expect(
      await screen.findByText(
        'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
      ),
    ).toBeInTheDocument()
  })

  it('redirects an expired parent notification session to parent login', async () => {
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

    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ['/notifications'],
        })}
      />,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Yeniden hoş geldiniz.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
      ),
    ).toBeInTheDocument()
  })

  it.each([
    ['ADMIN', '/admin/schools'],
    ['OPERATOR', '/operator'],
    ['PARENT', '/demands'],
  ] as const)(
    'sends an expired admin deep link to the shared login and lets only %s reach %s',
    async (role, destination) => {
      let signedIn = false
      server.use(
        http.get('/api/v1/auth/me', () =>
          signedIn
            ? HttpResponse.json(authUser(role))
            : HttpResponse.json(
                {
                  title: 'Unauthorized',
                  status: 401,
                  detail: 'Authentication is required',
                  code: 'UNAUTHENTICATED',
                },
                { status: 401 },
              ),
        ),
        http.get('/api/v1/auth/csrf', () =>
          HttpResponse.json({
            headerName: 'X-CSRF-TOKEN',
            parameterName: '_csrf',
            token: 'csrf-token',
          }),
        ),
        http.post('/api/v1/auth/login', () => {
          signedIn = true
          return HttpResponse.json(authUser(role))
        }),
      )
      const router = createMemoryRouter(routes, {
        initialEntries: ['/admin/schools'],
      })
      render(<RouterProvider router={router} />)

      expect(
        await screen.findByText(
          'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
        ),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(
        new URLSearchParams(router.state.location.search).get('next'),
      ).toBe('/admin/schools')

      fireEvent.change(screen.getByLabelText('E-posta'), {
        target: { value: 'user@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Şifre'), {
        target: { value: 'password value' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

      await waitFor(() =>
        expect(router.state.location.pathname).toBe(destination),
      )
    },
  )

  it('uses a view transition when navigating between pages', async () => {
    server.use(
      http.get('/api/v1/provinces', () =>
        HttpResponse.json([{ id: 34, code: '34', name: 'İstanbul' }]),
      ),
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
    const startViewTransition = vi.fn((update: () => void) => {
      update()
      return { finished: Promise.resolve() }
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })

    try {
      render(
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: ['/'] })}
        />,
      )

      expect(document.querySelector('.road-backdrop')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', {
          name: 'Okul servisini birlikte bulalım.',
        }),
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Servis bulmanın yeni yolu.'),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Talep panosunu keşfet' }),
      ).toHaveAttribute('href', '/demands')
      // Let the public page's database-backed pilot location lookup finish.
      expect(
        await screen.findByRole('option', { name: 'İstanbul' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Yönetim' }),
      ).not.toBeInTheDocument()
      const primaryNavigation = within(
        screen.getByRole('navigation', { name: 'Ana menü' }),
      )
      expect(
        await primaryNavigation.findByRole('link', { name: 'Veli kaydı' }),
      ).toHaveAttribute('href', '/parent/register')
      expect(
        primaryNavigation.getByRole('link', { name: 'İşletmeci girişi' }),
      ).toHaveAttribute('href', '/operator/login')
      expect(
        primaryNavigation.getByRole('link', { name: 'İşletmeci kaydı' }),
      ).toHaveAttribute('href', '/operator/register')
      fireEvent.click(
        primaryNavigation.getByRole('link', { name: 'Veli girişi' }),
      )

      const loginHeading = await screen.findByRole('heading', {
        name: 'Yeniden hoş geldiniz.',
      })
      await waitFor(() => expect(loginHeading).toHaveFocus())
      expect(document.title).toBe('Veli girişi | ServisimiBul')
      expect(startViewTransition).toHaveBeenCalledOnce()
    } finally {
      Reflect.deleteProperty(document, 'startViewTransition')
    }
  })

  it('shows a recoverable message when an authenticated session expires', async () => {
    const expiredRoute: RouteObject[] = [
      {
        path: '/',
        loader: () => {
          throw new ApiError(
            {
              title: 'Unauthorized',
              status: 401,
              detail: 'Authentication is required',
              code: 'UNAUTHENTICATED',
            },
            true,
          )
        },
        Component: () => null,
        ErrorBoundary: RouteErrorPage,
      },
    ]

    render(
      <RouterProvider
        router={createMemoryRouter(expiredRoute, { initialEntries: ['/'] })}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Oturumunuz sona erdi' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ana sayfaya dön' }),
    ).toHaveAttribute('href', '/')
  })

  it('provides an accessible loading state', () => {
    render(<LoadingPage />)

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByRole('heading', { name: 'Yükleniyor' }),
    ).toBeInTheDocument()
  })
})

function authUser(role: 'ADMIN' | 'OPERATOR' | 'PARENT') {
  return {
    id: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
    email: 'user@example.com',
    role,
    operatorApprovalRequired: true,
    approvalStatus: role === 'OPERATOR' ? 'APPROVED' : null,
  }
}
