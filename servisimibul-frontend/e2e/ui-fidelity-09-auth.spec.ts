import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const routes = [
  {
    id: 'A04',
    path: '/operator/register',
    heading: 'İşletmenizi tanıtalım.',
  },
  {
    id: 'A05',
    path: '/operator/login',
    heading: 'İşletmeci paneline giriş',
  },
  {
    id: 'A06',
    path: '/operator/verify-email?token=email-token',
    heading: 'E-posta adresinizi doğrulayın',
  },
] as const

for (const viewport of viewports) {
  test(`A04-A06 remain accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)

    for (const route of routes) {
      await page.goto(route.path)
      const captureStage = process.env.UI_FIDELITY_09_CAPTURE
      await expect(page.locator('main h1')).toBeVisible()
      if (captureStage === 'before') {
        await assertAccessibleAndContained(page)
        await capture(page, route.id, viewport.name)
        continue
      }

      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible()
      await expect(page.locator('.auth-experience')).toBeVisible()
      if (viewport.name === 'desktop') {
        await expect(page.locator('.auth-experience-visual')).toBeVisible()
      } else {
        await expect(page.locator('.auth-experience-visual')).toBeHidden()
      }

      if (route.id === 'A04') {
        await expect(
          page.getByLabel('İşletme adı (isteğe bağlı)'),
        ).toBeVisible()
        await expect(
          page.getByLabel('Herkese açık iletişim telefonu'),
        ).toBeVisible()
        await expect(
          page.getByText(/Telefonunuz ve paylaştığınız işletme bilgileri/),
        ).toBeVisible()
      } else if (route.id === 'A05') {
        await expect(
          page.getByRole('button', { name: 'Parolayı göster' }),
        ).toBeVisible()
        await expect(page.getByLabel('Beni hatırla')).toBeVisible()
        await expect(
          page.getByRole('link', { name: 'Şifremi unuttum' }),
        ).toHaveAttribute('href', '/forgot-password?from=operator')
      } else {
        await expect(page.getByLabel('Doğrulama kodu')).toHaveValue(
          'email-token',
        )
        await expect(
          page.getByText(/E-postadaki bağlantı bu alanı otomatik doldurur/),
        ).toBeVisible()
      }

      await assertAccessibleAndContained(page)
      await capture(page, route.id, viewport.name)
    }
  })
}

test('A04 keeps production validation visible and associated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/operator/register')
  const captureStage = process.env.UI_FIDELITY_09_CAPTURE
  await page
    .getByRole('button', {
      name:
        captureStage === 'before'
          ? 'Hesap oluştur'
          : 'İşletmeci hesabı oluştur',
    })
    .click()

  await expect(
    page.getByText('Geçerli bir e-posta adresi girin.'),
  ).toBeVisible()
  await expect(
    page.getByText('Şifre en az 12 karakter olmalıdır.'),
  ).toBeVisible()
  await expect(page.getByText('İletişim telefonu zorunludur.')).toBeVisible()
  await expect(
    page.getByLabel('İşletme adı (isteğe bağlı)'),
  ).not.toHaveAttribute('aria-invalid', 'true')
  await assertAccessibleAndContained(page)

  const stage = captureStage
  if (stage === 'before' || stage === 'after') {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(100)
    await page.locator('main').screenshot({
      path: `../docs/screenshots/ui-fidelity-09/${stage}/state-A04-validation-mobile.png`,
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
  const stage = process.env.UI_FIDELITY_09_CAPTURE
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-09/${stage}/${surface}-${viewport}.png`,
  })
}
