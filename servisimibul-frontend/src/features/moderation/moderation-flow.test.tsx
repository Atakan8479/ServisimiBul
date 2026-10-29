import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  MemoryRouter,
  RouterProvider,
  createMemoryRouter,
} from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'
import { ReportControl } from './ReportControl'

afterEach(() => {
  resetCsrfToken()
  vi.restoreAllMocks()
})

describe('reporting and moderation flows', () => {
  it('submits a bounded report while explaining that content remains visible', async () => {
    let requestBody: unknown
    server.use(
      authHandler('PARENT'),
      csrfHandler(),
      http.post('/api/v1/reports', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json(
          {
            id: '7bd12425-ea60-45e5-b937-ddf75db2eb45',
            caseId: '1b0b4456-5e55-4814-b8f8-64d1343617fd',
            targetType: 'COMMENT',
            targetId: '75c3339d-f6f0-4e8e-aad9-2d783f7f2760',
            reason: 'PERSONAL_DATA',
            status: 'OPEN',
            createdAt: '2026-10-24T09:00:00Z',
          },
          { status: 201 },
        )
      }),
    )

    render(
      <MemoryRouter>
        <ReportControl
          targetId="75c3339d-f6f0-4e8e-aad9-2d783f7f2760"
          targetType="COMMENT"
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Bildir' }))
    expect(
      await screen.findByText(/İçerik hemen kaldırılmaz/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Bildirim nedeni'), {
      target: { value: 'PERSONAL_DATA' },
    })
    fireEvent.change(screen.getByLabelText('Açıklama (isteğe bağlı)'), {
      target: { value: 'Telefon numarası paylaşılmış.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bildirimi gönder' }))

    expect(await screen.findByText('Bildirim alındı')).toBeInTheDocument()
    expect(requestBody).toEqual({
      targetType: 'COMMENT',
      targetId: '75c3339d-f6f0-4e8e-aad9-2d783f7f2760',
      reason: 'PERSONAL_DATA',
      explanation: 'Telefon numarası paylaşılmış.',
    })
  })

  it('sends an unauthenticated reporter to the parent login', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(
          {
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication is required',
            code: 'UNAUTHORIZED',
          },
          { status: 401 },
        ),
      ),
    )
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: (
            <ReportControl
              targetId="75c3339d-f6f0-4e8e-aad9-2d783f7f2760"
              targetType="COMMENT"
            />
          ),
        },
      ],
      { initialEntries: ['/demands/example?tab=comments'] },
    )

    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bildir' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/parent/login'),
    )
    expect(router.state.location.search).toBe(
      '?next=%2Fdemands%2Fexample%3Ftab%3Dcomments&reason=session',
    )
  })

  it('shows grouped admin cases without reporter identity and records a reasoned action', async () => {
    let actionBody: unknown
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/admin/moderation/cases', () =>
        HttpResponse.json(casePage()),
      ),
      http.get('/api/v1/admin/moderation/cases/:id', () =>
        HttpResponse.json(caseDetail()),
      ),
      http.post(
        '/api/v1/admin/moderation/cases/:id/actions',
        async ({ request }) => {
          actionBody = await request.json()
          return HttpResponse.json({
            ...caseDetail(),
            summary: {
              ...caseDetail().summary,
              status: 'RESOLVED',
              target: {
                ...caseDetail().summary.target,
                currentlyVisible: false,
              },
              resolvedAt: '2026-10-24T09:10:00Z',
            },
            moderatedById: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
            decisionReason: 'Kişisel telefon numarası içeriyor.',
            audit: [
              {
                id: '6914e641-c8fb-45a6-8571-3651662153b7',
                moderatorId: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
                action: 'HIDE_COMMENT',
                reason: 'Kişisel telefon numarası içeriyor.',
                createdAt: '2026-10-24T09:10:00Z',
              },
            ],
          })
        },
      ),
    )

    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ['/admin/moderation'],
        })}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'İçerik bildirimleri' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('2 bildiren')).toBeInTheDocument()
    expect(screen.queryByText('reporter@example.com')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Örnek Okulu/ }))
    expect(
      await screen.findByText(
        /Bildirenlerin kimliği bu görünümde paylaşılmaz\./,
      ),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Yönetici gerekçesi'), {
      target: { value: 'Kişisel telefon numarası içeriyor.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yorumu gizle' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(
      await screen.findByText('Yorumu gizle işlemi kaydedildi.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(actionBody).toEqual({
        action: 'HIDE_COMMENT',
        reason: 'Kişisel telefon numarası içeriyor.',
      }),
    )
  })
})

function authHandler(role: 'ADMIN' | 'PARENT') {
  return http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
      email: `${role.toLowerCase()}@example.com`,
      role,
      operatorApprovalRequired: true,
      approvalStatus: null,
    }),
  )
}

function csrfHandler() {
  return http.get('/api/v1/auth/csrf', () =>
    HttpResponse.json({
      headerName: 'X-CSRF-TOKEN',
      parameterName: '_csrf',
      token: 'csrf-token',
    }),
  )
}

function caseSummary() {
  return {
    id: '1b0b4456-5e55-4814-b8f8-64d1343617fd',
    targetType: 'COMMENT',
    targetId: '75c3339d-f6f0-4e8e-aad9-2d783f7f2760',
    status: 'OPEN',
    target: {
      title: 'Örnek Okulu yorumu',
      snapshot: 'İçerikte kişisel telefon numarası var.',
      currentlyVisible: true,
      operatorProfileId: null,
    },
    reporterCount: 2,
    reasonCounts: { PERSONAL_DATA: 2 },
    createdAt: '2026-10-24T08:00:00Z',
    updatedAt: '2026-10-24T09:00:00Z',
    resolvedAt: null,
  }
}

function casePage() {
  return {
    content: [caseSummary()],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  }
}

function caseDetail() {
  return {
    summary: caseSummary(),
    moderatedById: null,
    decisionReason: null,
    reports: [
      {
        id: '7bd12425-ea60-45e5-b937-ddf75db2eb45',
        reason: 'PERSONAL_DATA',
        explanation: 'Telefon numarası paylaşılmış.',
        createdAt: '2026-10-24T09:00:00Z',
      },
      {
        id: 'bd25949e-871b-4a29-9c22-b0ff9a7c4315',
        reason: 'PERSONAL_DATA',
        explanation: null,
        createdAt: '2026-10-24T08:00:00Z',
      },
    ],
    audit: [],
  }
}
