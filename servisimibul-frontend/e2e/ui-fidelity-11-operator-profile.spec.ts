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
  test(`O02 keeps the real profile accessible at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    const state = approvedProfileState()
    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await login(page)
    await page.goto('/operator/profile')

    await expect(page.getByLabel('İşletme adı (isteğe bağlı)')).toHaveValue(
      'Rota İstanbul',
    )
    await expect(page.getByLabel('Herkese açık iletişim telefonu')).toHaveValue(
      '+905321234567',
    )
    await expect(page.getByText('Onaylandı')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([])

    if (viewport.name === 'desktop' || viewport.name === 'mobile') {
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`operator-profile-${viewport.name}.png`),
      })
    }
  })
}

test('O02 saves the real visibility preference and updates O01 readiness', async ({
  page,
}) => {
  const state = approvedProfileState()
  await installMockApi(page, state)
  await login(page)
  await page.goto('/operator/profile')

  const businessName = page.getByLabel('İşletme adı (isteğe bağlı)')
  await businessName.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Herkese açık iletişim telefonu')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Kısa açıklama')).toBeFocused()
  await page.keyboard.press('Tab')
  const visibility = page.getByRole('switch', {
    name: /Profil görünürlük tercihi/,
  })
  await expect(visibility).toBeFocused()
  await expect(visibility).toBeChecked()
  await visibility.click()
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click()

  await expect(page.getByText('Profil bilgileriniz kaydedildi.')).toBeVisible()
  await expect(visibility).not.toBeChecked()
  await page.goto('/operator')
  await expect(
    page.getByText(
      'Profil görünürlüğünü açarak işletme ve iletişim bilgilerinizi aramalarda yayınlayın.',
    ),
  ).toBeVisible()
})

test('O02 does not present a rejected visibility update as saved', async ({
  page,
}) => {
  const state = approvedProfileState()
  await installMockApi(page, state)
  await page.route('**/api/v1/operator/profile', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback()
      return
    }
    await route.fulfill({
      contentType: 'application/problem+json',
      status: 503,
      body: JSON.stringify({
        title: 'Service Unavailable',
        status: 503,
        detail: 'Profil şu anda kaydedilemiyor.',
        code: 'profile_unavailable',
      }),
    })
  })
  await login(page)
  await page.goto('/operator/profile')

  const visibility = page.getByRole('switch', {
    name: /Profil görünürlük tercihi/,
  })
  await visibility.click()
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click()

  await expect(page.getByText('Profil şu anda kaydedilemiyor.')).toBeVisible()
  await expect(visibility).toBeChecked()
  await expect(page.getByText('Profil bilgileriniz kaydedildi.')).toHaveCount(0)
})

test('O02 preserves pending read-only behavior and keyboard order', async ({
  page,
}) => {
  const state = approvedProfileState()
  state.approvalStatus = 'PENDING'
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, state)
  await login(page)
  await page.goto('/operator/profile')

  await expect(page.getByText('İncelemede')).toBeVisible()
  await expect(page.getByLabel('İşletme adı (isteğe bağlı)')).toBeDisabled()
  await expect(
    page.getByText(
      'İnceleme tamamlanana kadar başvuru bilgileri salt okunurdur.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Menü' }).focus()
  await expect(page.getByRole('button', { name: 'Menü' })).toBeFocused()
})

test('O02 remains usable at 200% zoom with reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page, approvedProfileState())
  await login(page)
  await page.goto('/operator/profile')
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%'
  })

  await expect(
    page.getByRole('heading', { name: 'İşletme profilim' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
  const visibility = page.getByRole('switch', {
    name: /Profil görünürlük tercihi/,
  })
  await visibility.focus()
  await expect(visibility).toBeFocused()
})

test('O02 remains protected from unauthenticated access', async ({ page }) => {
  await installMockApi(page, approvedProfileState())
  await page.goto('/operator/profile')

  await expect(page).toHaveURL(/\/operator\/login/)
  await expect(
    page.getByRole('heading', { name: 'İşletmeci paneline giriş' }),
  ).toBeVisible()
})

function approvedProfileState() {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Rota İstanbul'
  state.description =
    'Kadıköy ve Üsküdar çevresinde okul saatlerine göre planlanan servis hizmeti.'
  return state
}

async function login(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}
