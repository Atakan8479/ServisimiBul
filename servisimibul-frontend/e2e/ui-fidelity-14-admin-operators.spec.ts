import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const stage = process.env.UI_FIDELITY_14_CAPTURE
const detailPath = '/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20'

for (const viewport of viewports) {
  test(`M01-M02 remain accessible and contained on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const state = createMockApiState()
    state.approvalStatus = 'PENDING'
    state.businessName = 'Mavi Rota Taşımacılık'
    await installMockApi(page, state)
    await signIn(page)

    await page.goto('/admin/applications')
    await expect(page.getByText('Mavi Rota Taşımacılık')).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M01-${viewport.name}`, viewport.name)

    await page.goto(detailPath)
    await expect(
      page.getByRole('heading', { name: 'Mavi Rota Taşımacılık' }),
    ).toBeVisible()
    await assertAccessibleAndContained(page)
    await capture(page, `M02-${viewport.name}`, viewport.name)
  })
}

test('M02 suspension uses an accessible modal with real consequences', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = createMockApiState()
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Mavi Rota Taşımacılık'
  await installMockApi(page, state)
  await signIn(page)
  await page.goto(detailPath)

  const trigger = page.getByRole('button', { name: 'İşletmeciyi askıya al' })
  await trigger.click()
  const dialog = page.getByRole('dialog', {
    name: 'İşletmeci askıya alınsın mı?',
  })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeFocused()
  await assertAccessibleAndContained(page)
  await capture(page, 'state-M02-suspend-confirmation', 'desktop')

  await dialog.getByRole('button', { name: 'Askıya al', exact: true }).click()
  await expect(
    dialog.getByText('Askıya alma gerekçesi zorunludur.'),
  ).toBeVisible()
  expect(state.active).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(state.active).toBe(true)

  await trigger.click()
  await dialog.getByLabel('Askıya alma gerekçesi').fill('Şikayet incelemesi')
  await dialog.getByRole('button', { name: 'Askıya al', exact: true }).click()
  await expect(page.getByText('İşletmeci askıya alındı.')).toBeVisible()
  expect(state.active).toBe(false)
  await expect(page.getByText('Şikayet incelemesi')).toBeVisible()
  await expect(trigger).toHaveCount(0)
  await assertAccessibleAndContained(page)
})

test('M01-M02 pilot mode hides approval controls and stays usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = createMockApiState()
  state.businessName = 'Mavi Rota Taşımacılık'
  state.operatorApprovalRequired = false
  await installMockApi(page, state)
  await signIn(page)

  await expect(
    page.getByRole('heading', { name: 'İşletmeciler' }),
  ).toBeVisible()
  await expect(page.getByRole('group', { name: 'Başvuru durumu' })).toHaveCount(
    0,
  )
  await assertAccessibleAndContained(page)
  await page.getByRole('link', { name: 'Profili incele' }).click()
  await expect(
    page.getByRole('button', { name: 'İşletmeciyi askıya al' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Başvuruyu onayla' }),
  ).toHaveCount(0)
  await expect(page.getByLabel('Düzeltme nedeni')).toHaveCount(0)
  await assertAccessibleAndContained(page)
})

async function signIn(page: Page) {
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
    path: `../docs/screenshots/ui-fidelity-14/${stage}/${name}.png`,
  })
}
