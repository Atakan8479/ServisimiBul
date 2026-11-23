import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const

for (const viewport of viewports) {
  test(`homepage ends on the demand callout without the closing CTA strip at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/')

    await expect(page.locator('.discovery-closing-cta')).toHaveCount(0)
    await expect(page.getByText('İlk adım okulunuzu seçmek.')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Aramaya başla' })).toHaveCount(
      0,
    )

    // The hero CTA remains the single route into the school search.
    const heroCta = page.getByRole('link', { name: 'Okulunu seç' })
    await expect(heroCta).toHaveAttribute('href', '#school-search')
    await expect(page.locator('#school-search')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Talep panosuna git' }),
    ).toHaveAttribute('href', '/demands')

    // The demand callout meets the footer with a bounded, intentional gap.
    const gap = await page.evaluate(() => {
      const promo = document.querySelector('.discovery-demand-promo')!
      const footer = document.querySelector('footer')!
      return (
        footer.getBoundingClientRect().top -
        promo.getBoundingClientRect().bottom
      )
    })
    expect(gap).toBeGreaterThanOrEqual(24)
    expect(gap).toBeLessThanOrEqual(120)

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0)

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

test('keyboard focus moves from the demand callout straight into the footer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, createMockApiState())
  await page.goto('/')

  await page.getByRole('link', { name: 'Talep panosuna git' }).focus()
  await page.keyboard.press('Tab')
  await expect(
    page
      .getByRole('navigation', { name: 'Alt menü' })
      .getByRole('link', { name: 'Ana sayfa' }),
  ).toBeFocused()

  // Hero CTA still jumps to the school search.
  await page.getByRole('link', { name: 'Okulunu seç' }).click()
  await expect(page).toHaveURL(/#school-search$/)
  await expect(page.locator('#school-search')).toBeInViewport()
})
