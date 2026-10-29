import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'compact-mobile', width: 320, height: 844 },
] as const

for (const viewport of viewports) {
  test(`operator overview preserves readiness and reflow at ${viewport.width}px`, async ({
    page,
  }) => {
    const state = createMockApiState()
    state.registered = true
    state.verified = true
    state.approvalStatus = 'APPROVED'
    state.businessName = 'Rota İstanbul'
    state.operatorSchoolAdded = true
    state.generalCoverage = [101]

    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await login(page)

    await expect(
      page.getByText('Profiliniz uygun aramalarda görünebilir.'),
    ).toBeVisible()
    await expect(page.getByText('Örnek Okulu')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])

    if (viewport.name === 'desktop' || viewport.name === 'mobile') {
      await page.screenshot({
        fullPage: true,
        path: `../docs/screenshots/ui-fidelity-01/after/operator-overview-${viewport.name}.png`,
      })
    }
  })
}

async function login(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
