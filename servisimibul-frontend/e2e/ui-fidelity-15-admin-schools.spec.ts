import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_15_CAPTURE

const schools = [
  school('6de54e65-6e04-4168-a1cb-967a98d7ec12', 'Örnek Okulu', true),
  school('6de54e65-6e04-4168-a1cb-967a98d7ec13', 'Atatürk İlkokulu', true),
  school('6de54e65-6e04-4168-a1cb-967a98d7ec14', 'Moda Ortaokulu', false),
]

for (const viewport of viewports) {
  test(`M03 stays accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/schools')
    await expect(page.getByText('Moda Ortaokulu')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M03-${viewport.name}`, viewport.name)

    await page
      .locator('li', { hasText: 'Örnek Okulu' })
      .getByRole('button', { name: 'Düzenle' })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Okul kaydını düzenle' })
    await expect(dialog.getByLabel('Okul adı')).toHaveValue('Örnek Okulu')
    await expect(dialog.getByLabel('Okul adı')).toBeFocused()
    await assertAccessibleAndContained(page)
    await capture(page, `state-M03-edit-${viewport.name}`, viewport.name)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(
      page
        .locator('li', { hasText: 'Örnek Okulu' })
        .getByRole('button', { name: 'Düzenle' }),
    ).toBeFocused()
  })
}

test('M03 confirms a status change through the real endpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page)
  const requests: string[] = []
  await page.route('**/api/v1/admin/schools/*/activate', async (route) => {
    requests.push(route.request().url())
    await route.fulfill({
      json: { ...schools[2], active: true },
    })
  })
  await page.goto('/admin/schools')

  const row = page.locator('li', { hasText: 'Moda Ortaokulu' })
  await row.getByRole('button', { name: 'Etkinleştir' }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Moda Ortaokulu etkinleştirilsin mi?',
  })
  await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Vazgeç' }).click()
  expect(requests).toHaveLength(0)

  await row.getByRole('button', { name: 'Etkinleştir' }).click()
  await dialog.getByRole('button', { name: 'Etkinleştir' }).click()
  await expect(page.getByText('Okul etkinleştirildi.')).toBeVisible()
  expect(requests).toHaveLength(1)
  await expect(row.getByText('Aktif')).toBeVisible()
  await assertAccessibleAndContained(page)
})

const dialogViewports = [
  ...viewports,
  // A layout viewport shrunk the way an on-screen keyboard can shrink it.
  { name: 'keyboard', width: 390, height: 420 },
] as const

for (const viewport of dialogViewports) {
  test(`M03 editor stays usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page)
    await page.goto('/admin/schools')
    const opener = page
      .locator('li', { hasText: 'Örnek Okulu' })
      .getByRole('button', { name: 'Düzenle' })
    await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Okul kaydını düzenle' })
    await expect(dialog.getByLabel('Okul adı')).toBeFocused()

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    expect(
      await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(0)

    for (const name of ['Vazgeç', 'Değişiklikleri kaydet']) {
      const button = dialog.getByRole('button', { name })
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeInViewport({ ratio: 1 })
    }

    const stayedInside: boolean[] = []
    for (let step = 0; step < 16; step += 1) {
      await page.keyboard.press('Tab')
      stayedInside.push(
        await page.evaluate(() => {
          const active = document.activeElement
          return (
            active === document.body || Boolean(active?.closest('dialog[open]'))
          )
        }),
      )
    }
    expect(stayedInside).not.toContain(false)
    await assertAccessibleAndContained(page)

    await dialog.getByRole('button', { name: 'Vazgeç' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('M03 status confirmation survives Escape while the request runs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page)
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/admin/schools/*/activate', async (route) => {
    await gate
    await route.fulfill({ json: { ...schools[2], active: true } })
  })
  await page.goto('/admin/schools')
  await page
    .locator('li', { hasText: 'Moda Ortaokulu' })
    .getByRole('button', { name: 'Etkinleştir' })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Moda Ortaokulu etkinleştirilsin mi?',
  })
  await dialog.getByRole('button', { name: 'Etkinleştir' }).click()
  await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeDisabled()

  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()

  release()
  await expect(page.getByText('Okul etkinleştirildi.')).toBeVisible()
  await expect(dialog).toHaveCount(0)
})

test('M03 editor keeps errors linked and survives Escape while saving', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await prepare(page)
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/admin/schools', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await gate
    await route.fulfill({ status: 201, json: schools[0] })
  })
  await page.goto('/admin/schools')
  await page.getByRole('button', { name: 'Okul ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Okul ekle' })

  await dialog.getByRole('button', { name: 'Okulu ekle' }).click()
  const name = dialog.getByRole('textbox', { name: 'Okul adı' })
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveAccessibleDescription('Okul adı zorunludur.')
  await expect(
    dialog.getByRole('combobox', { name: 'Mahalle' }),
  ).toHaveAccessibleDescription('Mahalle zorunludur.')
  await assertAccessibleAndContained(page)

  await name.fill('Yeni Okul')
  await dialog
    .getByRole('combobox', { name: 'İl', exact: true })
    .selectOption('34')
  await dialog
    .getByRole('combobox', { name: 'İlçe', exact: true })
    .selectOption('10')
  const neighborhood = dialog.getByRole('combobox', { name: 'Mahalle' })
  await expect(neighborhood.locator('option')).not.toHaveCount(1)
  await neighborhood.selectOption({ index: 1 })
  await dialog.getByRole('button', { name: 'Okulu ekle' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Kaydediliyor…' }),
  ).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeDisabled()

  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Okul ekle', level: 2 }),
  ).toBeVisible()

  release()
  await expect(page.getByText('Okul eklendi.')).toBeVisible()
  await expect(dialog).toHaveCount(0)
})

async function prepare(page: Page) {
  await installMockApi(page, createMockApiState())
  await page.route('**/api/v1/admin/schools?*', (route) =>
    route.fulfill({
      json: {
        content: schools,
        page: 0,
        size: 20,
        totalElements: schools.length,
        totalPages: 1,
      },
    }),
  )
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
    path: `../docs/screenshots/ui-fidelity-15/${stage}/${name}.png`,
  })
}

function school(id: string, name: string, active: boolean) {
  return {
    id,
    neighborhoodId: 101,
    neighborhoodName: 'Moda',
    districtId: 10,
    districtName: 'Kadıköy',
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
    name,
    address: null,
    sourceName: null,
    sourceCode: null,
    active,
  }
}
