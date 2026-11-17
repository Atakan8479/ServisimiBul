import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  createMockApiState,
  installMockApi,
  type MockApiState,
} from './support/mock-api'

// D059 (#295): deletion eligibility comes only from the backend vehicle fields.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact-mobile', width: 320, height: 844 },
] as const

const FREE_ID = '22222222-2222-4222-8222-222222222222'
const dialogName = 'Aracı kalıcı olarak sil'
const deleteButtonName = '34 DEF 456 aracını kalıcı olarak sil'

for (const viewport of viewports) {
  test(`vehicle removal dialog is accessible at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await openFleet(page, fleetState())

    // Only the never-used vehicle offers deletion; the rest explain the backend's reason.
    await expect(
      page.getByRole('button', { name: /aracını kalıcı olarak sil$/ }),
    ).toHaveCount(1)
    await expect(
      page.getByText('Servis tekliflerinde kullanıldığı için silinemez'),
    ).toBeVisible()
    await expect(
      page.getByText('Daha önce bir servis teklifinde kullanıldığı için'),
    ).toBeVisible()
    await expect(
      page.getByText('Kullanım geçmişi doğrulanamadığı için silinemez'),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, `fleet-${viewport.width}`)

    await page.getByRole('button', { name: deleteButtonName }).click()
    const dialog = page.getByRole('dialog', { name: dialogName })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('34 DEF 456')
    await expect(dialog).toContainText('Bu işlem geri alınamaz.')
    // The safe action receives initial focus in a destructive confirmation.
    await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeFocused()

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    await expectNoHorizontalOverflow(page)
    for (const name of ['Vazgeç', 'Kalıcı olarak sil']) {
      const action = await dialog
        .getByRole('button', { name, exact: true })
        .boundingBox()
      // 44 px target; the tolerance absorbs sub-pixel layout rounding (e.g. 43.99997 in CI).
      expect(action!.height).toBeGreaterThanOrEqual(44 - 0.01)
      expect(action!.x + action!.width).toBeLessThanOrEqual(viewport.width)
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
    await capture(page, testInfo, `dialog-${viewport.width}`)
  })
}

test('keyboard users can cancel with Escape and focus returns to the trigger', async ({
  page,
}) => {
  const state = fleetState()
  await openFleet(page, state)

  const trigger = page.getByRole('button', { name: deleteButtonName })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog.getByRole('button', { name: 'Vazgeç' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('button', { name: 'Kalıcı olarak sil', exact: true }),
  ).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  await page.keyboard.press('Enter')
  await dialog.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(dialog).toBeHidden()
  expect(state.vehicles).toHaveLength(4)
})

test('confirming deletes the vehicle and moves focus to the fleet heading', async ({
  page,
}) => {
  const state = fleetState()
  await openFleet(page, state)

  await page.getByRole('button', { name: deleteButtonName }).click()
  await page
    .getByRole('dialog', { name: dialogName })
    .getByRole('button', { name: 'Kalıcı olarak sil', exact: true })
    .press('Enter')

  await expect(
    page.getByText('34 DEF 456 plakalı araç kalıcı olarak silindi.'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '34 DEF 456' })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Filo bilgileri' }),
  ).toBeFocused()
  expect(state.vehicles.some((vehicle) => vehicle.id === FREE_ID)).toBe(false)
})

const conflicts = [
  {
    name: 'an offering created elsewhere',
    mutate: (state: MockApiState) => {
      state.offerings.push({
        ...state.offerings[0],
        id: '55555555-5555-4555-8555-555555555555',
        vehicleId: FREE_ID,
        vehiclePlate: '34 DEF 456',
        published: false,
      })
    },
    message: 'Bu araç bir servis teklifinde kullanıldığı için silinemez.',
    note: 'Servis tekliflerinde kullanıldığı için silinemez',
  },
  {
    name: 'usage recorded after an offering was moved away',
    mutate: (state: MockApiState) => {
      state.vehicles.find((vehicle) => vehicle.id === FREE_ID)!.usageRecorded =
        true
    },
    message:
      'Bu araç daha önce bir servis teklifinde kullanıldığı için silinemez.',
    note: 'Daha önce bir servis teklifinde kullanıldığı için',
  },
] as const

for (const conflict of conflicts) {
  test(`server conflict after ${conflict.name} keeps the vehicle`, async ({
    page,
  }) => {
    const state = fleetState()
    await openFleet(page, state)

    await page.getByRole('button', { name: deleteButtonName }).click()
    conflict.mutate(state)
    await page
      .getByRole('dialog', { name: dialogName })
      .getByRole('button', { name: 'Kalıcı olarak sil', exact: true })
      .click()

    await expect(page.getByRole('alert')).toContainText(conflict.message)
    await expect(
      page.getByRole('heading', { name: '34 DEF 456' }),
    ).toBeVisible()
    // The card now reflects the refreshed backend eligibility.
    await expect(
      page.getByRole('button', { name: deleteButtonName }),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: '34 DEF 456' })
        .getByText(conflict.note),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Filo bilgileri' }),
    ).toBeFocused()
    expect(state.vehicles).toHaveLength(4)
  })
}

test('an unexpected server failure keeps the vehicle and its delete action', async ({
  page,
}) => {
  const state = fleetState()
  await openFleet(page, state)
  await page.route(`**/api/v1/operator/vehicles/${FREE_ID}`, (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            title: 'Internal Server Error',
            status: 500,
            detail: 'Araç şu anda silinemedi. Lütfen tekrar deneyin.',
            code: 'internal_error',
          }),
        })
      : route.fallback(),
  )

  await page.getByRole('button', { name: deleteButtonName }).click()
  await page
    .getByRole('dialog', { name: dialogName })
    .getByRole('button', { name: 'Kalıcı olarak sil', exact: true })
    .click()

  await expect(page.getByRole('alert')).toContainText(
    'Araç şu anda silinemedi.',
  )
  await expect(page.getByRole('dialog', { name: dialogName })).toBeHidden()
  await expect(
    page.getByRole('button', { name: deleteButtonName }),
  ).toBeVisible()
  expect(state.vehicles).toHaveLength(4)
})

test('a vehicle already deleted elsewhere is removed from the list', async ({
  page,
}) => {
  const state = fleetState()
  await openFleet(page, state)

  await page.getByRole('button', { name: deleteButtonName }).click()
  state.vehicles = state.vehicles.filter((vehicle) => vehicle.id !== FREE_ID)
  await page
    .getByRole('dialog', { name: dialogName })
    .getByRole('button', { name: 'Kalıcı olarak sil', exact: true })
    .click()

  await expect(
    page.getByText('Araç zaten silinmiş; liste güncellendi.'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '34 DEF 456' })).toHaveCount(0)
})

function fleetState() {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Rota İstanbul'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]
  const timestamps = {
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z',
  }
  state.vehicles = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      plate: '34 ABC 123',
      capacity: 16,
      active: true,
      usageRecorded: true,
      ...timestamps,
    },
    {
      id: FREE_ID,
      plate: '34 DEF 456',
      capacity: 14,
      active: false,
      ...timestamps,
    },
    {
      id: '33333333-3333-4333-8333-333333333334',
      plate: '34 GHI 789',
      capacity: 18,
      active: true,
      usageRecorded: true,
      ...timestamps,
    },
    {
      id: '44444444-4444-4444-8444-444444444445',
      plate: '34 JKL 012',
      capacity: 10,
      active: true,
      historyUnknown: true,
      ...timestamps,
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
        {
          neighborhoodId: 101,
          neighborhoodName: 'Moda',
          districtId: 10,
          districtName: 'Kadıköy',
          provinceId: 34,
          provinceCode: '34',
          provinceName: 'İstanbul',
        },
      ],
      ...timestamps,
    },
  ]
  return state
}

async function openFleet(page: Page, state: MockApiState) {
  await installMockApi(page, state)
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
  await page.goto('/operator/offerings')
  await expect(
    page.getByRole('heading', { name: 'Filo bilgileri' }),
  ).toBeVisible()
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`vehicle-removal-${name}.png`)
  await page.screenshot({ fullPage: !name.startsWith('dialog'), path })
  await testInfo.attach(`vehicle removal ${name}`, {
    path,
    contentType: 'image/png',
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
