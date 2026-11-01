import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  MemoryRouter,
  Route,
  Routes,
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { server } from '../../test/server'
import { NotificationCenterPage } from './NotificationCenterPage'
import { NotificationNavLink } from './NotificationNavLink'

afterEach(() => resetCsrfToken())

describe('notification center', () => {
  it('shows the unread count in navigation', async () => {
    server.use(
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 3 }),
      ),
    )

    render(
      <MemoryRouter>
        <NotificationNavLink to="/notifications" />
      </MemoryRouter>,
    )

    expect(
      await screen.findByLabelText('3 okunmamış bildirim'),
    ).toBeInTheDocument()
  })

  it('marks an unread notification before navigating to its target', async () => {
    let markedId: string | undefined
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(notificationPage()),
      ),
      http.put('/api/v1/notifications/:id/read', ({ params }) => {
        markedId = String(params.id)
        return HttpResponse.json({
          ...notificationPage().content[0],
          readAt: '2026-10-25T09:10:00Z',
        })
      }),
    )
    const router = createMemoryRouter(
      [
        { path: '/notifications', Component: NotificationCenterPage },
        { path: '/demands/:id', element: <h1>Talep ayrıntısı</h1> },
      ],
      { initialEntries: ['/notifications'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Yeni servis talebi')).toBeInTheDocument()
    expect(screen.getByText('Yeni')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'İncele' }))

    expect(
      await screen.findByRole('heading', { name: 'Talep ayrıntısı' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(markedId).toBe('7bd12425-ea60-45e5-b937-ddf75db2eb45'),
    )
  })

  it('marks a notification read in place and refreshes the backend count', async () => {
    let unread = 1
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(notificationPage()),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: unread }),
      ),
      http.put('/api/v1/notifications/:id/read', () => {
        unread = 0
        return HttpResponse.json({
          ...notificationPage().content[0],
          readAt: '2026-10-25T09:10:00Z',
        })
      }),
    )
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationNavLink to="/notifications" />
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByLabelText('1 okunmamış bildirim'),
    ).toBeInTheDocument()
    expect(await screen.findByText('1 okunmamış bildirim')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Okundu olarak işaretle' }),
    )

    expect(
      await screen.findByText('Bildirim okundu olarak işaretlendi.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Hepsi okundu')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByLabelText('1 okunmamış bildirim'),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: 'Okundu olarak işaretle' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'İncele' })).toHaveFocus()
  })

  it('marks every notification read through the backend', async () => {
    let unread = 1
    let calls = 0
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(
          unread
            ? notificationPage()
            : {
                ...notificationPage(),
                content: [
                  {
                    ...notificationPage().content[0],
                    readAt: '2026-10-25T09:10:00Z',
                  },
                ],
              },
        ),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: unread }),
      ),
      http.put('/api/v1/notifications/read-all', () => {
        calls += 1
        unread = 0
        return HttpResponse.json({ unreadCount: 0 })
      }),
    )
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationNavLink to="/notifications" />
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tümünü okundu işaretle' }),
    )

    const notice = await screen.findByText(
      'Tüm bildirimler okundu olarak işaretlendi.',
    )
    expect(notice).toHaveFocus()
    expect(calls).toBe(1)
    expect(screen.getByText('Hepsi okundu')).toBeInTheDocument()
    expect(screen.queryByText('Yeni')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Tümünü okundu işaretle' }),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByLabelText('1 okunmamış bildirim'),
      ).not.toBeInTheDocument(),
    )
  })

  it('keeps unread state and explains when read-all fails', async () => {
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(notificationPage()),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
      http.put('/api/v1/notifications/read-all', () =>
        HttpResponse.json(
          { title: 'Error', status: 503, detail: 'Şu anda işaretlenemiyor.' },
          {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tümünü okundu işaretle' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Şu anda işaretlenemiyor.',
    )
    expect(screen.getByText('Yeni')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tümünü okundu işaretle' }),
    ).toBeEnabled()
  })

  it('keeps a notification unread and explains when marking fails', async () => {
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(notificationPage()),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
      http.put('/api/v1/notifications/:id/read', () =>
        HttpResponse.json(
          { title: 'Not found', status: 404, detail: 'Bildirim bulunamadı.' },
          {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Okundu olarak işaretle' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bildirim bulunamadı.',
    )
    expect(screen.getByText('Yeni')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Okundu olarak işaretle' }),
    ).toBeEnabled()
  })

  it.each([
    ['/notifications', 'Bildirimler', 'Veli hesabı', 'veli hesabı'],
    [
      '/operator/notifications',
      'Bildirimler',
      'İşletmeci paneli',
      'işletmeci hesabı',
    ],
    [
      '/admin/notifications',
      'Yönetim bildirimleri',
      'Yönetim paneli',
      'yönetici hesabı',
    ],
  ])('shows the %s role copy', async (path, title, eyebrow, account) => {
    server.use(
      http.get('/api/v1/notifications', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 0 }),
      ),
    )
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<NotificationCenterPage />} path={path} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(screen.getByText(eyebrow)).toBeInTheDocument()
    expect(
      await screen.findByText(`0 toplam bildirim · ${account}`),
    ).toBeInTheDocument()
    expect(screen.getByText('Henüz bildiriminiz yok')).toBeInTheDocument()
    expect(screen.queryByText('Hepsi okundu')).not.toBeInTheDocument()
  })

  it('does not claim the list is empty when loading fails', async () => {
    server.use(
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(
          { title: 'Error', status: 503, detail: 'Servis kullanılamıyor.' },
          {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 0 }),
      ),
    )
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Servis kullanılamıyor.',
    )
    expect(screen.queryByText('Henüz bildiriminiz yok')).not.toBeInTheDocument()
  })

  it('provides an actionable retry state', async () => {
    let attempts = 0
    server.use(
      http.get('/api/v1/notifications', () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json(
              {
                status: 503,
                detail: 'Bildirim servisi geçici olarak kullanılamıyor.',
              },
              { status: 503 },
            )
          : HttpResponse.json(notificationPage())
      }),
    )

    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<NotificationCenterPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('Bildirim servisi geçici olarak kullanılamıyor.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('Yeni servis talebi')).toBeInTheDocument()
  })
})

describe('notification center asynchronous ordering', () => {
  const unreadItem = notificationPage().content[0]!
  const pageOf = (items: unknown[], page = 0, totalPages = 2) => ({
    content: items,
    page,
    size: 20,
    totalElements: 21,
    totalPages,
  })

  function deferred() {
    let resolve: () => void = () => undefined
    const promise = new Promise<void>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  function renderCenter(path = '/notifications') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <NotificationNavLink to="/notifications" />
        <Routes>
          <Route element={<NotificationCenterPage />} path={path} />
        </Routes>
      </MemoryRouter>,
    )
  }

  // Lets a released response reach the component before asserting its absence.
  async function settle(served: () => boolean) {
    await waitFor(() => expect(served()).toBe(true))
    await act(async () => {
      await fetch('/api/v1/notifications/unread-count')
    })
  }

  it('A: keeps zero when an older unread count arrives after read-all', async () => {
    const gate = deferred()
    let unread = 2
    let countCalls = 0
    let staleServed = false
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', ({ request }) =>
        HttpResponse.json(
          pageOf(
            [
              {
                ...unreadItem,
                readAt: unread ? null : '2026-10-25T09:10:00Z',
              },
            ],
            Number(new URL(request.url).searchParams.get('page')),
          ),
        ),
      ),
      http.get('/api/v1/notifications/unread-count', async () => {
        countCalls += 1
        const observed = unread
        // The page and the navigation badge each load once, then page 1 asks again.
        if (countCalls === 3) {
          await gate.promise
          staleServed = true
        }
        return HttpResponse.json({ unreadCount: observed })
      }),
      http.put('/api/v1/notifications/read-all', () => {
        unread = 0
        return HttpResponse.json({ unreadCount: 0 })
      }),
    )
    renderCenter()

    expect(await screen.findByText('2 okunmamış bildirim')).toBeInTheDocument()
    await waitFor(() => expect(countCalls).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }))
    await waitFor(() => expect(countCalls).toBe(3))
    fireEvent.click(
      screen.getByRole('button', { name: 'Tümünü okundu işaretle' }),
    )
    expect(await screen.findByText('0 okunmamış bildirim')).toBeInTheDocument()

    gate.resolve()
    await settle(() => staleServed)

    expect(screen.getByText('0 okunmamış bildirim')).toBeInTheDocument()
    expect(screen.queryByText('2 okunmamış bildirim')).not.toBeInTheDocument()
    expect(screen.getByText('Hepsi okundu')).toBeInTheDocument()
  })

  it('B: keeps read cards when an older list arrives after read-all', async () => {
    const gate = deferred()
    let unread = 1
    let listCalls = 0
    let staleServed = false
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', async () => {
        listCalls += 1
        const observed = unread
        if (listCalls === 2) {
          await gate.promise
          staleServed = true
        }
        return HttpResponse.json(
          pageOf([
            {
              ...unreadItem,
              readAt: observed ? null : '2026-10-25T09:10:00Z',
            },
          ]),
        )
      }),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: unread }),
      ),
      http.put('/api/v1/notifications/read-all', () => {
        unread = 0
        return HttpResponse.json({ unreadCount: 0 })
      }),
    )
    renderCenter()

    expect(await screen.findByText('Yeni')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }))
    await waitFor(() => expect(listCalls).toBe(2))
    fireEvent.click(
      screen.getByRole('button', { name: 'Tümünü okundu işaretle' }),
    )
    expect(
      await screen.findByText('Tüm bildirimler okundu olarak işaretlendi.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Yeni')).not.toBeInTheDocument()

    gate.resolve()
    await settle(() => staleServed)

    expect(screen.queryByText('Yeni')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Okundu olarak işaretle' }),
    ).not.toBeInTheDocument()
  })

  it('B2: does not show unread cards when reloading after read-all fails', async () => {
    let unread = 1
    let listCalls = 0
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () => {
        listCalls += 1
        if (listCalls > 1) {
          return HttpResponse.json(
            { title: 'Error', status: 503, detail: 'Liste alınamadı.' },
            {
              status: 503,
              headers: { 'Content-Type': 'application/problem+json' },
            },
          )
        }
        return HttpResponse.json(pageOf([unreadItem]))
      }),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: unread }),
      ),
      http.put('/api/v1/notifications/read-all', () => {
        unread = 0
        return HttpResponse.json({ unreadCount: 0 })
      }),
    )
    renderCenter()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tümünü okundu işaretle' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Liste alınamadı.',
    )
    expect(screen.queryByText('Yeni')).not.toBeInTheDocument()
    expect(screen.getByText('0 okunmamış bildirim')).toBeInTheDocument()
  })

  it('C: shows only page 1 when page 0 resolves last', async () => {
    const pageZero = deferred()
    let pageZeroCalls = 0
    let staleServed = false
    server.use(
      http.get('/api/v1/notifications', async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        if (page === 1) {
          return HttpResponse.json(
            pageOf([{ ...unreadItem, title: 'İkinci sayfa' }], 1),
          )
        }
        pageZeroCalls += 1
        if (pageZeroCalls === 2) {
          await pageZero.promise
          staleServed = true
        }
        return HttpResponse.json(
          pageOf([{ ...unreadItem, title: 'İlk sayfa' }], 0),
        )
      }),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
    )
    renderCenter()

    expect(await screen.findByText('İlk sayfa')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }))
    expect(await screen.findByText('İkinci sayfa')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Önceki' }))
    await waitFor(() => expect(pageZeroCalls).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }))
    expect(await screen.findByText('İkinci sayfa')).toBeInTheDocument()

    pageZero.resolve()
    await settle(() => staleServed)

    expect(screen.getByText('İkinci sayfa')).toBeInTheDocument()
    expect(screen.queryByText('İlk sayfa')).not.toBeInTheDocument()
    expect(screen.getByText('Sayfa 2 / 2')).toBeInTheDocument()
  })

  it('D: keeps unread state after a failed read-all and succeeds on retry', async () => {
    let attempts = 0
    let unread = 1
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(
          pageOf(
            [
              {
                ...unreadItem,
                readAt: unread ? null : '2026-10-25T09:10:00Z',
              },
            ],
            0,
            1,
          ),
        ),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: unread }),
      ),
      http.put('/api/v1/notifications/read-all', () => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json(
            { title: 'Error', status: 503, detail: 'Şu anda işaretlenemiyor.' },
            {
              status: 503,
              headers: { 'Content-Type': 'application/problem+json' },
            },
          )
        }
        unread = 0
        return HttpResponse.json({ unreadCount: 0 })
      }),
    )
    renderCenter()

    const action = await screen.findByRole('button', {
      name: 'Tümünü okundu işaretle',
    })
    fireEvent.click(action)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Şu anda işaretlenemiyor.',
    )
    expect(screen.getByText('Yeni')).toBeInTheDocument()
    expect(screen.getByText('1 okunmamış bildirim')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Listeyi yenile' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Tümünü okundu işaretle' }),
    )
    expect(
      await screen.findByText('Tüm bildirimler okundu olarak işaretlendi.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Yeni')).not.toBeInTheDocument()
  })

  it('E: an unmounted view cannot affect a newly mounted one', async () => {
    const gate = deferred()
    let listCalls = 0
    let staleServed = false
    server.use(
      http.get('/api/v1/notifications', async () => {
        listCalls += 1
        if (listCalls === 1) {
          await gate.promise
          staleServed = true
          return HttpResponse.json(
            pageOf([{ ...unreadItem, title: 'Eski görünüm' }], 0, 1),
          )
        }
        return HttpResponse.json(
          pageOf([{ ...unreadItem, title: 'Yeni görünüm' }], 0, 1),
        )
      }),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
    )
    const first = renderCenter()
    await waitFor(() => expect(listCalls).toBe(1))
    first.unmount()

    renderCenter()
    expect(await screen.findByText('Yeni görünüm')).toBeInTheDocument()

    gate.resolve()
    await settle(() => staleServed)

    expect(screen.getByText('Yeni görünüm')).toBeInTheDocument()
    expect(screen.queryByText('Eski görünüm')).not.toBeInTheDocument()
  })

  it('blocks conflicting actions while one mark is running', async () => {
    const gate = deferred()
    let singleCalls = 0
    let allCalls = 0
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(pageOf([unreadItem], 0, 1)),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
      http.put('/api/v1/notifications/read-all', () => {
        allCalls += 1
        return HttpResponse.json({ unreadCount: 0 })
      }),
      http.put('/api/v1/notifications/:id/read', async () => {
        singleCalls += 1
        await gate.promise
        return HttpResponse.json({
          ...unreadItem,
          readAt: '2026-10-25T09:10:00Z',
        })
      }),
    )
    renderCenter()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Okundu olarak işaretle' }),
    )
    const all = screen.getByRole('button', { name: 'Tümünü okundu işaretle' })
    expect(all).toBeDisabled()
    fireEvent.click(all)
    await waitFor(() => expect(singleCalls).toBe(1))
    expect(allCalls).toBe(0)

    gate.resolve()
    expect(
      await screen.findByText('Bildirim okundu olarak işaretlendi.'),
    ).toBeInTheDocument()
  })

  it('sends the parent to login when a mutation finds the session expired', async () => {
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(pageOf([unreadItem], 0, 1)),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
      http.put('/api/v1/notifications/read-all', () =>
        HttpResponse.json(
          {
            title: 'Unauthorized',
            status: 401,
            detail: 'Oturum gerekli.',
            code: 'AUTHENTICATION_REQUIRED',
          },
          {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
          <Route element={<h1>Veli girişi</h1>} path="/parent/login" />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tümünü okundu işaretle' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
  })
})

describe('notification action locking', () => {
  const first = notificationPage().content[0]!
  const second = {
    ...first,
    id: '7bd12425-ea60-45e5-b937-ddf75db2eb46',
    title: 'İkinci bildirim',
    href: '/demands/1b0b4456-5e55-4814-b8f8-64d1343617fe',
  }
  const list = (items: unknown[]) => ({
    content: items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: 1,
  })

  function deferred() {
    let resolve: () => void = () => undefined
    const promise = new Promise<void>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  function problem(status: number, detail: string) {
    return HttpResponse.json(
      { title: 'Error', status, detail },
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    )
  }

  function renderCenter() {
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route element={<NotificationCenterPage />} path="/notifications" />
          <Route element={<h1>Talep ayrıntısı</h1>} path="/demands/:id" />
          <Route element={<h1>Veli girişi</h1>} path="/parent/login" />
        </Routes>
      </MemoryRouter>,
    )
  }

  const button = (name: string) => screen.getAllByRole('button', { name })

  it('A: locks every action while read-all runs', async () => {
    const gate = deferred()
    const mutations: string[] = []
    let unread = 2
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(
          list(
            [first, second].map((item) => ({
              ...item,
              readAt: unread ? null : '2026-10-25T09:10:00Z',
            })),
          ),
        ),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: unread }),
      ),
      http.put('/api/v1/notifications/read-all', async () => {
        mutations.push('all')
        await gate.promise
        unread = 0
        return HttpResponse.json({ unreadCount: 0 })
      }),
      http.put('/api/v1/notifications/:id/read', () => {
        mutations.push('single')
        return HttpResponse.json({ ...first, readAt: '2026-10-25T09:10:00Z' })
      }),
    )
    renderCenter()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tümünü okundu işaretle' }),
    )
    await waitFor(() => expect(mutations).toEqual(['all']))
    for (const action of [
      ...button('İncele'),
      ...button('Okundu olarak işaretle'),
    ]) {
      expect(action).toBeDisabled()
      fireEvent.click(action)
    }
    expect(
      screen.getByRole('button', { name: 'İşaretleniyor…' }),
    ).toBeDisabled()

    gate.resolve()

    expect(
      await screen.findByText('Tüm bildirimler okundu olarak işaretlendi.'),
    ).toBeInTheDocument()
    expect(mutations).toEqual(['all'])
    expect(screen.queryByText('Yeni')).not.toBeInTheDocument()
    for (const action of button('İncele')) expect(action).toBeEnabled()
  })

  it('B: locks other actions while opening and then follows the deep link', async () => {
    const gate = deferred()
    const mutations: string[] = []
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(list([first, second])),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 2 }),
      ),
      http.put('/api/v1/notifications/read-all', () => {
        mutations.push('all')
        return HttpResponse.json({ unreadCount: 0 })
      }),
      http.put('/api/v1/notifications/:id/read', async ({ params }) => {
        mutations.push(String(params.id))
        await gate.promise
        return HttpResponse.json({ ...first, readAt: '2026-10-25T09:10:00Z' })
      }),
    )
    renderCenter()

    await screen.findByText('2 okunmamış bildirim')
    fireEvent.click(button('İncele')[1]!)
    await waitFor(() => expect(mutations).toEqual([second.id]))

    const all = screen.getByRole('button', { name: 'Tümünü okundu işaretle' })
    expect(all).toBeDisabled()
    fireEvent.click(all)
    const firstOpen = button('İncele')[0]!
    expect(firstOpen).toBeDisabled()
    fireEvent.click(firstOpen)
    for (const action of button('Okundu olarak işaretle')) {
      expect(action).toBeDisabled()
    }

    gate.resolve()

    expect(
      await screen.findByRole('heading', { name: 'Talep ayrıntısı' }),
    ).toBeInTheDocument()
    expect(mutations).toEqual([second.id])
  })

  it('C: unlocks actions and keeps unread state after a failed open', async () => {
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(list([first, second])),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 2 }),
      ),
      http.put('/api/v1/notifications/:id/read', () =>
        problem(503, 'Bildirim açılamıyor.'),
      ),
    )
    renderCenter()

    await screen.findByText('2 okunmamış bildirim')
    fireEvent.click(button('İncele')[0]!)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bildirim açılamıyor.',
    )
    expect(screen.getAllByText('Yeni')).toHaveLength(2)
    expect(screen.getByText('2 okunmamış bildirim')).toBeInTheDocument()
    for (const action of [
      ...button('İncele'),
      ...button('Okundu olarak işaretle'),
      ...button('Tümünü okundu işaretle'),
    ]) {
      expect(action).toBeEnabled()
    }
  })

  it('D: redirects to login when opening finds the session expired', async () => {
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () => HttpResponse.json(list([first]))),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
      http.put('/api/v1/notifications/:id/read', () =>
        problem(401, 'Oturum gerekli.'),
      ),
    )
    renderCenter()

    fireEvent.click(await screen.findByRole('button', { name: 'İncele' }))

    expect(
      await screen.findByRole('heading', { name: 'Veli girişi' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Talep ayrıntısı' }),
    ).not.toBeInTheDocument()
  })

  it('E: sends one request for two different actions in the same tick', async () => {
    const gate = deferred()
    const mutations: string[] = []
    server.use(
      csrfHandler(),
      http.get('/api/v1/notifications', () =>
        HttpResponse.json(list([first, second])),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ unreadCount: 2 }),
      ),
      http.put('/api/v1/notifications/read-all', async () => {
        mutations.push('all')
        await gate.promise
        return HttpResponse.json({ unreadCount: 0 })
      }),
      http.put('/api/v1/notifications/:id/read', async () => {
        mutations.push('single')
        await gate.promise
        return HttpResponse.json({ ...first, readAt: '2026-10-25T09:10:00Z' })
      }),
    )
    renderCenter()

    await screen.findByText('2 okunmamış bildirim')
    const [open] = button('İncele')
    const [mark] = button('Okundu olarak işaretle')
    const [all] = button('Tümünü okundu işaretle')
    act(() => {
      open!.click()
      mark!.click()
      all!.click()
    })

    await waitFor(() => expect(mutations).toHaveLength(1))
    await act(async () => {
      await fetch('/api/v1/notifications/unread-count')
    })
    expect(mutations).toHaveLength(1)

    gate.resolve()
    expect(
      await screen.findByRole('heading', { name: 'Talep ayrıntısı' }),
    ).toBeInTheDocument()
  })
})

function csrfHandler() {
  return http.get('/api/v1/auth/csrf', () =>
    HttpResponse.json({
      headerName: 'X-CSRF-TOKEN',
      parameterName: '_csrf',
      token: 'csrf-token',
    }),
  )
}

function notificationPage() {
  return {
    content: [
      {
        id: '7bd12425-ea60-45e5-b937-ddf75db2eb45',
        type: 'DEMAND_CREATED',
        demandId: '1b0b4456-5e55-4814-b8f8-64d1343617fd',
        serviceResponseId: null,
        publicationEventId: null,
        feedbackId: null,
        moderationCaseId: null,
        title: 'Yeni servis talebi',
        message:
          'Hizmet verdiğiniz okulun mevcut kapsama alanında yeni bir talep oluşturuldu.',
        href: '/demands/1b0b4456-5e55-4814-b8f8-64d1343617fd',
        createdAt: '2026-10-25T09:00:00Z',
        readAt: null,
      },
    ],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  }
}
