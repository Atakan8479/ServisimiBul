import { fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

afterEach(() => {
  resetCsrfToken()
  vi.restoreAllMocks()
})

describe('admin workspace flows', () => {
  it('lists every pilot operator without an approval filter and preserves suspension', async () => {
    let requestedStatus: string | null = 'not-called'
    server.use(
      authHandler('ADMIN', false),
      csrfHandler(),
      http.get('/api/v1/admin/operators', ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get('status')
        return HttpResponse.json({
          content: [applicationDetail('DRAFT').profile],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        })
      }),
      http.get('/api/v1/admin/operators/:id', () =>
        HttpResponse.json(applicationDetail('DRAFT')),
      ),
    )

    renderRoute('/admin/applications')

    expect(
      await screen.findByRole('heading', { name: 'İşletmeciler' }),
    ).toBeInTheDocument()
    const profileLink = await screen.findByRole('link', {
      name: 'Profili incele',
    })
    expect(requestedStatus).toBeNull()
    expect(screen.queryByLabelText('Başvuru durumu')).not.toBeInTheDocument()
    fireEvent.click(profileLink)
    expect(
      await screen.findByRole('button', { name: 'İşletmeciyi askıya al' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Başvuruyu onayla' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Düzeltme iste' }),
    ).not.toBeInTheDocument()
  })

  it('prevents an operator from opening the admin workspace', async () => {
    server.use(authHandler('OPERATOR'))

    renderRoute('/admin/applications')

    expect(
      await screen.findByRole('heading', { name: 'Bir sorun oluştu' }),
    ).toBeInTheDocument()
  })

  it('reviews an application and sends a required correction reason', async () => {
    let revisionBody: unknown
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/admin/operators/:id', () =>
        HttpResponse.json(applicationDetail('PENDING')),
      ),
      http.post(
        '/api/v1/admin/operators/:id/request-revision',
        async ({ request }) => {
          revisionBody = await request.json()
          return HttpResponse.json(applicationDetail('CHANGES_REQUESTED'))
        },
      ),
    )

    renderRoute('/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20')
    expect(
      await screen.findByRole('heading', { name: 'Örnek Servis' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Düzeltme iste' }))
    expect(
      await screen.findByText('Düzeltme nedeni zorunludur.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Düzeltme nedeni'), {
      target: { value: 'Telefon bilgisini doğrulayın.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Düzeltme iste' }))

    expect(
      await screen.findByText('Düzeltme talebi gönderildi.'),
    ).toBeInTheDocument()
    expect(revisionBody).toEqual({ reason: 'Telefon bilgisini doğrulayın.' })
    expect(window.confirm).toHaveBeenCalledOnce()
  })

  it('confirms approval and suspension actions', async () => {
    let approved = false
    let suspended = false
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/admin/operators/:id', () =>
        HttpResponse.json(applicationDetail('PENDING')),
      ),
      http.post('/api/v1/admin/operators/:id/approve', () => {
        approved = true
        return HttpResponse.json(applicationDetail('APPROVED'))
      }),
      http.post('/api/v1/admin/operators/:id/suspend', () => {
        suspended = true
        return HttpResponse.json(applicationDetail('APPROVED', false))
      }),
    )

    renderRoute('/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Başvuruyu onayla' }),
    )
    expect(await screen.findByText('Başvuru onaylandı.')).toBeInTheDocument()
    expect(approved).toBe(true)

    fireEvent.click(
      screen.getByRole('button', { name: 'İşletmeciyi askıya al' }),
    )
    expect(
      await screen.findByText('İşletmeci askıya alındı.'),
    ).toBeInTheDocument()
    expect(suspended).toBe(true)
    expect(window.confirm).toHaveBeenCalledTimes(2)
  })

  it('adds a school and keeps it listed after deactivation', async () => {
    let createBody: unknown
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/provinces', () =>
        HttpResponse.json([{ id: 34, code: '34', name: 'İstanbul' }]),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }]),
      ),
      http.get('/api/v1/neighborhoods', () =>
        HttpResponse.json([{ id: 100, districtId: 10, name: 'Moda' }]),
      ),
      http.get('/api/v1/admin/schools', () =>
        HttpResponse.json(schoolPage([])),
      ),
      http.post('/api/v1/admin/schools', async ({ request }) => {
        createBody = await request.json()
        return HttpResponse.json(school(true), { status: 201 })
      }),
      http.post('/api/v1/admin/schools/:id/deactivate', () =>
        HttpResponse.json(school(false)),
      ),
    )

    renderRoute('/admin/schools')
    expect(
      await screen.findByRole('heading', { name: 'Okulları yönetin' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul adı'), {
      target: { value: 'Örnek Okulu' },
    })
    await screen.findByRole('option', { name: 'İstanbul' })
    fireEvent.change(screen.getByLabelText('İl'), {
      target: { value: '34' },
    })
    await screen.findByRole('option', { name: 'Kadıköy' })
    fireEvent.change(screen.getByLabelText('İlçe'), {
      target: { value: '10' },
    })
    await screen.findByRole('option', { name: 'Moda' })
    fireEvent.change(screen.getByLabelText('Mahalle'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Okulu ekle' }))

    expect(await screen.findByText('Okul eklendi.')).toBeInTheDocument()
    expect(createBody).toMatchObject({
      name: 'Örnek Okulu',
      neighborhoodId: 100,
      active: true,
    })

    const card = screen
      .getByRole('heading', { name: 'Örnek Okulu' })
      .closest('article')
    expect(card).not.toBeNull()
    fireEvent.click(within(card!).getByRole('button', { name: 'Pasife al' }))

    expect(await screen.findByText('Okul pasife alındı.')).toBeInTheDocument()
    expect(within(card!).getByText('Pasif')).toBeInTheDocument()
  })

  it('associates required school errors with their fields', async () => {
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      http.get('/api/v1/admin/schools', () =>
        HttpResponse.json(schoolPage([])),
      ),
    )

    renderRoute('/admin/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Okulu ekle' }))

    const name = screen.getByRole('textbox', { name: /Okul adı/ })
    const neighborhood = screen.getByRole('combobox', { name: /Mahalle/ })
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Okul adı zorunludur.')
    expect(neighborhood).toHaveAttribute('aria-invalid', 'true')
    expect(neighborhood).toHaveAccessibleDescription('Mahalle zorunludur.')
  })

  it('saves the tariff against the version that was loaded', async () => {
    let updateBody: unknown
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/tariffs', () => HttpResponse.json(tariff('v1'))),
      http.put('/api/v1/admin/tariffs/34', async ({ request }) => {
        updateBody = await request.json()
        return HttpResponse.json(tariff('v2'))
      }),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    expect(
      screen.getByRole('heading', { name: 'Yayımlanacak görünüm' }),
    ).toBeInTheDocument()
    expect(screen.getByText('₺4.456,00')).toBeInTheDocument()
    expect(screen.getByText('₺39.970,00')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Resmî belgeyi aç/ }),
    ).toHaveAttribute('href', 'https://fixtures.invalid/ukome.pdf')
    const updated = tariff('v2')
    updated.bands[0].amountKurus = 140_000
    fireEvent.change(editor, { target: { value: JSON.stringify(updated) } })
    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))

    expect(
      await screen.findByText('Tarife v2 sürümüyle kaydedildi.'),
    ).toBeInTheDocument()
    expect(updateBody).toEqual({ expectedVersion: 'v1', tariff: updated })
  })

  it('keeps the tariff draft when another admin saved first', async () => {
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/tariffs', () => HttpResponse.json(tariff('v1'))),
      http.put('/api/v1/admin/tariffs/34', () =>
        HttpResponse.json(
          {
            title: 'Conflict',
            status: 409,
            detail: 'Version conflict',
            code: 'tariff_version_conflict',
          },
          { status: 409 },
        ),
      ),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    const draft = JSON.stringify(tariff('my-draft'))
    fireEvent.change(editor, { target: { value: draft } })
    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))

    expect(await screen.findByText(/Taslağınız korunuyor/)).toBeInTheDocument()
    expect(editor).toHaveValue(draft)
    expect(
      screen.getByRole('button', {
        name: 'Taslağı bırakıp güncel sürümü yükle',
      }),
    ).toBeInTheDocument()
  })

  it('creates the first version with a null expected version', async () => {
    let updateBody: unknown
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/tariffs', () =>
        HttpResponse.json(
          {
            title: 'Not found',
            status: 404,
            detail: 'Tariff not found',
            code: 'tariff_not_found',
          },
          { status: 404 },
        ),
      ),
      http.put('/api/v1/admin/tariffs/34', async ({ request }) => {
        updateBody = await request.json()
        return HttpResponse.json(tariff('v1'))
      }),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    expect(
      screen.getByText(
        'İstanbul için kayıtlı tarife yok. İlk sürümü oluşturabilirsiniz.',
      ),
    ).toBeInTheDocument()

    fireEvent.change(editor, {
      target: { value: JSON.stringify(tariff('v1')) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))

    expect(
      await screen.findByText('Tarife v1 sürümüyle kaydedildi.'),
    ).toBeInTheDocument()
    expect(updateBody).toEqual({ expectedVersion: null, tariff: tariff('v1') })
  })

  it('explains the invalid field and withholds the preview', async () => {
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/tariffs', () => HttpResponse.json(tariff('v1'))),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    const valid = tariff('v2')
    const invalid = {
      ...valid,
      bands: [
        valid.bands[0],
        { minDistanceKm: 1, maxDistanceKm: 25, amountKurus: 1_043_600 },
      ],
    }
    fireEvent.change(editor, { target: { value: JSON.stringify(invalid) } })

    expect(
      await screen.findByRole('heading', {
        name: 'Önizleme henüz hazır değil',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/bands\.1\.annualAmountKurus/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'bands.1.annualAmountKurus',
    )
  })
})

function authHandler(
  role: 'ADMIN' | 'OPERATOR',
  operatorApprovalRequired = true,
) {
  return http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: 'd28cc858-ed74-479a-b346-8b9cdccaaab8',
      email: `${role.toLowerCase()}@example.com`,
      role,
      operatorApprovalRequired,
      approvalStatus: role === 'OPERATOR' ? 'APPROVED' : null,
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

function applicationDetail(status: string, active = true) {
  return {
    profile: {
      id: '99dd588e-2b72-419e-aa29-28fb97f8ad20',
      businessName: 'Örnek Servis',
      contactPhone: '+905321234567',
      description: 'Açıklama',
      approvalStatus: status,
      active,
      publiclyVisible: true,
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
    },
    reviewHistory: [],
  }
}

function school(active: boolean) {
  return {
    id: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
    neighborhoodId: 100,
    neighborhoodName: 'Moda',
    districtId: 10,
    districtName: 'Kadıköy',
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
    name: 'Örnek Okulu',
    address: null,
    sourceName: null,
    sourceCode: null,
    active,
  }
}

function schoolPage(content: ReturnType<typeof school>[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
  }
}

function tariff(version: string) {
  return {
    provinceCode: '34',
    provinceName: 'İstanbul',
    authority: 'İstanbul Büyükşehir Belediyesi Meclisi',
    academicYear: '2026-2027',
    currency: 'TRY' as const,
    effectiveFrom: '2026-07-20',
    effectiveTo: null,
    sourceTitle: '17.07.2026 tarih ve 813 sayılı İBB Meclis kararı',
    officialSourceUrl: 'https://fixtures.invalid/ukome.pdf',
    version,
    additionalKilometerRule: {
      startsAfterDistanceKm: 25,
      monthlyAmountPerKilometerKurus: 8_799,
    },
    notes: [
      'Tutarlar KDV dahil azami ücretlerdir.',
      'Okul öncesi ve ilköğretim taşıma ücretine en fazla %35 rehber personel ücreti eklenebilir.',
      'Aynı okula giden kardeşlerde ikinci çocuk için %10 indirim uygulanır.',
    ],
    bands: [
      {
        minDistanceKm: 0,
        maxDistanceKm: 1,
        amountKurus: 445_600,
        annualAmountKurus: 3_997_000,
      },
      {
        minDistanceKm: 1,
        maxDistanceKm: 25,
        amountKurus: 1_043_600,
        annualAmountKurus: 9_361_000,
      },
    ],
  }
}

function renderRoute(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )
}
