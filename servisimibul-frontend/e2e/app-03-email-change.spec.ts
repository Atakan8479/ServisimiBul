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
    account: '/parent/account',
    emailPath: '/parent/account/email',
  },
  {
    email: 'operator@example.com',
    login: '/operator/login',
    landing: /\/operator$/,
    account: '/operator/account',
    emailPath: '/operator/account/email',
  },
] as const

for (const role of roles) {
  for (const viewport of viewports) {
    test(`email form is accessible for ${role.email} on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      const state = createMockApiState()
      state.verified = true
      state.approvalStatus = 'APPROVED'
      state.emailChangeAvailable = true
      await installMockApi(page, state)
      await signIn(page, role)
      await page.goto(role.emailPath)

      await expect(
        page.getByRole('heading', { name: 'E-posta adresini değiştir' }),
      ).toBeVisible()
      await expect(page.getByLabel('Yeni e-posta adresi')).toBeVisible()
      await assertAccessibleAndContained(page)
    })
  }
}

test('disabled delivery keeps the account action unavailable', async ({
  page,
}) => {
  const state = createMockApiState()
  state.verified = true
  state.approvalStatus = 'APPROVED'
  await installMockApi(page, state)
  await signIn(page, roles[1])
  await page.goto(roles[1].account)

  await expect(
    page.getByText(
      /E-posta teslimi ve gerekli hukuki kararlar tamamlanana kadar/,
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Kullanılamıyor' }).first(),
  ).toBeDisabled()
})

test('enabled request and confirmation preserve honest state transitions', async ({
  page,
}) => {
  const state = createMockApiState()
  state.verified = true
  state.emailChangeAvailable = true
  await installMockApi(page, state)
  await signIn(page, roles[0])
  await page.goto(roles[0].emailPath)
  await page.getByLabel('Yeni e-posta adresi').fill('new@example.com')
  await page.getByRole('button', { name: 'Doğrulama isteği oluştur' }).click()

  await expect(
    page.getByRole('heading', { name: 'İstek alındı' }),
  ).toBeVisible()
  await expect(page.getByText(/mevcut e-postanız değişmez/)).toBeVisible()

  await page.goto('/verify-email-change?token=test-token')
  await page
    .getByRole('button', { name: 'E-posta değişikliğini doğrula' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'E-posta adresiniz değiştirildi' }),
  ).toBeVisible()
})

async function signIn(page: Page, role: (typeof roles)[number]) {
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
