import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

afterEach(resetCsrfToken)

describe('operator workspace flows', () => {
  it('shows backend-authoritative readiness in pilot mode without an approval step', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({
        approvalRequired: false,
        approvalSatisfied: true,
        discoveryEligible: true,
        hasActiveSchoolRelationship: true,
        hasEligibleSchoolCoverage: true,
        schools: [schoolReadiness()],
      }),
    )

    renderRoute('/operator')

    expect(
      await screen.findByText('Profiliniz uygun aramalarda görünebilir.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Yönetici onayı')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Araç bilgileri arama görünürlüğü için isteğe bağlıdır/),
    ).toBeInTheDocument()
    expect(screen.getByText('Örnek Okulu')).toBeInTheDocument()
  })

  it('labels the summed school coverage as school-neighborhood records', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({
        schools: [
          schoolReadiness({ validCoverageCount: 1 }),
          schoolReadiness({
            operatorSchoolId: '9e1c6d39-ed33-421a-88f4-15cf57bbef03',
            schoolId: '5d24f11d-0832-4b79-81a8-78726b69b035',
            schoolName: 'İkinci Okul',
            validCoverageCount: 2,
          }),
        ],
      }),
    )

    renderRoute('/operator')

    const coverageSummary = (
      await screen.findByText('Okul-mahalle kapsamı')
    ).closest('article')
    expect(coverageSummary).not.toBeNull()
    expect(within(coverageSummary!).getByText('3')).toBeInTheDocument()
    expect(
      within(coverageSummary!).getByText(
        'Okul bazındaki geçerli kayıt toplamı',
      ),
    ).toBeInTheDocument()
  })

  it('shows approval and profile guidance only when the server reports them incomplete', async () => {
    server.use(
      authHandler(true, 'PENDING'),
      readinessHandler({
        approvalRequired: true,
        approvalSatisfied: false,
        profileActive: false,
        publiclyVisible: false,
      }),
    )

    renderRoute('/operator')

    expect(await screen.findAllByText('Yönetici onayı')).not.toHaveLength(0)
    expect(
      screen.getByText(/Askıya alınmış veya etkin olmayan profil/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Okulları yönet' }),
    ).not.toBeInTheDocument()
  })

  it('shows a retry action when readiness cannot be loaded', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      http.get('/api/v1/operator/discovery-readiness', () =>
        HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            detail: 'Uygunluk bilgisi şu anda alınamıyor.',
            code: 'readiness_unavailable',
          },
          { status: 503 },
        ),
      ),
    )

    renderRoute('/operator')

    expect(
      await screen.findByText('Uygunluk bilgisi şu anda alınamıyor.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Yeniden dene' }),
    ).toBeInTheDocument()
  })

  it('announces readiness loading before rendering the checklist', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      authHandler(false, 'DRAFT'),
      http.get('/api/v1/operator/discovery-readiness', async () => {
        await gate
        return HttpResponse.json({
          discoveryEligible: false,
          emailVerified: true,
          accountEnabled: true,
          profileActive: true,
          publiclyVisible: true,
          approvalRequired: false,
          approvalSatisfied: true,
          hasActiveSchoolRelationship: false,
          hasEligibleSchoolCoverage: false,
          schools: [],
        })
      }),
    )

    renderRoute('/operator')
    expect(
      await screen.findByText('Arama uygunluğu yükleniyor'),
    ).toBeInTheDocument()
    release()
    expect(await screen.findByText('Hesap doğrulaması')).toBeInTheDocument()
    expect(screen.getByText(/Henüz bağlı okulunuz yok/)).toBeInTheDocument()
  })

  it('hides the approval workflow and keeps draft profile editing available in pilot mode', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      http.get('/api/v1/operator/profile', () =>
        HttpResponse.json(profile('DRAFT')),
      ),
    )

    renderRoute('/operator/profile')

    expect(
      await screen.findByText('Yönetici onayı gerekmiyor'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Başvuru göndermeniz veya yönetici onayı beklemeniz gerekmez.',
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Başvuruyu gönder' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('İşletme adı (isteğe bağlı)')).toBeEnabled()
    expect(
      screen.getByRole('link', { name: 'Okullar ve kapsam' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Araçlar ve servisler' }),
    ).toBeInTheDocument()
  })

  it('renders a pending application as read-only when approval is required', async () => {
    server.use(
      authHandler(true, 'PENDING'),
      http.get('/api/v1/operator/profile', () =>
        HttpResponse.json(profile('PENDING')),
      ),
    )

    renderRoute('/operator/profile')

    expect(
      await screen.findByText(
        'İnceleme tamamlanana kadar başvuru bilgileri salt okunurdur.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('İşletme adı (isteğe bağlı)')).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: 'Okullar ve kapsam' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Araçlar ve servisler' }),
    ).not.toBeInTheDocument()
  })

  it('edits a correction-requested profile and resubmits it', async () => {
    let patchBody: unknown
    let resubmitted = false
    server.use(
      authHandler(),
      csrfHandler(),
      readinessHandler(),
      http.get('/api/v1/operator/profile', () =>
        HttpResponse.json(profile('CHANGES_REQUESTED')),
      ),
      http.patch('/api/v1/operator/profile', async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json({
          ...profile('CHANGES_REQUESTED'),
          businessName: 'Düzeltilmiş Servis',
        })
      }),
      http.post('/api/v1/operator/application/resubmit', () => {
        resubmitted = true
        return HttpResponse.json({
          ...profile('PENDING'),
          businessName: 'Düzeltilmiş Servis',
        })
      }),
    )

    renderRoute('/operator/profile')
    const businessName = await screen.findByLabelText(
      'İşletme adı (isteğe bağlı)',
    )
    expect(businessName).toHaveValue('')
    expect(
      screen.getByText(
        'Profil bilgilerinizi güncelledikten sonra yeniden gönderin.',
      ),
    ).toBeInTheDocument()

    fireEvent.change(businessName, {
      target: { value: 'Düzeltilmiş Servis' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Değişiklikleri kaydet' }),
    )
    expect(
      await screen.findByText('Profil bilgileriniz kaydedildi.'),
    ).toBeInTheDocument()
    expect(patchBody).toMatchObject({ businessName: 'Düzeltilmiş Servis' })

    fireEvent.click(screen.getByRole('button', { name: 'Yeniden gönder' }))
    expect(await screen.findByText('İncelemede')).toBeInTheDocument()
    expect(resubmitted).toBe(true)
  })

  it('restores the confirmed visibility setting when saving fails', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      csrfHandler(),
      http.get('/api/v1/operator/profile', () =>
        HttpResponse.json(profile('DRAFT')),
      ),
      http.patch('/api/v1/operator/profile', () =>
        HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            detail: 'Profil şu anda kaydedilemiyor.',
            code: 'profile_unavailable',
          },
          { status: 503 },
        ),
      ),
    )

    renderRoute('/operator/profile')

    const visibility = await screen.findByRole('switch', {
      name: /Profil görünürlük tercihi/,
    })
    expect(visibility).toBeChecked()
    fireEvent.click(visibility)
    fireEvent.click(
      screen.getByRole('button', { name: 'Değişiklikleri kaydet' }),
    )

    expect(
      await screen.findByText('Profil şu anda kaydedilemiyor.'),
    ).toBeInTheDocument()
    expect(visibility).toBeChecked()
    expect(
      screen.queryByText('Profil bilgileriniz kaydedildi.'),
    ).not.toBeInTheDocument()
  })

  it('requires a public phone while allowing an empty business name', async () => {
    let patchBody: Record<string, unknown> | undefined
    server.use(
      authHandler(false, 'DRAFT'),
      csrfHandler(),
      http.get('/api/v1/operator/profile', () =>
        HttpResponse.json(profile('DRAFT')),
      ),
      http.patch('/api/v1/operator/profile', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          ...profile('DRAFT'),
          contactPhone: patchBody.contactPhone,
        })
      }),
    )

    renderRoute('/operator/profile')

    const phone = await screen.findByLabelText('Herkese açık iletişim telefonu')
    fireEvent.change(phone, { target: { value: '' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Değişiklikleri kaydet' }),
    )
    expect(
      await screen.findByText('İletişim telefonu zorunludur.'),
    ).toBeInTheDocument()
    expect(patchBody).toBeUndefined()

    fireEvent.change(phone, { target: { value: '+905551112233' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Değişiklikleri kaydet' }),
    )
    expect(
      await screen.findByText('Profil bilgileriniz kaydedildi.'),
    ).toBeInTheDocument()
    expect(patchBody).toMatchObject({
      businessName: '',
      contactPhone: '+905551112233',
    })
  })

  it('loads neighborhoods on demand and preserves unopened district coverage', async () => {
    let coverageBody: unknown
    const neighborhoodRequests: string[] = []
    server.use(
      authHandler(),
      csrfHandler(),
      readinessHandler(),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([
          operatorSchool([coverage(201, 11, 'Acıbadem', 'Üsküdar')]),
        ]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [school()],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([
          { id: 10, provinceId: 34, name: 'Kadıköy' },
          { id: 11, provinceId: 34, name: 'Üsküdar' },
        ]),
      ),
      http.get('/api/v1/neighborhoods', ({ request }) => {
        const districtId = new URL(request.url).searchParams.get('districtId')
        neighborhoodRequests.push(districtId ?? '')
        return HttpResponse.json(
          districtId === '10'
            ? [{ id: 101, districtId: 10, name: 'Moda' }]
            : [{ id: 201, districtId: 11, name: 'Acıbadem' }],
        )
      }),
      http.put(
        '/api/v1/operator/schools/75ef6bb0-e313-43fb-a01c-c935774434b4/coverage',
        async ({ request }) => {
          coverageBody = await request.json()
          return HttpResponse.json(
            operatorSchool([
              coverage(101, 10, 'Moda', 'Kadıköy'),
              coverage(201, 11, 'Acıbadem', 'Üsküdar'),
            ]),
          )
        },
      ),
    )

    renderRoute('/operator/schools')
    await openAddSchool()
    expect(
      await screen.findByText(/Bu sayfadaki tüm okulları eklemişsiniz/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    expect(await screen.findByText('Seçili: Acıbadem')).toBeInTheDocument()
    expect(neighborhoodRequests).toEqual([])

    const kadikoy = await screen.findByRole('group', { name: 'Kadıköy' })
    const kadikoyToggle = within(kadikoy).getByRole('button', {
      name: 'Kadıköy',
    })
    expect(kadikoyToggle).toHaveAccessibleDescription('0 seçili')
    expect(
      within(screen.getByRole('group', { name: 'Üsküdar' })).getByRole(
        'button',
        { name: 'Üsküdar' },
      ),
    ).toHaveAccessibleDescription('1 seçili')
    fireEvent.click(kadikoyToggle)
    fireEvent.click(
      await within(kadikoy).findByRole('button', {
        name: 'Bu ilçenin tümünü seç',
      }),
    )
    expect(kadikoyToggle).toHaveAccessibleDescription('1 seçili')
    fireEvent.click(
      within(kadikoy).getByRole('button', {
        name: 'Bu ilçenin seçimini temizle',
      }),
    )
    expect(kadikoyToggle).toHaveAccessibleDescription('0 seçili')
    expect(screen.getByText('Seçili: Acıbadem')).toBeInTheDocument()
    fireEvent.click(
      within(kadikoy).getByRole('button', {
        name: 'Bu ilçenin tümünü seç',
      }),
    )
    fireEvent.click(kadikoyToggle)
    fireEvent.click(kadikoyToggle)
    expect(neighborhoodRequests).toEqual(['10'])
    fireEvent.click(screen.getByRole('button', { name: 'Kapsamı kaydet' }))

    expect(
      await screen.findByText(
        'Hizmet kapsamı kaydedildi. Bu okul uygun aramalara katkı sağlayabilir.',
      ),
    ).toBeInTheDocument()
    expect(coverageBody).toEqual({ neighborhoodIds: [101, 201] })
    expect(neighborhoodRequests).toEqual(['10'])
  })

  it('retries a failed district without loading other districts', async () => {
    let attempts = 0
    server.use(
      authHandler(),
      readinessHandler(),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([])]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [school()],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([
          { id: 10, provinceId: 34, name: 'Kadıköy' },
          { id: 11, provinceId: 34, name: 'Üsküdar' },
        ]),
      ),
      http.get('/api/v1/neighborhoods', ({ request }) => {
        attempts += 1
        const districtId = new URL(request.url).searchParams.get('districtId')
        if (attempts === 1) {
          return HttpResponse.json(
            {
              title: 'Service Unavailable',
              status: 503,
              detail: 'Kadıköy mahalleleri şu anda alınamıyor.',
              code: 'neighborhoods_unavailable',
            },
            { status: 503 },
          )
        }
        return HttpResponse.json(
          districtId === '10'
            ? [{ id: 101, districtId: 10, name: 'Moda' }]
            : [{ id: 201, districtId: 11, name: 'Acıbadem' }],
        )
      }),
    )

    renderRoute('/operator/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    const kadikoy = await screen.findByRole('group', { name: 'Kadıköy' })
    fireEvent.click(within(kadikoy).getByRole('button', { name: 'Kadıköy' }))

    expect(
      await screen.findByText('Kadıköy mahalleleri şu anda alınamıyor.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))

    expect(
      await within(kadikoy).findByRole('checkbox', { name: 'Moda' }),
    ).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('cancels stale requests and isolates selections when switching schools', async () => {
    let requestSignal: AbortSignal | undefined
    let releaseRequest: (() => void) | undefined
    const secondId = '85ef6bb0-e313-43fb-a01c-c935774434b4'
    server.use(
      authHandler(),
      readinessHandler(),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([
          operatorSchool([]),
          operatorSchool([coverage(201, 11, 'Acıbadem', 'Üsküdar')], {
            id: secondId,
            schoolId: '7de54e65-6e04-4168-a1cb-967a98d7ec12',
            schoolName: 'İkinci Okul',
          }),
        ]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [school()],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([
          { id: 10, provinceId: 34, name: 'Kadıköy' },
          { id: 11, provinceId: 34, name: 'Üsküdar' },
        ]),
      ),
      http.get('/api/v1/neighborhoods', async ({ request }) => {
        requestSignal = request.signal
        await new Promise<void>((resolve) => {
          releaseRequest = resolve
        })
        return HttpResponse.json([{ id: 101, districtId: 10, name: 'Moda' }])
      }),
    )

    renderRoute('/operator/schools')
    const firstCard = (await screen.findByText('Örnek Okulu')).closest(
      'article',
    )
    const secondCard = screen.getByText('İkinci Okul').closest('article')
    expect(firstCard).not.toBeNull()
    expect(secondCard).not.toBeNull()
    fireEvent.click(within(firstCard!).getByRole('button', { name: 'Düzenle' }))
    const kadikoy = await screen.findByRole('group', { name: 'Kadıköy' })
    fireEvent.click(within(kadikoy).getByRole('button', { name: 'Kadıköy' }))
    await waitFor(() => expect(requestSignal).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    fireEvent.click(
      within(secondCard!).getByRole('button', { name: 'Düzenle' }),
    )
    await waitFor(() => expect(requestSignal?.aborted).toBe(true))
    releaseRequest?.()

    const secondEditor = await screen.findByRole('dialog', {
      description: /^İkinci Okul için hizmet mahalleleri/,
    })
    expect(
      await within(secondEditor).findByText('Seçili: Acıbadem'),
    ).toBeInTheDocument()
    expect(
      within(secondEditor).queryByText('Seçili: Moda'),
    ).not.toBeInTheDocument()
  })

  it('opens a newly added school coverage editor and moves keyboard focus', async () => {
    const created = operatorSchool([])
    server.use(
      authHandler(false, 'DRAFT'),
      csrfHandler(),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [school()],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.post('/api/v1/operator/schools', () => HttpResponse.json(created)),
      http.get('/api/v1/districts', () => HttpResponse.json([])),
    )

    renderRoute('/operator/schools')
    await openAddSchool()
    await screen.findByRole('option', { name: /Örnek Okulu/ })
    fireEvent.change(screen.getByLabelText('Aktif okul'), {
      target: { value: created.schoolId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Okulu ekle' }))

    expect(
      await screen.findByText(/Şimdi bu okul için hizmet mahallelerini/),
    ).toBeInTheDocument()
    const heading = await screen.findByRole('heading', {
      name: 'Okul kapsamını düzenle',
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(
      screen.getByText(
        /Bu okul için hizmet verdiğiniz mahalleleri seçip kaydedin/,
      ),
    ).toBeInTheDocument()
  })

  it('distinguishes an empty pilot catalog from a search with no results', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 50,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    renderRoute('/operator/schools')
    await openAddSchool()
    expect(
      await screen.findByText(/Okul kataloğu henüz boş/),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul ara'), {
      target: { value: 'Bulunmayan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }))
    expect(
      await screen.findByText(/Bu aramayla eşleşen aktif okul bulunamadı/),
    ).toBeInTheDocument()
  })

  it('pages through more than 50 schools without losing the selected option', async () => {
    const requests: string[] = []
    const firstPageSchool = school({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'İlk Sayfa Okulu',
    })
    const secondPageSchool = school({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'İkinci Sayfa Okulu',
    })
    const searchedSchool = school({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Aranan Okul',
    })
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
      http.get('/api/v1/schools', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url.search)
        const query = url.searchParams.get('query')
        const page = Number(url.searchParams.get('page'))
        if (query === 'Aranan') {
          return HttpResponse.json({
            content: [searchedSchool],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
          })
        }
        return HttpResponse.json({
          content: [page === 1 ? secondPageSchool : firstPageSchool],
          page,
          size: 10,
          totalElements: 61,
          totalPages: 7,
        })
      }),
    )

    renderRoute('/operator/schools')
    await openAddSchool()
    const schoolSelect = await screen.findByLabelText('Aktif okul')
    expect(
      await within(schoolSelect).findByRole('option', {
        name: /İlk Sayfa Okulu/,
      }),
    ).toBeInTheDocument()
    fireEvent.change(schoolSelect, { target: { value: firstPageSchool.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }))

    expect(
      await within(schoolSelect).findByRole('option', {
        name: /İkinci Sayfa Okulu/,
      }),
    ).toBeInTheDocument()
    expect(schoolSelect).toHaveValue(firstPageSchool.id)
    expect(
      within(schoolSelect).getByRole('option', { name: /İlk Sayfa Okulu/ }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul ara'), {
      target: { value: '  Aranan  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }))
    expect(
      await within(schoolSelect).findByRole('option', { name: /Aranan Okul/ }),
    ).toBeInTheDocument()
    expect(schoolSelect).toHaveValue(firstPageSchool.id)
    expect(requests).toEqual([
      '?page=0&size=10&sort=name-asc',
      '?page=1&size=10&sort=name-asc',
      '?page=0&size=10&sort=name-asc&query=Aranan',
    ])
  })

  it('announces school loading and ignores an aborted stale search', async () => {
    let slowSignal: AbortSignal | undefined
    let releaseSlow: (() => void) | undefined
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
      http.get('/api/v1/schools', async ({ request }) => {
        const query = new URL(request.url).searchParams.get('query')
        if (query === 'Yavaş') {
          slowSignal = request.signal
          await new Promise<void>((resolve) => {
            releaseSlow = resolve
          })
          return HttpResponse.json({
            content: [school({ name: 'Eski Sonuç' })],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
          })
        }
        return HttpResponse.json({
          content: [school({ name: query === 'Hızlı' ? 'Yeni Sonuç' : 'İlk' })],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        })
      }),
    )

    renderRoute('/operator/schools')
    await openAddSchool()
    const input = await screen.findByLabelText('Okul ara')
    fireEvent.change(input, { target: { value: 'Yavaş' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }))
    expect(await screen.findByText('Okullar aranıyor')).toBeInTheDocument()
    await waitFor(() => expect(slowSignal).toBeDefined())

    fireEvent.change(input, { target: { value: 'Hızlı' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(slowSignal?.aborted).toBe(true))
    expect(
      await screen.findByRole('option', { name: /Yeni Sonuç/ }),
    ).toBeInTheDocument()
    releaseSlow?.()
    expect(screen.queryByRole('option', { name: /Eski Sonuç/ })).toBeNull()
  })

  it('retries the same school search after a catalog failure', async () => {
    let failedAttempts = 0
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
      http.get('/api/v1/schools', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query')
        if (query === 'Hata' && failedAttempts++ === 0) {
          return HttpResponse.json(
            {
              title: 'Service Unavailable',
              status: 503,
              detail: 'Okul kataloğu şu anda alınamıyor.',
              code: 'schools_unavailable',
            },
            { status: 503 },
          )
        }
        return HttpResponse.json({
          content: [
            school({ name: query === 'Hata' ? 'Bulunan Okul' : 'İlk' }),
          ],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        })
      }),
    )

    renderRoute('/operator/schools')
    await openAddSchool()
    fireEvent.change(await screen.findByLabelText('Okul ara'), {
      target: { value: 'Hata' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }))
    expect(
      await screen.findByText('Okul kataloğu şu anda alınamıyor.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))

    expect(
      await screen.findByRole('option', { name: /Bulunan Okul/ }),
    ).toBeInTheDocument()
    expect(failedAttempts).toBe(2)
  })

  it('warns about hidden profiles and administrator-deactivated schools', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({
        approvalRequired: false,
        approvalSatisfied: true,
        publiclyVisible: false,
      }),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([], { schoolActive: false })]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 50,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    renderRoute('/operator/schools')

    expect(
      await screen.findByText('Profil görünürlüğünüz kapalı.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/okul yönetici tarafından pasife alındı/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pasifleştir' })).toBeDisabled()
  })

  it('keeps each linked school coverage visibly separate', async () => {
    const secondId = '85ef6bb0-e313-43fb-a01c-c935774434b4'
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([
          operatorSchool([coverage(101, 10, 'Moda', 'Kadıköy')]),
          operatorSchool([], {
            id: secondId,
            schoolId: '7de54e65-6e04-4168-a1cb-967a98d7ec12',
            schoolName: 'İkinci Okul',
          }),
        ]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 50,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    renderRoute('/operator/schools')
    const firstCard = (await screen.findByText('Örnek Okulu')).closest(
      'article',
    )
    const secondCard = screen.getByText('İkinci Okul').closest('article')
    expect(firstCard).not.toBeNull()
    expect(secondCard).not.toBeNull()
    expect(
      within(firstCard!).getByText(/1 hizmet mahallesi/),
    ).toBeInTheDocument()
    expect(
      within(secondCard!).getByText(/0 hizmet mahallesi/),
    ).toBeInTheDocument()
    expect(
      within(secondCard!).getByText(
        /hizmet verdiğiniz mahalleleri seçip kaydedin/,
      ),
    ).toBeInTheDocument()
  })

  it('shows the district name and marks coverage from another district', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([
          operatorSchool([
            coverage(101, 10, 'Moda', 'Kadıköy'),
            coverage(201, 11, 'Acıbadem', 'Üsküdar'),
          ]),
        ]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }]),
      ),
    )

    renderRoute('/operator/schools')

    expect(await screen.findByText('Kadıköy')).toBeInTheDocument()
    expect(screen.getByText('Moda')).toBeInTheDocument()
    expect(screen.getByText('Acıbadem · Üsküdar')).toBeInTheDocument()
    expect(screen.getByText('1 aktif okul')).toBeInTheDocument()
  })

  it('removes a school only after confirmation and keeps it when removal fails', async () => {
    let deletes = 0
    server.use(
      authHandler(false, 'DRAFT'),
      csrfHandler(),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([])]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/districts', () => HttpResponse.json([])),
      http.delete('/api/v1/operator/schools/:id', () => {
        deletes += 1
        return deletes === 1
          ? HttpResponse.json(
              { title: 'Error', status: 503, detail: 'Okul kaldırılamadı.' },
              { status: 503 },
            )
          : new HttpResponse(null, { status: 204 })
      }),
    )

    renderRoute('/operator/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Kaldır' }))
    let dialog = screen.getByRole('dialog', {
      name: 'Okul kapsamı kaldırılsın mı?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    expect(deletes).toBe(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Kaldır' }))
    dialog = screen.getByRole('dialog', {
      name: 'Okul kapsamı kaldırılsın mı?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Okul kaldırılamadı.',
    )
    expect(screen.getByText('Örnek Okulu')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }))
    expect(
      await screen.findByText(
        'Okul bağlantısı ve okula özel kapsam kaldırıldı.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Örnek Okulu')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deletes).toBe(2)
  })

  it('keeps coverage selections and shows the error when saving fails', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      csrfHandler(),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([
          operatorSchool([coverage(101, 10, 'Moda', 'Kadıköy')]),
        ]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }]),
      ),
      http.put('/api/v1/operator/schools/:id/coverage', () =>
        HttpResponse.json(
          { title: 'Error', status: 503, detail: 'Kapsam kaydedilemedi.' },
          { status: 503 },
        ),
      ),
    )

    renderRoute('/operator/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Okul kapsamını düzenle',
    })
    await within(dialog).findByRole('group', { name: 'Kadıköy' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Kapsamı kaydet' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kapsam kaydedilemedi.',
    )
    expect(within(dialog).getByText('Seçili: Moda')).toBeInTheDocument()
  })

  describe('O03 review regressions', () => {
    const secondId = '85ef6bb0-e313-43fb-a01c-c935774434b4'
    const emptyCatalog = {
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    }
    const two = () => [
      operatorSchool([coverage(101, 10, 'Moda', 'Kadıköy')]),
      operatorSchool([coverage(201, 11, 'Acıbadem', 'Üsküdar')], {
        id: secondId,
        schoolId: '7de54e65-6e04-4168-a1cb-967a98d7ec12',
        schoolName: 'İkinci Okul',
      }),
    ]

    function deferred() {
      let resolve: () => void = () => undefined
      const promise = new Promise<void>((done) => {
        resolve = done
      })
      return { promise, resolve }
    }

    function base(schools: unknown[]) {
      return [
        authHandler(false, 'DRAFT'),
        csrfHandler(),
        readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
        http.get('/api/v1/operator/schools', () => HttpResponse.json(schools)),
        http.get('/api/v1/schools', () => HttpResponse.json(emptyCatalog)),
      ]
    }

    const districtsFail = http.get('/api/v1/districts', () =>
      HttpResponse.json(
        { title: 'Error', status: 503, detail: 'İlçeler alınamadı.' },
        { status: 503 },
      ),
    )

    it.each([
      ['success', 200],
      ['failure', 503],
    ])(
      'marks conflicting row actions during a mutation and unlocks after %s',
      async (_, status) => {
        const gate = deferred()
        const patches: string[] = []
        server.use(
          ...base(two()),
          http.get('/api/v1/districts', () => HttpResponse.json([])),
          http.patch('/api/v1/operator/schools/:id', async ({ params }) => {
            patches.push(String(params.id))
            await gate.promise
            return status === 200
              ? HttpResponse.json(operatorSchool([], { active: false }))
              : HttpResponse.json(
                  { title: 'Error', status, detail: 'Okul güncellenemedi.' },
                  { status },
                )
          }),
        )

        renderRoute('/operator/schools')
        const firstCard = (await screen.findByText('Örnek Okulu')).closest(
          'article',
        )!
        const secondCard = screen.getByText('İkinci Okul').closest('article')!
        const toggle = within(firstCard).getByRole('button', {
          name: 'Pasifleştir',
        })
        const otherToggle = within(secondCard).getByRole('button', {
          name: 'Pasifleştir',
        })
        toggle.focus()
        fireEvent.click(toggle)
        fireEvent.click(toggle)
        await waitFor(() => expect(patches).toHaveLength(1))

        expect(toggle).toHaveFocus()
        for (const action of [
          toggle,
          otherToggle,
          within(firstCard).getByRole('button', { name: 'Kaldır' }),
          within(secondCard).getByRole('button', { name: 'Kaldır' }),
          within(firstCard).getByRole('button', { name: 'Düzenle' }),
          within(firstCard).getByRole('button', { name: '+ Mahalle düzenle' }),
        ]) {
          expect(action).toHaveAttribute('aria-disabled', 'true')
        }
        expect(screen.getByRole('button', { name: 'Okul ekle' })).toBeDisabled()
        expect(
          within(secondCard).getByRole('button', { name: 'Düzenle' }),
        ).toHaveAttribute('aria-disabled', 'false')

        fireEvent.click(otherToggle)
        fireEvent.click(
          within(secondCard).getByRole('button', { name: 'Kaldır' }),
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(patches).toEqual([operatorSchool([]).id])

        gate.resolve()

        await waitFor(() =>
          expect(otherToggle).toHaveAttribute('aria-disabled', 'false'),
        )
        expect(screen.getByRole('button', { name: 'Okul ekle' })).toBeEnabled()
        expect(document.activeElement).toBe(toggle)
        if (status !== 200) {
          expect(screen.getByRole('alert')).toHaveTextContent(
            'Okul güncellenemedi.',
          )
        }
        expect(
          within(firstCard).getByRole('button', { name: 'Kaldır' }),
        ).toHaveAttribute('aria-disabled', 'false')
      },
    )

    it('uses the school district from the geography endpoint', async () => {
      server.use(
        ...base([operatorSchool([coverage(201, 11, 'Acıbadem', 'Üsküdar')])]),
        http.get('/api/v1/districts', () =>
          HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }]),
        ),
      )
      renderRoute('/operator/schools')
      expect(await screen.findByText('Kadıköy')).toBeInTheDocument()
    })

    it('falls back to matching coverage when the district lookup fails', async () => {
      server.use(
        ...base([operatorSchool([coverage(101, 10, 'Moda', 'Kadıköy')])]),
        districtsFail,
      )
      renderRoute('/operator/schools')
      expect(await screen.findByText('Kadıköy')).toBeInTheDocument()
      expect(screen.queryByText('İlçe bilgisi alınamadı')).toBeNull()
    })

    it('never shows the province or another district as the school district', async () => {
      server.use(
        ...base([operatorSchool([coverage(201, 11, 'Acıbadem', 'Üsküdar')])]),
        districtsFail,
      )
      renderRoute('/operator/schools')

      expect(
        await screen.findByText('İlçe bilgisi alınamadı'),
      ).toBeInTheDocument()
      expect(screen.queryByText('İstanbul')).toBeNull()
      expect(screen.queryByText('Üsküdar')).toBeNull()
      expect(screen.getByText('Acıbadem · Üsküdar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Düzenle' })).toHaveAttribute(
        'aria-disabled',
        'false',
      )

      const filter = screen.getByLabelText('Okul veya mahalle ara')
      fireEvent.change(filter, { target: { value: 'alınamadı' } })
      expect(screen.getByText(/Eşleşen okul yok/)).toBeInTheDocument()
      fireEvent.change(filter, { target: { value: 'acıbadem' } })
      expect(screen.getByText('Örnek Okulu')).toBeInTheDocument()
    })

    it('saves coverage only for the edited school', async () => {
      const puts: { id: string; body: unknown }[] = []
      server.use(
        ...base(two()),
        http.get('/api/v1/districts', () =>
          HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }]),
        ),
        http.put(
          '/api/v1/operator/schools/:id/coverage',
          async ({ params, request }) => {
            puts.push({ id: String(params.id), body: await request.json() })
            return HttpResponse.json(operatorSchool([]))
          },
        ),
      )
      renderRoute('/operator/schools')
      const firstCard = (await screen.findByText('Örnek Okulu')).closest(
        'article',
      )!
      fireEvent.click(
        within(firstCard).getByRole('button', { name: 'Düzenle' }),
      )
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByRole('group', { name: 'Kadıköy' })
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Kapsamı kaydet' }),
      )
      await screen.findByText(/Tüm hizmet mahalleleri kaldırıldı/)

      expect(puts).toEqual([
        { id: operatorSchool([]).id, body: { neighborhoodIds: [101] } },
      ])
      const secondCard = screen.getByText('İkinci Okul').closest('article')!
      expect(
        within(secondCard).getByText('Acıbadem · Üsküdar'),
      ).toBeInTheDocument()
    })

    describe('add-school dialog lifecycle', () => {
      function catalogHandler(gates: Record<string, Promise<void>>) {
        const signals: Record<string, AbortSignal> = {}
        const handler = http.get('/api/v1/schools', async ({ request }) => {
          const query = new URL(request.url).searchParams.get('query') ?? ''
          signals[query] = request.signal
          await gates[query]
          return HttpResponse.json({
            content: [school({ name: `${query || 'Varsayılan'} Sonucu` })],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
          })
        })
        return { handler, signals }
      }

      function search(value: string) {
        fireEvent.change(screen.getByLabelText('Okul ara'), {
          target: { value },
        })
        fireEvent.submit(screen.getByLabelText('Okul ara').closest('form')!)
      }

      async function closeDialog() {
        fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
        await waitFor(() =>
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        )
      }

      it('keeps only the latest search when an older one finishes last', async () => {
        const a = deferred()
        const b = deferred()
        const { handler, signals } = catalogHandler({
          Eski: a.promise,
          Yeni: b.promise,
        })
        server.use(handler, ...base([]))
        renderRoute('/operator/schools')
        await openAddSchool()
        await screen.findByRole('option', { name: /Varsayılan Sonucu/ })

        search('Eski')
        await waitFor(() => expect(signals.Eski).toBeDefined())
        await closeDialog()
        await waitFor(() => expect(signals.Eski?.aborted).toBe(true))

        await openAddSchool()
        search('Yeni')
        await waitFor(() => expect(signals.Yeni).toBeDefined())
        b.resolve()
        await screen.findByRole('option', { name: /Yeni Sonucu/ })
        a.resolve()
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(screen.queryByRole('option', { name: /Eski Sonucu/ })).toBeNull()
        expect(
          screen.getByRole('option', { name: /Yeni Sonucu/ }),
        ).toBeInTheDocument()
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('does not restore a stale search when reopened without searching', async () => {
        const a = deferred()
        const { handler, signals } = catalogHandler({ Eski: a.promise })
        server.use(handler, ...base([]))
        renderRoute('/operator/schools')
        await openAddSchool()
        await screen.findByRole('option', { name: /Varsayılan Sonucu/ })

        search('Eski')
        await waitFor(() => expect(signals.Eski).toBeDefined())
        await closeDialog()
        a.resolve()
        await new Promise((resolve) => setTimeout(resolve, 20))
        await openAddSchool()

        expect(await screen.findByLabelText('Okul ara')).toHaveValue('')
        await screen.findByRole('option', { name: /Varsayılan Sonucu/ })
        expect(screen.queryByRole('option', { name: /Eski Sonucu/ })).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('does not let a pending add be cancelled before it persists', async () => {
        const gate = deferred()
        const created = operatorSchool([])
        const { handler } = catalogHandler({})
        server.use(
          handler,
          ...base([]),
          http.get('/api/v1/districts', () => HttpResponse.json([])),
          http.post('/api/v1/operator/schools', async () => {
            await gate.promise
            return HttpResponse.json(created)
          }),
        )
        renderRoute('/operator/schools')
        await openAddSchool()
        await screen.findByRole('option', { name: /Varsayılan Sonucu/ })
        fireEvent.change(screen.getByLabelText('Aktif okul'), {
          target: { value: created.schoolId },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Okulu ekle' }))

        expect(
          await screen.findByRole('button', { name: 'Ekleniyor…' }),
        ).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Kapat' })).toBeDisabled()
        fireEvent(
          screen.getByRole('dialog'),
          new Event('cancel', { cancelable: true }),
        )
        expect(screen.getByRole('dialog')).toBeInTheDocument()

        gate.resolve()
        expect(
          await screen.findByRole('dialog', { name: 'Okul kapsamını düzenle' }),
        ).toBeInTheDocument()
        expect(screen.getByText('Örnek Okulu')).toBeInTheDocument()
      })
    })
  })

  it('warns when saving removes every neighborhood from a school', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      csrfHandler(),
      readinessHandler({ approvalRequired: false, approvalSatisfied: true }),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([
          operatorSchool([coverage(101, 10, 'Moda', 'Kadıköy')]),
        ]),
      ),
      http.get('/api/v1/schools', () =>
        HttpResponse.json({
          content: [school()],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }]),
      ),
      http.get('/api/v1/neighborhoods', () =>
        HttpResponse.json([{ id: 101, districtId: 10, name: 'Moda' }]),
      ),
      http.put('/api/v1/operator/schools/:id/coverage', () =>
        HttpResponse.json(operatorSchool([])),
      ),
    )

    renderRoute('/operator/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    fireEvent.click(
      within(await screen.findByRole('group', { name: 'Kadıköy' })).getByRole(
        'button',
        { name: 'Kadıköy' },
      ),
    )
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Moda' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kapsamı kaydet' }))

    expect(
      await screen.findByText(
        'Tüm hizmet mahalleleri kaldırıldı. Bu okul artık aramalara katkı sağlamaz.',
      ),
    ).toBeInTheDocument()
  })

  it('lists inactive vehicles but only offers active vehicles for new services', async () => {
    server.use(
      authHandler(),
      http.get('/api/v1/operator/vehicles', () =>
        HttpResponse.json([
          vehicle('11111111-1111-4111-8111-111111111111', '34 ABC 123', true),
          vehicle('22222222-2222-4222-8222-222222222222', '34 OLD 123', false),
        ]),
      ),
      http.get('/api/v1/operator/offerings', () => HttpResponse.json([])),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([])]),
      ),
    )

    renderRoute('/operator/offerings')

    expect(await screen.findByText('34 OLD 123')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Teklif oluştur' }))
    const vehicleSelect = screen.getByLabelText('Etkin araç')
    expect(
      within(vehicleSelect).getByRole('option', {
        name: '34 ABC 123 — 16 kişi',
      }),
    ).toBeInTheDocument()
    expect(
      within(vehicleSelect).queryByRole('option', { name: /34 OLD 123/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps create errors and entered values inside their open dialogs for retry', async () => {
    let vehicleAttempts = 0
    let offeringAttempts = 0
    const createdVehicle = vehicle(
      '11111111-1111-4111-8111-111111111111',
      '34 ABC 123',
      true,
    )
    server.use(
      authHandler(),
      csrfHandler(),
      http.get('/api/v1/operator/vehicles', () => HttpResponse.json([])),
      http.get('/api/v1/operator/offerings', () => HttpResponse.json([])),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([])]),
      ),
      http.post('/api/v1/operator/vehicles', () => {
        vehicleAttempts += 1
        return vehicleAttempts === 1
          ? HttpResponse.json(
              {
                title: 'Conflict',
                status: 409,
                detail: 'Bu plaka zaten kayıtlı.',
                code: 'vehicle_plate_conflict',
              },
              { status: 409 },
            )
          : HttpResponse.json(createdVehicle)
      }),
      http.post('/api/v1/operator/offerings', () => {
        offeringAttempts += 1
        return offeringAttempts === 1
          ? HttpResponse.json(
              {
                title: 'Bad Request',
                status: 400,
                detail: 'Servis taslağı kaydedilemedi.',
                code: 'offering_invalid',
              },
              { status: 400 },
            )
          : HttpResponse.json(offering(false, []))
      }),
    )

    renderRoute('/operator/offerings')
    fireEvent.click(await screen.findByRole('button', { name: 'Araç ekle' }))
    let dialog = screen.getByRole('dialog', { name: 'Araç ekle' })
    fireEvent.change(within(dialog).getByLabelText('Plaka'), {
      target: { value: '34 ABC 123' },
    })
    fireEvent.change(within(dialog).getByLabelText('Kapasite'), {
      target: { value: '16' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aracı ekle' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu plaka zaten kayıtlı.',
    )
    expect(within(dialog).getByLabelText('Plaka')).toHaveValue('34 ABC 123')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aracı ekle' }))
    expect(await screen.findByText('Araç eklendi.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Teklif oluştur' }))
    dialog = screen.getByRole('dialog', { name: 'Servis teklifi oluştur' })
    fireEvent.change(within(dialog).getByLabelText('Okul bağlantısı'), {
      target: { value: '75ef6bb0-e313-43fb-a01c-c935774434b4' },
    })
    fireEvent.change(within(dialog).getByLabelText('Etkin araç'), {
      target: { value: createdVehicle.id },
    })
    fireEvent.change(within(dialog).getByLabelText('Açıklama (isteğe bağlı)'), {
      target: { value: 'Deneme servisi' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Taslağı oluştur' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Servis taslağı kaydedilemedi.',
    )
    expect(
      within(dialog).getByLabelText('Açıklama (isteğe bağlı)'),
    ).toHaveValue('Deneme servisi')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Taslağı oluştur' }),
    )
    expect(
      await screen.findByText('Servis taslağı oluşturuldu.'),
    ).toBeInTheDocument()
    expect(vehicleAttempts).toBe(2)
    expect(offeringAttempts).toBe(2)
  })

  it('redirects an expired dialog operation to operator login', async () => {
    server.use(
      authHandler(),
      csrfHandler(),
      http.get('/api/v1/operator/vehicles', () => HttpResponse.json([])),
      http.get('/api/v1/operator/offerings', () => HttpResponse.json([])),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
      http.post('/api/v1/operator/vehicles', () =>
        HttpResponse.json(
          {
            title: 'Unauthorized',
            status: 401,
            detail: 'Oturum sona erdi.',
            code: 'session_expired',
          },
          { status: 401 },
        ),
      ),
    )

    renderRoute('/operator/offerings')
    fireEvent.click(await screen.findByRole('button', { name: 'Araç ekle' }))
    const dialog = screen.getByRole('dialog', { name: 'Araç ekle' })
    fireEvent.change(within(dialog).getByLabelText('Plaka'), {
      target: { value: '34 ABC 123' },
    })
    fireEvent.change(within(dialog).getByLabelText('Kapasite'), {
      target: { value: '16' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aracı ekle' }))

    expect(
      await screen.findByRole('heading', { name: 'İşletmeci paneline giriş' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps vehicle edit errors and entered values inside the dialog for retry', async () => {
    let updateBody: unknown
    let attempts = 0
    const currentVehicle = vehicle(
      '11111111-1111-4111-8111-111111111111',
      '34 ABC 123',
      true,
    )
    server.use(
      authHandler(),
      csrfHandler(),
      http.get('/api/v1/operator/vehicles', () =>
        HttpResponse.json([currentVehicle]),
      ),
      http.get('/api/v1/operator/offerings', () => HttpResponse.json([])),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([])]),
      ),
      http.patch('/api/v1/operator/vehicles/:id', async ({ request }) => {
        updateBody = await request.json()
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json(
            {
              title: 'Conflict',
              status: 409,
              detail: 'Plaka değişikliği kaydedilemedi.',
              code: 'vehicle_update_conflict',
            },
            { status: 409 },
          )
        }
        return HttpResponse.json({
          ...currentVehicle,
          plate: '34 XYZ 987',
          capacity: 18,
        })
      }),
    )

    renderRoute('/operator/offerings')

    fireEvent.click(
      await screen.findByRole('button', {
        name: '34 ABC 123 aracını düzenle',
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Araç bilgilerini düzenle',
    })
    fireEvent.change(within(dialog).getByLabelText('Plaka'), {
      target: { value: '34 XYZ 987' },
    })
    fireEvent.change(within(dialog).getByLabelText('Kapasite'), {
      target: { value: '18' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Aracı kaydet' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Plaka değişikliği kaydedilemedi.',
    )
    expect(within(dialog).getByLabelText('Plaka')).toHaveValue('34 XYZ 987')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Aracı kaydet' }),
    )

    expect(
      await screen.findByText('Araç bilgileri kaydedildi.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('34 XYZ 987')).toBeInTheDocument()
    expect(updateBody).toEqual({ plate: '34 XYZ 987', capacity: 18 })
    expect(attempts).toBe(2)
  })

  it('retries a failed offerings load without showing misleading empty states', async () => {
    let attempts = 0
    server.use(
      authHandler(),
      http.get('/api/v1/operator/vehicles', () => {
        if (attempts++ === 0) {
          return HttpResponse.json(
            {
              title: 'Service Unavailable',
              status: 503,
              detail: 'Servis bilgileri şu anda alınamıyor.',
              code: 'offerings_unavailable',
            },
            { status: 503 },
          )
        }
        return HttpResponse.json([])
      }),
      http.get('/api/v1/operator/offerings', () => HttpResponse.json([])),
      http.get('/api/v1/operator/schools', () => HttpResponse.json([])),
    )

    renderRoute('/operator/offerings')

    expect(
      await screen.findByText('Servis bilgileri şu anda alınamıyor.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Henüz araç eklenmedi')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))

    expect(await screen.findByText('Henüz araç eklenmedi')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('keeps offering edit and coverage errors inside the dialog for retry', async () => {
    let coverageBody: unknown
    let detailAttempts = 0
    let coverageAttempts = 0
    let published = false
    const activeVehicle = vehicle(
      '11111111-1111-4111-8111-111111111111',
      '34 ABC 123',
      true,
    )
    const schoolWithCoverage = operatorSchool([
      coverage(101, 10, 'Moda', 'Kadıköy'),
      coverage(201, 11, 'Acıbadem', 'Üsküdar'),
    ])
    const draft = offering(false, [coverage(101, 10, 'Moda', 'Kadıköy')])
    server.use(
      authHandler(),
      csrfHandler(),
      http.get('/api/v1/operator/vehicles', () =>
        HttpResponse.json([activeVehicle]),
      ),
      http.get('/api/v1/operator/offerings', () => HttpResponse.json([draft])),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([schoolWithCoverage]),
      ),
      http.patch('/api/v1/operator/offerings/:id', () => {
        detailAttempts += 1
        return detailAttempts === 1
          ? HttpResponse.json(
              {
                title: 'Conflict',
                status: 409,
                detail: 'Servis ayrıntıları kaydedilemedi.',
                code: 'offering_update_conflict',
              },
              { status: 409 },
            )
          : HttpResponse.json({
              ...draft,
              description: 'Yeni açıklama',
            })
      }),
      http.put(
        '/api/v1/operator/offerings/:id/coverage',
        async ({ request }) => {
          coverageBody = await request.json()
          coverageAttempts += 1
          if (coverageAttempts === 1) {
            return HttpResponse.json(
              {
                title: 'Bad Request',
                status: 400,
                detail: 'Servis kapsamı kaydedilemedi.',
                code: 'offering_coverage_invalid',
              },
              { status: 400 },
            )
          }
          return HttpResponse.json(
            offering(false, [
              coverage(101, 10, 'Moda', 'Kadıköy'),
              coverage(201, 11, 'Acıbadem', 'Üsküdar'),
            ]),
          )
        },
      ),
      http.post('/api/v1/operator/offerings/:id/publish', () => {
        published = true
        return HttpResponse.json(offering(true, draft.coverage))
      }),
    )

    renderRoute('/operator/offerings')
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Servis teklifini düzenle',
    })
    fireEvent.change(within(dialog).getByLabelText('Açıklama (isteğe bağlı)'), {
      target: { value: 'Yeni açıklama' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Ayrıntıları kaydet' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Servis bilgileri değişti. Sayfayı yenileyip tekrar deneyin.',
    )
    expect(
      within(dialog).getByLabelText('Açıklama (isteğe bağlı)'),
    ).toHaveValue('Yeni açıklama')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Ayrıntıları kaydet' }),
    )
    expect(
      await screen.findByText('Servis ayrıntıları kaydedildi.'),
    ).toBeInTheDocument()

    const uskudar = within(dialog).getByRole('group', { name: 'Üsküdar' })
    fireEvent.click(within(uskudar).getByRole('checkbox', { name: 'Acıbadem' }))
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Servis kapsamını kaydet' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Servis kapsamı kaydedilemedi.',
    )
    expect(
      within(uskudar).getByRole('checkbox', { name: 'Acıbadem' }),
    ).toBeChecked()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Servis kapsamını kaydet' }),
    )
    expect(await screen.findByText('Servis kapsamı kaydedildi.')).toBeVisible()
    expect(coverageBody).toEqual({ neighborhoodIds: [101, 201] })
    expect(detailAttempts).toBe(2)
    expect(coverageAttempts).toBe(2)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Servis teklifini düzenle penceresini kapat',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yayımla' }))
    expect(await screen.findByText('Servis yayımlandı.')).toBeInTheDocument()
    expect(published).toBe(true)
  })
})

function authHandler(
  operatorApprovalRequired = true,
  approvalStatus = 'APPROVED',
) {
  return http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: '6e2973ac-0302-49a8-b519-563ec9861272',
      email: 'operator@example.com',
      role: 'OPERATOR',
      operatorApprovalRequired,
      approvalStatus,
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

function readinessHandler(overrides: Record<string, unknown> = {}) {
  return http.get('/api/v1/operator/discovery-readiness', () =>
    HttpResponse.json({
      discoveryEligible: false,
      emailVerified: true,
      accountEnabled: true,
      profileActive: true,
      publiclyVisible: true,
      approvalRequired: true,
      approvalSatisfied: true,
      hasActiveSchoolRelationship: true,
      hasEligibleSchoolCoverage: false,
      schools: [
        schoolReadiness({
          validCoverageCount: 0,
          contributesToDiscovery: false,
        }),
      ],
      ...overrides,
    }),
  )
}

function schoolReadiness(overrides: Record<string, unknown> = {}) {
  return {
    operatorSchoolId: '75ef6bb0-e313-43fb-a01c-c935774434b4',
    schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
    schoolName: 'Örnek Okulu',
    relationshipActive: true,
    schoolActive: true,
    validCoverageCount: 1,
    contributesToDiscovery: true,
    ...overrides,
  }
}

function profile(status: string) {
  return {
    id: '99dd588e-2b72-419e-aa29-28fb97f8ad20',
    businessName: null,
    contactPhone: '+905321234567',
    description: 'Açıklama',
    approvalStatus: status,
    active: true,
    publiclyVisible: true,
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
  }
}

async function openAddSchool() {
  const open = await screen.findByRole('button', { name: 'Okul ekle' })
  await waitFor(() => expect(open).toBeEnabled())
  fireEvent.click(open)
}

function operatorSchool(
  items: ReturnType<typeof coverage>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: '75ef6bb0-e313-43fb-a01c-c935774434b4',
    schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
    schoolName: 'Örnek Okulu',
    schoolNeighborhoodId: 100,
    schoolDistrictId: 10,
    schoolProvinceId: 34,
    schoolProvinceCode: '34',
    schoolProvinceName: 'İstanbul',
    schoolActive: true,
    active: true,
    coverage: items,
    ...overrides,
  }
}

function school(overrides: Record<string, unknown> = {}) {
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
    active: true,
    ...overrides,
  }
}

function coverage(
  id: number,
  districtId: number,
  name: string,
  district: string,
) {
  return {
    neighborhoodId: id,
    neighborhoodName: name,
    districtId,
    districtName: district,
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
  }
}

function vehicle(id: string, plate: string, active: boolean) {
  return {
    id,
    plate,
    capacity: 16,
    active,
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
  }
}

function offering(published: boolean, items: ReturnType<typeof coverage>[]) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    operatorSchoolId: '75ef6bb0-e313-43fb-a01c-c935774434b4',
    schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
    schoolName: 'Örnek Okulu',
    vehicleId: '11111111-1111-4111-8111-111111111111',
    vehiclePlate: '34 ABC 123',
    vehicleCapacity: 16,
    availableSeats: 3,
    description: 'Sabah ve akşam servisi',
    published,
    coverage: items,
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
  }
}

function renderRoute(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )
}
