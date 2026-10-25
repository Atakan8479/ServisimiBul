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
    fireEvent.click(screen.getByRole('button', { name: /Ayrıntıyı aç/ }))

    expect(
      await screen.findByRole('heading', { name: 'Talep ayrıntısı' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(markedId).toBe('7bd12425-ea60-45e5-b937-ddf75db2eb45'),
    )
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
