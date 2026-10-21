import { fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

afterEach(() => resetCsrfToken())

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
      screen.getByRole('link', { name: 'Talebi görüntüle' }),
    ).toHaveAttribute('href', `/demands/${demandId}`)
    expect(
      screen.getByText('Bu konum için bir talep zaten var'),
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
      await screen.findByRole('heading', { name: 'Hoş geldiniz' }),
    ).toBeInTheDocument()
    expect(operatorChecks).toBe(1)
    expect(
      screen.getByText(/Veli hesapları pilot kapsamında/),
    ).toBeInTheDocument()
  })

  it('creates a demand for a parent after the operator-first check', async () => {
    let createBody: unknown
    const createdDemand = demand({ currentUserSupport: activeSupport })
    server.use(
      ...locationHandlers(),
      emptyDemandHandler(),
      emptyOperatorHandler(),
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
      await screen.findByText('Talebiniz oluşturuldu ve desteğiniz eklendi.'),
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
      await screen.findByText(/Desteğiniz otomatik eklenmedi/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Benim de ihtiyacım var' }),
    ).toBeInTheDocument()
  })
})

describe('demand board regression cases', () => {
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
      await screen.findByText(/Kaydedilen okul ve mahalle artık bulunamadı/),
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
      await screen.findByText(/daha önce açılmış talep katılıma kapalı/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Benim de ihtiyacım var' }),
    ).not.toBeInTheDocument()
  })
})

describe('demand support management', () => {
  it('edits, withdraws and reactivates the current parent support', async () => {
    let current = demand({ currentUserSupport: activeSupport })
    const methods: string[] = []
    server.use(
      parentHandler(),
      csrfHandler(),
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

const demandId = '481be36b-c8ee-4c03-868e-47bbc19b7735'
const supportId = 'b6586a84-6094-4ddb-80ea-e36756cf1915'

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
