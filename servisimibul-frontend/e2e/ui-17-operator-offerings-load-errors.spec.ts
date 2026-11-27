import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// Issue #327: each initial read fails and recovers on its own.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

const screenshotDir = process.env.OFFERINGS_SCREENSHOT_DIR

for (const viewport of viewports) {
  test(`LOAD327 vehicle-only failure stays contextual on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, populatedState())
    await login(page)
    const vehicleReads = await failReads(page, '/api/v1/operator/vehicles')
    await page.goto('/operator/offerings')

    const fleet = page.getByRole('region', { name: 'Araçlar', exact: true })
    const offerings = page.getByRole('region', { name: 'Servis teklifleri' })
    const alert = fleet.getByRole('alert')
    await expect(alert).toContainText('Araç bilgileri yüklenemedi')
    await expect(page.getByRole('alert')).toHaveCount(1)
    await expect(page.getByText(/SQL|column/)).toHaveCount(0)
    await expect(page.getByText('Henüz araç eklenmedi')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Araç ekle' })).toHaveCount(0)

    // Successfully loaded offerings stay visible with unsafe actions disabled.
    await expect(offerings.getByText('Sabah ve akşam servisi')).toBeVisible()
    await expect(
      offerings.getByRole('button', { name: 'Teklif oluştur' }),
    ).toHaveCount(0)
    await expect(
      offerings.getByRole('button', { name: 'Düzenle' }),
    ).toBeDisabled()

    // Message and retry are visibly separated and fit without overflow.
    const retry = fleet.getByRole('button', { name: 'Yeniden dene' })
    const [textBox, retryBox] = await Promise.all([
      alert.getByText('Araç bilgileri yüklenemedi').boundingBox(),
      retry.boundingBox(),
    ])
    expect(retryBox!.height).toBeGreaterThanOrEqual(44)
    const separated =
      retryBox!.x >= textBox!.x + textBox!.width + 8 ||
      retryBox!.y >= textBox!.y + textBox!.height + 8
    expect(separated).toBe(true)
    await expectNoOverflow(page)
    await expectAxeClean(page)
    await shoot(page, `vehicles-error-${viewport.width}`)

    vehicleReads.recover()
    await retry.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { name: 'Araçlar', exact: true }),
    ).toBeFocused()
    await expect(fleet.getByText('34 ABC 123')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(
      offerings.getByRole('button', { name: 'Teklif oluştur' }),
    ).toBeVisible()
    expect(vehicleReads.readsAfterRecovery()).toBe(1)
    await expectNoOverflow(page)
  })
}

test('LOAD327 school-only failure blocks creation without a false empty state', async ({
  page,
}) => {
  await installMockApi(page, populatedState())
  await login(page)
  const schoolReads = await failReads(page, '/api/v1/operator/schools')
  await page.goto('/operator/offerings')

  const offerings = page.getByRole('region', { name: 'Servis teklifleri' })
  await expect(offerings.getByRole('alert')).toContainText(
    'Okullar yüklenemedi',
  )
  await expect(page.getByText('Önce gerekli bilgileri tamamlayın')).toHaveCount(
    0,
  )
  await expect(
    page
      .getByRole('region', { name: 'Araçlar', exact: true })
      .getByText('34 ABC 123'),
  ).toBeVisible()
  await expect(
    offerings.getByRole('button', { name: 'Düzenle' }),
  ).toBeDisabled()

  schoolReads.recover()
  await offerings.getByRole('button', { name: 'Yeniden dene' }).click()
  await expect(
    offerings.getByRole('button', { name: 'Teklif oluştur' }),
  ).toBeVisible()
  await expect(offerings.getByRole('button', { name: 'Düzenle' })).toBeEnabled()
  expect(schoolReads.readsAfterRecovery()).toBe(1)
})

test('LOAD327 simultaneous failures each keep their own retry', async ({
  page,
}) => {
  await page.setViewportSize(viewports[2])
  await installMockApi(page, populatedState())
  await login(page)
  await failReads(page, '/api/v1/operator/vehicles')
  const offeringReads = await failReads(page, '/api/v1/operator/offerings')
  await page.goto('/operator/offerings')

  await expect(page.getByRole('alert')).toHaveCount(2)
  await expect(page.getByText('Henüz servis teklifi yok')).toHaveCount(0)
  await expectNoOverflow(page)
  await shoot(page, 'multiple-errors-390')

  const offerings = page.getByRole('region', { name: 'Servis teklifleri' })
  offeringReads.recover()
  await offerings.getByRole('button', { name: 'Yeniden dene' }).click()
  await expect(offerings.getByText('Sabah ve akşam servisi')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(1)
  expect(offeringReads.readsAfterRecovery()).toBe(1)
})

/** Fails GET reads of a path with a leaky 500 body until recovered. */
async function failReads(page: Page, path: string) {
  let failing = true
  let readsAfterRecovery = 0
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    if (!failing) {
      readsAfterRecovery += 1
      return route.fallback()
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        title: 'Internal Server Error',
        status: 500,
        detail: 'ERROR: column v.deletion_blocked_reason does not exist (SQL)',
        code: 'internal_error',
      }),
    })
  })
  return {
    recover: () => {
      failing = false
    },
    readsAfterRecovery: () => readsAfterRecovery,
  }
}

function populatedState() {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]
  state.vehicles = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      plate: '34 ABC 123',
      capacity: 16,
      active: true,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ]
  state.offerings = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      operatorSchoolId: '75ef6bb0-e313-43fb-a01c-c935774434b4',
      schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
      schoolName: 'Örnek Okulu',
      vehicleId: '11111111-1111-4111-8111-111111111111',
      vehiclePlate: '34 ABC 123',
      vehicleCapacity: 16,
      availableSeats: 3,
      description: 'Sabah ve akşam servisi',
      published: false,
      coverage: [],
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ]
  return state
}

async function login(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

async function shoot(page: Page, name: string) {
  if (!screenshotDir) return
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/${name}.png`,
  })
}
