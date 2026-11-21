import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// DEMAND-UX (#270, with #271, #274, #284, #285): demand creation and operator
// discovery journeys against the real backend, disposable PostgreSQL and
// synthetic users. Only the step titled "[intercepted]" fakes a network
// failure; every other status code and count comes from the real backend.

const parentPassword = process.env.J03_PARENT_PASSWORD
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD
const operatorPassword = 'DEMAND01-operator-password'
const districtId = 3401
const neighborhoodId = 340101
const academicYear = '2026-2027'
const openSchoolName = 'DEMAND-01 Açık Okulu'
const newSchoolName = 'DEMAND-01 Yeni Okulu'
const createHeading = 'Yeni servis talebi oluştur'
const createLink = 'Yeni talep oluştur'
const parentEmail = 'demand01.parent@example.test'
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
]
const tabs = [
  { label: 'Tümü', status: 'ALL', countLabel: 'talep' },
  { label: 'Açık', status: 'OPEN', countLabel: 'açık talep' },
  { label: 'Karşılandı', status: 'FULFILLED', countLabel: 'karşılanan talep' },
  { label: 'Kapalı', status: 'CLOSED', countLabel: 'kapalı talep' },
] as const

test('DEMAND-01 keeps demand creation and discovery recoverable on the real stack', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  expect(parentPassword, 'J03_PARENT_PASSWORD must be supplied').toBeTruthy()
  expect(adminPassword, 'J03_ADMIN_PASSWORD must be supplied').toBeTruthy()

  // Reduced motion keeps axe from sampling colour transitions mid-flight.
  const contexts = await Promise.all(
    Array.from({ length: 5 }, () =>
      browser.newContext({ reducedMotion: 'reduce' }),
    ),
  )
  const [guest, parent, supporter, operator, admin] = await Promise.all(
    contexts.map((context) => context.newPage()),
  )

  try {
    await apiLogin(admin, adminEmail, adminPassword!)
    const adminCsrf = await csrf(admin)
    const schoolIds: string[] = []
    for (const [name, code] of [
      [openSchoolName, 'DEMAND01-OPEN'],
      [newSchoolName, 'DEMAND01-NEW'],
    ]) {
      const school = await admin.request.post('/api/v1/admin/schools', {
        headers: { [adminCsrf.headerName]: adminCsrf.token },
        data: {
          neighborhoodId,
          name,
          address: null,
          sourceName: 'DEMAND-01 synthetic fixture',
          sourceCode: code,
          active: true,
        },
      })
      expect(school.status()).toBe(201)
      schoolIds.push(((await school.json()) as { id: string }).id)
    }
    const [openSchoolId, newSchoolId] = schoolIds as [string, string]
    const boardPath = (schoolId: string, extra = '') =>
      `/demands?schoolId=${schoolId}&pickupDistrictId=${districtId}&neighborhoodId=${neighborhoodId}${extra}`

    // One approved operator covers only the "open" school, so the other school
    // has a genuine zero-operator result.
    await register(operator, '/api/v1/auth/register', {
      email: 'demand01.operator@example.test',
      password: operatorPassword,
      businessName: 'DEMAND-01 Servis',
      contactPhone: '+905321234568',
    })
    await apiLogin(operator, 'demand01.operator@example.test', operatorPassword)
    const operatorCsrf = await csrf(operator)
    const operatorHeaders = { [operatorCsrf.headerName]: operatorCsrf.token }
    expect(
      (
        await operator.request.post('/api/v1/operator/application/submit', {
          headers: operatorHeaders,
        })
      ).status(),
    ).toBe(200)
    const profileId = (
      (await (
        await operator.request.get('/api/v1/operator/profile')
      ).json()) as {
        id: string
      }
    ).id
    expect(
      (
        await admin.request.post(
          `/api/v1/admin/operators/${profileId}/approve`,
          { headers: { [adminCsrf.headerName]: adminCsrf.token } },
        )
      ).status(),
    ).toBe(200)
    const operatorSchool = await operator.request.post(
      '/api/v1/operator/schools',
      { headers: operatorHeaders, data: { schoolId: openSchoolId } },
    )
    expect(operatorSchool.status()).toBe(201)
    const operatorSchoolId = ((await operatorSchool.json()) as { id: string })
      .id
    expect(
      (
        await operator.request.put(
          `/api/v1/operator/schools/${operatorSchoolId}/coverage`,
          {
            headers: operatorHeaders,
            data: { neighborhoodIds: [neighborhoodId] },
          },
        )
      ).status(),
    ).toBe(200)
    expect(await operatorCount(guest, openSchoolId)).toBe(1)
    expect(await operatorCount(guest, newSchoolId)).toBe(0)

    for (const [page, email] of [
      [supporter, 'demand01.supporter@example.test'],
      [parent, parentEmail],
    ] as const) {
      await register(page, '/api/v1/auth/parent/register', {
        email,
        password: parentPassword,
      })
    }
    await apiLogin(
      supporter,
      'demand01.supporter@example.test',
      parentPassword!,
    )
    const supporterCsrf = await csrf(supporter)
    const created = await supporter.request.post('/api/v1/demands', {
      headers: { [supporterCsrf.headerName]: supporterCsrf.token },
      data: {
        schoolId: openSchoolId,
        neighborhoodId,
        needsMorning: true,
        needsAfternoon: false,
        reasons: ['NO_SUITABLE_SERVICE'],
      },
    })
    expect(created.status()).toBe(201)
    const openDemandId = ((await created.json()) as { demand: { id: string } })
      .demand.id

    await test.step('backend rejects demand creation for guests and non-parents', async () => {
      const body = {
        schoolId: newSchoolId,
        neighborhoodId,
        needsMorning: true,
        needsAfternoon: false,
        reasons: ['NO_SUITABLE_SERVICE'],
      }
      const guestCsrf = await csrf(guest)
      expect(
        (
          await guest.request.post('/api/v1/demands', {
            headers: { [guestCsrf.headerName]: guestCsrf.token },
            data: body,
          })
        ).status(),
      ).toBe(401)
      for (const page of [operator, admin]) {
        const token = await csrf(page)
        expect(
          (
            await page.request.post('/api/v1/demands', {
              headers: { [token.headerName]: token.token },
              data: body,
            })
          ).status(),
        ).toBe(403)
      }
      expect(await demandCount(guest, 'ALL', newSchoolId)).toBe(0)
    })

    await test.step('status tabs show backend counts and keep creation reachable', async () => {
      await guest.goto(boardPath(openSchoolId))
      await expect(
        guest.getByRole('heading', { name: '1 mevcut servis bulundu' }),
      ).toBeVisible()
      for (const tab of tabs) {
        await guest
          .getByRole('button', { name: tab.label, exact: true })
          .click()
        await expect(
          guest.getByRole('button', { name: tab.label, exact: true }),
        ).toHaveAttribute('aria-pressed', 'true')
        const expected = await demandCount(guest, tab.status, openSchoolId)
        await expect(
          guest.locator('.count-badge', {
            hasText: new RegExp(`^${expected} ${tab.countLabel}$`),
          }),
        ).toBeVisible()
        // Count shows only after loading; the list skeleton is gone.
        await expect(guest.locator('.demand-list-skeleton')).toHaveCount(0)
        if (expected > 0) {
          await expect(guest.locator('.demand-summary-list > *')).toHaveCount(
            expected,
          )
        }
        await expect(
          guest.getByRole('link', { name: createLink }).first(),
        ).toBeVisible()
      }
    })

    await test.step('every tab starts creation with the selection preserved', async () => {
      for (const tab of tabs) {
        await parent.goto(
          boardPath(newSchoolId, `&academicYear=${academicYear}`),
        )
        await expect(
          parent.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
        ).toBeVisible()
        await parent
          .getByRole('button', { name: tab.label, exact: true })
          .click()
        await expect(
          parent.locator('.count-badge', {
            hasText: new RegExp(`^0 ${tab.countLabel}$`),
          }),
        ).toBeVisible()
        const emptyState = parent.locator('.demand-empty-state')
        await expect(emptyState).toBeVisible()
        await emptyState.getByRole('link', { name: createLink }).click()
        await expectCreatePage(parent, newSchoolId, newSchoolName, academicYear)
        await parent.goBack()
        await expect(parent).toHaveURL(/\/demands\?/)
        await expect(
          parent.getByRole('heading', { name: 'Servis talep panosu' }),
        ).toBeVisible()
        await expect(parent.getByLabel('Eğitim yılı')).toHaveValue(academicYear)
      }
    })

    await test.step('a guest signs in and returns to the prefilled demand draft', async () => {
      await guest.goto(boardPath(newSchoolId, `&academicYear=${academicYear}`))
      await guest
        .locator('.demand-empty-state')
        .getByRole('link', { name: createLink })
        .click()
      await expectCreatePage(guest, newSchoolId, newSchoolName, academicYear)
      await review(guest)
      await expect(guest).toHaveURL(/\/parent\/login\?next=/)
      await guest.getByLabel('E-posta').fill(parentEmail)
      await guest
        .getByRole('textbox', { name: 'Şifre', exact: true })
        .fill(parentPassword!)
      await guest.getByRole('button', { name: 'Giriş yap' }).click()
      await expectCreatePage(guest, newSchoolId, newSchoolName)
      await review(guest)
      const posted = guest.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/demands'),
      )
      await guest.getByRole('button', { name: 'Talebi oluştur' }).click()
      expect((await posted).status()).toBe(201)
      await expect(guest).toHaveURL(/\/demands\/[0-9a-f-]{36}$/)
      await expect(guest.getByText('Talebiniz oluşturuldu.')).toBeVisible()
      await expect(
        guest.getByRole('heading', { level: 1, name: newSchoolName }),
      ).toBeVisible()
      expect(await demandCount(guest, 'OPEN', newSchoolId)).toBe(1)
    })

    await test.step('an existing open demand opens its detail without a duplicate', async () => {
      // The signed-in guest context is now a parent without support for it.
      await guest.goto(boardPath(openSchoolId))
      await guest.getByRole('button', { name: 'Tümü', exact: true }).click()
      await guest.getByRole('link', { name: createLink }).first().click()
      await expectCreatePage(guest, openSchoolId, openSchoolName)
      await review(guest)
      const posted = guest.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/demands'),
      )
      await guest.getByRole('button', { name: 'Talebi oluştur' }).click()
      expect((await posted).status()).toBe(200)
      await expect(guest).toHaveURL(new RegExp(`/demands/${openDemandId}$`))
      await expect(
        guest.getByText(/Bu okul ve mahalle için zaten bir talep var/),
      ).toBeVisible()
      expect(await demandCount(guest, 'ALL', openSchoolId)).toBe(1)
    })

    await test.step('only parents reach the confirmation step in the UI', async () => {
      for (const page of [operator, admin]) {
        await page.goto(
          `/demands/new?schoolId=${newSchoolId}&pickupDistrictId=${districtId}&neighborhoodId=${neighborhoodId}`,
        )
        await expectCreatePage(page, newSchoolId, newSchoolName)
        await review(page)
        await expect(
          page.getByText(
            'Talep oluşturma ve destek işlemleri yalnızca veli hesabıyla yapılabilir.',
          ),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'Talebi onaylayın' }),
        ).toHaveCount(0)
      }
    })

    await test.step('[intercepted] a failed operator lookup is retryable and never shown as zero', async () => {
      const page = parent
      // Simulated network failure: this request never reaches the backend.
      await page.route('**/api/v1/operators?**', (route) => route.abort())
      await page.goto(boardPath(newSchoolId))
      await expect(
        page.getByText(
          'Mevcut servisler şu anda yüklenemiyor. Tekrar deneyin.',
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: createLink }).first(),
      ).toBeVisible()
      await page.unroute('**/api/v1/operators?**')
      // Genuine backend answer after recovery.
      await page
        .locator('.demand-operator-panel')
        .getByRole('button', { name: 'Tekrar dene' })
        .click()
      await expect(
        page.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
      ).toBeVisible()
      await expect(
        page.getByText(
          'Mevcut servisler şu anda yüklenemiyor. Tekrar deneyin.',
        ),
      ).toHaveCount(0)
    })

    await test.step('a zero-result public search leads to a prefilled demand', async () => {
      const page = supporter
      await page.goto('/')
      await page
        .getByLabel('Okulun bulunduğu il')
        .selectOption({ label: 'İstanbul' })
      await page.getByLabel('Okul adında ara').fill(newSchoolName)
      await page.getByRole('button', { name: 'Okullarda ara' }).click()
      await page
        .getByRole('button', { name: `Bu okulu seç: ${newSchoolName}` })
        .click()
      await selectLoadedOption(page, 'Servis alınacak ilçe', 'Kadıköy')
      await selectLoadedOption(page, 'Servis alınacak mahalle', 'Moda')
      await page
        .getByRole('button', { name: 'Servis işletmecilerini bul' })
        .click()
      await expect(
        page.getByRole('heading', {
          name: 'Bu bölgede henüz servis işletmecisi bulunamadı.',
        }),
      ).toBeVisible()
      await page.getByRole('link', { name: 'Servis talebi oluştur' }).click()
      await expectCreatePage(page, newSchoolId, newSchoolName)
      await page.goBack()
      await expect(page).toHaveURL(/\/$/)
    })

    await test.step('tampered or stale query parameters fail safely', async () => {
      const page = parent
      await page.goto(
        `/demands?schoolId=00000000-0000-4000-8000-00000000dead&pickupDistrictId=${districtId}&neighborhoodId=${neighborhoodId}`,
      )
      await expect(
        page.getByText(
          'Seçtiğiniz okul veya mahalle artık bulunamıyor. Yeniden seçin.',
        ),
      ).toBeVisible()
      await expect(page).toHaveURL(/\/demands$/)
      await expect(page.locator('.count-badge')).toBeVisible()

      await page.goto(
        `/demands?schoolId=${openSchoolId}&pickupDistrictId=3402&neighborhoodId=${neighborhoodId}`,
      )
      await expect(
        page.getByText(
          'Seçtiğiniz okul veya mahalle artık bulunamıyor. Yeniden seçin.',
        ),
      ).toBeVisible()

      await page.goto(
        '/demands?schoolId=not-a-uuid&pickupDistrictId=-1&neighborhoodId=abc',
      )
      await expect(
        page.getByRole('heading', { name: 'Servis talep panosu' }),
      ).toBeVisible()
      await expect(page.locator('.count-badge')).toBeVisible()
      await expect(
        page.getByRole('link', { name: createLink }).first(),
      ).toHaveAttribute('href', '#demand-filters')

      await page.goto(
        '/demands/new?schoolId=not-a-uuid&pickupDistrictId=-1&neighborhoodId=abc',
      )
      await expect(
        page.getByRole('heading', { name: createHeading }),
      ).toBeVisible()
      await review(page)
      await expect(
        page.getByText(
          'Okul, servis alınacak ilçe ve mahalle seçimlerini tamamlayın.',
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Talebi onaylayın' }),
      ).toHaveCount(0)
    })

    await test.step('board and create page fit, pass axe and work by keyboard at each width', async () => {
      const page = parent
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        await page.goto(boardPath(openSchoolId))
        await expect(
          page.getByRole('heading', { name: '1 mevcut servis bulundu' }),
        ).toBeVisible()
        await expect(page.locator('.demand-summary-list > *')).toHaveCount(1)
        await assertLayout(page)

        const shortcut = page.locator('.demand-create-shortcut')
        await shortcut.focus()
        await expect(shortcut).toBeFocused()
        await page.keyboard.press('Enter')
        await expectCreatePage(page, openSchoolId, openSchoolName)
        await assertLayout(page)
      }
    })
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})

async function expectCreatePage(
  page: Page,
  schoolId: string,
  schoolName: string,
  expectedYear?: string,
) {
  await expect(page).toHaveURL(/\/demands\/new\?/)
  await expect(page.getByRole('heading', { name: createHeading })).toBeVisible()
  const params = new URL(page.url()).searchParams
  expect(params.get('schoolId')).toBe(schoolId)
  expect(params.get('pickupDistrictId')).toBe(String(districtId))
  expect(params.get('neighborhoodId')).toBe(String(neighborhoodId))
  await expect(page.getByText(schoolName).first()).toBeVisible()
  await expect(page.getByLabel('Servis alınacak mahalle')).toHaveValue(
    String(neighborhoodId),
  )
  if (expectedYear !== undefined) {
    expect(params.get('academicYear')).toBe(expectedYear)
    await expect(page.getByLabel('Eğitim yılı')).toHaveValue(expectedYear)
  }
}

async function review(page: Page) {
  await page.getByRole('checkbox', { name: 'Uygun servis bulamıyorum' }).check()
  await page.getByRole('button', { name: 'Bilgileri gözden geçir' }).click()
}

async function assertLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([])
}

async function demandCount(page: Page, status: string, schoolId: string) {
  const response = await page.request.get(
    `/api/v1/demands?status=${status}&schoolId=${schoolId}&neighborhoodId=${neighborhoodId}`,
  )
  expect(response.status()).toBe(200)
  return ((await response.json()) as { totalElements: number }).totalElements
}

async function operatorCount(page: Page, schoolId: string) {
  const response = await page.request.get(
    `/api/v1/operators?schoolId=${schoolId}&neighborhoodId=${neighborhoodId}`,
  )
  expect(response.status()).toBe(200)
  return ((await response.json()) as { totalElements: number }).totalElements
}

async function selectLoadedOption(page: Page, label: string, option: string) {
  const field = page.getByLabel(label)
  await expect(field.locator('option', { hasText: option })).toHaveCount(1)
  await field.selectOption({ label: option })
}

async function register(
  page: Page,
  path: string,
  data: Record<string, unknown>,
) {
  const token = await csrf(page)
  const response = await page.request.post(path, {
    headers: { [token.headerName]: token.token },
    data,
  })
  expect(response.status()).toBe(202)
}

async function apiLogin(page: Page, email: string, password: string) {
  const token = await csrf(page)
  const response = await page.request.post('/api/v1/auth/login', {
    headers: { [token.headerName]: token.token },
    data: { email, password, rememberMe: false },
  })
  expect(response.status()).toBe(200)
}

async function csrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  return (await response.json()) as { headerName: string; token: string }
}
