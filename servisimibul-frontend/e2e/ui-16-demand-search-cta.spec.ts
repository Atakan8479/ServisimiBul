import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// Issue #319: "Talepleri göster" closes the filter form as its primary action.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

async function completeFilters(page: Page) {
  await page.getByLabel('Okulun bulunduğu il').selectOption('34')
  await page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }).click()
  await page.getByLabel('Servis alınacak ilçe').selectOption('11')
  await page.getByLabel('Servis alınacak mahalle').selectOption('201')
}

for (const viewport of viewports) {
  test(`CTA319 apply action is a separate primary row on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/demands')
    const panel = page.locator('#demand-filters')
    await expect(page.getByLabel('Okulun bulunduğu il')).toBeEnabled()

    const row = panel.locator('.demand-filter-actions')
    const apply = row.getByRole('button', { name: 'Talepleri göster' })
    const preferences = panel.getByRole('group', { name: /Sonuç tercihleri/ })
    await expect(apply).toBeVisible()
    await expect(preferences.getByRole('button')).toHaveCount(0)

    const [prefBox, rowBox, buttonBox, panelBox] = await Promise.all(
      [preferences, row, apply, panel].map(
        async (item) => (await item.boundingBox())!,
      ),
    )
    // Final row below the grouped inputs, inside the panel.
    expect(rowBox.y).toBeGreaterThanOrEqual(prefBox.y + prefBox.height)
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(
      panelBox.y + panelBox.height,
    )
    expect(buttonBox.height).toBeGreaterThanOrEqual(44)
    if (viewport.width <= 704) {
      expect(Math.abs(buttonBox.width - rowBox.width)).toBeLessThanOrEqual(1)
    } else {
      // Proportionate and right-aligned on wider screens.
      expect(buttonBox.width).toBeLessThan(rowBox.width / 2)
      expect(
        Math.abs(buttonBox.x + buttonBox.width - (rowBox.x + rowBox.width)),
      ).toBeLessThanOrEqual(1)
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)

    await completeFilters(page)
    // Keyboard order: sorting is followed directly by the apply action.
    await preferences.getByLabel('Sıralama').focus()
    await page.keyboard.press('Tab')
    await expect(apply).toBeFocused()
    await expect(apply).not.toHaveCSS('outline-style', 'none')

    expect(
      (
        await new AxeBuilder({ page })
          .include('#demand-filters')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([])

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(
      /schoolId=.*pickupDistrictId=11.*neighborhoodId=201/,
    )
    await expect(apply).toBeEnabled()
  })
}

test('CTA319 invalid year keeps the error beside the inputs and blocks applying', async ({
  page,
}) => {
  await installMockApi(page, createMockApiState())
  await page.goto('/demands')
  const panel = page.locator('#demand-filters')
  await expect(page.getByLabel('Okulun bulunduğu il')).toBeEnabled()
  const url = page.url()

  await panel.getByLabel('Eğitim yılı').fill('2026-2028')
  await panel.getByRole('button', { name: 'Talepleri göster' }).click()
  const error = panel.getByText(/Eğitim yılını 2026-2027 biçiminde/)
  await expect(error).toBeVisible()
  const errorBox = (await error.boundingBox())!
  const rowBox = (await panel.locator('.demand-filter-actions').boundingBox())!
  expect(errorBox.y + errorBox.height).toBeLessThanOrEqual(rowBox.y)
  expect(page.url()).toBe(url)
})
