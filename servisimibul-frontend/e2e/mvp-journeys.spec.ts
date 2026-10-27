import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

test('completes all 13 MVP journeys and preserves privacy boundaries', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const state = createMockApiState()
  const operatorContext = await browser.newContext()
  const adminContext = await browser.newContext()
  const publicContext = await browser.newContext()
  const operatorPage = await operatorContext.newPage()
  const adminPage = await adminContext.newPage()
  const publicPage = await publicContext.newPage()
  await Promise.all([
    installMockApi(operatorPage, state),
    installMockApi(adminPage, state),
    installMockApi(publicPage, state),
  ])

  const browserErrors: string[] = []
  for (const page of [operatorPage, adminPage, publicPage]) {
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))
  }
  adminPage.on('dialog', (dialog) => void dialog.accept())

  await test.step('1. Register and verify email', async () => {
    await operatorPage.goto('/operator/register')
    await operatorPage.getByLabel('E-posta').fill('operator@example.com')
    await operatorPage.getByLabel('Şifre').fill('uzun-ve-guvenli-sifre')
    await operatorPage
      .getByLabel('İşletme adı (isteğe bağlı)')
      .fill('Örnek Servis')
    await operatorPage
      .getByLabel('Herkese açık iletişim telefonu')
      .fill('0532 123 45 67')
    await operatorPage.getByRole('button', { name: 'Hesap oluştur' }).click()
    await expect(
      operatorPage.getByRole('heading', { name: 'E-postanızı kontrol edin' }),
    ).toBeVisible()

    await operatorPage.goto('/operator/verify-email?token=e2e-token')
    await operatorPage
      .getByRole('button', { name: 'E-postayı doğrula' })
      .click()
    await expect(
      operatorPage.getByText('E-posta adresiniz doğrulandı.'),
    ).toBeVisible()
  })

  await test.step('2. Log in and complete operator profile', async () => {
    await login(operatorPage, 'operator@example.com')
    await expect(
      operatorPage.getByRole('heading', {
        name: 'Aramalarda görünmeye hazır mısınız?',
      }),
    ).toBeVisible()
    await operatorPage.goto('/operator/profile')
    await operatorPage
      .getByLabel('İşletme adı (isteğe bağlı)')
      .fill('Örnek Servis')
    await operatorPage.getByLabel('Kısa açıklama').fill('Güvenli okul servisi')
    await operatorPage
      .getByRole('button', { name: 'Değişiklikleri kaydet' })
      .click()
    await expect(
      operatorPage.getByText('Profil bilgileriniz kaydedildi.'),
    ).toBeVisible()
  })

  await test.step('3. Submit application', async () => {
    await operatorPage.getByRole('button', { name: 'Başvuruyu gönder' }).click()
    await expect(operatorPage.getByText('İncelemede')).toBeVisible()
  })

  await test.step('4. Receive a correction request', async () => {
    await login(adminPage, 'admin@example.com')
    await adminPage.goto(
      '/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20',
    )
    await adminPage
      .getByLabel('Düzeltme nedeni')
      .fill('Telefon bilgisini doğrulayın.')
    await adminPage.getByRole('button', { name: 'Düzeltme iste' }).click()
    await expect(
      adminPage.getByText('Düzeltme talebi gönderildi.'),
    ).toBeVisible()
  })

  await test.step('5. Edit and resubmit', async () => {
    await operatorPage.goto('/operator/profile')
    await expect(operatorPage.getByText('Düzeltme istendi')).toBeVisible()
    await operatorPage
      .getByLabel('Herkese açık iletişim telefonu')
      .fill('+905321234568')
    await operatorPage
      .getByRole('button', { name: 'Değişiklikleri kaydet' })
      .click()
    await operatorPage.getByRole('button', { name: 'Yeniden gönder' }).click()
    await expect(operatorPage.getByText('İncelemede')).toBeVisible()
  })

  await test.step('6. Receive approval', async () => {
    await adminPage.goto(
      '/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20',
    )
    await adminPage.getByRole('button', { name: 'Başvuruyu onayla' }).click()
    await expect(adminPage.getByText('Başvuru onaylandı.')).toBeVisible()
  })

  await test.step('7. Add school and general coverage', async () => {
    await operatorPage.goto('/operator/schools')
    await operatorPage.getByLabel('Okul ara').fill('Örnek')
    await operatorPage.getByRole('button', { name: 'Ara' }).click()
    await operatorPage
      .getByLabel('Aktif okul')
      .selectOption({ label: 'Örnek Okulu — Kadıköy' })
    await operatorPage.getByRole('button', { name: 'Okulu ekle' }).click()
    await expect(
      operatorPage.getByRole('heading', {
        name: 'Örnek Okulu için hizmet mahalleleri',
      }),
    ).toBeFocused()
    await operatorPage
      .getByRole('group', { name: 'Kadıköy' })
      .getByRole('button', { name: 'Kadıköy' })
      .click()
    await operatorPage
      .getByRole('group', { name: 'Kadıköy' })
      .getByRole('checkbox', { name: 'Moda' })
      .check()
    await operatorPage
      .getByRole('group', { name: 'Üsküdar' })
      .getByRole('button', { name: 'Üsküdar' })
      .click()
    await operatorPage
      .getByRole('group', { name: 'Üsküdar' })
      .getByRole('checkbox', { name: 'Acıbadem' })
      .check()
    await operatorPage.getByRole('button', { name: 'Kapsamı kaydet' }).click()
    await expect(
      operatorPage.getByText(
        'Hizmet kapsamı kaydedildi. Bu okul uygun aramalara katkı sağlayabilir.',
      ),
    ).toBeVisible()
  })

  await test.step('8. Appear in anonymous discovery without vehicles or offerings', async () => {
    await operatorPage.goto('/operator')
    await expect(
      operatorPage.getByText('Profiliniz uygun aramalarda görünebilir.'),
    ).toBeVisible()
    await expect(
      operatorPage.getByText(/Aramalarda görünmek için araç eklemek zorunda değilsiniz/),
    ).toBeVisible()
    await search(publicPage, 'Kadıköy', 'Moda')
    await expect(
      publicPage.getByRole('heading', { name: '1 işletmeci bulundu' }),
    ).toBeVisible()
    await expect(publicPage.getByText('Örnek Servis')).toBeVisible()
    await expect(
      publicPage.getByRole('link', { name: '+905321234568' }),
    ).toBeVisible()
    await expect(
      publicPage.getByText('Paylaşılan servis bilgileri'),
    ).toHaveCount(0)
    await expect(publicPage.getByText('operator@example.com')).toHaveCount(0)
  })

  await test.step('9. Add a vehicle', async () => {
    await operatorPage.goto('/operator/offerings')
    await operatorPage.getByLabel('Plaka').first().fill('34 ABC 123')
    await operatorPage.getByLabel('Kapasite').first().fill('16')
    await operatorPage.getByRole('button', { name: 'Araç ekle' }).click()
    await expect(operatorPage.getByText('Araç eklendi.')).toBeVisible()
  })

  await test.step('10. Create and publish an offering', async () => {
    await operatorPage
      .getByLabel('Okul bağlantısı')
      .first()
      .selectOption({ label: 'Örnek Okulu' })
    await operatorPage
      .getByLabel('Etkin araç')
      .first()
      .selectOption({ label: '34 ABC 123 — 16 kişi' })
    await operatorPage
      .getByLabel('Uygun koltuk (isteğe bağlı)')
      .first()
      .fill('4')
    await operatorPage
      .getByLabel('Açıklama (isteğe bağlı)')
      .first()
      .fill('Sabah ve akşam servisi')
    await operatorPage
      .getByRole('button', { name: 'Servis taslağı oluştur' })
      .click()
    await expect(
      operatorPage.getByText('Servis taslağı oluşturuldu.'),
    ).toBeVisible()

    await operatorPage.getByText('Servisi düzenle').click()
    await operatorPage
      .getByRole('group', { name: 'Kadıköy' })
      .getByRole('checkbox', { name: 'Moda' })
      .check()
    await operatorPage
      .getByRole('button', { name: 'Servis kapsamını kaydet' })
      .click()
    await operatorPage.getByRole('button', { name: 'Yayımla' }).click()
    await expect(operatorPage.getByText('Servis yayımlandı.')).toBeVisible()
  })

  await test.step('11. Show the offering only in its specific coverage', async () => {
    await search(publicPage, 'Kadıköy', 'Moda')
    await expect(publicPage.getByText('Sabah ve akşam servisi')).toBeVisible()
    await expect(publicPage.getByText('Uygun koltuk: 4/16')).toBeVisible()

    await search(publicPage, 'Üsküdar', 'Acıbadem')
    await expect(
      publicPage.getByRole('heading', { name: '1 işletmeci bulundu' }),
    ).toBeVisible()
    await expect(publicPage.getByText('Sabah ve akşam servisi')).toHaveCount(0)
  })

  await test.step('12. Update and display an official tariff', async () => {
    await adminPage.goto('/admin/tariffs')
    const editor = adminPage.getByLabel('Tarife JSON içeriği')
    const updatedTariff = {
      ...state.tariff,
      version: 'v2',
      sourceTitle: 'Güncel UKOME kararı',
    }
    await editor.fill(JSON.stringify(updatedTariff, null, 2))
    await adminPage.getByRole('button', { name: 'Tarifeyi kaydet' }).click()
    await expect(
      adminPage.getByText('Tarife v2 sürümüyle kaydedildi.'),
    ).toBeVisible()

    await search(publicPage, 'Kadıköy', 'Moda')
    await expect(
      publicPage.getByRole('link', {
        name: 'Güncel UKOME kararı kaynağını aç',
      }),
    ).toBeVisible()
    await expect(
      publicPage.getByText('Bu tarife kişisel fiyat teklifi değildir.'),
    ).toBeVisible()
  })

  await test.step('13. Suspend the operator and verify visibility and session removal', async () => {
    await adminPage.goto(
      '/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20',
    )
    await adminPage
      .getByRole('button', { name: 'İşletmeciyi askıya al' })
      .click()
    await expect(adminPage.getByText('İşletmeci askıya alındı.')).toBeVisible()

    await operatorPage.goto('/operator/profile')
    await expect(operatorPage).toHaveURL(/\/operator\/login\?.*reason=session/)
    await expect(operatorPage.getByText('Oturumunuz sona erdi.')).toBeVisible()

    await search(publicPage, 'Kadıköy', 'Moda')
    await expect(
      publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
    ).toBeVisible()
    await expect(publicPage.getByText('+905321234568')).toHaveCount(0)
  })

  const expectedRevocationErrors = browserErrors.filter((message) =>
    message.includes('401 (Unauthorized)'),
  )
  expect(expectedRevocationErrors).toHaveLength(1)
  expect(
    browserErrors.filter((message) => !message.includes('401 (Unauthorized)')),
  ).toEqual([])
  await Promise.all([
    operatorContext.close(),
    adminContext.close(),
    publicContext.close(),
  ])
})

test('edits school filters after listing and keeps pickup geography separate', async ({
  page,
}) => {
  const state = createMockApiState()
  await installMockApi(page, state)
  await page.goto('/')
  await page
    .getByLabel('Okulun bulunduğu il')
    .selectOption({ label: 'İstanbul' })

  const schoolNames = page.locator('.school-result-list strong')
  await expect(schoolNames).toHaveText([
    'Atatürk İlkokulu',
    'Örnek Okulu',
    'Zübeyde Hanım İlkokulu',
  ])

  await page.getByLabel('Sıralama').selectOption('name-desc')
  await expect(schoolNames).toHaveText([
    'Zübeyde Hanım İlkokulu',
    'Örnek Okulu',
    'Atatürk İlkokulu',
  ])

  await page.getByLabel('Okul adında ara').fill('ornek')
  await page.getByRole('button', { name: 'Okullarda ara' }).click()
  await expect(schoolNames).toHaveText(['Örnek Okulu'])

  await page.getByRole('button', { name: 'Filtreleri temizle' }).click()
  await expect(schoolNames).toHaveCount(3)
  await page.getByLabel('Okulun ilçesi').selectOption({ label: 'Üsküdar' })
  await expect(schoolNames).toHaveText(['Zübeyde Hanım İlkokulu'])

  await page
    .getByRole('button', { name: 'Zübeyde Hanım İlkokulu okulunu seç' })
    .click()
  await expect(page.getByText('Seçilen okul')).toBeVisible()
  await expect(page.getByLabel('Servis alınacak ilçe')).toBeEnabled()
  await expect(page.getByLabel('Servis alınacak mahalle')).toBeDisabled()
})

test('operator reaches and selects a school beyond the first 50 results', async ({
  page,
}) => {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  await installMockApi(page, state)

  const catalog = Array.from({ length: 51 }, (_, index) => ({
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    neighborhoodId: 101,
    neighborhoodName: 'Moda',
    districtId: 10,
    districtName: 'Kadıköy',
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
    name: `Okul ${String(index + 1).padStart(3, '0')}`,
    address: null,
    sourceName: null,
    sourceCode: null,
    active: true,
  }))
  const requestedPages: number[] = []
  await page.route('**/api/v1/schools?**', async (route) => {
    const url = new URL(route.request().url())
    const pageNumber = Number(url.searchParams.get('page') ?? '0')
    const pageSize = Number(url.searchParams.get('size') ?? '10')
    requestedPages.push(pageNumber)
    const start = pageNumber * pageSize
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: catalog.slice(start, start + pageSize),
        page: pageNumber,
        size: pageSize,
        totalElements: catalog.length,
        totalPages: Math.ceil(catalog.length / pageSize),
      }),
    })
  })

  await login(page, 'operator@example.com')
  await page.goto('/operator/schools')
  await expect(page.getByText('51 aktif okul')).toBeVisible()
  for (let pageNumber = 1; pageNumber < 6; pageNumber += 1) {
    await page.getByRole('button', { name: 'Sonraki sayfa' }).click()
    await expect(page.getByText(`Sayfa ${pageNumber + 1} / 6`)).toHaveCount(2)
  }

  await page
    .getByLabel('Aktif okul')
    .selectOption({ label: 'Okul 051 — Kadıköy' })
  await expect(page.getByLabel('Aktif okul')).toHaveValue(catalog[50]!.id)
  expect([...new Set(requestedPages)]).toEqual([0, 1, 2, 3, 4, 5])
})

async function login(page: Page, email: string) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('uzun-ve-guvenli-sifre')
  if (email === 'operator@example.com') {
    await page.getByLabel('Beni hatırla').check()
  }
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(
    email === 'operator@example.com' ? /\/operator$/ : /\/admin(?:\/|$)/,
  )
}

async function search(page: Page, district: string, neighborhood: string) {
  await page.goto('/')
  await page
    .getByLabel('Okulun bulunduğu il')
    .selectOption({ label: 'İstanbul' })
  await page.getByText('Örnek Okulu', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }).click()
  await page
    .locator('select[name="districtId"]')
    .selectOption({ label: district })
  await page
    .locator('select[name="neighborhoodId"]')
    .selectOption({ label: neighborhood })
  await page.getByRole('button', { name: 'Servis işletmecilerini bul' }).click()
}
