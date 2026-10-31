import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_16_CAPTURE

for (const viewport of viewports) {
  test(`M04 stays accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/tariffs')
    const editor = page.getByLabel('Tarife JSON içeriği')
    await expect(editor).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Uygulanacak ücret tarifesi' }),
    ).toBeVisible()
    const effective = page.locator('.tariff-meta dd').first()
    expect((await effective.boundingBox())!.width).toBeGreaterThan(150)
    await assertAccessibleAndContained(page)
    await capture(page, `M04-${viewport.name}`, viewport.name)

    await editor.fill('{ geçersiz')
    await expect(
      page.getByRole('heading', { name: 'Önizleme henüz hazır değil' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Tarifeyi kaydet' }).click()
    await expect(page.getByRole('alert')).toContainText('JSON biçimi geçersiz')
    await assertAccessibleAndContained(page)
    await capture(page, `state-M04-invalid-${viewport.name}`, viewport.name)
  })
}

test('M04 resolves a version conflict without overwriting', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page)
  const expected: unknown[] = []
  await page.route('**/api/v1/admin/tariffs/34', (route) => {
    expected.push(route.request().postDataJSON().expectedVersion)
    return route.fulfill({
      status: 409,
      json: {
        title: 'Conflict',
        status: 409,
        detail: 'Version conflict',
        code: 'tariff_version_conflict',
      },
    })
  })
  await page.goto('/admin/tariffs')
  const editor = page.getByLabel('Tarife JSON içeriği')
  await expect(editor).toBeVisible()
  const loaded = await editor.inputValue()
  const draft = loaded.replace(/"version": "[^"]+"/, '"version": "taslak"')
  await editor.fill(draft)
  await page.getByRole('button', { name: 'Tarifeyi kaydet' }).click()

  await expect(page.getByRole('alert')).toContainText('Taslağınız korunuyor')
  await expect(editor).toHaveValue(draft)
  expect(expected).toHaveLength(1)
  await assertAccessibleAndContained(page)
  await capture(page, 'state-M04-conflict-mobile', 'mobile')

  await page
    .getByRole('button', { name: 'Taslağı bırakıp güncel sürümü yükle' })
    .click()
  await expect(editor).toBeFocused()
  await expect(editor).toHaveValue(loaded)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('M04 confirms before discarding an edited draft', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await prepare(page)
  await page.goto('/admin/tariffs')
  const editor = page.getByLabel('Tarife JSON içeriği')
  await expect(editor).toBeVisible()
  const loaded = await editor.inputValue()
  await editor.fill('taslak')
  const reload = page.getByRole('button', { name: 'Güncel sürümü yükle' })
  await reload.click()

  const dialog = page.getByRole('dialog', {
    name: 'Kaydedilmemiş taslak bırakılsın mı?',
  })
  await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeFocused()
  await assertAccessibleAndContained(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(reload).toBeFocused()
  await expect(editor).toHaveValue('taslak')

  await reload.click()
  await dialog.getByRole('button', { name: 'Taslağı bırak' }).click()
  await expect(editor).toHaveValue(loaded)
})

test('M04 offers a retry when the tariff cannot load', async ({ page }) => {
  await prepare(page)
  let failing = true
  await page.route('**/api/v1/tariffs?*', (route) =>
    failing
      ? route.fulfill({
          status: 500,
          json: { title: 'Hata', status: 500, detail: 'Sunucu hatası.' },
        })
      : route.fallback(),
  )
  await page.goto('/admin/tariffs')
  await expect(page.getByText('Tarife yüklenemedi')).toBeVisible()
  await expect(page.getByLabel('Tarife JSON içeriği')).toHaveCount(0)
  failing = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByLabel('Tarife JSON içeriği')).toBeVisible()
})

async function prepare(page: Page) {
  await installMockApi(page, createMockApiState())
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('admin@example.com')
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/admin\/applications$/)
}

async function assertAccessibleAndContained(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

async function capture(page: Page, name: string, viewport: string) {
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.scrollTo(0, 0)
  })
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-16/${stage}/${name}.png`,
  })
}
