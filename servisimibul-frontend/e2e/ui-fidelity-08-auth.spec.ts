import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const routes = [
  { id: 'A01', path: '/register', heading: 'Nasıl katılmak istersiniz?' },
  {
    id: 'A02',
    path: '/parent/register?next=%2Fdemands',
    heading: 'Veli hesabı oluşturun',
  },
  {
    id: 'A03',
    path: '/parent/login?next=%2Fdemands',
    heading: 'Yeniden hoş geldiniz.',
  },
] as const

for (const viewport of viewports) {
  test(`A01-A03 remain accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)

    for (const route of routes) {
      await page.goto(route.path)
      await expect(
        process.env.UI_FIDELITY_08_CAPTURE === 'before'
          ? page.locator('main h1')
          : page.getByRole('heading', { name: route.heading }),
      ).toBeVisible()
      await expect(page.locator('.auth-experience')).toBeVisible()
      if (viewport.name === 'desktop') {
        await expect(page.locator('.auth-experience-visual')).toBeVisible()
      } else {
        await expect(page.locator('.auth-experience-visual')).toBeHidden()
      }
      if (route.id === 'A01') {
        await expect(
          page.getByRole('link', { name: /Veli olarak/ }),
        ).toHaveAttribute('href', '/parent/register?next=%2Fdemands')
        await expect(
          page.getByRole('link', { name: /İşletmeci olarak/ }),
        ).toHaveAttribute('href', '/operator/register')
      } else {
        await expect(page.getByLabel('E-posta')).toBeVisible()
        await expect(
          page.getByRole('textbox', { name: 'Şifre', exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole('button', { name: 'Şifreyi göster' }),
        ).toBeVisible()
      }
      await assertAccessibleAndContained(page)
      await capture(page, route.id, viewport.name)
    }
  })
}

test('A02 keeps production validation visible and associated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/parent/register?next=%2Fdemands')
  await page.getByRole('button', { name: 'Veli hesabı oluştur' }).click()

  await expect(
    page.getByText('Geçerli bir e-posta adresi girin.'),
  ).toBeVisible()
  await expect(
    page.getByText('Şifre en az 12 karakter olmalıdır.'),
  ).toBeVisible()
  await expect(page.getByLabel('E-posta')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(
    page.getByRole('textbox', { name: 'Şifre', exact: true }),
  ).toHaveAttribute('aria-invalid', 'true')
  await assertAccessibleAndContained(page)

  const stage = process.env.UI_FIDELITY_08_CAPTURE
  if (stage === 'before' || stage === 'after') {
    await page.screenshot({
      fullPage: true,
      path: `../docs/screenshots/ui-fidelity-08/${stage}/state-A02-validation-mobile.png`,
    })
  }
})

async function assertAccessibleAndContained(
  page: import('@playwright/test').Page,
) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

async function capture(
  page: import('@playwright/test').Page,
  surface: (typeof routes)[number]['id'],
  viewport: (typeof viewports)[number]['name'],
) {
  const stage = process.env.UI_FIDELITY_08_CAPTURE
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-08/${stage}/${surface}-${viewport}.png`,
  })
}
