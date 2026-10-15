import { fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

afterEach(resetCsrfToken)

describe('operator workspace flows', () => {
  it('edits a correction-requested profile and resubmits it', async () => {
    let patchBody: unknown
    let resubmitted = false
    server.use(
      authHandler(),
      csrfHandler(),
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

  it('groups coverage by district and saves cross-district neighborhoods', async () => {
    let coverageBody: unknown
    server.use(
      authHandler(),
      csrfHandler(),
      http.get('/api/v1/operator/schools', () =>
        HttpResponse.json([operatorSchool([])]),
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
      http.get('/api/v1/districts', () =>
        HttpResponse.json([
          { id: 10, provinceId: 34, name: 'Kadıköy' },
          { id: 11, provinceId: 34, name: 'Üsküdar' },
        ]),
      ),
      http.get('/api/v1/neighborhoods', ({ request }) => {
        const districtId = new URL(request.url).searchParams.get('districtId')
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

    const kadikoy = await screen.findByRole('group', { name: 'Kadıköy' })
    const uskudar = screen.getByRole('group', { name: 'Üsküdar' })
    fireEvent.click(within(kadikoy).getByRole('checkbox', { name: 'Moda' }))
    fireEvent.click(within(uskudar).getByRole('checkbox', { name: 'Acıbadem' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kapsamı kaydet' }))

    expect(
      await screen.findByText('Hizmet kapsamı kaydedildi.'),
    ).toBeInTheDocument()
    expect(coverageBody).toEqual({ neighborhoodIds: [101, 201] })
  })
})

function authHandler() {
  return http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: '6e2973ac-0302-49a8-b519-563ec9861272',
      email: 'operator@example.com',
      role: 'OPERATOR',
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

function operatorSchool(items: ReturnType<typeof coverage>[]) {
  return {
    id: '75ef6bb0-e313-43fb-a01c-c935774434b4',
    schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
    schoolName: 'Pilot Okulu',
    schoolNeighborhoodId: 100,
    schoolDistrictId: 10,
    schoolProvinceId: 34,
    schoolProvinceCode: '34',
    schoolProvinceName: 'İstanbul',
    active: true,
    coverage: items,
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

function renderRoute(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )
}
