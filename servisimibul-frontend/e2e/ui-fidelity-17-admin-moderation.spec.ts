import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_17_CAPTURE

const commentCase = {
  id: '1b0b4456-5e55-4814-b8f8-64d1343617fd',
  targetType: 'COMMENT',
  targetId: '75c3339d-f6f0-4e8e-aad9-2d783f7f2760',
  status: 'OPEN',
  target: {
    title: 'Örnek Okulu yorumu',
    snapshot: 'Yorumda kişisel telefon numarası paylaşılmış olabilir.',
    currentlyVisible: true,
    operatorProfileId: null,
  },
  reporterCount: 2,
  reasonCounts: { PERSONAL_DATA: 2 },
  createdAt: '2026-10-24T08:00:00Z',
  updatedAt: '2026-10-24T09:00:00Z',
  resolvedAt: null,
}

const unbrokenCase = {
  ...commentCase,
  id: '2c1c5567-6f66-4925-b9f9-75e2454728ae',
  target: {
    ...commentCase.target,
    title: `Uzun ${'başlık'.repeat(20)}`,
    snapshot: 'kırılmayanmetin'.repeat(30),
  },
}

const commentDetail = {
  summary: commentCase,
  moderatedById: null,
  decisionReason: null,
  reports: [
    {
      id: '7bd12425-ea60-45e5-b937-ddf75db2eb45',
      reason: 'PERSONAL_DATA',
      explanation: 'Telefon numarası paylaşılmış.',
      createdAt: '2026-10-24T09:00:00Z',
    },
  ],
  audit: [],
}

for (const viewport of viewports) {
  test(`M05 stays accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/moderation')
    await expect(
      page.getByRole('heading', { name: 'Örnek Okulu yorumu' }),
    ).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M05-${viewport.name}`, viewport.name)

    const opener = page.getByRole('button', {
      name: 'İncele: Örnek Okulu yorumu',
    })
    await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Bildirim ayrıntısı' })
    await expect(dialog.getByLabel('Karar')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `state-M05-review-${viewport.name}`, viewport.name)

    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    expect(
      await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(0)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('M05 confirms an enforcement decision and moves focus to the result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page)
  const bodies: unknown[] = []
  await page.route('**/api/v1/admin/moderation/cases/*/actions', (route) => {
    bodies.push(route.request().postDataJSON())
    return route.fulfill({ json: commentDetail })
  })
  await page.goto('/admin/moderation')
  await page.getByRole('button', { name: 'İncele: Örnek Okulu yorumu' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bildirim ayrıntısı' })
  await dialog.getByLabel('Yönetici gerekçesi').fill('  Kişisel veri var.  ')
  await dialog.getByLabel('Karar').selectOption('HIDE_COMMENT')
  await expect(dialog.getByText(/onay istenir/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Kararı kaydet' }).click()

  const confirm = page.getByRole('dialog', {
    name: 'Yorumu gizle işlemi onaylansın mı?',
  })
  await expect(confirm.getByRole('button', { name: 'Vazgeç' })).toBeFocused()
  await assertAccessibleAndContained(page)
  await confirm.getByRole('button', { name: 'Vazgeç' }).click()
  expect(bodies).toHaveLength(0)
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Kararı kaydet' }).click()
  await confirm.getByRole('button', { name: 'Yorumu gizle' }).click()
  const result = page.getByText('Yorumu gizle işlemi kaydedildi.')
  await expect(result).toBeFocused()
  await expect(dialog).toHaveCount(0)
  expect(bodies).toEqual([
    { action: 'HIDE_COMMENT', reason: 'Kişisel veri var.' },
  ])
})

test('M05 review survives Escape while a decision saves', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await prepare(page)
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    '**/api/v1/admin/moderation/cases/*/actions',
    async (route) => {
      await gate
      await route.fulfill({ json: commentDetail })
    },
  )
  await page.goto('/admin/moderation')
  await page.getByRole('button', { name: 'İncele: Örnek Okulu yorumu' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bildirim ayrıntısı' })
  await dialog.getByLabel('Yönetici gerekçesi').fill('İncelemeye alındı.')
  await dialog.getByLabel('Karar').selectOption('MARK_IN_REVIEW')
  await dialog.getByRole('button', { name: 'Kararı kaydet' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Kaydediliyor…' }),
  ).toBeDisabled()

  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()

  release()
  await expect(page.getByText('İncelemeye al işlemi kaydedildi.')).toBeVisible()
  await expect(dialog).toHaveCount(0)
})

test('M05 keeps unbroken reported content inside the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await prepare(page, [unbrokenCase])
  await page.goto('/admin/moderation')
  await expect(page.getByRole('button', { name: /^İncele:/ })).toBeVisible()
  await assertAccessibleAndContained(page)
})

test('M05 offers a retry when the queue fails', async ({ page }) => {
  await prepare(page)
  let failing = true
  await page.route('**/api/v1/admin/moderation/cases?*', (route) =>
    failing
      ? route.fulfill({
          status: 500,
          json: { title: 'Hata', status: 500, detail: 'Sunucu hatası.' },
        })
      : route.fallback(),
  )
  await page.goto('/admin/moderation')
  await expect(page.getByText('Bildirimler yüklenemedi')).toBeVisible()
  failing = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(
    page.getByRole('heading', { name: 'Örnek Okulu yorumu' }),
  ).toBeVisible()
})

async function prepare(page: Page, content: unknown[] = [commentCase]) {
  await installMockApi(page, createMockApiState())
  await page.route('**/api/v1/admin/moderation/cases?*', (route) =>
    route.fulfill({
      json: {
        content,
        page: 0,
        size: 20,
        totalElements: content.length,
        totalPages: 1,
      },
    }),
  )
  await page.route('**/api/v1/admin/moderation/cases/*', (route) =>
    route.request().url().endsWith('/actions')
      ? route.fallback()
      : route.fulfill({ json: commentDetail }),
  )
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('admin@example.com')
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/admin\/applications$/)
}

async function assertAccessibleAndContained(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

async function capture(page: Page, name: string, viewport: string) {
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.scrollTo(0, 0)
  })
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-17/${stage}/${name}.png`,
  })
}
