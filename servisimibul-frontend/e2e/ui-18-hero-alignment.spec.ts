import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const heroBoxes = () => {
  const box = (selector: string) =>
    document.querySelector(selector)!.getBoundingClientRect().toJSON()
  return {
    kicker: box('.discovery-kicker'),
    lede: box('.discovery-hero-lede'),
    image: box('.discovery-hero-visual img'),
    principles: box('.discovery-principles'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
] as const) {
  test(`hero copy is optically lifted beside the vehicle at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/')

    const m = await page.evaluate(heroBoxes)
    const textMid = (m.kicker.top + m.principles.bottom) / 2
    const imageMid = (m.image.top + m.image.bottom) / 2
    // Text block sits above the image's geometric centre, but stays within its span.
    expect(imageMid - textMid).toBeGreaterThanOrEqual(24)
    expect(m.kicker.top).toBeGreaterThan(m.image.top)
    expect(m.principles.bottom).toBeLessThan(m.image.bottom)
    // First-screen CTA stays visible.
    await expect(
      page.getByRole('link', { name: 'Okulunu seç' }),
    ).toBeInViewport({
      ratio: 1,
    })
    expect(m.overflow).toBeLessThanOrEqual(0)
  })
}

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const) {
  test(`hero stacks copy above the vehicle without overlap at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/')

    const m = await page.evaluate(heroBoxes)
    expect(m.principles.bottom).toBeLessThan(m.image.top)
    expect(m.lede.left).toBeGreaterThanOrEqual(0)
    expect(m.overflow).toBeLessThanOrEqual(0)
    await expect(
      page.getByRole('link', { name: 'Okulunu seç' }),
    ).toBeInViewport({
      ratio: 1,
    })

    const results = await new AxeBuilder({ page })
      .include('.discovery-hero')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

test('hero CTAs keep their keyboard order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, createMockApiState())
  await page.goto('/')

  await page.getByRole('link', { name: 'Okulunu seç' }).focus()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Talep panosunu keşfet' }),
  ).toBeFocused()
})
