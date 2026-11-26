import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// Issue #322: the dotted route line and its four circles between the hero
// and the search card are gone; the hero-to-search seam stays unchanged.
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const

const screenshotDir = process.env.ISSUE322_SCREENSHOT_DIR

/** Frames the hero bottom with the search card ~70% down the viewport. */
async function shootSeam(page: Page) {
  if (!screenshotDir) return
  await page.evaluate(() => {
    const search = document.querySelector('#school-search')!
    const top = search.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: Math.max(0, top - window.innerHeight * 0.7),
      behavior: 'instant',
    })
  })
  await page.screenshot({
    path: `${screenshotDir}/hero-search-${page.viewportSize()!.width}.png`,
  })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}

for (const viewport of viewports) {
  test(`ROUTE322 hero has no decorative route line at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/')
    await expect(page.locator('.discovery-hero-visual img')).toBeVisible()
    await shootSeam(page)

    await expect(page.locator('.discovery-route-line')).toHaveCount(0)
    const hero = page.locator('.discovery-hero')
    // No other dashed rule or empty circular marker took its place.
    expect(
      await hero.evaluate(
        (element) =>
          [...element.querySelectorAll<HTMLElement>('*')].filter((node) => {
            const style = getComputedStyle(node)
            return (
              style.borderTopStyle === 'dashed' ||
              (node.childElementCount === 0 &&
                !node.textContent?.trim() &&
                style.borderRadius === '50%' &&
                node.getBoundingClientRect().width < 12 &&
                !node.closest('[class*="float"], figcaption'))
            )
          }).length,
      ),
    ).toBe(0)

    // Search card still overlaps the hero bottom as before, without clipping.
    const seam = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect()
      return {
        heroBottom: box('.discovery-hero').bottom,
        imageBottom: box('.discovery-hero-visual img').bottom,
        searchTop: box('#school-search').top,
        searchLeft: box('#school-search').left,
        searchRight: box('#school-search').right,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    expect(seam.searchTop).toBeLessThan(seam.heroBottom)
    expect(seam.searchTop).toBeGreaterThanOrEqual(seam.imageBottom - 1)
    expect(seam.searchLeft).toBeGreaterThanOrEqual(0)
    expect(seam.searchRight).toBeLessThanOrEqual(viewport.width)
    expect(seam.overflow).toBeLessThanOrEqual(0)

    // The search steps and anchor navigation are untouched.
    await expect(page.locator('.discovery-search-steps li')).toHaveCount(3)
    await page.getByRole('link', { name: 'Okulunuzu seçin' }).click()
    await expect(page).toHaveURL(/#school-search$/)
    await expect(page.locator('#school-search')).toBeInViewport()

    const results = await new AxeBuilder({ page })
      .include('.discovery-hero')
      .include('#school-search')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

test('ROUTE322 keyboard order runs from hero actions into the search card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, createMockApiState())
  await page.goto('/')

  const cta = page.getByRole('link', { name: 'Okulunuzu seçin' })
  await cta.focus()
  const order: string[] = []
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab')
    order.push(
      await page.evaluate(() => {
        const active = document.activeElement as HTMLElement
        return active.closest('#school-search')
          ? 'search'
          : active.closest('.discovery-hero')
            ? 'hero'
            : 'other'
      }),
    )
  }
  // Focus leaves the hero straight into the search card; nothing decorative
  // receives focus in between.
  const firstSearch = order.indexOf('search')
  expect(firstSearch).toBeGreaterThanOrEqual(0)
  expect(order.slice(0, firstSearch).every((area) => area === 'hero')).toBe(
    true,
  )
})
