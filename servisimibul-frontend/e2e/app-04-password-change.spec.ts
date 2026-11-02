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
    passwordPath: '/parent/account/password',
  },
  {
    email: 'operator@example.com',
    login: '/operator/login',
    landing: /\/operator$/,
    passwordPath: '/operator/account/password',
  },
] as const

for (const role of roles) {
  for (const viewport of viewports) {
    test(`password form is accessible and contained for ${role.email} on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page, role)
      await page.goto(role.passwordPath)

      await expect(
        page.getByRole('heading', { name: 'Şifreyi değiştir' }),
      ).toBeVisible()
      await expect(page.getByLabel('Mevcut şifre')).toBeVisible()
      await expect(page.getByLabel('Yeni şifre', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Yeni şifreyi tekrar girin')).toBeVisible()
      await assertAccessibleAndContained(page)
    })
  }
}

test('successful password change revokes the mocked session before login guidance', async ({
  page,
}) => {
  await signIn(page, roles[0])
  await page.goto(roles[0].passwordPath)
  await page.getByLabel('Mevcut şifre').fill('current password value')
  await page
    .getByLabel('Yeni şifre', { exact: true })
    .fill('new secure password value')
  await page
    .getByLabel('Yeni şifreyi tekrar girin')
    .fill('new secure password value')

  await page.getByRole('button', { name: 'Şifreyi güncelle' }).click()

  await expect(page).toHaveURL(/\/parent\/login\?passwordChanged=true$/)
  await expect(
    page.getByText(/Şifreniz güncellendi ve açık oturumlarınız sonlandırıldı/),
  ).toBeVisible()
  expect(
    await page.evaluate(async () => (await fetch('/api/v1/auth/me')).status),
  ).toBe(401)
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
