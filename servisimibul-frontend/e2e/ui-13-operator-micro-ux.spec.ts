import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  createMockApiState,
  installMockApi,
  type MockApiState,
} from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow', width: 320, height: 640 },
] as const

const operatorNav = [
  { name: 'Profil ve başvuru', url: /\/operator\/profile$/ },
  { name: 'Okullar ve kapsam', url: /\/operator\/schools$/ },
  { name: 'Araçlar ve servisler', url: /\/operator\/offerings$/ },
  { name: 'Hesap ve gizlilik', url: /\/operator\/account$/ },
  { name: 'Genel bakış', url: /\/operator$/ },
] as const

const adminNav = [
  { name: 'Okullar', url: /\/admin\/schools$/ },
  { name: 'UKOME tarifesi', url: /\/admin\/tariffs$/ },
  { name: 'Moderasyon', url: /\/admin\/moderation$/ },
  { name: 'Başvurular', url: /\/admin\/applications$/ },
] as const

for (const viewport of viewports) {
  // The workspace switches to a drawer at the 44rem breakpoint.
  const drawer = viewport.width <= 704

  test.describe(`operator micro-UX at ${viewport.width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
    })

    test('home link sits directly above sign-out at the sidebar bottom', async ({
      page,
    }) => {
      await installMockApi(page, approvedState())
      await operatorLogin(page)
      if (drawer) await openMenu(page)
      const sidebar = page.locator('.workspace-sidebar')
      const home = sidebar.getByRole('link', { name: 'Ana sayfaya dön' })
      const signOut = sidebar.getByRole('button', { name: 'Çıkış yap' })
      await expect(home).toBeVisible()
      await expect(signOut).toBeVisible()

      const homeBox = await home.boundingBox()
      const signOutBox = await signOut.boundingBox()
      const navBox = await sidebar.locator('nav').boundingBox()
      expect(homeBox && signOutBox && navBox).toBeTruthy()
      if (!homeBox || !signOutBox || !navBox) return

      const gap = signOutBox.y - (homeBox.y + homeBox.height)
      expect(gap).toBeGreaterThanOrEqual(0)
      expect(gap).toBeLessThanOrEqual(16)
      // The footer follows the navigation without overlapping it.
      expect(homeBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height)
      if (viewport.height >= 800) {
        // With room to spare, the footer is pushed to the sidebar bottom.
        expect(homeBox.y - (navBox.y + navBox.height)).toBeGreaterThan(48)
      }
    })

    test('operator sidebar navigates to every workspace section', async ({
      page,
    }) => {
      const state = approvedState()
      state.operatorSchoolAdded = true
      await installMockApi(page, state)
      await operatorLogin(page)
      await assertSidebarNavigation(page, operatorNav)
    })

    test('admin sidebar navigates to every workspace section', async ({
      page,
    }) => {
      await installMockApi(page, approvedState())
      await adminLogin(page)
      await assertSidebarNavigation(page, adminNav)
    })

    test('visibility switch is readable and toggles both states', async ({
      page,
    }) => {
      await installMockApi(page, approvedState())
      await operatorLogin(page)
      await page.goto('/operator/profile')
      const row = page.locator('.operator-profile-visibility')
      const visibility = page.getByRole('switch', {
        name: /Profil görünürlük tercihi/,
      })
      const state = page.locator('.operator-profile-visibility-state')
      await expect(visibility).toBeEnabled()
      await expect(visibility).toBeChecked()
      await expect(state).toHaveText('Açık')
      const onBackground = await backgroundOf(visibility)
      expect(onBackground).toBe('rgb(6, 107, 112)')

      await visibility.click()
      await expect(visibility).not.toBeChecked()
      await expect(state).toHaveText('Kapalı')
      await expect.poll(() => backgroundOf(visibility)).not.toBe(onBackground)

      // Keyboard: Space toggles, focus ring is visible.
      await visibility.focus()
      await page.keyboard.press('Space')
      await expect(visibility).toBeChecked()
      await expect(state).toHaveText('Açık')
      await expect(visibility).toBeFocused()
      const outline = await visibility.evaluate((element) => {
        const style = getComputedStyle(element)
        return { style: style.outlineStyle, width: style.outlineWidth }
      })
      expect(outline.style).toBe('solid')
      expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2)

      await assertContained(page, row, visibility, state)
      const results = await new AxeBuilder({ page })
        .include('.operator-profile-visibility')
        .withRules(['color-contrast', 'label', 'aria-allowed-role'])
        .analyze()
      expect(results.violations).toEqual([])
    })

    test('visibility switch is disabled while the application is pending', async ({
      page,
    }) => {
      const state = approvedState()
      state.approvalStatus = 'PENDING'
      await installMockApi(page, state)
      await operatorLogin(page)
      await page.goto('/operator/profile')
      const row = page.locator('.operator-profile-visibility')
      const visibility = page.getByRole('switch', {
        name: /Profil görünürlük tercihi/,
      })
      const label = page.locator('.operator-profile-visibility-state')
      await expect(visibility).toBeDisabled()
      await expect(visibility).toBeChecked()
      await expect(label).toHaveText('Açık')
      await expect(visibility).toHaveCSS('cursor', 'not-allowed')

      await visibility.click({ force: true })
      await expect(visibility).toBeChecked()
      await expect(label).toHaveText('Açık')
      await assertContained(page, row, visibility, label)
    })

    test('schools empty-state CTA is spaced and opens the add dialog', async ({
      page,
    }) => {
      await installMockApi(page, approvedState())
      await operatorLogin(page)
      await page.goto('/operator/schools')
      const empty = page.locator('.empty-state')
      await expect(
        empty.getByRole('heading', { name: 'Henüz okul eklenmedi' }),
      ).toBeVisible()
      const cta = empty.getByRole('button', { name: 'İlk okulunuzu ekleyin' })
      const copyBox = await empty.locator('p').boundingBox()
      const ctaBox = await cta.boundingBox()
      expect(copyBox && ctaBox).toBeTruthy()
      if (!copyBox || !ctaBox) return
      expect(ctaBox.y - (copyBox.y + copyBox.height)).toBeGreaterThanOrEqual(16)
      expect(ctaBox.x).toBeGreaterThanOrEqual(0)
      expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(viewport.width)

      await cta.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(cta).toBeFocused()
    })
  })
}

test.describe('mobile workspace drawer keyboard behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await installMockApi(page, approvedState())
    await operatorLogin(page)
  })

  test('opens from the keyboard, traps focus and restores it on Escape', async ({
    page,
  }) => {
    const toggle = page.getByRole('button', { name: 'Menü', exact: true })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const dialog = page.getByRole('dialog', { name: 'İşletmeci alanı menüsü' })
    await expect(dialog).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Menüyü kapat' }),
    ).toBeFocused()

    const signOut = dialog.getByRole('button', { name: 'Çıkış yap' })
    await signOut.focus()
    await page.keyboard.press('Tab')
    expect(await focusInside(page, '.workspace-sidebar')).toBe(true)
    await page.keyboard.press('Shift+Tab')
    await expect(signOut).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
  })

  test('activating a nav link from the keyboard navigates and closes the drawer', async ({
    page,
  }) => {
    const toggle = page.getByRole('button', { name: 'Menü', exact: true })
    await toggle.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'İşletmeci alanı menüsü' })
    const profile = dialog.getByRole('link', { name: 'Profil ve başvuru' })
    await profile.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/operator\/profile$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(
      page.getByRole('heading', { level: 1, name: 'İşletme profilim' }),
    ).toBeVisible()
  })
})

async function assertSidebarNavigation(
  page: Page,
  items: ReadonlyArray<{ name: string; url: RegExp }>,
) {
  const drawer = (page.viewportSize()?.width ?? 1440) <= 704
  for (const item of items) {
    if (drawer) await openMenu(page)
    const nav = page.locator('.workspace-sidebar nav')
    await nav.getByRole('link', { name: item.name, exact: true }).click()
    await expect(page).toHaveURL(item.url)
    // A CSS locator still resolves the link while the closed drawer is inert.
    await expect(
      nav.locator('a', { hasText: new RegExp(`^${item.name}$`) }),
    ).toHaveAttribute('aria-current', 'page')
    if (drawer) {
      await expect(
        page.getByRole('button', { name: 'Menü', exact: true }),
      ).toHaveAttribute('aria-expanded', 'false')
    }
  }
}

async function assertContained(
  page: Page,
  row: ReturnType<Page['locator']>,
  control: ReturnType<Page['locator']>,
  label: ReturnType<Page['locator']>,
) {
  const [rowBox, controlBox, labelBox] = await Promise.all([
    row.boundingBox(),
    control.boundingBox(),
    label.boundingBox(),
  ])
  expect(rowBox && controlBox && labelBox).toBeTruthy()
  if (!rowBox || !controlBox || !labelBox) return
  // The state label and the switch sit side by side inside the row.
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(controlBox.x + 1)
  for (const box of [controlBox, labelBox]) {
    expect(box.x).toBeGreaterThanOrEqual(rowBox.x - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1)
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

function backgroundOf(locator: ReturnType<Page['locator']>) {
  return locator.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
}

function focusInside(page: Page, selector: string) {
  return page.evaluate(
    (target) => !!document.activeElement?.closest(target),
    selector,
  )
}

async function openMenu(page: Page) {
  const toggle = page.getByRole('button', { name: 'Menü', exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

function approvedState(): MockApiState {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = false
  return state
}

async function operatorLogin(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}

async function adminLogin(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('admin@example.com')
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/admin\/applications$/)
}
