import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

for (const viewport of viewports) {
  test(`D01 demand board remains accessible on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const state = createMockApiState()
    state.demandCreated = true
    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await page.goto('/demands')

    await expect(
      page.getByRole('heading', { name: 'Servis talep panosu' }),
    ).toBeVisible()
    await expect(
      page.getByText('Talep oluşturmak rezervasyon değildir.'),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Örnek Okulu' }),
    ).toBeVisible()
    await expect(page.getByText('Katılıma açık')).toBeVisible()
    await expect(page.getByText('Güvenli ve açık iletişim')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Talebi görüntüle' }),
    ).toHaveAttribute('href', /\/demands\//)

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

    await page.screenshot({
      path: testInfo.outputPath(`d01-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

test('D01 exposes truthful empty, loading and retry states', async ({
  page,
}, testInfo) => {
  const state = createMockApiState()
  await installMockApi(page, state)
  let rejectNext = true
  await page.route(/\/api\/v1\/demands\?/, async (route) => {
    if (rejectNext) {
      rejectNext = false
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          status: 503,
          title: 'Service unavailable',
          detail: 'Temporary test failure',
          code: 'service_unavailable',
        }),
      })
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.fallback()
  })

  await page.goto('/demands')
  await expect(page.getByText('Talepler yüklenemedi')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('d01-error.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(
    page.getByRole('status').getByText('Talepler yükleniyor…'),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('d01-loading.png'),
    fullPage: true,
  })
  await expect(
    page.getByRole('heading', { name: 'Bu seçim için açık talep yok' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Seçimi güncelle' }),
  ).toHaveAttribute('href', '#demand-filters')
  await page.screenshot({
    path: testInfo.outputPath('d01-empty.png'),
    fullPage: true,
  })
})

test('D01 keeps the real operator check before parent demand creation', async ({
  page,
}, testInfo) => {
  const state = createMockApiState()
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, state)

  await page.goto('/parent/login')
  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/demands$/)
  await page.goto('/demands')
  await page.getByLabel('Okulun bulunduğu il').selectOption('34')
  await page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }).click()
  await page.getByLabel('Servis alınacak ilçe').selectOption('11')
  await page.getByLabel('Servis alınacak mahalle').selectOption('201')
  await page.getByRole('button', { name: 'Talepleri göster' }).click()
  await page
    .getByRole('button', { name: 'Mevcut servisleri kontrol et' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yeni talep oluştur' }).click()
  await expect(
    page.getByRole('heading', { name: 'İhtiyacınızı ekleyin' }),
  ).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: testInfo.outputPath('d01-create-demand-mobile.png'),
    fullPage: true,
  })
})
