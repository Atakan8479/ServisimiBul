import { expect, test, type Locator, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const transformOf = (target: Locator) =>
  target.evaluate((node) => getComputedStyle(node).transform)

test('navigation links and buttons stay in place on hover and press in', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, createMockApiState())
  await page.goto('/demands')

  const navLink = page.locator('.site-nav a').first()
  const restingBackground = await navLink.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  )
  await navLink.hover()
  await expect
    .poll(() =>
      navLink.evaluate((node) => getComputedStyle(node).backgroundColor),
    )
    .not.toBe(restingBackground)
  expect(await transformOf(navLink)).toBe('none')

  const button = page.locator('.button-link:visible').first()
  await button.hover()
  await expect
    .poll(() => button.evaluate((node) => getComputedStyle(node).filter))
    .toBe('brightness(0.94)')
  expect(await transformOf(button)).toBe('none')

  await page.mouse.down()
  await expect
    .poll(() => transformOf(button))
    .toBe('matrix(0.98, 0, 0, 0.98, 0, 0)')
  await page.mouse.move(0, 0)
  await page.mouse.up()
})

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`public, operator and admin dialogs open and close with motion: ${reducedMotion}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion })
    const state = createMockApiState()
    state.registered = true
    state.verified = true
    state.approvalStatus = 'APPROVED'
    state.operatorSchoolAdded = true
    state.generalCoverage = [101]
    state.demandCreated = true
    await installMockApi(page, state)

    await page.goto('/demands')
    await assertDialogMotion(
      page,
      page.getByRole('button', { name: 'Önizlemeyi aç' }).first(),
      reducedMotion,
    )

    await login(page, 'operator@example.com')
    await page.goto('/operator/schools')
    await assertDialogMotion(
      page,
      page.getByRole('button', { name: 'Düzenle', exact: true }).first(),
      reducedMotion,
    )

    await page.context().clearCookies()
    await login(page, 'admin@example.com')
    await page.goto('/admin/schools')
    await assertDialogMotion(
      page,
      page.getByRole('button', { name: 'Düzenle' }).first(),
      reducedMotion,
    )
  })
}

async function login(page: Page, email: string) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function assertDialogMotion(
  page: Page,
  trigger: Locator,
  reducedMotion: 'no-preference' | 'reduce',
) {
  const animated = reducedMotion === 'no-preference'
  await page.evaluate(() => {
    const seen = { enter: false, exit: false }
    Object.assign(window, { dialogMotion: seen })
    document.addEventListener('transitionrun', (event) => {
      const target = event.target
      if (!(target instanceof HTMLDialogElement)) return
      if ('closing' in target.dataset) seen.exit = true
      else seen.enter = true
    })
  })

  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCSS('opacity', '1')
  await expect(dialog).toHaveCSS('transform', 'none')
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { dialogMotion: Record<string, boolean> })
          .dialogMotion,
    ),
  ).toEqual({ enter: animated, exit: animated })
}
