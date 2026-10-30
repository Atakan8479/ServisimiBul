import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow-mobile', width: 320, height: 720 },
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

    if (viewport.width <= 960) {
      const searchContext = page.locator('.discovery-context-disclosure')
      await expect(searchContext).toBeVisible()
      await searchContext.getByText('Arama ölçütlerini göster').click()
      await expect(searchContext.getByText('Örnek Okulu')).toBeVisible()
      await expect(searchContext.getByText('Üsküdar / Acıbadem')).toBeVisible()
    } else {
      const searchContext = page.locator('.discovery-context-panel')
      await expect(searchContext).toBeVisible()
      await expect(searchContext.getByText('Örnek Okulu')).toBeVisible()
      await expect(searchContext.getByText('Üsküdar / Acıbadem')).toBeVisible()
    }

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

    const resultColumns = await page
      .locator('.operator-result-list')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
    expect(resultColumns.split(' ')).toHaveLength(1)

    const captureStage = process.env.UI04_CAPTURE
    if (captureStage === 'before' || captureStage === 'after') {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        fullPage: true,
        path: `../docs/screenshots/ui-fidelity-04/${captureStage}/P02-results-${viewport.name}.png`,
      })
    }
  })
}
