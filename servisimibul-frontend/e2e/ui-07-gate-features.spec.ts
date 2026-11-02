import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  createMockApiState,
  installMockApi,
  mockNotifications,
  type MockApiState,
} from './support/mock-api'

// UI-07 features absorbed from #191, #192 and #193.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const capture = process.env.UI_07_CAPTURE === '1'

const notificationCenters = [
  { id: 'N01', path: '/notifications', signIn: signInParent },
  { id: 'N02', path: '/operator/notifications', signIn: signInOperator },
  { id: 'N03', path: '/admin/notifications', signIn: signInAdmin },
] as const

for (const center of notificationCenters) {
  for (const viewport of viewports) {
    test(`${center.id} read-state filters work at ${viewport.width}px`, async ({
      page,
    }) => {
      const state = featureState()
      await page.setViewportSize(viewport)
      await installMockApi(page, state)
      await center.signIn(page)
      await page.goto(center.path)

      const filters = page.getByRole('group', {
        name: 'Okunma durumuna göre filtrele',
      })
      const all = filters.getByRole('button', { name: 'Tümü' })
      const unread = filters.getByRole('button', { name: /Okunmamış/ })
      const read = filters.getByRole('button', { name: 'Okunmuş' })
      await expect(all).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.notification-feed > li')).toHaveCount(6)
      await assertAccessibleAndContained(page, `${center.id} all`)
      await shot(page, `${center.id}-filters`, viewport.name)

      await all.focus()
      await page.keyboard.press('Tab')
      await expect(unread).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(unread).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.notification-feed > li')).toHaveCount(4)
      await expect(page.locator('.notification-feed > li.is-read')).toHaveCount(
        0,
      )

      await read.click()
      await expect(page.locator('.notification-feed > li')).toHaveCount(2)
      await expect(
        page.locator('.notification-feed > li.is-unread'),
      ).toHaveCount(0)

      await unread.click()
      await page.getByRole('button', { name: 'Tümünü okundu işaretle' }).click()
      await expect(
        page.getByRole('heading', { name: 'Okunmamış bildiriminiz yok' }),
      ).toBeVisible()
      await assertAccessibleAndContained(page, `${center.id} empty`)
      await shot(page, `${center.id}-filters-empty`, viewport.name)
    })
  }
}

test('notification filters keep the navigation badge in step', async ({
  page,
}) => {
  await installMockApi(page, featureState())
  await signInParent(page)
  await page.goto('/notifications')
  await expect(page.getByLabel('4 okunmamış bildirim').first()).toBeVisible()
  await page
    .getByRole('group', { name: 'Okunma durumuna göre filtrele' })
    .getByRole('button', { name: /Okunmamış/ })
    .click()
  await page
    .getByRole('button', { name: 'Okundu olarak işaretle' })
    .first()
    .click()
  await expect(page.locator('.notification-feed > li')).toHaveCount(3)
  await expect(page.getByLabel('3 okunmamış bildirim').first()).toBeVisible()
})

for (const viewport of viewports) {
  test(`M01 summary cards show real counts at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const state = featureState()
    await installMockApi(page, state)
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/v1/admin/operators/summary', async (route) => {
      await gate
      await route.fallback()
    })
    await signInAdmin(page)

    const summary = page.getByRole('region', { name: 'İşletmeci özeti' })
    await expect(summary.locator('dl')).toHaveAttribute('aria-busy', 'true')
    await expect(summary.getByText('0', { exact: true })).toHaveCount(0)
    release()
    await expect(summary.locator('dl')).toHaveAttribute('aria-busy', 'false')
    for (const [label, value] of [
      ['Toplam işletmeci', '1'],
      ['Aramalarda görünen', '1'],
      ['Düzeltme bekleyen', '0'],
      ['Askıya alınan', '0'],
    ] as const) {
      await expect(
        summary
          .locator('.admin-summary-card', { hasText: label })
          .locator('dd')
          .first(),
      ).toHaveText(value)
    }
    await assertAccessibleAndContained(page, 'M01 summary')
    await shot(page, 'M01-summary', viewport.name)
  })
}

test('M01 summary failure shows a retry instead of zeros', async ({ page }) => {
  await installMockApi(page, featureState())
  let failures = 1
  await page.route('**/api/v1/admin/operators/summary', (route) => {
    if (failures-- > 0) {
      return route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        json: { title: 'Error', status: 503, detail: 'unavailable' },
      })
    }
    return route.fallback()
  })
  await signInAdmin(page)
  const summary = page.getByRole('region', { name: 'İşletmeci özeti' })
  await expect(summary.getByRole('alert')).toHaveText(
    /Özet sayılar yüklenemedi/,
  )
  await expect(summary.locator('dd')).toHaveCount(0)
  await assertAccessibleAndContained(page, 'M01 summary error')
  await summary.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(
    summary.locator('.admin-summary-card', { hasText: 'Toplam işletmeci' }),
  ).toContainText('1')
})

for (const viewport of viewports) {
  test(`D01 status filters follow the lifecycle at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const state = featureState()
    state.demandClosure = 'INACTIVE'
    await installMockApi(page, state)
    await page.goto('/demands')

    const filters = page.getByRole('group', {
      name: 'Talep durumuna göre filtrele',
    })
    await expect(filters.getByRole('button', { name: 'Açık' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      page.getByRole('heading', { name: 'Bu seçim için açık talep yok' }),
    ).toBeVisible()

    await filters.getByRole('button', { name: 'Kapalı' }).focus()
    await page.keyboard.press('Enter')
    await expect(
      filters.getByRole('button', { name: 'Kapalı' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByText('Hareketsizlik nedeniyle kapandı'),
    ).toBeVisible()
    await assertAccessibleAndContained(page, 'D01 closed')
    await shot(page, 'D01-status-closed', viewport.name)

    await filters.getByRole('button', { name: 'Karşılandı' }).click()
    await expect(
      page.getByRole('heading', { name: 'Bu seçim için karşılanan talep yok' }),
    ).toBeVisible()
    await filters.getByRole('button', { name: 'Tümü' }).click()
    await expect(
      page.getByText('Hareketsizlik nedeniyle kapandı'),
    ).toBeVisible()
    await assertAccessibleAndContained(page, 'D01 all')
  })
}

test('new feature controls fit a 200% browser zoom on a 1440px screen', async ({
  browser,
}) => {
  // 1440x900 at 200% zoom gives a 720x450 CSS viewport at device scale 2.
  const context = await browser.newContext({
    viewport: { width: 720, height: 450 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await installMockApi(page, featureState())
  for (const [signIn, path, group] of [
    [undefined, '/demands', 'Talep durumuna göre filtrele'],
    [signInParent, '/notifications', 'Okunma durumuna göre filtrele'],
  ] as const) {
    await signIn?.(page)
    await page.goto(path)
    const filters = page.getByRole('group', { name: group })
    await filters.scrollIntoViewIfNeeded()
    await expect(filters).toBeInViewport()
    await assertAccessibleAndContained(page, `${path} at 200% zoom`)
  }
  await signInAdmin(page)
  await expect(
    page.getByRole('region', { name: 'İşletmeci özeti' }),
  ).toBeVisible()
  await assertAccessibleAndContained(page, 'M01 at 200% zoom')
  await context.close()
})

function featureState(): MockApiState {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Moda Öğrenci Servisi'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101, 201]
  state.demandCreated = true
  state.notifications = mockNotifications(6)
  return state
}

async function assertAccessibleAndContained(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    results.violations.map((violation) => violation.id),
    `${label} axe violations`,
  ).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
    `${label} horizontal overflow`,
  ).toBeLessThanOrEqual(1)
}

async function shot(page: Page, name: string, viewport: string) {
  if (!capture || (viewport !== 'desktop' && viewport !== 'mobile')) return
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-07/${name}-${viewport}.png`,
  })
}

async function signInOperator(page: Page) {
  await signIn(page, 'operator@example.com', /\/operator$/)
}

async function signInAdmin(page: Page) {
  await signIn(page, 'admin@example.com', /\/admin\/applications$/)
}

async function signIn(page: Page, email: string, landing: RegExp) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(landing)
}

async function signInParent(page: Page) {
  await page.goto('/parent/login')
  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL('/demands')
}
