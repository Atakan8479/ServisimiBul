import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const) {
  test(`parent submits and tracks an erasure request on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const state = createMockApiState()
    state.parentRegistered = true
    state.verified = true
    state.dataRightsRequestsAvailable = true
    await installMockApi(page, state)

    await page.goto('/parent/login')
    await page.getByLabel('E-posta').fill('parent@example.com')
    await page
      .getByRole('textbox', { name: 'Şifre', exact: true })
      .fill('Password123!')
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    await page.goto('/parent/account')
    await page.getByRole('link', { name: 'Başvuruları yönet' }).click()

    await expect(page).toHaveURL('/parent/privacy/erasure')
    await expect(
      page.getByRole('heading', { name: 'Hesap silme başvurusu' }),
    ).toBeVisible()
    await expect(
      page.getByText('Henüz hesap silme başvurunuz yok.'),
    ).toBeVisible()
    await page
      .getByLabel('Başvuru açıklaması')
      .fill('Hesabım ve ilişkili kayıtlar incelensin.')
    await page.getByRole('button', { name: 'İnceleme talebi gönder' }).click()

    await expect(page.getByText('Başvurunuz kaydedildi')).toBeVisible()
    await expect(page.getByText('Alındı', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Başvuru açıklaması')).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Alındı', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Açık başvurunuz sonuçlanana kadar'),
    ).toBeVisible()
    const backLink = page.getByRole('link', {
      name: 'Hesap ve gizlilik sayfasına dön',
    })
    expect((await backLink.boundingBox())?.height).toBeGreaterThanOrEqual(44)

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })
}
