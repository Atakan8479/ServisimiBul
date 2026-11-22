import { expect, test, type Locator, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// #320: every shell renders the approved ServisimiBul mark (not the old CSS pin).
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const

const screenshotDir = process.env.BRAND_SCREENSHOT_DIR

test('public header and footer show the approved mark at every width', async ({
  page,
}) => {
  await installMockApi(page, createMockApiState())

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const homeLink = page
      .getByRole('banner')
      .getByRole('link', { name: 'ServisimiBul ana sayfa' })
    await expectApprovedMark(homeLink.locator('.brand-mark'))
    await expect(homeLink.locator('.brand-mark')).toHaveCount(1)
    await expectApprovedMark(page.locator('.site-footer .brand-mark'))
    await expectNoOverflow(page)

    if (viewport.width <= 384) {
      await expect(homeLink.locator('.brand-wordmark')).toBeHidden()
    } else {
      await expect(homeLink.locator('.brand-wordmark')).toHaveText(
        'ServisimiBul',
      )
    }

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(homeLink).toBeFocused()

    await shoot(page, `public-${viewport.width}`)
  }
})

for (const account of [
  { email: 'operator@example.com', path: '/operator', name: 'operator' },
  { email: 'admin@example.com', path: '/admin/applications', name: 'admin' },
] as const) {
  test(`${account.name} workspace sidebar shows the approved mark`, async ({
    page,
  }) => {
    const state = createMockApiState()
    state.registered = true
    state.verified = true
    state.approvalStatus = 'APPROVED'
    await installMockApi(page, state)
    await page.setViewportSize(viewports[0])
    await login(page, account.email)

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto(account.path)
      const sidebar = page.locator('.workspace-sidebar')

      if (viewport.width <= 704) {
        await page.getByRole('button', { name: 'Menü' }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
      }

      await expectApprovedMark(sidebar.locator('.brand-mark'))
      await expect(page.locator('.brand-mark:visible')).toHaveCount(1)
      await expectNoOverflow(page)
      await shoot(page, `${account.name}-${viewport.width}`)
    }
  })
}

async function expectApprovedMark(mark: Locator) {
  await expect(mark).toBeVisible()
  await expect(mark).toHaveAttribute('alt', '')
  await expect(mark).toHaveAttribute('src', /servisimibul-mark.*\.png/)
  const metrics = await mark.evaluate((element) => {
    const image = element as HTMLImageElement
    const box = image.getBoundingClientRect()
    return {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: box.width,
      height: box.height,
      right: box.right,
    }
  })
  expect(metrics.complete).toBe(true)
  expect(metrics.naturalWidth).toBeGreaterThanOrEqual(metrics.width * 2)
  expect(metrics.naturalWidth).toBe(metrics.naturalHeight)
  expect(metrics.width).toBeGreaterThanOrEqual(32)
  expect(metrics.width).toBe(metrics.height)
  expect(metrics.right).toBeLessThanOrEqual(
    await mark.page().evaluate(() => window.innerWidth),
  )
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

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

async function shoot(page: Page, name: string) {
  if (!screenshotDir) return
  await page.screenshot({ path: `${screenshotDir}/${name}.png` })
}
