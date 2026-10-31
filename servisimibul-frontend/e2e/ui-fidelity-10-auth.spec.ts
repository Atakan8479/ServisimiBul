import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_10_CAPTURE

const routes = [
  {
    id: 'A07',
    path: '/forgot-password?from=parent',
    heading: 'Şifrenizi yenileyin',
  },
  {
    id: 'A08',
    path: '/reset-password?token=reset-token',
    heading: 'Yeni şifrenizi belirleyin',
  },
] as const

for (const viewport of viewports) {
  test(`A07-A08 remain accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)

    for (const route of routes) {
      await page.goto(route.path)
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible()
      if (stage === 'before') {
        await capture(page, `${route.id}-${viewport.name}`, viewport.name)
        continue
      }

      await expect(page.locator('.auth-experience')).toBeVisible()
      if (viewport.name === 'desktop') {
        await expect(page.locator('.auth-experience-visual')).toBeVisible()
      } else {
        await expect(page.locator('.auth-experience-visual')).toBeHidden()
      }

      if (route.id === 'A07') {
        await expect(page.getByLabel('E-posta')).toBeVisible()
        await expect(
          page.getByRole('link', { name: 'Giriş sayfasına dön' }),
        ).toHaveAttribute('href', '/parent/login')
      } else {
        await expect(page.getByLabel('Şifre yenileme kodu')).toHaveValue(
          'reset-token',
        )
        await expect(
          page.getByLabel('Yeni şifre', { exact: true }),
        ).toHaveAttribute('type', 'password')
        await expect(
          page.getByRole('link', { name: 'Yeni bağlantı iste' }),
        ).toHaveAttribute('href', '/forgot-password')
      }

      await assertAccessibleAndContained(page)
      await capture(page, `${route.id}-${viewport.name}`, viewport.name)
    }
  })
}

test('A07 posts the email and shows only the non-enumerating confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCsrf(page)
  let body: unknown
  await page.route('**/api/v1/auth/forgot-password', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 202 })
  })

  await page.goto('/forgot-password?from=operator')
  await page.getByLabel('E-posta').fill('kisi@example.test')
  await page.getByLabel('E-posta').press('Enter')

  await expect(page.getByRole('status')).toHaveText(
    /Hesap uygunsa şifre yenileme bağlantısı e-posta adresine gönderildi\./,
  )
  expect(body).toEqual({ email: 'kisi@example.test' })
  await expect(
    page.getByRole('link', { name: 'Giriş sayfasına dön' }),
  ).toHaveAttribute('href', '/operator/login')
  await assertAccessibleAndContained(page)
  await capture(page, 'state-A07-success-mobile', 'mobile')
})

test('A07 keeps validation visible and associated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/forgot-password')
  await page.getByRole('button', { name: 'Yenileme bağlantısı gönder' }).click()

  await expect(page.getByLabel('E-posta')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(
    page.getByText('Geçerli bir e-posta adresi girin.'),
  ).toBeVisible()
  await assertAccessibleAndContained(page)
  await capture(page, 'state-A07-validation-mobile', 'mobile')
})

test('A08 keeps the form and shows the backend rejection of a bad token', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCsrf(page)
  await page.route('**/api/v1/auth/reset-password', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/problem+json',
      json: {
        title: 'Bad Request',
        status: 400,
        detail: 'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş.',
        code: 'invalid_token',
      },
    }),
  )

  await page.goto('/reset-password?token=expired-token')
  await page
    .getByLabel('Yeni şifre', { exact: true })
    .fill('yeni guvenli sifre')
  await page.getByRole('button', { name: 'Şifreyi yenile' }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş.',
  )
  await expect(page.getByLabel('Yeni şifre', { exact: true })).toHaveValue(
    'yeni guvenli sifre',
  )
  await assertAccessibleAndContained(page)
  await capture(page, 'state-A08-invalid-token-mobile', 'mobile')
})

test('A08 posts the prefilled token and offers both login paths on success', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockCsrf(page)
  let body: unknown
  await page.route('**/api/v1/auth/reset-password', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 204 })
  })

  await page.goto('/reset-password?token=reset-token')
  await page
    .getByLabel('Yeni şifre', { exact: true })
    .fill('yeni guvenli sifre')
  await page.getByRole('button', { name: 'Parolayı göster' }).click()
  await expect(page.getByLabel('Yeni şifre', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await page.getByRole('button', { name: 'Şifreyi yenile' }).click()

  await expect(page.getByRole('status')).toContainText('Şifreniz yenilendi.')
  expect(body).toEqual({
    token: 'reset-token',
    newPassword: 'yeni guvenli sifre',
  })
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Veli girişi' })).toHaveAttribute(
    'href',
    '/parent/login',
  )
  await expect(
    main.getByRole('link', { name: 'İşletmeci veya yönetici girişi' }),
  ).toHaveAttribute('href', '/operator/login')
  await assertAccessibleAndContained(page)
  await capture(page, 'state-A08-success-desktop', 'desktop')
})

test('A08 is usable with the keyboard alone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/reset-password?token=reset-token')
  await page.getByLabel('Şifre yenileme kodu').focus()

  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Yeni şifre', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Parolayı göster' }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Şifreyi yenile' }),
  ).toBeFocused()
})

async function mockCsrf(page: Page) {
  await page.route('**/api/v1/auth/csrf', (route) =>
    route.fulfill({
      json: {
        headerName: 'X-CSRF-TOKEN',
        parameterName: '_csrf',
        token: 'csrf-token',
      },
    }),
  )
}

async function assertAccessibleAndContained(page: Page) {
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

async function capture(page: Page, name: string, viewport: string) {
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.scrollTo(0, 0)
  })
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-10/${stage}/${name}.png`,
  })
}
