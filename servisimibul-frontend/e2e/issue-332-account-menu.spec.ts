import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const

for (const viewport of viewports) {
  test(`parent account menu stays accessible without overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await signIn(page)

    const navigation = page.getByRole('navigation', { name: 'Ana menü' })
    if (viewport.width <= 1024) {
      await page.getByRole('button', { name: 'Menü' }).click()
    }

    await expect(
      navigation.getByRole('link', { name: 'Ana sayfa' }),
    ).toBeVisible()
    await expect(
      navigation.getByRole('link', { name: 'Talep panosu' }),
    ).toBeVisible()
    await expect(
      navigation.getByRole('link', { name: 'Bildirim merkezi' }),
    ).toBeVisible()
    await expect(page.locator('.nav-session')).toHaveCount(0)

    const trigger = navigation.getByRole('button', { name: 'Hesabım' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const accountMenu = navigation.getByRole('group', { name: 'Hesabım' })
    await expect(accountMenu.getByText('Veli oturumu açık')).toBeVisible()
    await expect(
      accountMenu.getByRole('link', { name: 'Hesap ve gizlilik' }),
    ).toHaveAttribute('href', '/parent/account')
    await expect(
      accountMenu.getByRole('button', { name: 'Çıkış yap' }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])

    await accountMenu.getByRole('link', { name: 'Hesap ve gizlilik' }).focus()
    await page.keyboard.press('Escape')
    await expect(accountMenu).toBeHidden()
    await expect(trigger).toBeFocused()
    if (viewport.width <= 1024) {
      await expect(page.getByRole('dialog', { name: 'Ana menü' })).toBeVisible()
    }
  })
}

test('desktop account menu closes on outside click', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, createMockApiState())
  await signIn(page)

  await page.getByRole('button', { name: 'Hesabım' }).click()
  const accountMenu = page.getByRole('group', { name: 'Hesabım' })
  await expect(accountMenu).toBeVisible()
  await page.getByRole('heading', { level: 1 }).click()
  await expect(accountMenu).toBeHidden()
})

async function signIn(page: Page) {
  await page.goto('/parent/login')
  await page.getByLabel('E-posta').fill('parent@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.locator('.account-menu-trigger')).toBeAttached()
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
