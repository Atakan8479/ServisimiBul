import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const

test('public shell keeps real navigation accessible at every supported width', async ({
  page,
}) => {
  await installMockApi(page, createMockApiState())

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    await expect(
      page.getByRole('contentinfo').getByText('ServisimiBul'),
    ).toBeVisible()
    await expectNoOverflow(page)
    await expectAxeClean(page)

    if (viewport.width <= 768) {
      const toggle = page.getByRole('button', { name: 'Menü' })
      await toggle.click()
      await expect(
        page.getByRole('navigation', { name: 'Ana menü' }),
      ).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: 'Ana menü' })
          .getByRole('link', { name: 'Ana sayfa' }),
      ).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(toggle).toBeFocused()
    }
  }

  await page.setViewportSize(viewports[0])
  await page.goto('/')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await expectNoOverflow(page)
})

for (const account of [
  {
    email: 'operator@example.com',
    path: '/operator',
    title: 'Genel bakış',
    workspace: 'İşletmeci alanı',
  },
  {
    email: 'admin@example.com',
    path: '/admin/applications',
    title: 'İşletmeciler',
    workspace: 'Yönetim alanı',
  },
] as const) {
  test(`${account.workspace} uses the shared responsive shell`, async ({
    page,
  }) => {
    const state = createMockApiState()
    if (account.path === '/operator') {
      state.registered = true
      state.verified = true
      state.approvalStatus = 'APPROVED'
    }
    await installMockApi(page, state)
    await page.setViewportSize(viewports[0])
    await login(page, account.email)
    await page.goto(account.path)

    const breadcrumb = page.getByRole('navigation', { name: 'Sayfa yolu' })
    await expect(breadcrumb.getByText(account.workspace)).toBeVisible()
    await expect(breadcrumb.getByText(account.title)).toBeVisible()
    await expect(page.getByText(account.email).first()).toBeVisible()
    await expectNoOverflow(page)
    await expectAxeClean(page)

    await page.setViewportSize(viewports[2])
    await page.goto(account.path)
    const toggle = page.getByRole('button', { name: 'Menü' })
    await toggle.click()
    await expect(
      page.getByRole('dialog', { name: `${account.workspace} menüsü` }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Menüyü kapat' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(toggle).toBeFocused()
    await expectNoOverflow(page)
  })
}

async function login(page: Page, email: string) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(
    email.startsWith('admin') ? /\/admin\/applications$/ : /\/operator$/,
  )
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
