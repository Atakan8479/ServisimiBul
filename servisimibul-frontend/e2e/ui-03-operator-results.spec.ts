import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`operator result cards remain complete on ${viewport.name}`, async ({
    page,
  }) => {
    const state = createMockApiState()
    state.verified = true
    state.approvalStatus = 'APPROVED'
    state.operatorSchoolAdded = true
    state.generalCoverage = [201]

    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await page.goto('/')

    await page.getByLabel('Okulun bulunduğu il').selectOption('34')
    await page
      .getByRole('button', { name: 'Bu okulu seç: Örnek Okulu' })
      .click()
    await page.getByLabel('Servis alınacak ilçe').selectOption('11')
    await page.getByLabel('Servis alınacak mahalle').selectOption('201')
    await page
      .getByRole('button', { name: 'Servis işletmecilerini bul' })
      .click()

    await expect(
      page.getByRole('heading', { name: '1 işletmeci bulundu' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Bağımsız servis işletmecisi' }),
    ).toBeVisible()
    await expect(page.getByText('Servis ayrıntısı yayımlanmamış')).toBeVisible()
    await expect(
      page.getByText(/kesin adres, güzergâh, güncel kapasite veya fiyat/),
    ).toBeVisible()
    const resultHeading = page.getByRole('heading', {
      name: '1 işletmeci bulundu',
    })
    await expect(resultHeading).toBeFocused()
    const phoneLink = page.getByRole('link', {
      name: 'Telefonla ara: +905321234567',
    })
    await expect(phoneLink).toHaveAttribute('href', 'tel:+905321234567')
    await phoneLink.focus()
    await expect(phoneLink).toBeFocused()
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)

    const captureStage = process.env.UI03_CAPTURE
    if (captureStage === 'before' || captureStage === 'after') {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        fullPage: true,
        path: `../docs/screenshots/ui-03/${captureStage}/public-results-${viewport.name}.png`,
      })
    }
  })
}
