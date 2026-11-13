import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const board =
  '/demands?schoolId=6de54e65-6e04-4168-a1cb-967a98d7ec12&pickupDistrictId=11&neighborhoodId=201&academicYear=2026-2027'
const tabs = ['Tümü', 'Açık', 'Karşılandı', 'Kapalı']

async function expectBoardIsSound(page: Page, emptyTabs: string[]) {
  const createLinks = page.getByRole('link', { name: 'Yeni talep oluştur' })
  const operatorPanel = page.locator('.demand-operator-panel')

  for (const tab of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    const emptyState = page.locator('.demand-empty-state')
    const empty = emptyTabs.includes(tab)
    await expect(emptyState, tab).toHaveCount(empty ? 1 : 0)
    // The header shortcut is always there; an empty list adds its own CTA.
    await expect(createLinks, tab).toHaveCount(empty ? 2 : 1)
    await expect(page.locator('.demand-create-shortcut'), tab).toBeVisible()
    await expect(
      operatorPanel.getByRole('link', { name: /talep/i }),
    ).toHaveCount(0)
    if (empty) {
      await page.getByRole('button', { name: 'Kapalı', exact: true }).focus()
      await page.keyboard.press('Tab')
      await expect(emptyState.getByRole('link')).toBeFocused()
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      tab,
    ).toBe(true)
  }

  // The operator copy sits on an opaque panel, not on the road backdrop.
  expect(
    await operatorPanel.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    ),
  ).toBe('rgba(255, 255, 255, 0.96)')
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
}

for (const width of [1440, 768, 390, 320]) {
  test(`demand board keeps one local create CTA at ${width}px with no demands or operators`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await installMockApi(page, createMockApiState())
    await page.goto(board)
    await page.getByRole('button', { name: 'Talepleri göster' }).click()
    await expect(
      page.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
    ).toBeVisible()

    await expectBoardIsSound(page, tabs)
  })

  test(`demand board keeps creation reachable at ${width}px with demands and operators`, async ({
    page,
  }) => {
    const state = createMockApiState()
    Object.assign(state, {
      demandCreated: true,
      verified: true,
      approvalStatus: 'APPROVED',
      operatorSchoolAdded: true,
      generalCoverage: [201],
    })
    await page.setViewportSize({ width, height: 900 })
    await installMockApi(page, state)
    await page.goto(board)
    await page.getByRole('button', { name: 'Talepleri göster' }).click()
    await expect(
      page.getByRole('heading', { name: '1 mevcut servis bulundu' }),
    ).toBeVisible()

    await expectBoardIsSound(page, ['Karşılandı', 'Kapalı'])
  })
}
