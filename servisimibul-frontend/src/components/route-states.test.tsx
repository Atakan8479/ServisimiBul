import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { normalizeApiProblem } from '../api/contracts'
import { RouteErrorPage } from './route-states'

describe('route error presentation', () => {
  it.each([
    ['INVALID_CREDENTIALS', 401, 'E-posta veya şifre yanlış.'],
    ['RATE_LIMITED', 429, 'Çok sık denediniz. Biraz sonra tekrar deneyin.'],
    ['UNKNOWN_ERROR', 500, 'İşlem tamamlanamadı. Tekrar deneyin.'],
  ])(
    'renders a safe heading and detail for %s',
    async (code, status, detail) => {
      const problem = normalizeApiProblem(
        {
          title: 'Technical backend title',
          detail: 'Internal database exception',
          code,
          traceId: 'route-trace',
        },
        status,
      )
      renderError(new ApiError(problem))
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'İşlem tamamlanamadı',
        }),
      ).toBeInTheDocument()
      expect(screen.getByText(detail)).toBeInTheDocument()
      expect(
        screen.queryByText('Technical backend title'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('Internal database exception'),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Ana sayfaya dön' }),
      ).toHaveAttribute('href', '/')
      expect(problem).toMatchObject({
        code,
        status,
        traceId: 'route-trace',
        title: 'Technical backend title',
      })
    },
  )

  it.each([
    [404, 'Sayfa bulunamadı'],
    [500, 'Bir sorun oluştu'],
  ])(
    'preserves router response handling for HTTP %s',
    async (status, title) => {
      renderError(
        new Response('Internal route detail', {
          status,
          statusText: 'Technical title',
        }),
      )
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Internal route detail'),
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Technical title')).not.toBeInTheDocument()
    },
  )
})

function renderError(error: unknown) {
  const router = createMemoryRouter([
    {
      path: '/',
      loader: () => {
        throw error
      },
      Component: () => null,
      ErrorBoundary: RouteErrorPage,
    },
  ])
  render(<RouterProvider router={router} />)
}
