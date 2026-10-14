import { render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { LoadingPage, RouteErrorPage } from '../components/route-states'
import { routes } from './router'

describe('application routes', () => {
  it.each([
    ['/operator', 'İşletmeci alanı hazır'],
    ['/admin', 'Yönetim alanı hazır'],
  ])('renders the %s workspace shell', async (path, heading) => {
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [path] })}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
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
