import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_14_CAPTURE
const detailPath = '/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20'

for (const viewport of viewports) {
  test(`M01-M02 remain accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const state = createMockApiState()
    state.approvalStatus = 'PENDING'
    state.businessName = 'Mavi Rota Taşımacılık'
    await installMockApi(page, state)
    await signIn(page)

    await page.goto('/admin/applications')
    await expect(page.getByText('Mavi Rota Taşımacılık')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M01-${viewport.name}`, viewport.name)

    await page.goto(detailPath)
    await expect(
      page.getByRole('heading', { name: 'Mavi Rota Taşımacılık' }),
    ).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M02-${viewport.name}`, viewport.name)
  })
}

async function signIn(page: Page) {
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
    path: `../docs/screenshots/ui-fidelity-14/${stage}/${name}.png`,
  })
}
