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
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_12_CAPTURE

const relationships = [
  relationship('Örnek Okulu', 1, true, true, [
    area(101, 'Moda', 10, 'Kadıköy'),
    area(201, 'Acıbadem', 11, 'Üsküdar'),
  ]),
  relationship('Üsküdar Ortaokulu', 2, true, true, [
    area(201, 'Acıbadem', 11, 'Üsküdar'),
  ]),
  relationship('Çınar Eğitim Kampüsü Anadolu Lisesi', 3, false, true, []),
  relationship('Kapatılan Okul', 4, true, false, []),
]

for (const viewport of viewports) {
  test(`O03 stays accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await prepare(page, approvedState())
    await page.route('**/api/v1/operator/schools', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: relationships })
        : route.fallback(),
    )
    await page.goto('/operator/schools')
    await expect(page.getByText('3 aktif okul')).toHaveCount(0)
    await expect(page.getByText('2 aktif okul')).toBeVisible()
    await expect(page.getByText('Acıbadem · Üsküdar')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `O03-${viewport.name}`, viewport.name)

    const row = page.locator('article', { hasText: 'Örnek Okulu' })
    const edit = row.getByRole('button', { name: 'Düzenle', exact: true })
    await edit.click()
    const editor = page.getByRole('dialog', { name: 'Okul kapsamını düzenle' })
    await expect(
      editor.getByRole('heading', { name: 'Okul kapsamını düzenle' }),
    ).toBeFocused()
    await expect(editor.getByText('Seçili: Moda')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `state-O03-edit-${viewport.name}`, viewport.name)
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    await expect(edit).toBeFocused()

    const removeButton = row.getByRole('button', { name: 'Kaldır' })
    await removeButton.click()
    const confirm = page.getByRole('dialog', {
      name: 'Okul kapsamı kaldırılsın mı?',
    })
    await expect(confirm.getByRole('button', { name: 'Vazgeç' })).toBeFocused()
    await assertAccessibleAndContained(page)
    await capture(page, `state-O03-remove-${viewport.name}`, viewport.name)
    await confirm.getByRole('button', { name: 'Vazgeç' }).click()
    await expect(removeButton).toBeFocused()

    await page.getByRole('button', { name: 'Okul ekle' }).click()
    const add = page.getByRole('dialog', { name: 'Hizmet kapsamına okul ekle' })
    await expect(add.getByLabel('Okul ara')).toBeFocused()
    await assertAccessibleAndContained(page)
    await capture(page, `state-O03-add-${viewport.name}`, viewport.name)
  })
}

test('O03 adds a school, saves cross-district coverage and reopens it', async ({
  page,
}) => {
  const state = approvedState()
  state.operatorSchoolAdded = false
  state.generalCoverage = []
  await prepare(page, state)
  await page.goto('/operator/schools')
  await expect(
    page.getByRole('heading', { name: 'Henüz okul eklenmedi' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Okul ekle' }).click()
  const add = page.getByRole('dialog', { name: 'Hizmet kapsamına okul ekle' })
  await add
    .getByLabel('Aktif okul')
    .selectOption({ label: 'Örnek Okulu — Kadıköy' })
  await add.getByRole('button', { name: 'Okulu ekle' }).click()

  const editor = page.getByRole('dialog', { name: 'Okul kapsamını düzenle' })
  await expect(
    editor.getByRole('heading', { name: 'Okul kapsamını düzenle' }),
  ).toBeFocused()
  for (const [district, neighborhood] of [
    ['Kadıköy', 'Moda'],
    ['Üsküdar', 'Acıbadem'],
  ] as const) {
    const group = editor.getByRole('group', { name: district })
    await group.getByRole('button', { name: district }).click()
    await group.getByRole('checkbox', { name: neighborhood }).check()
  }
  await editor.getByRole('button', { name: 'Kapsamı kaydet' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByText(/Hizmet kapsamı kaydedildi/)).toBeVisible()
  expect(state.generalCoverage).toEqual([101, 201])

  const row = page.locator('article', { hasText: 'Örnek Okulu' })
  await expect(row.getByText('Moda', { exact: true })).toBeVisible()
  await expect(row.getByText('Acıbadem · Üsküdar')).toBeVisible()
  await row.getByRole('button', { name: '+ Mahalle düzenle' }).click()
  await expect(editor.getByText('Seçili: Moda')).toBeVisible()
  await expect(editor.getByText('Seçili: Acıbadem')).toBeVisible()
})

test('O03 activation changes O01 readiness and keeps keyboard focus', async ({
  page,
}) => {
  await prepare(page, approvedState())
  const ready = page.getByText('Profiliniz uygun aramalarda görünebilir.')
  await page.goto('/operator')
  await expect(ready).toBeVisible()

  await page.goto('/operator/schools')
  const passive = page.getByRole('button', { name: 'Pasifleştir' })
  await passive.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Bağlantı pasif')).toBeVisible()
  const activate = page.getByRole('button', { name: 'Etkinleştir' })
  await expect(activate).toBeFocused()
  await page.goto('/operator')
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
  await expect(ready).toHaveCount(0)

  await page.goto('/operator/schools')
  await activate.click()
  await expect(page.getByText('Okul bağlantısı etkinleştirildi.')).toBeVisible()
  await page.goto('/operator')
  await expect(ready).toBeVisible()
})

test('O03 confirms removal, survives Escape and reports failures', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = approvedState()
  await prepare(page, state)
  let attempts = 0
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/operator/schools/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    attempts += 1
    if (attempts === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        json: { title: 'Error', status: 503, detail: 'Okul kaldırılamadı.' },
      })
    }
    await gate
    return route.fallback()
  })
  await page.goto('/operator/schools')
  await page.getByRole('button', { name: 'Kaldır' }).click()
  const confirm = page.getByRole('dialog', {
    name: 'Okul kapsamı kaldırılsın mı?',
  })
  await confirm.getByRole('button', { name: 'Kaldır' }).click()
  await expect(confirm.getByRole('alert')).toHaveText('Okul kaldırılamadı.')

  await confirm.getByRole('button', { name: 'Kaldır' }).click()
  await expect(
    confirm.getByRole('button', { name: 'Kaldırılıyor…' }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(confirm).toBeVisible()

  release()
  await expect(confirm).toHaveCount(0)
  await expect(
    page.getByText('Okul bağlantısı ve okula özel kapsam kaldırıldı.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Okul ekle' })).toBeFocused()
  expect(state.operatorSchoolAdded).toBe(false)
})

test('O03 filters linked schools and offers a retry when loading fails', async ({
  page,
}) => {
  await prepare(page, approvedState())
  let failing = true
  await page.route('**/api/v1/operator/schools', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    if (failing) {
      return route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        json: { title: 'Error', status: 503, detail: 'Okullar alınamadı.' },
      })
    }
    return route.fulfill({ json: relationships })
  })
  await page.goto('/operator/schools')
  await expect(page.getByText('Okullar alınamadı.')).toBeVisible()
  await expect(page.getByText('Henüz okul eklenmedi')).toHaveCount(0)
  failing = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()

  const filter = page.getByLabel('Okul veya mahalle ara')
  await filter.fill('ÇINAR')
  await expect(page.locator('article')).toHaveCount(1)
  await filter.fill('acıbadem')
  await expect(page.locator('article')).toHaveCount(2)
  await filter.fill('bulunmayan')
  await expect(page.getByText(/Eşleşen okul yok/)).toBeVisible()
  await page.getByRole('button', { name: 'Filtreleri temizle' }).click()
  await expect(filter).toBeFocused()
  await expect(page.locator('article')).toHaveCount(relationships.length)
})

test('O03 add dialog stays usable with a shrunken viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 420 })
  await prepare(page, approvedState())
  await page.goto('/operator/schools')
  await page.getByRole('button', { name: 'Düzenle', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Okul kapsamını düzenle' })
  const box = await editor.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(420)
  await expect(
    editor.getByRole('button', { name: 'Kapsamı kaydet' }),
  ).toBeInViewport({ ratio: 1 })
})

test('O03 coverage editor stays usable at 320px with many selections', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await prepare(page, approvedState())
  await page.route('**/api/v1/neighborhoods*', (route) =>
    route.fulfill({
      json: Array.from({ length: 24 }, (_, index) => ({
        id: 1000 + index,
        districtId: 10,
        name: `Küçükbakkalköy Mahalle ${index + 1}`,
      })),
    }),
  )
  await page.goto('/operator/schools')
  const opener = page.getByRole('button', { name: 'Düzenle', exact: true })
  await opener.click()
  const editor = page.getByRole('dialog', { name: 'Okul kapsamını düzenle' })
  const kadikoy = editor.getByRole('group', { name: 'Kadıköy' })
  await kadikoy.getByRole('button', { name: 'Kadıköy' }).click()
  await kadikoy.getByRole('button', { name: 'Bu ilçenin tümünü seç' }).click()

  expect(
    await editor.evaluate((node) => node.scrollWidth - node.clientWidth),
  ).toBeLessThanOrEqual(0)
  await expect(kadikoy.getByText(/^Seçili:/)).toHaveCount(0)
  const last = kadikoy.getByRole('checkbox', {
    name: 'Küçükbakkalköy Mahalle 24',
  })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await expect(
    editor.getByRole('button', { name: 'Kapsamı kaydet' }),
  ).toBeInViewport({ ratio: 1 })
  await assertAccessibleAndContained(page)

  const hit = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')!
    const element = document.elementFromPoint(4, 4)
    return element === dialog || !element?.closest('article, header, nav')
  })
  expect(hit).toBe(true)
  await page.mouse.click(4, 4)
  await expect(editor).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('O03 remains protected from unauthenticated access', async ({ page }) => {
  await installMockApi(page, approvedState())
  await page.goto('/operator/schools')
  await expect(page).toHaveURL(/\/operator\/login/)
})

function approvedState() {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]
  return state
}

async function prepare(page: Page, state: MockApiState) {
  await installMockApi(page, state)
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
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
  if (stage !== 'after' || (viewport !== 'desktop' && viewport !== 'mobile')) {
    return
  }
  await page.screenshot({
    fullPage: !name.startsWith('state-'),
    path: `../docs/screenshots/ui-fidelity-12/after/${name}.png`,
  })
}

function area(
  neighborhoodId: number,
  neighborhoodName: string,
  districtId: number,
  districtName: string,
) {
  return {
    neighborhoodId,
    neighborhoodName,
    districtId,
    districtName,
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
  }
}

function relationship(
  schoolName: string,
  index: number,
  active: boolean,
  schoolActive: boolean,
  coverage: ReturnType<typeof area>[],
) {
  return {
    id: `75ef6bb0-e313-43fb-a01c-c93577443${index}b4`,
    schoolId: `6de54e65-6e04-4168-a1cb-967a98d7e${index}12`,
    schoolName,
    schoolNeighborhoodId: 101,
    schoolDistrictId: index === 2 ? 11 : 10,
    schoolProvinceId: 34,
    schoolProvinceCode: '34',
    schoolProvinceName: 'İstanbul',
    schoolActive,
    active,
    coverage,
  }
}
