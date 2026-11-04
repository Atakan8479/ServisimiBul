import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

for (const viewport of viewports) {
  test(`public request form fails closed on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/privacy/requests')

    await expectRequestFormToFailClosed(page)
    await expect(page.getByRole('status')).toContainText(
      'Başvuru kanalı henüz onaylanmadı',
    )
    await assertAccessibleAndContained(page)
  })
}

for (const role of [
  {
    accountPath: '/parent/account',
    email: 'parent@example.com',
    landing: /\/demands$/,
    login: '/parent/login',
    requestPath: '/parent/privacy/requests/new',
  },
  {
    accountPath: '/operator/account',
    email: 'operator@example.com',
    landing: /\/operator$/,
    login: '/operator/login',
    requestPath: '/operator/privacy/requests/new',
  },
] as const) {
  test(`${role.email} reaches the same gated form from account settings`, async ({
    page,
  }) => {
    await signIn(page, role)
    await page.goto(role.accountPath)
    await page.getByRole('link', { name: 'Formu görüntüle' }).click()

    await expect(page).toHaveURL(role.requestPath)
    await expectRequestFormToFailClosed(page)
    await expect(
      page.getByRole('link', { name: 'Hesap ve gizlilik sayfasına dön' }),
    ).toHaveAttribute('href', role.accountPath)
    await assertAccessibleAndContained(page)
  })
}

async function expectRequestFormToFailClosed(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Kişisel veri başvuru formu' }),
  ).toBeVisible()
  await expect(page.getByLabel('Başvuru konusu')).toBeDisabled()
  await expect(page.getByLabel('Başvurunuzu açıklayın')).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Başvuruyu gönder' }),
  ).toBeDisabled()
  await expect(
    page.getByText('Form şu anda bilgi göndermez veya kaydetmez.'),
  ).toBeVisible()
}

async function signIn(
  page: Page,
  role: {
    email: string
    landing: RegExp
    login: string
  },
) {
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
