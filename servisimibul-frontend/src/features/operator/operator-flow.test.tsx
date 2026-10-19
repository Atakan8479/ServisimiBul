import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

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
      screen.getByText(/Araç eklemeden veya ayrıntılı hizmet ilanı/),
    ).toBeInTheDocument()
    expect(screen.getByText('Örnek Okulu')).toBeInTheDocument()
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

    expect(await screen.findByText('Yönetici onayı')).toBeInTheDocument()
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
  })

  it('hides the approval workflow and keeps draft profile editing available in pilot mode', async () => {
    server.use(
      authHandler(false, 'DRAFT'),
      http.get('/api/v1/operator/profile', () =>
        HttpResponse.json(profile('DRAFT')),
      ),
    )

    renderRoute('/operator/profile')

    expect(await screen.findByText('Pilot modu etkin')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Başvuru göndermeniz veya yönetici onayı beklemeniz gerekmez.',
      ),
    ).toBeInTheDocument()
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kapsamı düzenle' }),
    )
    expect(
      screen.getByText(
        'Görüntülenen tüm okullar zaten hizmet ağınıza eklenmiş.',
      ),
    ).toBeInTheDocument()
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kapsamı düzenle' }),
    )
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
    fireEvent.click(
      within(firstCard!).getByRole('button', { name: 'Kapsamı düzenle' }),
    )
    const kadikoy = await screen.findByRole('group', { name: 'Kadıköy' })
    fireEvent.click(within(kadikoy).getByRole('button', { name: 'Kadıköy' }))
    await waitFor(() => expect(requestSignal).toBeDefined())

    fireEvent.click(
      within(secondCard!).getByRole('button', { name: 'Kapsamı düzenle' }),
    )
    await waitFor(() => expect(requestSignal?.aborted).toBe(true))
    releaseRequest?.()

    const secondEditor = await screen.findByRole('region', {
      name: 'İkinci Okul kapsamı',
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
    fireEvent.change(await screen.findByLabelText('Aktif okul'), {
      target: { value: created.schoolId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Okulu ekle' }))

    expect(
      await screen.findByText(/Şimdi bu okul için hizmet mahallelerini/),
    ).toBeInTheDocument()
    const heading = await screen.findByRole('heading', {
      name: 'Örnek Okulu için hizmet mahalleleri',
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(
      screen.getByText(/kapsam kaydedilmeden okul aramalara katkı sağlamaz/),
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
    expect(
      await screen.findByText(/Pilot okul kataloğu henüz boş/),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Okul ara'), {
      target: { value: 'Bulunmayan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }))
    expect(
      await screen.findByText(/Bu aramayla eşleşen aktif okul bulunamadı/),
    ).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Pasife al' })).toBeDisabled()
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
      within(secondCard!).getByText(/hizmet mahallesi seçin/),
    ).toBeInTheDocument()
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kapsamı düzenle' }),
    )
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

  it('saves only parent coverage neighborhoods and publishes the offering', async () => {
    let coverageBody: unknown
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
      http.put(
        '/api/v1/operator/offerings/:id/coverage',
        async ({ request }) => {
          coverageBody = await request.json()
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
    fireEvent.click(await screen.findByText('Servisi düzenle'))
    const uskudar = screen.getByRole('group', { name: 'Üsküdar' })
    fireEvent.click(within(uskudar).getByRole('checkbox', { name: 'Acıbadem' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Servis kapsamını kaydet' }),
    )

    expect(
      await screen.findByText('Servis kapsamı kaydedildi.'),
    ).toBeInTheDocument()
    expect(coverageBody).toEqual({ neighborhoodIds: [101, 201] })

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

function school() {
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
