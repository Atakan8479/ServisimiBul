import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryRouter,
  redirect,
} from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ROUTE_PENDING_DELAY_MS,
  RoutePendingIndicator,
} from './RoutePendingIndicator'

type Deferred = { resolve: () => void; reject: (error: unknown) => void }

function setup() {
  const pending: Record<string, Deferred> = {}
  const wait = (key: string) =>
    new Promise<null>((resolve, reject) => {
      pending[key] = { resolve: () => resolve(null), reject }
    })
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <>
          <RoutePendingIndicator />
          <Link to="/slow">Yavaş</Link>
          <Link to="/other">Diğer</Link>
          <Link to="/fast">Hızlı</Link>
          <Link to="/redirect">Yönlendir</Link>
          <Outlet />
        </>
      ),
      ErrorBoundary: () => <h1>Hata</h1>,
      children: [
        { index: true, element: <h1>Başlangıç</h1> },
        { path: 'slow', loader: () => wait('slow'), element: <h1>Yavaş</h1> },
        {
          path: 'other',
          loader: () => wait('other'),
          element: <h1>Diğer</h1>,
        },
        { path: 'fast', loader: () => null, element: <h1>Hızlı</h1> },
        {
          path: 'redirect',
          loader: async () => {
            await wait('redirect')
            return redirect('/')
          },
          element: null,
        },
      ],
    },
  ])
  render(<RouterProvider router={router} />)
  return { pending, router }
}

const bar = () => screen.queryByTestId('route-pending')
const announcement = () =>
  document.querySelector('.route-pending-status')?.textContent

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('RoutePendingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays hidden for fast navigations', async () => {
    setup()
    fireEvent.click(screen.getByRole('link', { name: 'Hızlı' }))
    await settle(ROUTE_PENDING_DELAY_MS * 2)
    expect(screen.getByRole('heading', { name: 'Hızlı' })).toBeInTheDocument()
    expect(bar()).toBeNull()
    expect(announcement()).toBe('')
  })

  it('appears after a short delay while a loader waits and clears on success', async () => {
    const { pending } = setup()
    fireEvent.click(screen.getByRole('link', { name: 'Yavaş' }))
    await settle(ROUTE_PENDING_DELAY_MS - 50)
    expect(bar()).toBeNull()

    await settle(60)
    expect(bar()).toBeInTheDocument()
    expect(announcement()).toBe('Sayfa yükleniyor')
    // The previous page stays on screen during the wait.
    expect(screen.getByRole('heading', { name: 'Başlangıç' })).toBeVisible()

    await act(async () => pending.slow.resolve())
    await settle()
    expect(screen.getByRole('heading', { name: 'Yavaş' })).toBeInTheDocument()
    expect(bar()).toBeNull()
    expect(announcement()).toBe('')
  })

  it('clears after a failed loader shows the error state', async () => {
    const { pending } = setup()
    fireEvent.click(screen.getByRole('link', { name: 'Yavaş' }))
    await settle(ROUTE_PENDING_DELAY_MS + 10)
    expect(bar()).toBeInTheDocument()

    await act(async () => pending.slow.reject(new Error('500')))
    await settle()
    expect(screen.getByRole('heading', { name: 'Hata' })).toBeInTheDocument()
    expect(bar()).toBeNull()
  })

  it('clears after a redirect completes', async () => {
    const { pending, router } = setup()
    fireEvent.click(screen.getByRole('link', { name: 'Yönlendir' }))
    await settle(ROUTE_PENDING_DELAY_MS + 10)
    expect(bar()).toBeInTheDocument()

    await act(async () => pending.redirect.resolve())
    await settle()
    expect(router.state.location.pathname).toBe('/')
    expect(bar()).toBeNull()
  })

  it('shows one indicator across rapid navigations and clears when the last one lands', async () => {
    const { pending } = setup()
    fireEvent.click(screen.getByRole('link', { name: 'Yavaş' }))
    await settle(ROUTE_PENDING_DELAY_MS + 10)
    fireEvent.click(screen.getByRole('link', { name: 'Diğer' }))
    await settle(ROUTE_PENDING_DELAY_MS + 10)
    expect(screen.getAllByTestId('route-pending')).toHaveLength(1)

    // The superseded navigation resolving must not end the pending state.
    await act(async () => pending.slow.resolve())
    await settle()
    expect(bar()).toBeInTheDocument()

    await act(async () => pending.other.resolve())
    await settle()
    expect(screen.getByRole('heading', { name: 'Diğer' })).toBeInTheDocument()
    expect(bar()).toBeNull()
  })
})
