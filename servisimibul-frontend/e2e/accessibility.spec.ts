import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`${viewport.name} routes meet WCAG 2.2 AA and do not overflow`, async ({
    page,
  }) => {
    const state = createMockApiState()
    const consoleProblems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        consoleProblems.push(message.text())
      }
    })
    page.on('pageerror', (error) => consoleProblems.push(error.message))
    state.registered = true
    state.verified = true
    state.approvalStatus = 'APPROVED'
    state.businessName = 'Örnek Servis'
    state.operatorSchoolAdded = true
    state.generalCoverage = [101, 201]

    await page.setViewportSize(viewport)
    await installMockApi(page, state)

    await page.goto('/')
    await audit(page, 'public discovery')

    await page.goto('/operator/register')
    await audit(page, 'registration')

    await page.goto('/operator/login')
    await assertVisibleKeyboardFocus(page)
    await login(page, 'operator@example.com')
    await page.goto('/operator/profile')
    await expect(
      page.getByRole('heading', { name: 'İşletme bilgileriniz' }),
    ).toBeVisible()
    await audit(page, 'operator profile')

    await page.goto('/operator/schools')
    await expect(
      page.getByRole('heading', { name: 'Hizmet ağınız' }),
    ).toBeVisible()
    await audit(page, 'operator schools')

    await login(page, 'admin@example.com')
    await page.goto('/admin/applications')
    await expect(
      page.getByRole('heading', { name: 'Başvurular' }),
    ).toBeVisible()
    await audit(page, 'admin applications')

    await page.goto('/admin/tariffs')
    await expect(
      page.getByRole('heading', { name: 'Resmî tarifeler' }),
    ).toBeVisible()
    await audit(page, 'admin tariffs')
    expect(consoleProblems).toEqual([])
  })
}

test('reduced-motion mode removes decorative and page-transition motion', async ({
  page,
}) => {
  const state = createMockApiState()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page, state)
  await page.goto('/')

  const animationName = await page
    .locator('.road-minibus')
    .first()
    .evaluate((element) => getComputedStyle(element).animationName)
  expect(animationName).toBe('none')
})

async function audit(page: Page, surface: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations, `${surface} axe violations`).toEqual([])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${surface} horizontal overflow`).toBeLessThanOrEqual(1)
}

async function assertVisibleKeyboardFocus(page: Page) {
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'İçeriğe geç' })
  await expect(skipLink).toBeFocused()
  const focusStyle = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0)
}

async function login(page: Page, email: string) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('uzun-ve-guvenli-sifre')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
}
