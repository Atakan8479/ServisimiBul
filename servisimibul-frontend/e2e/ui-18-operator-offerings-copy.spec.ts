import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// Issue #328: the optional fleet/offerings explanation appears exactly once,
// as a calm note inside the page header.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

const screenshotDir = process.env.OFFERINGS_SCREENSHOT_DIR
const optionalNote = /isteğe bağlıdır|zorunlu değildir/

for (const viewport of viewports) {
  test(`COPY328 single optional note on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, populatedState())
    await login(page)
    await page.goto('/operator/offerings')

    await expect(page.getByText('34 ABC 123').first()).toBeVisible()
    await shoot(page, `normal-${viewport.width}`)

    await expectSingleCalmNote(page)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Araçlar ve servis teklifleri',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Araçlar', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Servis teklifleri' }),
    ).toBeVisible()
    await expectTableLabelsOnOneLine(page)
    await expectNoOverflow(page)
    await expectAxeClean(page)
  })
}

test('COPY328 empty state keeps one note', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = populatedState()
  state.vehicles = []
  state.offerings = []
  await installMockApi(page, state)
  await login(page)
  await page.goto('/operator/offerings')

  await expect(page.getByText('Henüz araç eklenmedi')).toBeVisible()
  await shoot(page, 'empty-390')
  await expectSingleCalmNote(page)
  await expectNoOverflow(page)
  await expectAxeClean(page)
})

test('COPY328 note stays put through loading, partial failure and retry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await installMockApi(page, populatedState())
  await login(page)

  let failing = true
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/operator/vehicles', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await held
    if (!failing) return route.fallback()
    await route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 500, code: 'internal_error' }),
    })
  })
  await page.goto('/operator/offerings')

  // Loading: the header and note render before the fleet resolves.
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Araçlar ve servis teklifleri',
    }),
  ).toBeVisible()
  await expectSingleCalmNote(page)

  release()
  const fleet = page.getByRole('region', { name: 'Araçlar', exact: true })
  await expect(fleet.getByRole('alert')).toContainText(
    'Araç bilgileri yüklenemedi',
  )
  await shoot(page, 'partial-failure-768')
  await expectTableLabelsOnOneLine(page)
  await expectSingleCalmNote(page)
  await expect(page.getByRole('alert')).toHaveCount(1)

  failing = false
  const retry = fleet.getByRole('button', { name: 'Yeniden dene' })
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(fleet.getByText('34 ABC 123').first()).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expectSingleCalmNote(page)
  await expectNoOverflow(page)
})

async function expectSingleCalmNote(page: Page) {
  const notes = page.getByText(optionalNote)
  await expect(notes).toHaveCount(1)
  const note = notes.first()
  // Lives in the page header, is not announced as a warning or alert.
  await expect(page.locator('header').getByText(optionalNote)).toHaveCount(1)
  await expect(note).toContainText(
    'Araç ve servis teklifi eklemek isteğe bağlıdır',
  )
  await expect(
    page.locator('[role="alert"]').getByText(optionalNote),
  ).toHaveCount(0)
  await expect(page.locator('.operator-offerings-callout')).toHaveCount(0)
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

// Status heading, status badge and action labels must never wrap mid-word.
async function expectTableLabelsOnOneLine(page: Page) {
  const table = page.locator('.operator-offerings-table')
  const labels = [
    table.getByText('Taslak', { exact: true }),
    table.getByRole('button', { name: 'Düzenle', exact: true }),
    table.getByRole('button', { name: 'Yayımla', exact: true }),
  ]
  const statusHeading = table.getByRole('columnheader', { name: 'Durum' })
  // The header row is visually hidden (1px clip) in the stacked card layout.
  const headingBox = await statusHeading.boundingBox()
  if (headingBox && headingBox.width > 1) labels.push(statusHeading)
  for (const label of labels) {
    const lines = await label.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const tops = new Set(
        [...range.getClientRects()]
          .filter((rect) => rect.width > 0)
          .map((rect) => Math.round(rect.top)),
      )
      return tops.size
    })
    expect(lines).toBe(1)
  }
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
