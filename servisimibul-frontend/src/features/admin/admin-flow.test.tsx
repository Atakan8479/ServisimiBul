import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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
    expect(screen.getAllByText('Profil görünürlük tercihi')).not.toHaveLength(0)
    expect(screen.getByText('Açık')).toBeInTheDocument()
    expect(screen.queryByText('Herkese açık')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Başvuru durumu')).not.toBeInTheDocument()
    fireEvent.click(profileLink)
    expect(
      await screen.findByRole('button', { name: 'İşletmeciyi askıya al' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Profil görünürlük tercihi')).toBeInTheDocument()
    expect(screen.getByText('Açık')).toBeInTheDocument()
    expect(screen.queryByText('Herkese açık')).not.toBeInTheDocument()
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
    const dialog = await screen.findByRole('dialog', {
      name: 'Düzeltme talebi gönderilsin mi?',
    })
    expect(
      within(dialog).getByText('Telefon bilgisini doğrulayın.'),
    ).toBeInTheDocument()
    expect(revisionBody).toBeUndefined()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Talebi gönder' }),
    )

    expect(
      await screen.findByText('Düzeltme talebi gönderildi.'),
    ).toBeInTheDocument()
    expect(revisionBody).toEqual({ reason: 'Telefon bilgisini doğrulayın.' })
  })

  it('confirms approval and suspension actions', async () => {
    let approved = false
    let suspensionBody: unknown
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
      http.post('/api/v1/admin/operators/:id/suspend', async ({ request }) => {
        suspensionBody = await request.json()
        return HttpResponse.json(applicationDetail('APPROVED', false))
      }),
    )

    renderRoute('/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Başvuruyu onayla' }),
    )
    expect(approved).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Evet, onayla' }))
    expect(await screen.findByText('Başvuru onaylandı.')).toBeInTheDocument()
    expect(approved).toBe(true)

    fireEvent.click(
      screen.getByRole('button', { name: 'İşletmeciyi askıya al' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'İşletmeci askıya alınsın mı?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(suspensionBody).toBeUndefined()

    fireEvent.click(
      screen.getByRole('button', { name: 'İşletmeciyi askıya al' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Askıya al' }))
    expect(
      screen.getByRole('textbox', { name: /Askıya alma gerekçesi/ }),
    ).toHaveAccessibleDescription('Askıya alma gerekçesi zorunludur.')
    expect(suspensionBody).toBeUndefined()

    fireEvent.change(
      screen.getByRole('textbox', { name: /Askıya alma gerekçesi/ }),
      { target: { value: '  Şikayet incelemesi  ' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Askıya al' }))
    expect(
      await screen.findByText('İşletmeci askıya alındı.'),
    ).toBeInTheDocument()
    expect(suspensionBody).toEqual({ reason: 'Şikayet incelemesi' })
    expect(
      screen.queryByRole('button', { name: 'İşletmeciyi askıya al' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('Askıda').length).toBeGreaterThan(0)
  })

  it('reports a failed suspension and keeps the operator active', async () => {
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/admin/operators/:id', () =>
        HttpResponse.json(applicationDetail('APPROVED')),
      ),
      http.post('/api/v1/admin/operators/:id/suspend', () =>
        HttpResponse.json(
          { title: 'Conflict', status: 409, detail: 'Hesap zaten askıda.' },
          {
            status: 409,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    renderRoute('/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20')
    fireEvent.click(
      await screen.findByRole('button', { name: 'İşletmeciyi askıya al' }),
    )
    fireEvent.change(
      screen.getByRole('textbox', { name: /Askıya alma gerekçesi/ }),
      { target: { value: 'Şikayet incelemesi' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Askıya al' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hesap zaten askıda.',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'İşletmeciyi askıya al' }),
    ).toBeInTheDocument()
  })

  it('retries a failed detail load', async () => {
    let calls = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/operators/:id', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(
              { title: 'Error', status: 500, detail: 'Sunucu hatası.' },
              {
                status: 500,
                headers: { 'Content-Type': 'application/problem+json' },
              },
            )
          : HttpResponse.json(applicationDetail('APPROVED'))
      }),
    )

    renderRoute('/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20')
    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))

    expect(
      await screen.findByRole('heading', { name: 'Örnek Servis' }),
    ).toBeInTheDocument()
  })

  it('filters by the status the API supports and pages through results', async () => {
    const requests: Array<{ status: string | null; page: string | null }> = []
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/admin/operators', ({ request }) => {
        const params = new URL(request.url).searchParams
        requests.push({
          status: params.get('status'),
          page: params.get('page'),
        })
        return HttpResponse.json({
          content: [applicationDetail('APPROVED').profile],
          page: Number(params.get('page')),
          size: 20,
          totalElements: 21,
          totalPages: 2,
        })
      }),
    )

    renderRoute('/admin/applications')
    const group = await screen.findByRole('group', { name: 'Başvuru durumu' })
    expect(
      within(group).getByRole('button', { name: 'İncelemede' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('21 kayıt')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Sonraki' }))
    expect(await screen.findByText('Sayfa 2 / 2')).toBeInTheDocument()

    fireEvent.click(within(group).getByRole('button', { name: 'Tümü' }))
    await waitFor(() => expect(requests.at(-1)?.status).toBeNull())
    expect(requests.at(-1)?.page).toBe('0')
    expect(requests[0]?.status).toBe('PENDING')
    expect(requests.some((entry) => entry.page === '1')).toBe(true)
  })

  it('adds a school and keeps it listed after deactivation', async () => {
    let createBody: unknown
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
      await screen.findByRole('heading', { name: 'Okul kataloğu' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Okul ekle' }))
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
      .closest('li')
    expect(card).not.toBeNull()
    fireEvent.click(
      within(card!).getByRole('button', { name: 'Devre dışı bırak' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Örnek Okulu devre dışı bırakılsın mı?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Devre dışı bırak' }),
    )

    expect(
      await screen.findByText('Okul devre dışı bırakıldı.'),
    ).toBeInTheDocument()
    expect(within(card!).getByText('Devre dışı')).toBeInTheDocument()
  })

  it('prefills the school editor and sends only the real patch fields', async () => {
    let patchBody: unknown
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
        HttpResponse.json(schoolPage([school(true)])),
      ),
      http.patch('/api/v1/admin/schools/:id', async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json({ ...school(true), name: 'Yeni Ad' })
      }),
    )

    renderRoute('/admin/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))

    const dialog = await screen.findByRole('dialog', {
      name: 'Okul kaydını düzenle',
    })
    const name = within(dialog).getByLabelText('Okul adı')
    expect(name).toHaveValue('Örnek Okulu')
    await within(dialog).findByRole('option', { name: 'Moda' })
    expect(within(dialog).getByLabelText('İlçe')).toHaveValue('10')
    expect(within(dialog).getByLabelText('Mahalle')).toHaveValue('100')
    expect(
      within(dialog).queryByLabelText('Okulu aktif olarak ekle'),
    ).not.toBeInTheDocument()

    fireEvent.change(name, { target: { value: 'Yeni Ad' } })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }),
    )

    expect(await screen.findByText('Okul güncellendi.')).toBeInTheDocument()
    expect(patchBody).toEqual({
      neighborhoodId: 100,
      name: 'Yeni Ad',
      address: null,
      sourceName: null,
      sourceCode: null,
    })
    expect(screen.getByRole('heading', { name: 'Yeni Ad' })).toBeInTheDocument()
  })

  it('keeps the editor open and shows a server rejection inside it', async () => {
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      http.get('/api/v1/districts', () => HttpResponse.json([])),
      http.get('/api/v1/neighborhoods', () =>
        HttpResponse.json([{ id: 100, districtId: 10, name: 'Moda' }]),
      ),
      http.get('/api/v1/admin/schools', () =>
        HttpResponse.json(schoolPage([school(true)])),
      ),
      http.patch('/api/v1/admin/schools/:id', () =>
        HttpResponse.json(
          { title: 'Conflict', status: 409, detail: 'Bu okul zaten kayıtlı.' },
          {
            status: 409,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    renderRoute('/admin/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Okul kaydını düzenle',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu okul zaten kayıtlı.',
    )
    expect(within(dialog).getByLabelText('Okul adı')).toHaveValue('Örnek Okulu')
  })

  it('retries a failed school list instead of claiming it is empty', async () => {
    let calls = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/provinces', () => HttpResponse.json([])),
      http.get('/api/v1/admin/schools', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(
              { title: 'Error', status: 500, detail: 'Sunucu hatası.' },
              {
                status: 500,
                headers: { 'Content-Type': 'application/problem+json' },
              },
            )
          : HttpResponse.json(schoolPage([school(true)]))
      }),
    )

    renderRoute('/admin/schools')
    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))

    expect(
      await screen.findByRole('heading', { name: 'Örnek Okulu' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Okul bulunamadı')).not.toBeInTheDocument()
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
    fireEvent.click(await screen.findByRole('button', { name: 'Okul ekle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Okulu ekle' }))

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
      screen.getByRole('heading', { name: 'Uygulanacak ücret tarifesi' }),
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

  it('sends the newer version after the admin reloads past a conflict', async () => {
    const bodies: unknown[] = []
    let current = 'v1'
    server.use(
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/tariffs', () => HttpResponse.json(tariff(current))),
      http.put('/api/v1/admin/tariffs/34', async ({ request }) => {
        const body = await request.json()
        bodies.push(body)
        if (bodies.length === 1) {
          current = 'other'
          return HttpResponse.json(
            {
              title: 'Conflict',
              status: 409,
              detail: 'Version conflict',
              code: 'tariff_version_conflict',
            },
            { status: 409 },
          )
        }
        return HttpResponse.json(tariff('mine-2'))
      }),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    fireEvent.change(editor, {
      target: { value: JSON.stringify(tariff('mine')) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Taslağı bırakıp güncel sürümü yükle',
      }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Tarife JSON içeriği')).toHaveFocus(),
    )
    const reloaded = screen.getByLabelText('Tarife JSON içeriği')
    expect(reloaded).toHaveValue(JSON.stringify(tariff('other'), null, 2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.change(reloaded, {
      target: { value: JSON.stringify(tariff('mine-2')) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))
    expect(
      await screen.findByText('Tarife mine-2 sürümüyle kaydedildi.'),
    ).toBeInTheDocument()
    expect(bodies[1]).toEqual({
      expectedVersion: 'other',
      tariff: tariff('mine-2'),
    })
  })

  it('asks before a reload discards an edited draft', async () => {
    let reads = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/tariffs', () => {
        reads += 1
        return HttpResponse.json(tariff('v1'))
      }),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    fireEvent.change(editor, { target: { value: 'taslak' } })
    fireEvent.click(screen.getByRole('button', { name: 'Güncel sürümü yükle' }))

    const dialog = await screen.findByRole('dialog', {
      name: 'Kaydedilmemiş taslak bırakılsın mı?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    expect(editor).toHaveValue('taslak')
    expect(reads).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Güncel sürümü yükle' }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Kaydedilmemiş taslak bırakılsın mı?',
        }),
      ).getByRole('button', { name: 'Taslağı bırak' }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Tarife JSON içeriği')).toHaveValue(
        JSON.stringify(tariff('v1'), null, 2),
      ),
    )
    expect(reads).toBe(2)
  })

  it('offers a retry instead of an editor when the tariff cannot load', async () => {
    let reads = 0
    let puts = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/tariffs', () => {
        reads += 1
        return reads === 1
          ? HttpResponse.json(
              {
                title: 'Error',
                status: 500,
                detail: 'Tarife okunamadı.',
                code: 'failed',
              },
              { status: 500 },
            )
          : HttpResponse.json(tariff('v1'))
      }),
      http.put('/api/v1/admin/tariffs/34', () => {
        puts += 1
        return HttpResponse.json(tariff('v1'))
      }),
    )

    renderRoute('/admin/tariffs')
    expect(await screen.findByText('Tarife yüklenemedi')).toBeInTheDocument()
    expect(screen.getByText('Tarife okunamadı.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tarife JSON içeriği')).toBeNull()
    expect(screen.queryByText('Henüz yayımlanmış sürüm yok.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByLabelText('Tarife JSON içeriği')).toHaveValue(
      JSON.stringify(tariff('v1'), null, 2),
    )
    expect(puts).toBe(0)
  })

  it('keeps the draft when a reload fails', async () => {
    let reads = 0
    server.use(
      authHandler('ADMIN'),
      http.get('/api/v1/tariffs', () => {
        reads += 1
        return reads === 1
          ? HttpResponse.json(tariff('v1'))
          : HttpResponse.json(
              {
                title: 'Error',
                status: 500,
                detail: 'Tarife okunamadı.',
                code: 'failed',
              },
              { status: 500 },
            )
      }),
    )

    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    fireEvent.change(editor, { target: { value: 'taslak' } })
    fireEvent.click(screen.getByRole('button', { name: 'Güncel sürümü yükle' }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Kaydedilmemiş taslak bırakılsın mı?',
        }),
      ).getByRole('button', { name: 'Taslağı bırak' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tarife okunamadı.',
    )
    expect(screen.getByLabelText('Tarife JSON içeriği')).toHaveValue('taslak')
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

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('overlapping tariff loads', () => {
  function plannedLoads(
    ...plan: ((gate: Promise<void>) => Promise<Response>)[]
  ) {
    const gates = plan.map(() => deferred())
    const started = { count: 0 }
    const handler = http.get('/api/v1/tariffs', async () => {
      const index = started.count
      started.count += 1
      return plan[index](gates[index].promise)
    })
    return { gates, handler, started }
  }

  const success =
    (version: string) =>
    async (gate: Promise<void>): Promise<Response> => {
      await gate
      return HttpResponse.json(tariff(version))
    }
  const failure = async (gate: Promise<void>): Promise<Response> => {
    await gate
    return HttpResponse.json(
      {
        title: 'Error',
        status: 500,
        detail: 'Eski veya yeni yükleme hatası.',
        code: 'failed',
      },
      { status: 500 },
    )
  }

  // Both activations land before React re-renders, so two loads overlap.
  function activateTwice(button: HTMLElement) {
    act(() => {
      button.click()
      button.click()
    })
  }

  async function settleLateResponse(release: () => void) {
    const reads: Promise<unknown>[] = []
    const read = Response.prototype.text
    vi.spyOn(Response.prototype, 'text').mockImplementation(function (
      this: Response,
    ) {
      const result = read.call(this)
      reads.push(result)
      return result
    })
    release()
    await waitFor(() => expect(reads.length).toBeGreaterThan(0))
    await act(async () => {
      await Promise.all(reads)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    vi.mocked(Response.prototype.text).mockRestore()
  }

  async function expectSaveAgainst(expectedVersion: string, next: string) {
    fireEvent.change(screen.getByLabelText('Tarife JSON içeriği'), {
      target: { value: JSON.stringify(tariff(next)) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tarifeyi kaydet' }))
    expect(
      await screen.findByText(`Tarife ${next} sürümüyle kaydedildi.`),
    ).toBeInTheDocument()
    expect(savedBody).toEqual({ expectedVersion, tariff: tariff(next) })
  }

  let savedBody: unknown
  const saveHandler = http.put(
    '/api/v1/admin/tariffs/34',
    async ({ request }) => {
      savedBody = await request.json()
      return HttpResponse.json(
        tariff((savedBody as { tariff: { version: string } }).tariff.version),
      )
    },
  )

  it('keeps the newer tariff when an older success arrives last', async () => {
    const loads = plannedLoads(success('v0'), success('v1'), success('v2'))
    loads.gates[0].resolve()
    server.use(authHandler('ADMIN'), csrfHandler(), loads.handler, saveHandler)
    renderRoute('/admin/tariffs')
    await screen.findByLabelText('Tarife JSON içeriği')

    activateTwice(screen.getByRole('button', { name: 'Güncel sürümü yükle' }))
    await waitFor(() => expect(loads.started.count).toBe(3))
    loads.gates[2].resolve()
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    expect(editor).toHaveValue(JSON.stringify(tariff('v2'), null, 2))

    await settleLateResponse(loads.gates[1].resolve)

    expect(screen.getByLabelText('Tarife JSON içeriği')).toHaveValue(
      JSON.stringify(tariff('v2'), null, 2),
    )
    expect(screen.getByText(/Yüklü sürüm: v2/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Mevcut sürüm · v2' }),
    ).toBeInTheDocument()
    await expectSaveAgainst('v2', 'v3')
  })

  it('shows no error when an older failure arrives last', async () => {
    const loads = plannedLoads(success('v0'), failure, success('v2'))
    loads.gates[0].resolve()
    server.use(authHandler('ADMIN'), csrfHandler(), loads.handler, saveHandler)
    renderRoute('/admin/tariffs')
    await screen.findByLabelText('Tarife JSON içeriği')

    activateTwice(screen.getByRole('button', { name: 'Güncel sürümü yükle' }))
    await waitFor(() => expect(loads.started.count).toBe(3))
    loads.gates[2].resolve()
    await screen.findByLabelText('Tarife JSON içeriği')

    await settleLateResponse(loads.gates[1].resolve)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const editor = screen.getByLabelText('Tarife JSON içeriği')
    expect(editor).toHaveValue(JSON.stringify(tariff('v2'), null, 2))
    expect(editor).toHaveProperty('readOnly', false)
    expect(screen.getByText(/Yüklü sürüm: v2/)).toBeInTheDocument()
    await expectSaveAgainst('v2', 'v3')
  })

  it('keeps the latest failure and the draft when an older success arrives last', async () => {
    const loads = plannedLoads(success('v1'), success('v-old'), failure)
    loads.gates[0].resolve()
    server.use(authHandler('ADMIN'), csrfHandler(), loads.handler, saveHandler)
    renderRoute('/admin/tariffs')
    const editor = await screen.findByLabelText('Tarife JSON içeriği')
    const draft = JSON.stringify(tariff('my-draft'))
    fireEvent.change(editor, { target: { value: draft } })
    fireEvent.click(screen.getByRole('button', { name: 'Güncel sürümü yükle' }))
    activateTwice(
      within(
        await screen.findByRole('dialog', {
          name: 'Kaydedilmemiş taslak bırakılsın mı?',
        }),
      ).getByRole('button', { name: 'Taslağı bırak' }),
    )
    await waitFor(() => expect(loads.started.count).toBe(3))
    loads.gates[2].resolve()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Eski veya yeni yükleme hatası.',
    )

    await settleLateResponse(loads.gates[1].resolve)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Eski veya yeni yükleme hatası.',
    )
    expect(screen.getByLabelText('Tarife JSON içeriği')).toHaveValue(draft)
    expect(screen.getByText(/Yüklü sürüm: v1/)).toBeInTheDocument()
    await expectSaveAgainst('v1', 'my-draft')
  })
})

describe('school editor asynchronous ordering', () => {
  const second = {
    ...school(true),
    id: '6de54e65-6e04-4168-a1cb-967a98d7ec99',
    name: 'İkinci Okul',
    districtId: 20,
    districtName: 'Üsküdar',
    neighborhoodId: 200,
    neighborhoodName: 'Altunizade',
  }

  function geography(gate?: Promise<void>, failOnce = false) {
    let served = 0
    let failed = false
    const handlers = [
      authHandler('ADMIN'),
      csrfHandler(),
      http.get('/api/v1/provinces', () =>
        HttpResponse.json([{ id: 34, code: '34', name: 'İstanbul' }]),
      ),
      http.get('/api/v1/districts', () =>
        HttpResponse.json([
          { id: 10, provinceId: 34, name: 'Kadıköy' },
          { id: 20, provinceId: 34, name: 'Üsküdar' },
        ]),
      ),
      http.get('/api/v1/neighborhoods', async ({ request }) => {
        const districtId = new URL(request.url).searchParams.get('districtId')
        if (districtId === '20') {
          return HttpResponse.json([
            { id: 200, districtId: 20, name: 'Altunizade' },
          ])
        }
        if (gate) await gate
        served += 1
        if (failOnce && !failed) {
          failed = true
          return HttpResponse.json(
            { title: 'Error', status: 500, detail: 'Coğrafya yüklenemedi.' },
            {
              status: 500,
              headers: { 'Content-Type': 'application/problem+json' },
            },
          )
        }
        return HttpResponse.json([{ id: 100, districtId: 10, name: 'Moda' }])
      }),
      http.get('/api/v1/admin/schools', () =>
        HttpResponse.json(schoolPage([school(true), second])),
      ),
    ]
    return { handlers, served: () => served }
  }

  function editButton(name: string) {
    const row = screen.getByRole('heading', { name }).closest('li')
    return within(row!).getByRole('button', { name: 'Düzenle' })
  }

  // Waits for the delayed response, then lets its promise chain finish.
  async function settle(served: () => number, count = 1) {
    await waitFor(() => expect(served()).toBeGreaterThanOrEqual(count))
    await act(async () => {
      await fetch('/api/v1/provinces')
    })
  }

  it('prefills the geography of the school that was opened', async () => {
    server.use(...geography().handlers)
    renderRoute('/admin/schools')
    await screen.findByRole('heading', { name: 'İkinci Okul' })

    fireEvent.click(editButton('İkinci Okul'))

    const dialog = await screen.findByRole('dialog', {
      name: 'Okul kaydını düzenle',
    })
    expect(within(dialog).getByLabelText('Okul adı')).toHaveValue('İkinci Okul')
    expect(within(dialog).getByLabelText('İlçe')).toHaveValue('20')
    expect(within(dialog).getByLabelText('Mahalle')).toHaveValue('200')
  })

  it('keeps a new creation editor when an older edit response arrives', async () => {
    const gate = deferred()
    const { handlers, served } = geography(gate.promise)
    server.use(...handlers)
    renderRoute('/admin/schools')
    await screen.findByRole('heading', { name: 'Örnek Okulu' })

    fireEvent.click(editButton('Örnek Okulu'))
    fireEvent.click(screen.getByRole('button', { name: 'Okul ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Okul ekle' })
    fireEvent.change(within(dialog).getByLabelText('Okul adı'), {
      target: { value: 'Yeni Okul' },
    })

    gate.resolve()
    await settle(served)

    expect(
      screen.getByRole('dialog', { name: 'Okul ekle' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Okul adı')).toHaveValue('Yeni Okul')
    expect(within(dialog).getByLabelText('İl')).toHaveValue('')
    expect(
      within(dialog).getByRole('button', { name: 'Okulu ekle' }),
    ).toBeVisible()
  })

  it('does not show an error from an edit the user has moved on from', async () => {
    const gate = deferred()
    const { handlers, served } = geography(gate.promise, true)
    server.use(...handlers)
    renderRoute('/admin/schools')
    await screen.findByRole('heading', { name: 'Örnek Okulu' })

    fireEvent.click(editButton('Örnek Okulu'))
    fireEvent.click(screen.getByRole('button', { name: 'Okul ekle' }))
    await screen.findByRole('dialog', { name: 'Okul ekle' })

    gate.resolve()
    await settle(served)

    expect(screen.queryByText('Coğrafya yüklenemedi.')).not.toBeInTheDocument()
  })

  it('shows the latest school when edits overlap', async () => {
    const gate = deferred()
    const { handlers, served } = geography(gate.promise)
    server.use(...handlers)
    renderRoute('/admin/schools')
    await screen.findByRole('heading', { name: 'Örnek Okulu' })

    fireEvent.click(editButton('Örnek Okulu'))
    fireEvent.click(editButton('İkinci Okul'))
    const dialog = await screen.findByRole('dialog', {
      name: 'Okul kaydını düzenle',
    })
    expect(within(dialog).getByLabelText('Okul adı')).toHaveValue('İkinci Okul')

    gate.resolve()
    await settle(served)

    expect(within(dialog).getByLabelText('Okul adı')).toHaveValue('İkinci Okul')
    expect(within(dialog).getByLabelText('Mahalle')).toHaveValue('200')
  })

  it('does not open the editor over a status confirmation', async () => {
    const gate = deferred()
    const { handlers, served } = geography(gate.promise)
    server.use(...handlers)
    renderRoute('/admin/schools')
    const heading = await screen.findByRole('heading', { name: 'Örnek Okulu' })

    fireEvent.click(editButton('Örnek Okulu'))
    fireEvent.click(
      within(heading.closest('li')!).getByRole('button', {
        name: 'Devre dışı bırak',
      }),
    )
    await screen.findByRole('dialog', {
      name: 'Örnek Okulu devre dışı bırakılsın mı?',
    })

    gate.resolve()
    await settle(served)

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('does not restore stale values after closing and reopening', async () => {
    const gate = deferred()
    let servedDistricts = 0
    server.use(
      http.get('/api/v1/districts', async () => {
        await gate.promise
        servedDistricts += 1
        return HttpResponse.json([{ id: 10, provinceId: 34, name: 'Kadıköy' }])
      }),
      ...geography().handlers,
    )
    renderRoute('/admin/schools')
    await screen.findByRole('heading', { name: 'Örnek Okulu' })

    fireEvent.click(screen.getByRole('button', { name: 'Okul ekle' }))
    const first = await screen.findByRole('dialog', { name: 'Okul ekle' })
    await within(first).findByRole('option', { name: 'İstanbul' })
    fireEvent.change(within(first).getByLabelText('Okul adı'), {
      target: { value: 'Yarım Kayıt' },
    })
    fireEvent.change(within(first).getByLabelText('İl'), {
      target: { value: '34' },
    })
    fireEvent.click(within(first).getByRole('button', { name: 'Vazgeç' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Okul ekle' }))
    const reopened = await screen.findByRole('dialog', { name: 'Okul ekle' })
    gate.resolve()
    await settle(() => servedDistricts)

    expect(within(reopened).getByLabelText('Okul adı')).toHaveValue('')
    expect(within(reopened).getByLabelText('İl')).toHaveValue('')
    expect(
      within(reopened).queryByRole('option', { name: 'Kadıköy' }),
    ).not.toBeInTheDocument()
  })

  it('stays usable after a failed edit and can still create a school', async () => {
    let createBody: unknown
    server.use(
      ...geography(undefined, true).handlers,
      http.post('/api/v1/admin/schools', async ({ request }) => {
        createBody = await request.json()
        return HttpResponse.json(
          { ...school(true), id: '6de54e65-6e04-4168-a1cb-967a98d7ec77' },
          { status: 201 },
        )
      }),
    )
    renderRoute('/admin/schools')
    await screen.findByRole('heading', { name: 'Örnek Okulu' })

    fireEvent.click(editButton('Örnek Okulu'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Coğrafya yüklenemedi.',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(editButton('Örnek Okulu'))
    const retried = await screen.findByRole('dialog', {
      name: 'Okul kaydını düzenle',
    })
    fireEvent.click(within(retried).getByRole('button', { name: 'Vazgeç' }))

    fireEvent.click(screen.getByRole('button', { name: 'Okul ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Okul ekle' })
    fireEvent.change(within(dialog).getByLabelText('Okul adı'), {
      target: { value: 'Yeni Okul' },
    })
    await within(dialog).findByRole('option', { name: 'İstanbul' })
    fireEvent.change(within(dialog).getByLabelText('İl'), {
      target: { value: '34' },
    })
    await within(dialog).findByRole('option', { name: 'Kadıköy' })
    fireEvent.change(within(dialog).getByLabelText('İlçe'), {
      target: { value: '10' },
    })
    await within(dialog).findByRole('option', { name: 'Moda' })
    fireEvent.change(within(dialog).getByLabelText('Mahalle'), {
      target: { value: '100' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Okulu ekle' }))

    expect(await screen.findByText('Okul eklendi.')).toBeInTheDocument()
    expect(createBody).toMatchObject({ name: 'Yeni Okul', neighborhoodId: 100 })
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
