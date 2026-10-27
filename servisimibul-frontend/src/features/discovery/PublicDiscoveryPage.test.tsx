import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from '../../app/router'
import { server } from '../../test/server'

describe('public operator discovery', () => {
  it('recovers when the province endpoint temporarily has no network connection', async () => {
    let attempts = 0
    server.use(
      http.get('/api/v1/provinces', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json([{ id: 34, code: '34', name: 'İstanbul' }])
      }),
    )

    renderHome()

    const istanbul = await screen.findByRole('option', { name: 'İstanbul' })
    expect(istanbul).toBeInTheDocument()
    expect(attempts).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('finds operators across districts and exposes only the public phone', async () => {
    const requestedPages: string[] = []
    server.use(
      ...locationHandlers(),
      tariffHandler(),
      http.get('/api/v1/operators', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requestedPages.push(parameters.get('page') ?? '')
        expect(parameters.get('schoolId')).toBe(school.id)
        expect(parameters.get('neighborhoodId')).toBe('201')

        const page = Number(parameters.get('page'))
        return HttpResponse.json({
          content: [operator(page === 0 ? 'Acıbadem Servis' : 'İkinci Servis')],
          page,
          size: 10,
          totalElements: 2,
          totalPages: 2,
        })
      }),
    )

    renderHome()
    await selectLocation()
    fireEvent.click(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Acıbadem Servis' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+905321234567' })).toHaveAttribute(
      'href',
      'tel:+905321234567',
    )
    expect(screen.getByText('Uygun koltuk: 3/16')).toBeInTheDocument()
    expect(
      screen.getByText(/Koltuk bilgisi rezervasyon değildir/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/UKOME tarifeleri yalnızca resmi referanstır/),
    ).toBeInTheDocument()
    expect(screen.queryByText('operator@example.com')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Okul servisi ücret tarifesi' }),
    ).toBeInTheDocument()
    expect(screen.getByText('₺1.300,00')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Bu tarife kişisel fiyat teklifi değildir. Kesin ücret için işletmeciyle görüşün.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
    expect(
      await screen.findByRole('heading', { name: 'İkinci Servis' }),
    ).toBeInTheDocument()
    expect(requestedPages).toEqual(['0', '1'])
  })

  it('explains an empty result without treating it as an error', async () => {
    server.use(
      ...locationHandlers(),
      tariffHandler(),
      http.get('/api/v1/operators', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    renderHome()
    await selectLocation()
    fireEvent.click(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Henüz bir eşleşme yok' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Bu bölgede henüz servis işletmecisi bulunamadı.'),
    ).toBeInTheDocument()
  })

  it('shows a Turkish recovery message when discovery fails', async () => {
    server.use(
      ...locationHandlers(),
      tariffHandler(),
      http.get('/api/v1/operators', () =>
        HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            detail: 'Temporary failure',
            code: 'temporary_failure',
          },
          { status: 503 },
        ),
      ),
    )

    renderHome()
    await selectLocation()
    fireEvent.click(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    )

    const message = await screen.findByText(
      'Servis işletmecileri yüklenemedi. Lütfen tekrar deneyin.',
    )
    expect(message).toHaveAttribute('role', 'alert')
  })

  it('keeps discovery results usable when the tariff cannot load', async () => {
    server.use(
      ...locationHandlers(),
      http.get('/api/v1/tariffs', () =>
        HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            detail: 'Tariff storage unavailable',
            code: 'tariff_storage_unavailable',
          },
          { status: 503 },
        ),
      ),
      http.get('/api/v1/operators', () =>
        HttpResponse.json({
          content: [operator('Acıbadem Servis')],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    )

    renderHome()
    await selectLocation()
    fireEvent.click(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Acıbadem Servis' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Resmî tarife şu anda yüklenemedi. Arama sonuçları etkilenmedi.',
      ),
    ).toHaveAttribute('role', 'alert')
  })

  it('requires a database-backed pilot province before loading schools', async () => {
    let schoolRequests = 0
    server.use(
      http.get('/api/v1/provinces', () =>
        HttpResponse.json([
          { id: 34, code: '34', name: 'İstanbul' },
          { id: 6, code: '06', name: 'Ankara' },
        ]),
      ),
      http.get('/api/v1/schools', () => {
        schoolRequests += 1
        return HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        })
      }),
    )

    renderHome()
    await screen.findByRole('option', { name: 'İstanbul' })
    expect(
      screen.queryByRole('option', { name: 'Ankara' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    )

    expect(
      await screen.findByText('Okulun bulunduğu ili seçin.'),
    ).toBeInTheDocument()
    expect(schoolRequests).toBe(0)
  })

  it('explains when Istanbul is missing instead of fabricating a fallback', async () => {
    server.use(
      http.get('/api/v1/provinces', () =>
        HttpResponse.json([{ id: 6, code: '06', name: 'Ankara' }]),
      ),
    )

    renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'İstanbul bilgisi henüz okul kataloğunda bulunmuyor. Lütfen daha sonra tekrar deneyin.',
    )
    expect(screen.getByLabelText('Okulun bulunduğu il')).toBeDisabled()
    expect(
      screen.queryByRole('option', { name: 'Ankara' }),
    ).not.toBeInTheDocument()
  })

  it('rejects an out-of-province server page instead of silently changing its totals', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/schools', async ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requests.push(parameters)
        const districtId = parameters.get('districtId')
        await delay(districtId ? 10 : 80)
        return HttpResponse.json({
          content: districtId
            ? [{ ...school, name: 'Kadıköy İlkokulu' }]
            : [school, ankaraSchool],
          page: 0,
          size: 10,
          totalElements: districtId ? 1 : 2,
          totalPages: 1,
        })
      }),
      ...locationHandlers(),
    )

    renderHome()
    await screen.findByRole('option', { name: 'İstanbul' })
    fireEvent.change(screen.getByLabelText('Okulun bulunduğu il'), {
      target: { value: '34' },
    })
    expect(
      await screen.findByText(/Okul sonuçları yüklenemedi/),
    ).toBeInTheDocument()
    expect(screen.queryByText('2 okul bulundu')).not.toBeInTheDocument()
    await screen.findByRole('option', { name: 'Kadıköy' })
    fireEvent.change(screen.getByLabelText('Okulun ilçesi'), {
      target: { value: '10' },
    })

    expect(await screen.findByText('Kadıköy İlkokulu')).toBeInTheDocument()
    await delay(100)
    expect(screen.queryByText('Ankara İlkokulu')).not.toBeInTheDocument()
    expect(requests).toHaveLength(2)
    expect(requests[0].get('provinceId')).toBe('34')
    expect(requests[0].has('districtId')).toBe(false)
    expect(requests[1].get('districtId')).toBe('10')
  })

  it('composes post-list search, sort and district filters with deterministic paging', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/schools', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requests.push(new URLSearchParams(parameters))
        const page = Number(parameters.get('page'))
        return HttpResponse.json({
          content: [
            {
              ...school,
              name: `Okul sayfası ${page + 1}`,
              districtId: parameters.get('districtId') ? 10 : school.districtId,
            },
          ],
          page,
          size: 10,
          totalElements: 61,
          totalPages: 7,
        })
      }),
      ...locationHandlers(),
    )

    renderHome()
    await screen.findByRole('option', { name: 'İstanbul' })
    fireEvent.change(screen.getByLabelText('Okulun bulunduğu il'), {
      target: { value: '34' },
    })

    expect(await screen.findByText('Okul sayfası 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
    expect(await screen.findByText('Okul sayfası 2')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'IŞIK' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Okullarda ara' }))
    await waitFor(() => {
      const latest = requests.at(-1)
      expect(latest?.get('query')).toBe('IŞIK')
      expect(latest?.get('page')).toBe('0')
    })

    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'name-desc' },
    })
    await waitFor(() => {
      const latest = requests.at(-1)
      expect(latest?.get('query')).toBe('IŞIK')
      expect(latest?.get('sort')).toBe('name-desc')
      expect(latest?.get('page')).toBe('0')
    })

    fireEvent.change(screen.getByLabelText('Okulun ilçesi'), {
      target: { value: '10' },
    })
    await waitFor(() => {
      const latest = requests.at(-1)
      expect(latest?.get('districtId')).toBe('10')
      expect(latest?.get('query')).toBe('IŞIK')
      expect(latest?.get('sort')).toBe('name-desc')
      expect(latest?.get('page')).toBe('0')
    })

    for (let page = 1; page < 7; page += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
      expect(
        await screen.findByText(`Okul sayfası ${page + 1}`),
      ).toBeInTheDocument()
    }
    expect(requests.at(-1)?.get('page')).toBe('6')
    expect(screen.getByRole('button', { name: 'Sonraki sayfa' })).toBeDisabled()
  })

  it('uses pending search text when filters change', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/schools', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requests.push(new URLSearchParams(parameters))
        return HttpResponse.json({
          content: [school],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        })
      }),
      ...locationHandlers(),
    )

    renderHome()
    await selectLocation()
    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'GÜNEŞ' },
    })
    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'name-desc' },
    })

    await waitFor(() => {
      expect(requests.at(-1)?.get('query')).toBe('GÜNEŞ')
      expect(requests.at(-1)?.get('sort')).toBe('name-desc')
    })
    expect(screen.queryByText('Seçilen okul')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Servis alınacak ilçe')).toBeDisabled()
    expect(
      screen.getByText(/Önceki okul seçimi yeni okul filtreleriyle eşleşmedi/),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'ATATÜRK' },
    })
    fireEvent.change(screen.getByLabelText('Okulun ilçesi'), {
      target: { value: '10' },
    })
    await waitFor(() => {
      expect(requests.at(-1)?.get('query')).toBe('ATATÜRK')
      expect(requests.at(-1)?.get('districtId')).toBe('10')
      expect(requests.at(-1)?.get('page')).toBe('0')
    })

    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'bekleyen' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Filtreleri temizle' }))
    expect(screen.getByLabelText('Okul adında ara')).toHaveValue('')
    await waitFor(() => {
      expect(requests.at(-1)?.has('query')).toBe(false)
      expect(requests.at(-1)?.has('districtId')).toBe(false)
    })
  })

  it('applies pending search before pagination', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get('/api/v1/schools', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        requests.push(new URLSearchParams(parameters))
        const page = Number(parameters.get('page'))
        return HttpResponse.json({
          content: [{ ...school, name: `Sayfa ${page + 1} Okulu` }],
          page,
          size: 10,
          totalElements: 21,
          totalPages: 3,
        })
      }),
      ...locationHandlers(),
    )
    renderHome()
    await screen.findByRole('option', { name: 'İstanbul' })
    fireEvent.change(screen.getByLabelText('Okulun bulunduğu il'), {
      target: { value: '34' },
    })
    expect(await screen.findByText('Sayfa 1 Okulu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
    expect(await screen.findByText('Sayfa 2 Okulu')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'yeni' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))
    await waitFor(() => {
      expect(requests.at(-1)?.get('query')).toBe('yeni')
      expect(requests.at(-1)?.get('page')).toBe('0')
    })
    expect(await screen.findByText('Sayfa 1 Okulu')).toBeInTheDocument()
  })

  it('keeps a selected school while paging and compatible filters change', async () => {
    server.use(...locationHandlers())

    renderHome()
    await selectLocation()

    expect(screen.getByText('Seçilen okul')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Sıralama'), {
      target: { value: 'name-desc' },
    })
    await screen.findByText('1 okul bulundu')
    expect(screen.getByText('Seçilen okul')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'örnek' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Okullarda ara' }))
    await screen.findByText('1 okul bulundu')
    expect(screen.getByText('Seçilen okul')).toBeInTheDocument()
    expect(screen.getByLabelText('Servis alınacak ilçe')).toHaveValue('11')
  })

  it('shows school loading, failure recovery and empty-filter guidance', async () => {
    let requests = 0
    server.use(
      http.get('/api/v1/schools', async ({ request }) => {
        requests += 1
        await delay(30)
        if (requests === 1) {
          return HttpResponse.json(
            { code: 'temporary_failure', status: 503, title: 'Unavailable' },
            { status: 503 },
          )
        }
        const query = new URL(request.url).searchParams.get('query')
        return HttpResponse.json({
          content: query ? [] : [school],
          page: 0,
          size: 10,
          totalElements: query ? 0 : 1,
          totalPages: query ? 0 : 1,
        })
      }),
      ...locationHandlers(),
    )

    renderHome()
    await screen.findByRole('option', { name: 'İstanbul' })
    fireEvent.change(screen.getByLabelText('Okulun bulunduğu il'), {
      target: { value: '34' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Okullar yükleniyor')
    expect(
      (await screen.findByText(/Okul sonuçları yüklenemedi/)).closest(
        '[role="alert"]',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('Örnek İlkokulu')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul adında ara'), {
      target: { value: 'bulunmayan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Okullarda ara' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Okul bulunamadı',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Filtreleri temizle' }),
    ).toBeEnabled()
  })

  it('does not restore search results after school-location filters change', async () => {
    server.use(
      ...locationHandlers(),
      tariffHandler(),
      http.get('/api/v1/operators', async () => {
        await delay(80)
        return HttpResponse.json({
          content: [operator('Geciken Servis')],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        })
      }),
    )

    renderHome()
    await selectLocation()
    fireEvent.click(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    )
    await screen.findByRole('button', { name: 'İşletmeciler aranıyor...' })
    fireEvent.change(screen.getByLabelText('Okulun ilçesi'), {
      target: { value: '11' },
    })

    await delay(100)
    expect(
      screen.queryByRole('heading', { name: 'Geciken Servis' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('1 işletmeci bulundu')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Önceki okul seçimi yeni okul filtreleriyle eşleşmedi/),
    ).toHaveAttribute('role', 'status')
  })
})

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

const ankaraSchool = {
  ...school,
  id: '36df806f-b9ab-4a75-89de-51d5ae8af800',
  neighborhoodId: 301,
  neighborhoodName: 'Bahçelievler',
  districtId: 30,
  districtName: 'Çankaya',
  provinceId: 6,
  provinceCode: '06',
  provinceName: 'Ankara',
  name: 'Ankara İlkokulu',
}

function locationHandlers() {
  return [
    http.get('/api/v1/provinces', () =>
      HttpResponse.json([
        { id: 34, code: '34', name: 'İstanbul' },
        { id: 6, code: '06', name: 'Ankara' },
      ]),
    ),
    http.get('/api/v1/schools', ({ request }) => {
      const parameters = new URL(request.url).searchParams
      expect(parameters.get('provinceId')).toBe('34')
      return HttpResponse.json({
        content: [school],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
      })
    }),
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

function tariffHandler() {
  return http.get('/api/v1/tariffs', () =>
    HttpResponse.json({
      provinceCode: '34',
      provinceName: 'İstanbul',
      authority: 'İBB UKOME',
      academicYear: '2026–2027',
      currency: 'TRY',
      effectiveFrom: '2026-09-01',
      effectiveTo: '2027-08-31',
      sourceTitle: 'UKOME kararı',
      officialSourceUrl: 'https://example.com/ukome',
      version: 'v1',
      bands: [
        { minDistanceKm: 0, maxDistanceKm: 3, amountKurus: 130_000 },
        { minDistanceKm: 3, maxDistanceKm: null, amountKurus: 150_000 },
      ],
    }),
  )
}

function operator(businessName: string) {
  return {
    operatorId:
      businessName === 'Acıbadem Servis'
        ? '99dd588e-2b72-419e-aa29-28fb97f8ad20'
        : 'aac30fa1-bfe3-4f09-929c-dc0b4216c579',
    businessName,
    contactPhone: '+905321234567',
    description: 'Okul servis taşımacılığı',
    matchingSchool: { id: school.id, name: school.name },
    publishedOfferings: [
      {
        offeringId: '74414637-56b7-4bf1-ab74-33b454353690',
        availableSeats: 3,
        vehicleCapacity: 16,
        description: 'Sabah ve akşam servisi',
      },
    ],
  }
}

async function selectLocation() {
  await screen.findByRole('option', { name: 'İstanbul' })
  expect(
    screen.queryByRole('option', { name: 'Ankara' }),
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Okulun bulunduğu il'), {
    target: { value: '34' },
  })

  await screen.findByText('Örnek İlkokulu')
  fireEvent.click(
    screen.getByRole('button', { name: 'Örnek İlkokulu okulunu seç' }),
  )

  const pickupDistrict = screen.getByLabelText('Servis alınacak ilçe')
  await within(pickupDistrict).findByRole('option', { name: 'Üsküdar' })
  fireEvent.change(pickupDistrict, {
    target: { value: '11' },
  })

  await screen.findByRole('option', { name: 'Acıbadem' })
  fireEvent.change(screen.getByLabelText('Servis alınacak mahalle'), {
    target: { value: '201' },
  })

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Servis işletmecilerini bul' }),
    ).toBeEnabled(),
  )
}

function renderHome() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/'] })}
    />,
  )
}
