import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

afterEach(() => resetCsrfToken())
beforeEach(() => server.use(emptyCommentsHandler()))

describe('public demand board', () => {
  it('hydrates exact school and neighborhood filters and links to the existing demand', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      ...locationHandlers(),
      http.get('/api/v1/demands', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requests.push(new URLSearchParams(parameters))
        const exact = parameters.get('schoolId') === school.id
        return HttpResponse.json(demandPage(exact ? [demand()] : []))
      }),
    )

    renderRoute(filteredBoardPath)

    expect(
      await screen.findByRole('heading', { name: school.name }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 talep')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Talep panosu bilgisi')).getByText(
        'Talep oluşturmak rezervasyon değildir.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('1', { selector: '.demand-supporter-count strong' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sabah').closest('div')).toHaveTextContent('Sabah1')
    expect(
      screen.getByRole('link', { name: 'Talebi görüntüle' }),
    ).toHaveAttribute('href', `/demands/${demandId}`)
    expect(
      screen.getByText('Bu okul ve mahalle için zaten bir talep var'),
    ).toBeInTheDocument()
    expect(requests.at(-1)?.get('neighborhoodId')).toBe('201')
  })

  it('checks existing operators before sending an anonymous parent to login', async () => {
    let operatorChecks = 0
    server.use(
      ...locationHandlers(),
      emptyDemandHandler(),
      http.get('/api/v1/operators', () => {
        operatorChecks += 1
        return HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        })
      }),
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(problem(401, 'Authentication is required'), {
          status: 401,
        }),
      ),
    )

    renderRoute(filteredBoardPath)
    await screen.findByRole('heading', { name: 'Bu seçim için açık talep yok' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Mevcut servisleri kontrol et' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Görünür servis bulunamadı' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yeni talep oluştur' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Yeniden hoş geldiniz.',
      }),
    ).toBeInTheDocument()
    expect(operatorChecks).toBe(1)
    expect(
      screen.getByRole('link', { name: 'Veli hesabı oluşturun' }),
    ).toBeInTheDocument()
  })

  it('creates a demand for a parent after the operator-first check', async () => {
    let createBody: unknown
    const createdDemand = demand({ currentUserSupport: activeSupport })
    server.use(
      ...locationHandlers(),
      emptyDemandHandler(),
      emptyOperatorHandler(),
      emptyServiceResponsesHandler(),
      parentHandler(),
      csrfHandler(),
      http.post('/api/v1/demands', async ({ request }) => {
        createBody = await request.json()
        return HttpResponse.json(
          { created: true, demand: createdDemand },
          { status: 201 },
        )
      }),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(createdDemand),
      ),
    )

    renderRoute(filteredBoardPath)
    await openCreateForm()
    fireEvent.click(screen.getByLabelText('Uygun servis bulamıyorum'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Talebi ve desteğimi oluştur' }),
    )

    expect(
      await screen.findByText('Talebiniz oluşturuldu.'),
    ).toBeInTheDocument()
    expect(createBody).toEqual({
      schoolId: school.id,
      neighborhoodId: 201,
      needsMorning: true,
      needsAfternoon: false,
      reasons: ['NO_SUITABLE_SERVICE'],
    })
    expect(screen.getByText('Destekliyorsunuz')).toBeInTheDocument()
  })

  it('does not silently add support when creation finds an existing demand', async () => {
    const existingDemand = demand()
    server.use(
      ...locationHandlers(),
      emptyDemandHandler(),
      emptyOperatorHandler(),
      emptyServiceResponsesHandler(),
      parentHandler(),
      csrfHandler(),
      http.post('/api/v1/demands', () =>
        HttpResponse.json({ created: false, demand: existingDemand }),
      ),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(existingDemand),
      ),
    )

    renderRoute(filteredBoardPath)
    await openCreateForm()
    fireEvent.click(screen.getByLabelText('Uygun servis bulamıyorum'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Talebi ve desteğimi oluştur' }),
    )

    expect(
      await screen.findByText(/Katılmak için “Benim de ihtiyacım var”/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Benim de ihtiyacım var' }),
    ).toBeInTheDocument()
  })
})

describe('demand board regression cases', () => {
  it('validates the academic year and keeps sorting and pagination server-backed', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      http.get('/api/v1/demands', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requests.push(new URLSearchParams(parameters))
        const page = Number(parameters.get('page'))
        return HttpResponse.json({
          ...demandPage([demand()]),
          page,
          totalElements: 11,
          totalPages: 2,
        })
      }),
    )

    renderRoute('/demands')
    await screen.findByRole('heading', { name: school.name })
    fireEvent.change(screen.getByLabelText('Eğitim yılı'), {
      target: { value: '2026-2028' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Talepleri göster' }))
    expect(
      screen.getByText(/Eğitim yılını 2026-2027 biçiminde/),
    ).toBeInTheDocument()
    expect(requests).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Eğitim yılı'), {
      target: { value: '2026-2027' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Talepleri göster' }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests.at(-1)?.get('academicYear')).toBe('2026-2027')

    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'most-supported' },
    })
    await waitFor(() =>
      expect(requests.at(-1)?.get('sort')).toBe('most-supported'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
    await waitFor(() => expect(requests.at(-1)?.get('page')).toBe('1'))
  })

  it('unblocks the list after an invalid shared location link', async () => {
    server.use(
      http.get('/api/v1/provinces', () =>
        HttpResponse.json([{ id: 34, code: '34', name: 'İstanbul' }]),
      ),
      http.get(`/api/v1/schools/${school.id}`, () =>
        HttpResponse.json(problem(404, 'School not found'), { status: 404 }),
      ),
      emptyDemandHandler(),
    )
    renderRoute(filteredBoardPath)
    expect(
      await screen.findByText(/Seçtiğiniz okul veya mahalle artık bulunamıyor/),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Bu seçim için açık talep yok'),
    ).toBeInTheDocument()
  })

  it('shows a closed duplicate without offering an impossible join', async () => {
    const closed = demand({ status: 'CLOSED', currentUserSupport: null })
    server.use(
      ...locationHandlers(),
      emptyDemandHandler(),
      emptyOperatorHandler(),
      emptyServiceResponsesHandler(),
      parentHandler(),
      csrfHandler(),
      http.post('/api/v1/demands', () =>
        HttpResponse.json({ created: false, demand: closed }),
      ),
      http.get(`/api/v1/demands/${demandId}`, () => HttpResponse.json(closed)),
    )
    renderRoute(filteredBoardPath)
    await openCreateForm()
    fireEvent.click(screen.getByLabelText('Uygun servis bulamıyorum'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Talebi ve desteğimi oluştur' }),
    )
    expect(
      await screen.findByText(/talep var ancak yeni katılıma kapalı/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Benim de ihtiyacım var' }),
    ).not.toBeInTheDocument()
  })

  it('redirects a parent whose session expires while creating a demand', async () => {
    server.use(
      ...locationHandlers(),
      emptyDemandHandler(),
      emptyOperatorHandler(),
      parentHandler(),
      csrfHandler(),
      http.post('/api/v1/demands', () =>
        HttpResponse.json(problem(401, 'Session expired'), { status: 401 }),
      ),
    )

    renderRoute(filteredBoardPath)
    await openCreateForm()
    fireEvent.click(screen.getByLabelText('Uygun servis bulamıyorum'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Talebi ve desteğimi oluştur' }),
    )

    expect(
      await screen.findByText(
        'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
      ),
    ).toBeInTheDocument()
  })
})

describe('demand board draft vs applied academic year', () => {
  function pagedHandler(
    requests: URLSearchParams[],
    failNext = { value: false },
  ) {
    return http.get('/api/v1/demands', ({ request }) => {
      const parameters = new URL(request.url).searchParams
      requests.push(new URLSearchParams(parameters))
      if (failNext.value) {
        failNext.value = false
        return HttpResponse.json(problem(500, 'boom'), { status: 500 })
      }
      return HttpResponse.json({
        ...demandPage([demand()]),
        page: Number(parameters.get('page')),
        totalElements: 11,
        totalPages: 2,
      })
    })
  }

  async function renderBoard(path = '/demands') {
    renderRoute(path)
    await screen.findByRole('heading', { name: school.name })
  }

  function typeYear(value: string) {
    fireEvent.change(screen.getByLabelText('Eğitim yılı'), {
      target: { value },
    })
  }

  function apply() {
    fireEvent.click(screen.getByRole('button', { name: 'Talepleri göster' }))
  }

  it('does not request anything when the year is only edited', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      pagedHandler(requests),
    )
    await renderBoard()
    typeYear('2026-2027')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(requests).toHaveLength(1)
    expect(requests[0].get('academicYear')).toBeNull()
  })

  it('sorts and paginates with the last applied year, not the uncommitted draft', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      pagedHandler(requests),
    )
    await renderBoard()
    typeYear('2026-2027')
    apply()
    await waitFor(() => expect(requests).toHaveLength(2))

    typeYear('2025-2026')
    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'most-supported' },
    })
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[2].get('sort')).toBe('most-supported')
    expect(requests[2].get('academicYear')).toBe('2026-2027')

    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
    await waitFor(() => expect(requests).toHaveLength(4))
    expect(requests[3].get('page')).toBe('1')
    expect(requests[3].get('academicYear')).toBe('2026-2027')
    expect(screen.getByLabelText('Eğitim yılı')).toHaveValue('2025-2026')
  })

  it('never applies an uncommitted or invalid year when sorting or retrying', async () => {
    const requests: URLSearchParams[] = []
    const failNext = { value: false }
    server.use(
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      pagedHandler(requests, failNext),
    )
    await renderBoard()
    typeYear('2026-2028')
    apply()
    expect(
      screen.getByText(/Eğitim yılını 2026-2027 biçiminde/),
    ).toBeInTheDocument()
    expect(requests).toHaveLength(1)

    failNext.value = true
    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'most-supported' },
    })
    expect(await screen.findByText('Talepler yüklenemedi')).toBeInTheDocument()
    expect(requests[1].get('academicYear')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[2].get('academicYear')).toBeNull()
    expect(requests[2].get('sort')).toBe('most-supported')
  })

  it('retries a failed apply with the applied year after the draft changed', async () => {
    const requests: URLSearchParams[] = []
    const failNext = { value: false }
    server.use(
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      pagedHandler(requests, failNext),
    )
    await renderBoard()
    failNext.value = true
    typeYear('2026-2027')
    apply()
    expect(await screen.findByText('Talepler yüklenemedi')).toBeInTheDocument()
    typeYear('2025-2026')
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[2].get('academicYear')).toBe('2026-2027')
  })

  it('resets draft and applied year when filters are cleared', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      pagedHandler(requests),
    )
    await renderBoard()
    typeYear('2026-2027')
    apply()
    await waitFor(() => expect(requests).toHaveLength(2))
    typeYear('2025-2026')
    fireEvent.click(screen.getByRole('button', { name: 'Filtreleri temizle' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[2].get('academicYear')).toBeNull()
    expect(screen.getByLabelText('Eğitim yılı')).toHaveValue('')

    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'most-supported' },
    })
    await waitFor(() => expect(requests).toHaveLength(4))
    expect(requests[3].get('academicYear')).toBeNull()
  })

  it('uses the academic year from the URL for the initial load, sorting and paging', async () => {
    const requests: URLSearchParams[] = []
    server.use(...locationHandlers(), pagedHandler(requests))
    await renderBoard(`${filteredBoardPath}&academicYear=2026-2027`)
    expect(screen.getByLabelText('Eğitim yılı')).toHaveValue('2026-2027')
    expect(requests.at(-1)?.get('academicYear')).toBe('2026-2027')

    typeYear('2025-2026')
    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'most-supported' },
    })
    await waitFor(() =>
      expect(requests.at(-1)?.get('sort')).toBe('most-supported'),
    )
    expect(requests.at(-1)?.get('academicYear')).toBe('2026-2027')
    expect(requests.at(-1)?.get('neighborhoodId')).toBe('201')
  })
})

describe('demand support management', () => {
  it('lets a new parent reopen an inactive demand by joining it', async () => {
    let current = demand({
      status: 'CLOSED',
      closureReason: 'INACTIVE',
      closedAt: '2026-10-29T09:00:00Z',
      supporterCount: 0,
    })
    let joinBody: unknown
    server.use(
      parentHandler(),
      csrfHandler(),
      emptyServiceResponsesHandler(),
      http.get(`/api/v1/demands/${demandId}`, () => HttpResponse.json(current)),
      http.post(`/api/v1/demands/${demandId}/support`, async ({ request }) => {
        joinBody = await request.json()
        current = demand({ currentUserSupport: activeSupport })
        return HttpResponse.json(current)
      }),
    )

    renderRoute(`/demands/${demandId}`)
    expect(
      await screen.findByText(/Talebe katılarak yeniden açabilirsiniz/),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Benim de ihtiyacım var' }),
    )
    fireEvent.click(await screen.findByLabelText('Uygun servis bulamıyorum'))
    fireEvent.click(screen.getByRole('button', { name: 'Talebe katıl' }))

    expect(
      await screen.findByRole('button', { name: 'Desteğimi düzenle' }),
    ).toBeInTheDocument()
    expect(joinBody).toMatchObject({ reasons: ['NO_SUITABLE_SERVICE'] })
  })

  it.each(['FULFILLED', 'ADMIN'])(
    'keeps a %s closed demand closed to a new parent',
    async (closureReason) => {
      server.use(
        emptyServiceResponsesHandler(),
        http.get(`/api/v1/demands/${demandId}`, () =>
          HttpResponse.json(
            demand({
              status: 'CLOSED',
              closureReason,
              closedAt: '2026-10-29T09:00:00Z',
            }),
          ),
        ),
      )

      renderRoute(`/demands/${demandId}`)
      expect(
        (await screen.findAllByText(/kapatıldı|kapalıdır/)).length,
      ).toBeGreaterThan(0)
      expect(
        screen.queryByRole('button', { name: 'Benim de ihtiyacım var' }),
      ).not.toBeInTheDocument()
    },
  )

  it('edits, withdraws and reactivates the current parent support', async () => {
    let current = demand({ currentUserSupport: activeSupport })
    const methods: string[] = []
    server.use(
      parentHandler(),
      csrfHandler(),
      emptyServiceResponsesHandler(),
      http.get(`/api/v1/demands/${demandId}`, () => HttpResponse.json(current)),
      http.put(`/api/v1/demands/${demandId}/support`, async ({ request }) => {
        methods.push(request.method)
        const body = (await request.json()) as {
          needsMorning: boolean
          needsAfternoon: boolean
          reasons: string[]
        }
        current = demand({
          currentUserSupport: { ...activeSupport, ...body },
          morningCount: body.needsMorning ? 1 : 0,
          afternoonCount: body.needsAfternoon ? 1 : 0,
        })
        return HttpResponse.json(current)
      }),
      http.delete(`/api/v1/demands/${demandId}/support`, ({ request }) => {
        methods.push(request.method)
        current = demand({
          currentUserSupport: { ...activeSupport, status: 'WITHDRAWN' },
          supporterCount: 0,
          morningCount: 0,
          afternoonCount: 0,
        })
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(`/api/v1/demands/${demandId}/support`, async ({ request }) => {
        methods.push(request.method)
        const body = (await request.json()) as typeof activeSupport
        current = demand({ currentUserSupport: { ...activeSupport, ...body } })
        return HttpResponse.json(current)
      }),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Desteğimi düzenle' }),
    )
    fireEvent.click(await screen.findByLabelText(/^Öğleden sonra/))
    fireEvent.click(screen.getByRole('button', { name: 'Tercihlerimi kaydet' }))
    expect(
      await screen.findByText('Destek tercihleriniz güncellendi.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Desteğimi geri çek' }))
    expect(
      await screen.findByText(/Desteğiniz geri çekildi/),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Desteğimi yeniden etkinleştir' }),
    )
    await screen.findByRole('group', {
      name: 'Hangi yönde servise ihtiyacınız var?',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Desteğimi yeniden etkinleştir' }),
    )
    expect(
      await screen.findByText('Desteğiniz yeniden etkinleştirildi.'),
    ).toBeInTheDocument()
    expect(methods).toEqual(['PUT', 'DELETE', 'POST'])
  })
})

describe('parent service feedback', () => {
  it('shows an empty feedback state to an active supporting parent', async () => {
    server.use(
      parentHandler(),
      csrfHandler(),
      emptyServiceResponsesHandler(),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand({ currentUserSupport: activeSupport })),
      ),
      http.post(`/api/v1/demands/${demandId}/feedback/open`, () =>
        HttpResponse.json({
          demandId,
          feedback: [],
          disclaimer: 'Bildirimdir.',
        }),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    expect(
      await screen.findByText('Henüz değerlendirilecek servis bildirimi yok.'),
    ).toBeInTheDocument()
  })

  it('explains when the parent session expires while opening feedback', async () => {
    server.use(
      parentHandler(),
      csrfHandler(),
      emptyServiceResponsesHandler(),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand({ currentUserSupport: activeSupport })),
      ),
      http.post(`/api/v1/demands/${demandId}/feedback/open`, () =>
        HttpResponse.json(problem(401, 'Authentication is required'), {
          status: 401,
        }),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'veli hesabınızla yeniden giriş yapın',
    )
  })

  it('keeps rejected feedback visible after support returns to active', async () => {
    const publicationEventId = 'c1f54a9d-cf2e-4206-9016-644372685b74'
    let current = demand({
      currentUserSupport: { ...activeSupport, status: 'AWAITING_FEEDBACK' },
    })
    let feedback = {
      demandId,
      disclaimer: 'İşletmeci bildirimleri uygunluk beyanıdır.',
      feedback: [
        {
          publicationEventId,
          operatorId: '2778473a-5886-454c-a6d8-a2eaa4f585b1',
          operatorBusinessName: 'Mavi Servis',
          offersMorning: true,
          offersAfternoon: false,
          publishedAt: '2026-10-20T09:00:00Z',
          status: 'AWAITING_FEEDBACK',
          openedAt: '2026-10-21T09:00:00Z',
          reminderDueAt: '2026-10-28T09:00:00Z',
          reminderTriggeredAt: null,
          expiresAt: '2026-11-04T09:00:00Z',
          evaluatedAt: null as string | null,
          canEvaluate: true,
        },
      ],
    }
    server.use(
      parentHandler(),
      csrfHandler(),
      emptyServiceResponsesHandler(),
      http.get(`/api/v1/demands/${demandId}`, () => HttpResponse.json(current)),
      http.post(`/api/v1/demands/${demandId}/feedback/open`, () =>
        HttpResponse.json(feedback),
      ),
      http.put(
        `/api/v1/demands/${demandId}/feedback/${publicationEventId}`,
        () => {
          current = demand({ currentUserSupport: activeSupport })
          feedback = {
            ...feedback,
            feedback: [
              {
                ...feedback.feedback[0],
                status: 'NOT_SATISFIED',
                evaluatedAt: '2026-10-22T09:00:00Z',
                canEvaluate: false,
              },
            ],
          }
          return HttpResponse.json(feedback)
        },
      ),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Karşılanmadı' }))
    expect(
      await screen.findByText(
        'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Servis ihtiyacınız karşılandı mı?',
      }),
    ).toBeInTheDocument()
  })

  it('records the screen open and lets the supporting parent resolve a publication', async () => {
    const publicationEventId = 'c1f54a9d-cf2e-4206-9016-644372685b74'
    let current = demand({
      currentUserSupport: {
        ...activeSupport,
        status: 'AWAITING_FEEDBACK',
      },
    })
    let openEvents = 0
    const awaitingFeedback = {
      demandId,
      disclaimer:
        'İşletmeci bildirimleri uygunluk beyanıdır; rezervasyon veya hizmet garantisi değildir.',
      feedback: [
        {
          publicationEventId,
          operatorId: '2778473a-5886-454c-a6d8-a2eaa4f585b1',
          operatorBusinessName: 'Mavi Servis',
          offersMorning: true,
          offersAfternoon: false,
          publishedAt: '2026-10-20T09:00:00Z',
          status: 'AWAITING_FEEDBACK',
          openedAt: '2026-10-21T09:00:00Z',
          reminderDueAt: '2026-10-28T09:00:00Z',
          reminderTriggeredAt: '2026-10-28T09:05:00Z',
          expiresAt: '2026-11-04T09:00:00Z',
          evaluatedAt: null,
          canEvaluate: true,
        },
      ],
    }
    server.use(
      parentHandler(),
      csrfHandler(),
      emptyServiceResponsesHandler(),
      http.get(`/api/v1/demands/${demandId}`, () => HttpResponse.json(current)),
      http.post(`/api/v1/demands/${demandId}/feedback/open`, () => {
        openEvents += 1
        return HttpResponse.json(awaitingFeedback)
      }),
      http.put(
        `/api/v1/demands/${demandId}/feedback/${publicationEventId}`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ satisfied: true })
          current = demand({
            status: 'CLOSED',
            closureReason: 'FULFILLED',
            closedAt: '2026-10-29T09:00:00Z',
            currentUserSupport: {
              ...activeSupport,
              status: 'SATISFIED',
            },
          })
          return HttpResponse.json({
            ...awaitingFeedback,
            feedback: [
              {
                ...awaitingFeedback.feedback[0],
                status: 'SATISFIED',
                evaluatedAt: '2026-10-29T09:00:00Z',
                canEvaluate: false,
              },
            ],
          })
        },
      ),
    )

    renderRoute(`/demands/${demandId}`)
    expect(
      await screen.findByRole('heading', {
        name: 'Servis ihtiyacınız karşılandı mı?',
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Mavi Servis')).toBeInTheDocument()
    expect(screen.getByText(/Hatırlatma:/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Talebim karşılandı' }))

    expect(
      await screen.findByText('Talebinizin karşılandığını bildirdiniz.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Katılıma kapalı')).toBeInTheDocument()
    expect(openEvents).toBeGreaterThan(0)
  })
})

describe('demand comments', () => {
  it('renders public comments as text and never interprets comment markup', async () => {
    const unsafeText = '<img src=x onerror="alert(1)"> Güvenli metin'
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      http.get(`/api/v1/demands/${demandId}/comments`, () =>
        HttpResponse.json(commentPage([comment({ body: unsafeText })])),
      ),
    )

    const rendered = renderRoute(`/demands/${demandId}`)

    expect(await screen.findByText(unsafeText)).toBeInTheDocument()
    expect(
      rendered.container.querySelector('.demand-comment-list img'),
    ).toBeNull()
    expect(screen.getByText('Veli')).toBeInTheDocument()
  })

  it('lets a supporting parent publish and delete their own comment', async () => {
    let comments: ReturnType<typeof comment>[] = []
    server.use(
      parentHandler(),
      csrfHandler(),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand({ currentUserSupport: activeSupport })),
      ),
      http.get(`/api/v1/demands/${demandId}/comments`, () =>
        HttpResponse.json(commentPage(comments)),
      ),
      http.post(`/api/v1/demands/${demandId}/comments`, async ({ request }) => {
        const body = (await request.json()) as { body: string }
        const created = comment({ body: body.body, canDelete: true })
        comments = [created]
        return HttpResponse.json(created, { status: 201 })
      }),
      http.delete(`/api/v1/demands/${demandId}/comments/${commentId}`, () => {
        comments = []
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Yorum yaz' }))
    const field = await screen.findByLabelText('Yorumunuz')
    fireEvent.change(field, {
      target: { value: 'Servis saatini konuşabiliriz.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yorumu yayınla' }))

    expect(await screen.findByText('Yorumunuz yayınlandı.')).toBeInTheDocument()
    expect(
      await screen.findByText('Servis saatini konuşabiliriz.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yorumumu sil' }))
    expect(await screen.findByText('Yorumunuz silindi.')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByText('Servis saatini konuşabiliriz.'),
      ).not.toBeInTheDocument(),
    )
  })

  it('reloads page one after deletion so shifted comments remain visible', async () => {
    let comments = Array.from({ length: 11 }, (_, index) =>
      comment({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        body: `Yorum ${index + 1}`,
        canDelete: index === 0,
      }),
    )
    server.use(
      csrfHandler(),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      http.get(`/api/v1/demands/${demandId}/comments`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        return HttpResponse.json({
          content: comments.slice(page * 10, page * 10 + 10),
          page,
          size: 10,
          totalElements: comments.length,
          totalPages: Math.ceil(comments.length / 10),
        })
      }),
      http.delete(
        `/api/v1/demands/${demandId}/comments/${comments[0].id}`,
        () => {
          comments = comments.slice(1)
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    renderRoute(`/demands/${demandId}`)
    expect(await screen.findByText('Yorum 1')).toBeInTheDocument()
    expect(screen.queryByText('Yorum 11')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yorumumu sil' }))

    expect(await screen.findByText('Yorum 11')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Daha fazla yorum göster' }),
    ).not.toBeInTheDocument()
  })

  it('explains why a non-supporting parent cannot comment', async () => {
    server.use(
      parentHandler(),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Yorum yaz' }))

    expect(
      await screen.findByText('Yorum yazmak için önce bu talebe destek verin.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Yorumunuz')).not.toBeInTheDocument()
  })

  it('sends an unauthenticated commenter to the parent login', async () => {
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(problem(401, 'Authentication is required'), {
          status: 401,
        }),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Yorum yaz' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Yeniden hoş geldiniz.',
      }),
    ).toBeInTheDocument()
  })

  it('lets an eligible operator open the form and paginates public comments', async () => {
    server.use(
      operatorHandler(),
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      http.get(`/api/v1/demands/${demandId}/comments`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        return HttpResponse.json(
          commentPage(
            [
              comment({
                id: page === 0 ? commentId : secondCommentId,
                body: page === 0 ? 'İlk yorum' : 'İkinci yorum',
                author: operatorCommentAuthor,
              }),
            ],
            page,
            2,
          ),
        )
      }),
    )

    renderRoute(`/demands/${demandId}`)
    expect(await screen.findByText('İlk yorum')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Daha fazla yorum göster' }),
    )
    expect(await screen.findByText('İkinci yorum')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yorum yaz' }))
    const field = await screen.findByLabelText('Yorumunuz')
    await waitFor(() => expect(field).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Yorum yaz' })).toHaveFocus(),
    )
  })
})

describe('demand-specific operator service responses', () => {
  it('shows eligible operator declarations to anonymous visitors with the safety disclosure', async () => {
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      http.get(`/api/v1/demands/${demandId}/responses`, () =>
        HttpResponse.json(
          serviceResponsePage([
            publicServiceResponse({ businessName: 'Moda Öğrenci Servisi' }),
          ]),
        ),
      ),
    )

    renderRoute(`/demands/${demandId}`)

    expect(await screen.findByText('Moda Öğrenci Servisi')).toBeInTheDocument()
    expect(screen.getByText(/Yayın 1 ·/)).toBeInTheDocument()
    expect(
      screen.getByText(/Bilgiler işletmeciler tarafından paylaşılır/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '+905321234567 numarasını ara' }),
    ).toHaveAttribute('href', 'tel:+905321234567')
  })

  it('returns an anonymous operator to the demand response flow after login', async () => {
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      emptyServiceResponsesHandler(),
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(problem(401, 'Authentication is required'), {
          status: 401,
        }),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Bu talep için servis ekle',
      }),
    )

    expect(
      await screen.findByText(/İşletmeci hesabınız yoksa/),
    ).toBeInTheDocument()
  })

  it('guides an ineligible operator to existing school and coverage management', async () => {
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      emptyServiceResponsesHandler(),
      operatorHandler(),
      http.get(`/api/v1/operator/demands/${demandId}/response`, () =>
        HttpResponse.json(
          serviceEligibility({
            eligible: false,
            blockers: ['COVERAGE_MISSING'],
          }),
        ),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Bu talep için servis ekle',
      }),
    )

    expect(
      await screen.findByText(
        'Talebin mahallesini bu okulun genel kapsamına ekleyin.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Okul ve kapsam yönetimine git' }),
    ).toHaveAttribute('href', '/operator/schools')
  })

  it('does not describe an active response as public after eligibility is lost', async () => {
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      emptyServiceResponsesHandler(),
      operatorHandler(),
      http.get(`/api/v1/operator/demands/${demandId}/response`, () =>
        HttpResponse.json(
          serviceEligibility({
            eligible: false,
            blockers: ['PROFILE_HIDDEN'],
            response: operatorServiceResponse({ currentlyPublic: false }),
          }),
        ),
      ),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Bu talep için servis ekle',
      }),
    )

    expect(
      await screen.findByText('Bildiriminiz şu anda gizli'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /gerekli koşullar sağlanana kadar velilere gösterilmiyor/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Profil görünürlüğünü düzenle' }),
    ).toHaveAttribute('href', '/operator/profile')
  })

  it('publishes immediately and lets the owning operator withdraw the response', async () => {
    let response: ReturnType<typeof operatorServiceResponse> | null = null
    let publishBody: unknown
    server.use(
      http.get(`/api/v1/demands/${demandId}`, () =>
        HttpResponse.json(demand()),
      ),
      http.get(`/api/v1/demands/${demandId}/responses`, () =>
        HttpResponse.json(
          serviceResponsePage(
            response?.status === 'ACTIVE' ? [publicServiceResponse()] : [],
          ),
        ),
      ),
      operatorHandler(),
      csrfHandler(),
      http.get(`/api/v1/operator/demands/${demandId}/response`, () =>
        HttpResponse.json(serviceEligibility({ eligible: true, response })),
      ),
      http.post(
        `/api/v1/operator/demands/${demandId}/response`,
        async ({ request }) => {
          publishBody = await request.json()
          response = operatorServiceResponse()
          return HttpResponse.json({ published: true, response })
        },
      ),
      http.delete(`/api/v1/operator/demands/${demandId}/response`, () => {
        response = operatorServiceResponse({
          status: 'WITHDRAWN',
          withdrawnAt: '2026-10-21T11:00:00Z',
          currentlyPublic: false,
        })
        return HttpResponse.json(response)
      }),
    )

    renderRoute(`/demands/${demandId}`)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Bu talep için servis ekle',
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Servis bildirimini yayınla',
      }),
    )

    expect(
      await screen.findByText('Servis bildiriminiz velilere hemen yayınlandı.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Bildiriminiz yayında')).toBeInTheDocument()
    expect(await screen.findByText('İsimsiz işletmeci')).toBeInTheDocument()
    expect(publishBody).toEqual({
      offersMorning: true,
      offersAfternoon: false,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Bildirimi geri çek' }))
    expect(
      await screen.findByText(/Servis bildiriminiz geri çekildi/),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', {
        name: 'Henüz servis bildirimi yok',
      }),
    ).toBeInTheDocument()
  })
})

const demandId = '481be36b-c8ee-4c03-868e-47bbc19b7735'
const supportId = 'b6586a84-6094-4ddb-80ea-e36756cf1915'
const commentId = '6b78776f-ad3f-4580-9d69-839a14786aed'
const secondCommentId = 'f4c9c973-6dfd-43c3-83e2-e53a290fd2db'

const school = {
  id: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
  neighborhoodId: 101,
  neighborhoodName: 'Moda',
  districtId: 10,
  districtName: 'Kadıköy',
  provinceId: 34,
  provinceCode: '34',
  provinceName: 'İstanbul',
  name: 'Örnek İlkokulu',
  address: null,
  sourceName: null,
  sourceCode: null,
  active: true,
}

const filteredBoardPath = `/demands?schoolId=${school.id}&pickupDistrictId=11&neighborhoodId=201`

const activeSupport = {
  id: supportId,
  status: 'ACTIVE' as const,
  needsMorning: true,
  needsAfternoon: false,
  reasons: ['NO_SUITABLE_SERVICE'] as const,
}

function demand(overrides: Record<string, unknown> = {}) {
  return {
    id: demandId,
    status: 'OPEN',
    closureReason: null,
    closedAt: null,
    academicYear: '2026-2027',
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-20T09:00:00Z',
    school: { id: school.id, name: school.name },
    neighborhood: {
      id: 201,
      name: 'Acıbadem',
      districtId: 11,
      districtName: 'Üsküdar',
      provinceId: 34,
      provinceCode: '34',
      provinceName: 'İstanbul',
    },
    supporterCount: 1,
    morningCount: 1,
    afternoonCount: 0,
    reasonCounts: [{ reason: 'NO_SUITABLE_SERVICE', count: 1 }],
    currentUserSupport: null,
    ...overrides,
  }
}

function demandPage(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
  }
}

function locationHandlers() {
  return [
    http.get('/api/v1/provinces', () =>
      HttpResponse.json([{ id: 34, code: '34', name: 'İstanbul' }]),
    ),
    http.get(`/api/v1/schools/${school.id}`, () => HttpResponse.json(school)),
    http.get('/api/v1/districts', () =>
      HttpResponse.json([
        { id: 10, provinceId: 34, name: 'Kadıköy' },
        { id: 11, provinceId: 34, name: 'Üsküdar' },
      ]),
    ),
    http.get('/api/v1/neighborhoods', () =>
      HttpResponse.json([{ id: 201, districtId: 11, name: 'Acıbadem' }]),
    ),
  ]
}

function emptyDemandHandler() {
  return http.get('/api/v1/demands', () => HttpResponse.json(demandPage([])))
}

function emptyOperatorHandler() {
  return http.get('/api/v1/operators', () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    }),
  )
}

function emptyServiceResponsesHandler() {
  return http.get(`/api/v1/demands/${demandId}/responses`, () =>
    HttpResponse.json(serviceResponsePage([])),
  )
}

function emptyCommentsHandler() {
  return http.get(`/api/v1/demands/${demandId}/comments`, () =>
    HttpResponse.json(commentPage([])),
  )
}

const operatorCommentAuthor = {
  role: 'OPERATOR' as const,
  displayName: 'Mavi Servis',
  operatorProfileId: '2778473a-5886-454c-a6d8-a2eaa4f585b1',
}

function comment(overrides: Record<string, unknown> = {}) {
  return {
    id: commentId,
    body: 'Servis talebi hakkında yorum',
    author: {
      role: 'PARENT',
      displayName: 'Veli',
      operatorProfileId: null,
    },
    canDelete: false,
    createdAt: '2026-10-21T09:30:00Z',
    updatedAt: '2026-10-21T09:30:00Z',
    ...overrides,
  }
}

function commentPage(content: unknown[], page = 0, totalPages?: number) {
  return {
    content,
    page,
    size: 10,
    totalElements: totalPages === undefined ? content.length : totalPages,
    totalPages: totalPages ?? (content.length ? 1 : 0),
  }
}

function operatorHandler() {
  return http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: '6e2973ac-0302-49a8-b519-563ec9861272',
      email: 'operator@example.test',
      role: 'OPERATOR',
      operatorApprovalRequired: true,
      approvalStatus: 'APPROVED',
    }),
  )
}

function parentHandler() {
  return http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd',
      email: 'parent@example.test',
      role: 'PARENT',
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

function serviceResponsePage(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
  }
}

function publicServiceResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'de3abec5-1adc-4267-a7f1-dc06e8164655',
    publicationEventId: 'c1f54a9d-cf2e-4206-9016-644372685b74',
    publicationVersion: 1,
    operatorId: '99dd588e-2b72-419e-aa29-28fb97f8ad20',
    businessName: null,
    contactPhone: '+905321234567',
    offersMorning: true,
    offersAfternoon: false,
    publishedAt: '2026-10-21T10:00:00Z',
    ...overrides,
  }
}

function operatorServiceResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'de3abec5-1adc-4267-a7f1-dc06e8164655',
    status: 'ACTIVE' as const,
    offersMorning: true,
    offersAfternoon: false,
    publicationVersion: 1,
    publicationEventId: 'c1f54a9d-cf2e-4206-9016-644372685b74',
    publishedAt: '2026-10-21T10:00:00Z',
    withdrawnAt: null,
    currentlyPublic: true,
    ...overrides,
  }
}

function serviceEligibility(overrides: Record<string, unknown> = {}) {
  return {
    demandId,
    eligible: true,
    blockers: [],
    response: null,
    ...overrides,
  }
}

function problem(status: number, detail: string) {
  return { title: 'Request failed', status, detail, code: 'request_failed' }
}

async function openCreateForm() {
  await screen.findByRole('heading', { name: 'Bu seçim için açık talep yok' })
  fireEvent.click(
    screen.getByRole('button', { name: 'Mevcut servisleri kontrol et' }),
  )
  await screen.findByRole('heading', { name: 'Görünür servis bulunamadı' })
  fireEvent.click(screen.getByRole('button', { name: 'Yeni talep oluştur' }))
  expect(
    await screen.findByRole('heading', { name: 'İhtiyacınızı ekleyin' }),
  ).toBeInTheDocument()
}

function renderRoute(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )
}
