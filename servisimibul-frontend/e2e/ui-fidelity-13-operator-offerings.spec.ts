import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact-mobile', width: 320, height: 844 },
] as const

for (const viewport of viewports) {
  test(`operator offerings stays accessible at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, populatedState())
    await login(page)
    await page.goto('/operator/offerings')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('34 ABC 123').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])

    if (viewport.name === 'desktop' || viewport.name === 'mobile') {
      const screenshotPath = testInfo.outputPath(
        `operator-offerings-${viewport.name}.png`,
      )
      await page.screenshot({ fullPage: true, path: screenshotPath })
      await testInfo.attach(`operator offerings ${viewport.name}`, {
        path: screenshotPath,
        contentType: 'image/png',
      })
    }
  })
}

test('vehicle edit and offering draft/publish use the real controls', async ({
  page,
}, testInfo) => {
  await installMockApi(page, populatedState())
  await login(page)
  await page.goto('/operator/offerings')

  await page.getByRole('button', { name: '34 ABC 123 aracını düzenle' }).click()
  const vehicleDialog = page.getByRole('dialog', {
    name: 'Araç bilgilerini düzenle',
  })
  const dialogScreenshot = testInfo.outputPath('vehicle-edit-dialog.png')
  await page.screenshot({ path: dialogScreenshot })
  await testInfo.attach('vehicle edit dialog', {
    path: dialogScreenshot,
    contentType: 'image/png',
  })
  const capacity = vehicleDialog.getByLabel('Kapasite')
  await capacity.fill('0')
  await vehicleDialog.getByRole('button', { name: 'Aracı kaydet' }).click()
  expect(await capacity.evaluate((input) => !input.validity.valid)).toBe(true)
  await expect(vehicleDialog).toBeVisible()
  await vehicleDialog.getByLabel('Plaka').fill('34 XYZ 987')
  await capacity.fill('18')
  await vehicleDialog.getByRole('button', { name: 'Aracı kaydet' }).click()
  await expect(page.getByText('Araç bilgileri kaydedildi.')).toBeVisible()
  await expect(page.getByText('34 XYZ 987').first()).toBeVisible()

  await page.getByRole('button', { name: 'Düzenle', exact: true }).click()
  const offeringDialog = page.getByRole('dialog', {
    name: 'Servis teklifini düzenle',
  })
  await expect(
    offeringDialog.getByRole('checkbox', { name: 'Moda' }),
  ).toBeVisible()
  await expect(
    offeringDialog.getByRole('checkbox', { name: 'Acıbadem' }),
  ).toBeVisible()
  await expect(offeringDialog.getByRole('checkbox')).toHaveCount(2)
  await offeringDialog
    .getByRole('button', {
      name: 'Servis teklifini düzenle penceresini kapat',
    })
    .click()

  await page.getByRole('button', { name: 'Taslağa al' }).click()
  await expect(page.getByText('Servis yayından kaldırıldı.')).toBeVisible()
  await expect(page.getByText('Taslak', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Yayımla' }).click()
  await expect(page.getByText('Servis yayımlandı.')).toBeVisible()
  await expect(page.getByText('Yayında', { exact: true })).toBeVisible()
})

test('operator offerings requires an operator session', async ({ page }) => {
  await installMockApi(page, populatedState())
  await page.goto('/operator/offerings')
  await expect(page).toHaveURL(/\/operator\/login/)
})

function populatedState() {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Rota İstanbul'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101, 201]
  state.vehicles = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      plate: '34 ABC 123',
      capacity: 16,
      active: true,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      plate: '34 DEF 456',
      capacity: 14,
      active: false,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ]
  state.offerings = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      operatorSchoolId: '75ef6bb0-e313-43fb-a01c-c935774434b4',
      schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
      schoolName: 'Örnek Okulu',
      vehicleId: '11111111-1111-4111-8111-111111111111',
      vehiclePlate: '34 ABC 123',
      vehicleCapacity: 16,
      availableSeats: 3,
      description: 'Sabah ve akşam servisi',
      published: true,
      coverage: [
        neighborhood(101, 'Moda', 'Kadıköy'),
        neighborhood(201, 'Acıbadem', 'Üsküdar'),
      ],
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ]
  return state
}

function neighborhood(id: number, name: string, districtName: string) {
  return {
    neighborhoodId: id,
    neighborhoodName: name,
    districtId: id === 101 ? 10 : 11,
    districtName,
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
  }
}

async function login(page: Page) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
