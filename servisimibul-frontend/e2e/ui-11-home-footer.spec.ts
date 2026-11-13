import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const

const footerLinks = [
  ['Ana sayfa', '/'],
  ['Talep panosu', '/demands'],
  ['Veli kaydı', '/parent/register'],
  ['İşletmeci kaydı', '/operator/register'],
  ['Gizlilik ve kişisel veriler', '/privacy/notice'],
  ['Kullanım koşulları', '/terms'],
  ['Kişisel veri başvuru yolu', '/privacy/requests'],
] as const

for (const viewport of viewports) {
  test(`homepage drops the three-step section and keeps a light footer nav at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'Okul servisini birlikte bulalım.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Üç adımda servis keşfi' }),
    ).toHaveCount(0)
    await expect(page.locator('.discovery-how')).toHaveCount(0)
    // Primary discovery and the demand-board callout stay in place.
    await expect(page.getByLabel('Okulun bulunduğu il')).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Okulunuzda servis seçeneği bulamadınız mı?',
      }),
    ).toBeVisible()
    // Every in-page anchor still resolves to an element.
    const brokenAnchors = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
        .map((anchor) => anchor.getAttribute('href')!.slice(1))
        .filter((id) => id && !document.getElementById(id)),
    )
    expect(brokenAnchors).toEqual([])

    const footerNav = page
      .getByRole('contentinfo')
      .getByRole('navigation', { name: 'Alt menü' })
    await footerNav.scrollIntoViewIfNeeded()
    for (const [name, href] of footerLinks) {
      const link = footerNav.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', href)
      const box = (await link.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    }
    await expect(
      footerNav.getByRole('link', { name: 'Ana sayfa' }),
    ).toHaveAttribute('aria-current', 'page')

    // Footer links stay quieter than the primary heading and not fixed.
    const styles = await footerNav
      .getByRole('link', { name: 'Talep panosu' })
      .evaluate((element) => {
        const footer = element.closest('footer')!
        return {
          fontSize: parseFloat(getComputedStyle(element).fontSize),
          footerPosition: getComputedStyle(footer).position,
        }
      })
    expect(styles.fontSize).toBeLessThanOrEqual(16)
    expect(styles.footerPosition).not.toBe('fixed')
    expect(styles.footerPosition).not.toBe('sticky')

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0)

    const results = await new AxeBuilder({ page })
      .include('footer')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

test('footer links are reachable and operable with the keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, createMockApiState())
  await page.goto('/')

  const footerNav = page.getByRole('navigation', { name: 'Alt menü' })
  const demandsLink = footerNav.getByRole('link', { name: 'Talep panosu' })
  await footerNav.getByRole('link', { name: 'Ana sayfa' }).focus()
  await page.keyboard.press('Tab')
  await expect(demandsLink).toBeFocused()
  const outline = await demandsLink.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  )
  expect(outline).not.toBe('none')

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/demands$/)
  await expect(
    page
      .getByRole('navigation', { name: 'Alt menü' })
      .getByRole('link', { name: 'Talep panosu' }),
  ).toHaveAttribute('aria-current', 'page')
})
