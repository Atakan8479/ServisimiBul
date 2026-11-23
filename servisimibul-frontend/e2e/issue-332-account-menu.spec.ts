import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
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
    // Measured against the trigger so the mobile drawer's slide-in does not count.
    const chevronCenter = () =>
      trigger.evaluate((button) => {
        const box = button.getBoundingClientRect()
        const path = button.querySelector('path')!.getBoundingClientRect()
        return {
          x: path.x + path.width / 2 - box.x,
          y: path.y + path.height / 2 - box.y,
        }
      })
    const closedChevron = await chevronCenter()
    await trigger.focus()
    await page.keyboard.press('Enter')
    const accountMenu = navigation.getByRole('group', { name: 'Hesabım' })
    await expect(accountMenu.getByText('Veli oturumu açık')).toBeVisible()
    await expect(accountMenu).toHaveCSS('opacity', '1')
    const openChevron = await chevronCenter()
    expect(Math.abs(openChevron.x - closedChevron.x)).toBeLessThan(0.5)
    expect(Math.abs(openChevron.y - closedChevron.y)).toBeLessThan(0.5)

    const panelBox = (await accountMenu.boundingBox())!
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width)
    if (viewport.width > 1024) {
      const headerBox = (await page.locator('.site-header').boundingBox())!
      const triggerBox = (await trigger.boundingBox())!
      const gap = panelBox.y - (headerBox.y + headerBox.height)
      expect(gap).toBeGreaterThanOrEqual(8)
      expect(gap).toBeLessThanOrEqual(12)
      expect(
        Math.abs(
          panelBox.x + panelBox.width - (triggerBox.x + triggerBox.width),
        ),
      ).toBeLessThan(1)
    }
    expect(
      await accountMenu.evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(',')
          .map((duration) => duration.trim()),
      ),
    ).toContain('0.2s')
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

test('reduced motion opens and closes the account menu without a transition', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page, createMockApiState())
  await signIn(page)

  const trigger = page.getByRole('button', { name: 'Hesabım' })
  await trigger.click()
  const accountMenu = page.getByRole('group', { name: 'Hesabım' })
  await expect(accountMenu).toBeVisible()
  expect(
    await accountMenu.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .every((duration) => duration.trim() === '0s'),
    ),
  ).toBe(true)

  await trigger.click()
  await expect(page.locator('#account-menu-panel')).toHaveCount(0)
})

test('account menu shows one focus ring for keyboard users only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, createMockApiState())
  await signIn(page)

  const trigger = page.getByRole('button', { name: 'Hesabım' })
  const ring = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        visible: element.matches(':focus-visible'),
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        userSelect: style.userSelect,
      }
    })

  await trigger.click()
  await page.keyboard.press('Control')
  expect((await ring(trigger)).visible).toBe(false)

  const accountMenu = page.getByRole('group', { name: 'Hesabım' })
  const link = accountMenu.getByRole('link', { name: 'Hesap ve gizlilik' })
  const signOut = accountMenu.getByRole('button', { name: 'Çıkış yap' })
  const separator = () =>
    signOut.evaluate((element) => getComputedStyle(element).borderTopColor)
  const restingSeparator = await separator()
  await link.focus()
  await page.keyboard.press('Tab')
  await expect(signOut).toBeFocused()
  const buttonRing = await ring(signOut)
  const focusedSeparator = await separator()
  await page.keyboard.press('Shift+Tab')
  await expect(link).toBeFocused()
  const linkRing = await ring(link)

  expect(buttonRing.visible).toBe(true)
  expect(buttonRing.outline).toMatch(/^solid 2px/)
  expect(linkRing.outline).toBe(buttonRing.outline)
  expect(buttonRing.userSelect).toBe('none')
  expect(focusedSeparator).toBe(restingSeparator)
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
