import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  MemoryRouter,
  RouterProvider,
  createMemoryRouter,
} from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'
import { ReportControl } from './ReportControl'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

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
      await screen.findByRole('heading', { name: 'Raporlama ve moderasyon' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/2 bildiren/)).toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText('Karar'), {
      target: { value: 'HIDE_COMMENT' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }))

    expect(actionBody).toBeUndefined()
    fireEvent.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Yorumu gizle işlemi onaylansın mı?',
        }),
      ).getByRole('button', { name: 'Yorumu gizle' }),
    )
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

  it('queries real statuses and shows their backend totals', async () => {
    const statuses: (string | null)[] = []
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', ({ request }) => {
        const query = new URL(request.url).searchParams
        const status = query.get('status')
        if (query.get('size') === '20') statuses.push(status)
        const total = { OPEN: 3, IN_REVIEW: 2, RESOLVED: 4, DISMISSED: 1 }
        return HttpResponse.json({
          ...casePage(),
          totalElements: total[status as keyof typeof total],
        })
      }),
    )
    renderModeration()

    expect(
      await screen.findByRole('button', { name: 'Tüm bildirimler 10' }),
    ).toBeInTheDocument()
    expect(statuses).toEqual(['OPEN'])
    expect(screen.getByRole('button', { name: 'Açık 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByText('Bekleyen bildirim').parentElement,
    ).toHaveTextContent('5')
    expect(screen.getByText('Sonuçlanan').parentElement).toHaveTextContent('5')

    fireEvent.click(screen.getByRole('button', { name: 'İnceleniyor 2' }))
    await waitFor(() => expect(statuses).toEqual(['OPEN', 'IN_REVIEW']))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tüm bildirimler 10' }),
    )
    await waitFor(() => expect(statuses).toEqual(['OPEN', 'IN_REVIEW', null]))
  })

  it('keeps the queue usable without inventing totals when counts fail', async () => {
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', ({ request }) =>
        new URL(request.url).searchParams.get('size') === '1'
          ? HttpResponse.json(problem(500), { status: 500 })
          : HttpResponse.json(casePage()),
      ),
    )
    renderModeration()

    expect(await screen.findByText(/2 bildiren/)).toBeInTheDocument()
    expect(
      screen.getByText('Bekleyen bildirim').parentElement,
    ).toHaveTextContent('—')
    expect(screen.getByRole('button', { name: 'Açık' })).toBeInTheDocument()
  })

  it('discards a slower response from a previous status', async () => {
    const bodies = trackBodyReads()
    const openGate = deferred()
    let openStarted = false
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', async ({ request }) => {
        const query = new URL(request.url).searchParams
        if (query.get('size') === '1') return HttpResponse.json(casePage())
        if (query.get('status') === 'OPEN') {
          openStarted = true
          await openGate.promise
          return HttpResponse.json(titledPage('Eski açık kayıt'))
        }
        return HttpResponse.json(titledPage('Güncel inceleme kaydı'))
      }),
    )
    renderModeration()
    await waitFor(() => expect(openStarted).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /^İnceleniyor/ }))
    expect(await screen.findByText('Güncel inceleme kaydı')).toBeInTheDocument()
    await bodies.settle(openGate.resolve, 1)
    expect(screen.getByText('Güncel inceleme kaydı')).toBeInTheDocument()
    expect(screen.queryByText('Eski açık kayıt')).not.toBeInTheDocument()
  })

  it('shows the queue while its totals are still pending', async () => {
    const countsGate = deferred()
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', async ({ request }) => {
        if (new URL(request.url).searchParams.get('size') === '1') {
          await countsGate.promise
          return HttpResponse.json({ ...casePage(), totalElements: 2 })
        }
        return HttpResponse.json(casePage())
      }),
    )
    renderModeration()

    expect(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    ).toBeEnabled()
    expect(pendingTotal()).toHaveTextContent('—')

    countsGate.resolve()
    expect(
      await screen.findByRole('button', { name: 'Tüm bildirimler 8' }),
    ).toBeInTheDocument()
    expect(pendingTotal()).toHaveTextContent('4')
  })

  it('keeps totals of the latest filters when older totals arrive late', async () => {
    const bodies = trackBodyReads()
    const oldCounts = deferred()
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', async ({ request }) => {
        const query = new URL(request.url).searchParams
        if (query.get('size') !== '1') return HttpResponse.json(casePage())
        if (query.get('targetType') === 'COMMENT') {
          return HttpResponse.json({ ...casePage(), totalElements: 7 })
        }
        await oldCounts.promise
        return HttpResponse.json({ ...casePage(), totalElements: 99 })
      }),
    )
    renderModeration()
    await screen.findByRole('button', { name: /İncele: Örnek Okulu/ })

    fireEvent.change(screen.getByLabelText('İçerik türü'), {
      target: { value: 'COMMENT' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Filtrele' }))
    expect(
      await screen.findByRole('button', { name: 'Tüm bildirimler 28' }),
    ).toBeInTheDocument()

    await bodies.settle(oldCounts.resolve, 4)
    expect(pendingTotal()).toHaveTextContent('14')
    expect(
      screen.getByRole('button', { name: 'Tüm bildirimler 28' }),
    ).toBeInTheDocument()
  })

  it('does not show older totals while the new filters load', async () => {
    const newCounts = deferred()
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', async ({ request }) => {
        const query = new URL(request.url).searchParams
        if (query.get('size') !== '1') return HttpResponse.json(casePage())
        if (query.get('targetType') === 'COMMENT') await newCounts.promise
        return HttpResponse.json({ ...casePage(), totalElements: 3 })
      }),
    )
    renderModeration()
    await screen.findByRole('button', { name: 'Tüm bildirimler 12' })

    fireEvent.change(screen.getByLabelText('İçerik türü'), {
      target: { value: 'COMMENT' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Filtrele' }))

    await waitFor(() => expect(pendingTotal()).toHaveTextContent('—'))
    newCounts.resolve()
    expect(
      await screen.findByRole('button', { name: 'Tüm bildirimler 12' }),
    ).toBeInTheDocument()
  })

  it('requests totals once per filter set, not per tab or page', async () => {
    let countRequests = 0
    const pages: (string | null)[] = []
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', ({ request }) => {
        const query = new URL(request.url).searchParams
        if (query.get('size') === '1') {
          countRequests += 1
          return HttpResponse.json({ ...casePage(), totalElements: 21 })
        }
        pages.push(query.get('page'))
        return HttpResponse.json({
          ...casePage(),
          page: Number(query.get('page')),
          totalElements: 21,
          totalPages: 2,
        })
      }),
    )
    renderModeration()

    fireEvent.click(await screen.findByRole('button', { name: 'Sonraki' }))
    await waitFor(() => expect(pages).toEqual(['0', '1']))
    fireEvent.click(await screen.findByRole('button', { name: /^Reddedildi/ }))
    await waitFor(() => expect(pages).toEqual(['0', '1', '0']))
    await screen.findByRole('button', { name: 'Sonraki' })

    expect(countRequests).toBe(4)
  })

  it('refreshes the list and totals after a decision and keeps the filter', async () => {
    let decided = false
    const queueStatuses: (string | null)[] = []
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/admin/moderation/cases', ({ request }) => {
        const query = new URL(request.url).searchParams
        const status = query.get('status')
        if (query.get('size') === '1') {
          const reviewing = decided ? 0 : 1
          const totals: Record<string, number> = {
            OPEN: 0,
            IN_REVIEW: reviewing,
            RESOLVED: 1 - reviewing,
            DISMISSED: 0,
          }
          return HttpResponse.json({
            ...casePage(),
            totalElements: totals[status ?? ''],
          })
        }
        queueStatuses.push(status)
        return HttpResponse.json(
          status === 'IN_REVIEW' && decided
            ? { ...casePage(), content: [], totalElements: 0, totalPages: 0 }
            : casePage(),
        )
      }),
      http.get('/api/v1/admin/moderation/cases/:id', () =>
        HttpResponse.json(caseDetail()),
      ),
      http.post('/api/v1/admin/moderation/cases/:id/actions', () => {
        decided = true
        return HttpResponse.json(caseDetail())
      }),
    )
    renderModeration()

    fireEvent.click(
      await screen.findByRole('button', { name: 'İnceleniyor 1' }),
    )
    await waitFor(() => expect(queueStatuses).toEqual(['OPEN', 'IN_REVIEW']))
    fireEvent.click(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    )
    fireEvent.change(await screen.findByLabelText('Yönetici gerekçesi'), {
      target: { value: 'Kural ihlali yok.' },
    })
    fireEvent.change(screen.getByLabelText('Karar'), {
      target: { value: 'RESOLVE_NO_ACTION' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }))

    expect(
      await screen.findByText('Bu görünümde bildirim yok'),
    ).toBeInTheDocument()
    expect(queueStatuses.at(-1)).toBe('IN_REVIEW')
    expect(
      await screen.findByRole('button', { name: 'Sonuçlandı 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'İnceleniyor 0' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(pendingTotal()).toHaveTextContent('0')
  })

  it('retries a failed queue while its totals stay unavailable', async () => {
    let queueAttempts = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', ({ request }) => {
        if (new URL(request.url).searchParams.get('size') === '1') {
          return HttpResponse.json(problem(500), { status: 500 })
        }
        queueAttempts += 1
        return queueAttempts === 1
          ? HttpResponse.json(problem(500), { status: 500 })
          : HttpResponse.json(casePage())
      }),
    )
    renderModeration()

    expect(
      await screen.findByText('Bildirimler yüklenemedi'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))

    expect(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    ).toBeEnabled()
    expect(queueAttempts).toBe(2)
    expect(pendingTotal()).toHaveTextContent('—')
  })

  it('does not report a queue error when only totals fail', async () => {
    const bodies = trackBodyReads()
    const countsGate = deferred()
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', async ({ request }) => {
        if (new URL(request.url).searchParams.get('size') === '1') {
          await countsGate.promise
          return HttpResponse.json(problem(500), { status: 500 })
        }
        return HttpResponse.json(casePage())
      }),
    )
    renderModeration()
    await screen.findByRole('button', { name: /İncele: Örnek Okulu/ })

    await bodies.settle(countsGate.resolve, 1)
    expect(
      screen.queryByText('Bildirimler yüklenemedi'),
    ).not.toBeInTheDocument()
    expect(pendingTotal()).toHaveTextContent('—')
    expect(
      screen.getByRole('button', { name: /İncele: Örnek Okulu/ }),
    ).toBeEnabled()
  })

  it('leaves the page when the session expires during a totals request', async () => {
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', ({ request }) =>
        new URL(request.url).searchParams.get('size') === '1'
          ? HttpResponse.json(problem(401), { status: 401 })
          : HttpResponse.json(casePage()),
      ),
    )
    const router = createMemoryRouter(routes, {
      initialEntries: ['/admin/moderation'],
    })
    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/operator/login'),
    )
    expect(router.state.location.search).toBe('?reason=session')
  })

  it('requires a decision and a reason before contacting the backend', async () => {
    let posted = false
    server.use(
      ...queueHandlers(),
      http.post('/api/v1/admin/moderation/cases/:id/actions', () => {
        posted = true
        return HttpResponse.json(caseDetail())
      }),
    )
    renderModeration()
    fireEvent.click(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kararı kaydet' }),
    )

    expect(screen.getByLabelText('Karar')).toHaveAccessibleDescription(
      'Bir karar seçin.',
    )
    expect(
      screen.getByLabelText('Yönetici gerekçesi'),
    ).toHaveAccessibleDescription(
      'Yönetici gerekçesi en az 2 karakter olmalıdır.',
    )
    expect(posted).toBe(false)
  })

  it('offers only what still applies after a concurrent decision', async () => {
    let closed = false
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/admin/moderation/cases', () =>
        HttpResponse.json(casePage()),
      ),
      http.get('/api/v1/admin/moderation/cases/:id', () =>
        HttpResponse.json(
          closed
            ? {
                ...caseDetail(),
                summary: { ...caseDetail().summary, status: 'DISMISSED' },
                decisionReason: 'Başka yönetici reddetti.',
              }
            : caseDetail(),
        ),
      ),
      http.post('/api/v1/admin/moderation/cases/:id/actions', () => {
        closed = true
        return HttpResponse.json(
          {
            ...problem(409),
            detail: 'Kayıt başka bir yönetici tarafından kapatıldı.',
          },
          { status: 409 },
        )
      }),
    )
    renderModeration()
    fireEvent.click(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    )
    fireEvent.change(await screen.findByLabelText('Yönetici gerekçesi'), {
      target: { value: 'Gerekçe' },
    })
    fireEvent.change(screen.getByLabelText('Karar'), {
      target: { value: 'DISMISS' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }))

    expect(
      await screen.findByText('Kayıt başka bir yönetici tarafından kapatıldı.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Başka yönetici reddetti.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Bildirimi reddet' }),
    ).not.toBeInTheDocument()
  })

  it('retries a failed detail inside the review dialog', async () => {
    let attempts = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', () =>
        HttpResponse.json(casePage()),
      ),
      http.get('/api/v1/admin/moderation/cases/:id', () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json(problem(500), { status: 500 })
          : HttpResponse.json(caseDetail())
      }),
    )
    renderModeration()
    fireEvent.click(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))

    expect(await screen.findByLabelText('Karar')).toBeInTheDocument()
  })

  it('keeps a linked closed case open with its persisted decision', async () => {
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', () =>
        HttpResponse.json({ ...casePage(), content: [], totalElements: 0 }),
      ),
      http.get('/api/v1/admin/moderation/cases/:id', () =>
        HttpResponse.json({
          ...caseDetail(),
          summary: {
            ...caseDetail().summary,
            status: 'RESOLVED',
            resolvedAt: '2026-10-24T09:10:00Z',
          },
          decisionReason: 'Kural ihlali yok.',
          audit: [
            {
              id: '6914e641-c8fb-45a6-8571-3651662153b7',
              moderatorId: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
              action: 'RESOLVE_NO_ACTION',
              reason: 'Kural ihlali yok.',
              createdAt: '2026-10-24T09:10:00Z',
            },
          ],
        }),
      ),
    )
    renderModeration(`?caseId=${caseSummary().id}`)

    expect(
      await screen.findByRole('heading', { name: 'Kayıtlı karar gerekçesi' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Bu kayıt için uygulanabilecek başka işlem yok.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Karar')).not.toBeInTheDocument()
    expect(
      await screen.findByText('Bu görünümde bildirim yok'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kapat' })).toBeInTheDocument()
  })

  it('does not offer marking a case already in review again', async () => {
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/moderation/cases', () =>
        HttpResponse.json(casePage()),
      ),
      http.get('/api/v1/admin/moderation/cases/:id', () =>
        HttpResponse.json({
          ...caseDetail(),
          summary: { ...caseDetail().summary, status: 'IN_REVIEW' },
        }),
      ),
    )
    renderModeration()
    fireEvent.click(
      await screen.findByRole('button', { name: /İncele: Örnek Okulu/ }),
    )

    expect(
      await screen.findByRole('option', { name: 'Bildirimi reddet' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'İncelemeye al' }),
    ).not.toBeInTheDocument()
  })
})

function pendingTotal() {
  return screen.getByText('Bekleyen bildirim').parentElement as HTMLElement
}

function titledPage(title: string) {
  return {
    ...casePage(),
    content: [{ ...caseSummary(), target: { ...caseSummary().target, title } }],
  }
}

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

// Lets a test wait until late responses reached the page instead of sleeping.
function trackBodyReads() {
  const reads: Promise<unknown>[] = []
  const read = Response.prototype.text
  vi.spyOn(Response.prototype, 'text').mockImplementation(function (
    this: Response,
  ) {
    const result = read.call(this)
    reads.push(result)
    return result
  })
  return {
    async settle(release: () => void, responses: number) {
      const expected = reads.length + responses
      release()
      await waitFor(() => expect(reads.length).toBeGreaterThanOrEqual(expected))
      await act(async () => {
        await Promise.all(reads)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    },
  }
}

function renderModeration(search = '') {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: [`/admin/moderation${search}`],
      })}
    />,
  )
}

function queueHandlers() {
  return [
    authHandler('ADMIN'),
    csrfHandler(),
    http.get('/api/v1/admin/moderation/cases', () =>
      HttpResponse.json(casePage()),
    ),
    http.get('/api/v1/admin/moderation/cases/:id', () =>
      HttpResponse.json(caseDetail()),
    ),
  ]
}

function problem(status: number) {
  return { title: 'Hata', status, detail: 'İşlem başarısız.', code: 'FAILED' }
}

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
