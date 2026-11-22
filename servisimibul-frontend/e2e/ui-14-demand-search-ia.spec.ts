import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// Issue #318: the demand filter separates school, pickup and result preferences.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
}

async function selectSchool(page: Page) {
  await page.getByLabel('Okulun bulunduğu il').selectOption('34')
  await page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }).click()
  await expect(page.getByLabel('Servis alınacak ilçe')).toBeEnabled()
}

async function completePickup(page: Page) {
  await page.getByLabel('Servis alınacak ilçe').selectOption('11')
  await page.getByLabel('Servis alınacak mahalle').selectOption('201')
}

for (const viewport of viewports) {
  test(`IA318 filter states stay readable on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/demands')
    const panel = page.locator('#demand-filters')
    await expect(page.getByLabel('Okulun bulunduğu il')).toBeEnabled()

    const shot = async (state: string) => {
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
      // Full-page clip avoids the sticky header covering an element capture.
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: testInfo.outputPath(`ia318-${state}-${viewport.name}.png`),
        animations: 'disabled',
        fullPage: true,
        clip: (await panel.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return {
            x: box.x + window.scrollX,
            y: box.y + window.scrollY,
            width: box.width,
            height: box.height,
          }
        }))!,
      })
    }

    await shot('empty')
    await selectSchool(page)
    await shot('school-selected')
    await completePickup(page)
    await shot('completed')

    expect(
      (
        await new AxeBuilder({ page })
          .include('#demand-filters')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([])
  })
}

test('IA318 groups school, pickup and result preferences in reading order', async ({
  page,
}) => {
  await installMockApi(page, createMockApiState())
  await page.goto('/demands')
  const panel = page.locator('#demand-filters')

  const school = panel.getByRole('group', { name: /Okul seçimi/ })
  const pickup = panel.getByRole('group', { name: /Servis alınacak konum/ })
  const preferences = panel.getByRole('group', { name: /Sonuç tercihleri/ })
  await expect(school.getByLabel('Okulun bulunduğu il')).toBeVisible()
  await expect(school.getByLabel('Okulun ilçesi')).toBeVisible()
  await expect(school.getByLabel('Okul adında ara')).toBeVisible()
  await expect(pickup.getByLabel('Servis alınacak ilçe')).toBeDisabled()
  await expect(pickup.getByLabel('Servis alınacak mahalle')).toBeDisabled()
  await expect(pickup).toContainText('Önce okulu seçin')
  await expect(preferences.getByLabel('Eğitim yılı')).toBeVisible()
  await expect(preferences.getByLabel('Sıralama')).toBeVisible()

  // Sections follow the visual top-to-bottom order.
  const tops = await Promise.all(
    [school, pickup, preferences].map(
      async (item) => (await item.boundingBox())!.y,
    ),
  )
  expect(tops).toEqual([...tops].sort((a, b) => a - b))

  await selectSchool(page)
  // The chosen school replaces the result list and keeps keyboard focus nearby.
  const summary = school.locator('.selected-school-summary')
  await expect(summary).toContainText('Örnek Okulu')
  await expect(summary).toBeFocused()
  await expect(
    page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }),
  ).toBeHidden()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Okulu değiştir' }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Servis alınacak ilçe')).toBeFocused()
  await expect(pickup).not.toContainText('Önce okulu seçin')

  await completePickup(page)
  await expect(pickup).toHaveAttribute('data-complete', 'true')
  await page.getByLabel('Servis alınacak mahalle').focus()
  await page.keyboard.press('Tab')
  await expect(preferences.getByLabel('Eğitim yılı')).toBeFocused()

  await page.getByRole('button', { name: 'Talepleri göster' }).click()
  await expect(page).toHaveURL(
    /schoolId=.*pickupDistrictId=11.*neighborhoodId=201/,
  )

  // Changing the school restores the result list and returns focus to it.
  await page.getByRole('button', { name: 'Okulu değiştir' }).click()
  await expect(
    page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /okul bulundu/ }),
  ).toBeFocused()
  await expect(pickup.getByLabel('Servis alınacak ilçe')).toBeDisabled()
})
