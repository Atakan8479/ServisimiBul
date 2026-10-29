import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const

for (const viewport of viewports) {
  test(`shared navigation adapts without overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    const state = createMockApiState()
    state.registered = true
    state.verified = true
    state.approvalStatus = 'APPROVED'
    state.operatorSchoolAdded = true
    state.generalCoverage = [101]

    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await page.goto('/')

    const publicToggle = page.getByRole('button', { name: 'Menü' })
    const publicNavigation = page.getByRole('navigation', { name: 'Ana menü' })
    if (viewport.width <= 1024) {
      await expect(publicToggle).toBeVisible()
      await publicToggle.click()
      await expect(publicToggle).toHaveAttribute('aria-expanded', 'true')
      await expect(
        publicNavigation.getByRole('link', { name: 'Veli girişi' }),
      ).toBeVisible()
      await expect(
        publicNavigation.getByRole('link', { name: 'Veli kaydı' }),
      ).toBeVisible()
      await expect(
        publicNavigation.getByRole('link', { name: 'İşletmeci girişi' }),
      ).toBeVisible()
      await publicNavigation
        .getByRole('link', { name: 'Talep panosu', exact: true })
        .click()
      await expect(publicToggle).toHaveAttribute('aria-expanded', 'false')
    } else {
      await expect(publicToggle).toBeHidden()
      await expect(publicNavigation).toBeVisible()
    }
    await expectNoHorizontalOverflow(page)

    await login(page)
    const workspaceToggle = page.getByRole('button', {
      name: 'Menü',
      exact: true,
    })
    const sidebar = page.locator('.workspace-sidebar')
    if (viewport.width <= 704) {
      await expect(workspaceToggle).toBeVisible()
      await workspaceToggle.click()
      await expect(sidebar).toHaveClass(/open/)
      await page.getByRole('link', { name: 'Profil ve başvuru' }).click()
      await expect(sidebar).not.toHaveClass(/open/)
    } else {
      await expect(workspaceToggle).toBeHidden()
      await expect(sidebar).toBeVisible()
    }
    await expectNoHorizontalOverflow(page)
  })
}

test('mobile workspace drawer contains and restores keyboard focus', async ({
  page,
}) => {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]

  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, state)
  await login(page)

  const toggle = page.getByRole('button', { name: 'Menü', exact: true })
  await toggle.click()
  const drawer = page.getByRole('dialog', { name: 'İşletmeci alanı menüsü' })
  const close = drawer.getByRole('button', { name: 'Menüyü kapat' })
  const home = drawer.getByRole('link', { name: 'ServisimiBul ana sayfa' })
  const signOut = drawer.getByRole('button', { name: 'Çıkış yap' })
  await expect(close).toBeFocused()
  await expect(page.locator('.workspace-content')).toHaveAttribute('inert', '')

  await signOut.focus()
  await page.keyboard.press('Tab')
  await expect(home).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(signOut).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()

  await toggle.click()
  await page.mouse.click(380, 400)
  await expect(toggle).toBeFocused()

  await toggle.click()
  await drawer.getByRole('link', { name: 'Profil ve başvuru' }).click()
  await expect(
    page.getByRole('heading', { name: 'İşletme bilgileriniz' }),
  ).toBeFocused()
})

async function login(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
