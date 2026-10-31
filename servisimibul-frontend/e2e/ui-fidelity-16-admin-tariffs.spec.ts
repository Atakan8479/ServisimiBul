import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const stage = process.env.UI_FIDELITY_16_CAPTURE

for (const viewport of viewports) {
  test(`M04 baseline on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/tariffs')
    await expect(page.getByLabel('Tarife JSON içeriği')).toBeVisible()
    await capture(page, `M04-${viewport.name}`)
  })
}

async function prepare(page: Page) {
  await installMockApi(page, createMockApiState())
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
    path: `../docs/screenshots/ui-fidelity-16/${stage}/${name}.png`,
  })
}
