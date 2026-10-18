import { fireEvent, render, screen } from '@testing-library/react'
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
        name: 'Aramalarda görünmeye hazır mısınız?',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'İşletmeci alanı menüsü' }),
    ).toBeInTheDocument()
    // Wait for the overview's async GET before this test resets its MSW handlers.
    expect(
      await screen.findByText(
        'Profiliniz henüz ebeveyn aramalarına uygun değil.',
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

  it('uses a view transition when navigating between pages', async () => {
    server.use(
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 50,
          totalElements: 0,
          totalPages: 0,
        }),
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
        screen.getByRole('heading', { name: 'ServisimiBul' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Servis bulmanın yeni yolu.')).toBeInTheDocument()
      // Let the public page's school lookup finish before navigating away.
      expect(
        await screen.findByRole('option', { name: 'Okul seçin' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Yönetim' }),
      ).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('link', { name: 'Giriş' }))

      expect(
        await screen.findByRole('heading', { name: 'Hoş geldiniz' }),
      ).toBeInTheDocument()
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
