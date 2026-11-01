import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
