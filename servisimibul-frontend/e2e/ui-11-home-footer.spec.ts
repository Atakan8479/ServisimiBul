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
  ['Giriş Yap', '/login'],
  ['Kayıt Ol', '/register'],
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

    // Footer layout (#324): header-aligned gutter, text on shared column
    // edges, four evenly spread desktop columns, single-line links.
    const layout = await page.evaluate(() => {
      const textLeft = (element: Element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getBoundingClientRect().left
      }
      const groups = [...document.querySelectorAll('.site-footer-group')]
      return {
        headerBrand: document
          .querySelector('.site-header .brand')!
          .getBoundingClientRect().left,
        footerBrand: document
          .querySelector('.site-footer-brand')!
          .getBoundingClientRect().left,
        tagline: textLeft(document.querySelector('.site-footer-tagline')!),
        labels: groups.map((group) =>
          textLeft(group.querySelector('.site-footer-group-label')!),
        ),
        firstLinks: groups.map((group) => textLeft(group.querySelector('a')!)),
        linkHeights: groups.flatMap((group) =>
          [...group.querySelectorAll('a')].map(
            (link) => link.getBoundingClientRect().height,
          ),
        ),
      }
    })
    layout.labels.forEach((labelLeft, index) =>
      expect(Math.abs(labelLeft - layout.firstLinks[index])).toBeLessThan(1),
    )
    if (viewport.width >= 768) {
      expect(
        Math.abs(layout.footerBrand - layout.headerBrand),
      ).toBeLessThanOrEqual(2)
      for (const height of layout.linkHeights) {
        expect(height).toBeLessThanOrEqual(40)
      }
    } else {
      // Stacked: group text shares the brand/tagline edge.
      expect(Math.abs(layout.labels[0] - layout.tagline)).toBeLessThan(1)
    }
    if (viewport.width >= 1440) {
      const columns = [layout.tagline, ...layout.labels]
      const steps = columns.slice(1).map((left, i) => left - columns[i])
      for (const step of steps) {
        expect(step).toBeGreaterThan(viewport.width * 0.2)
        expect(Math.abs(step - steps[0])).toBeLessThanOrEqual(8)
      }
    }

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

    // Group labels keep their own compact style (not the tagline's).
    const label = await footerNav
      .locator('.site-footer-group-label')
      .first()
      .evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          fontSize: parseFloat(computed.fontSize),
          marginTop: parseFloat(computed.marginTop),
        }
      })
    expect(label.fontSize).toBeLessThan(styles.fontSize)
    expect(label.marginTop).toBe(0)
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
