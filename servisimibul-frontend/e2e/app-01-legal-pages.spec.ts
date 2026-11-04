import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

for (const viewport of viewports) {
  test(`public terms scaffold stays accessible on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/terms')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Kullanım koşulları' }),
    ).toBeVisible()
    await expect(page.getByRole('status')).toContainText(
      'Kullanım koşulları henüz yayında değil',
    )
    await expect(page.getByRole('contentinfo')).toContainText(
      'Gizlilik ve kişisel veriler',
    )

    await expectNoHorizontalOverflow(page)
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
  })
}

test('parent and operator registration expose both public legal routes', async ({
  page,
}) => {
  for (const path of ['/parent/register', '/operator/register']) {
    await page.goto(path)

    await expect(
      page.getByRole('link', { name: 'Gizlilik ve kişisel veriler' }),
    ).toHaveAttribute('href', '/privacy/notice')
    await expect(
      page.getByRole('link', { name: 'Kullanım koşulları' }),
    ).toHaveAttribute('href', '/terms')
  }
})

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
