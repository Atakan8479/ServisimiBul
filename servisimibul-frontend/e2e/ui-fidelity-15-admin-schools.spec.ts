import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_15_CAPTURE

const schools = [
  school('6de54e65-6e04-4168-a1cb-967a98d7ec12', 'Örnek Okulu', true),
  school('6de54e65-6e04-4168-a1cb-967a98d7ec13', 'Atatürk İlkokulu', true),
  school('6de54e65-6e04-4168-a1cb-967a98d7ec14', 'Moda Ortaokulu', false),
]

for (const viewport of viewports) {
  test(`M03 stays accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/schools')
    await expect(page.getByText('Moda Ortaokulu')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M03-${viewport.name}`, viewport.name)
  })
}

async function prepare(page: Page) {
  await installMockApi(page, createMockApiState())
  await page.route('**/api/v1/admin/schools?*', (route) =>
    route.fulfill({
      json: {
        content: schools,
        page: 0,
        size: 20,
        totalElements: schools.length,
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
    path: `../docs/screenshots/ui-fidelity-15/${stage}/${name}.png`,
  })
}

function school(id: string, name: string, active: boolean) {
  return {
    id,
    neighborhoodId: 101,
    neighborhoodName: 'Moda',
    districtId: 10,
    districtName: 'Kadıköy',
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
    name,
    address: null,
    sourceName: null,
    sourceCode: null,
    active,
  }
}
