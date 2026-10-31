import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
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

for (const viewport of viewports) {
  test(`M05 baseline on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/moderation')
    await expect(page.getByText('Örnek Okulu yorumu')).toBeVisible()
    await capture(page, `M05-${viewport.name}`)
  })
}

async function prepare(page: Page) {
  await installMockApi(page, createMockApiState())
  await page.route('**/api/v1/admin/moderation/cases?*', (route) =>
    route.fulfill({
      json: {
        content: [commentCase],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    }),
  )
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('admin@example.com')
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/admin\/applications$/)
}

async function capture(page: Page, name: string) {
  if (stage !== 'before' && stage !== 'after') return
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-17/${stage}/${name}.png`,
  })
}
