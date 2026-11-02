import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const roles = [
  {
    email: 'parent@example.com',
    login: '/parent/login',
    landing: /\/demands$/,
    path: '/parent/account',
    roleLabel: 'Veli',
  },
  {
    email: 'operator@example.com',
    login: '/operator/login',
    landing: /\/operator$/,
    path: '/operator/account',
    roleLabel: 'İşletmeci',
  },
] as const

for (const role of roles) {
  for (const viewport of viewports) {
    test(`${role.roleLabel} account stays accessible and contained on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page, role)
      await page.goto(role.path)

      await expect(
        page.getByRole('heading', { name: 'Hesap ve gizlilik' }),
      ).toBeVisible()
      await expect(page.getByText(role.email).last()).toBeVisible()
      await expect(page.locator('.account-facts dd').last()).toHaveText(
        role.roleLabel,
      )
      await expect(
        page.getByRole('button', { name: 'Kullanılamıyor' }),
      ).toHaveCount(4)
      await expect(page.getByRole('link', { name: 'Değiştir' })).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Oturumları sonlandır' }),
      ).toBeVisible()
      await assertAccessibleAndContained(page)
      if (
        process.env.APP_02_CAPTURE &&
        (viewport.name === 'desktop' || viewport.name === 'mobile')
      ) {
        await page.screenshot({
          fullPage: true,
          path: `../.impeccable/review/app-02-${role.roleLabel}-${viewport.name}.png`,
        })
      }
    })
  }
}

test('operator account keeps public profile management separate', async ({
  page,
}) => {
  await signIn(page, roles[1])
  await page.goto('/operator/account')

  await expect(
    page.getByRole('link', { name: 'İşletme profiline git' }),
  ).toHaveAttribute('href', '/operator/profile')
  await page.getByRole('link', { name: 'İşletme profiline git' }).click()
  await expect(page).toHaveURL(/\/operator\/profile$/)
  await expect(
    page.getByRole('heading', { name: 'İşletme profilim' }),
  ).toBeVisible()
})

async function signIn(page: Page, role: (typeof roles)[number]) {
  const state = createMockApiState()
  state.verified = true
  state.approvalStatus = 'APPROVED'
  await installMockApi(page, state)
  await page.goto(role.login)
  await page.getByLabel('E-posta').fill(role.email)
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(role.landing)
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
