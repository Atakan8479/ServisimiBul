import { expect, test, type Page } from '@playwright/test'

const operatorEmail = 'j03.operator@example.test'
const operatorPassword = 'J03-operator-password'
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD

test('runs the approved MVP journey against the real backend and PostgreSQL', async ({
  browser,
}) => {
  expect(
    adminPassword,
    'J03_ADMIN_PASSWORD must be supplied by the isolated runner',
  ).toBeTruthy()

  const operatorContext = await browser.newContext()
  const adminContext = await browser.newContext()
  const publicContext = await browser.newContext()
  const operatorPage = await operatorContext.newPage()
  const adminPage = await adminContext.newPage()
  const publicPage = await publicContext.newPage()

  adminPage.on('dialog', (dialog) => void dialog.accept())

  try {
    await test.step('register through the local-only verification bypass', async () => {
      await operatorPage.goto('/operator/register')
      await operatorPage.getByLabel('E-posta').fill(operatorEmail)
      await operatorPage.getByLabel('Şifre').fill(operatorPassword)
      await operatorPage
        .getByLabel('İşletme adı (isteğe bağlı)')
        .fill('J03 Gerçek Servis')
      await operatorPage
        .getByLabel('Herkese açık iletişim telefonu')
        .fill('0532 111 22 33')
      await operatorPage.getByRole('button', { name: 'Hesap oluştur' }).click()
      await expect(
        operatorPage.getByRole('heading', { name: 'Hesabınız hazır' }),
      ).toBeVisible()
    })

    await test.step('use a real session and reject a mutation without CSRF', async () => {
      await login(operatorPage, operatorEmail, operatorPassword, 'operator')
      await expect(operatorPage).toHaveURL(/\/operator$/)

      const csrfStatus = await operatorPage.evaluate(async () => {
        const response = await fetch('/api/v1/operator/application/submit', {
          method: 'POST',
          credentials: 'include',
        })
        return response.status
      })
      expect(csrfStatus).toBe(403)
    })

    await test.step('complete, submit, correct, and approve the profile', async () => {
      await operatorPage.goto('/operator/profile')
      await operatorPage
        .getByLabel('Kısa açıklama')
        .fill('J03 gerçek tam yığın doğrulaması')
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await expect(
        operatorPage.getByText('Profil bilgileriniz kaydedildi.'),
      ).toBeVisible()
      await operatorPage
        .getByRole('button', { name: 'Başvuruyu gönder' })
        .click()
      await expect(operatorPage.getByText('İncelemede')).toBeVisible()

      await login(adminPage, adminEmail, adminPassword!, 'admin')
      await adminPage.goto('/admin/applications')
      await adminPage.getByRole('link', { name: 'Başvuruyu incele' }).click()
      await adminPage
        .getByLabel('Düzeltme nedeni')
        .fill('J03 düzeltme ve yeniden gönderim kontrolü.')
      await adminPage.getByRole('button', { name: 'Düzeltme iste' }).click()
      await expect(
        adminPage.getByText('Düzeltme talebi gönderildi.'),
      ).toBeVisible()

      await operatorPage.reload()
      await expect(operatorPage.getByText('Düzeltme istendi')).toBeVisible()
      await operatorPage
        .getByLabel('Herkese açık iletişim telefonu')
        .fill('+905321112244')
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await operatorPage.getByRole('button', { name: 'Yeniden gönder' }).click()
      await expect(operatorPage.getByText('İncelemede')).toBeVisible()

      await adminPage.reload()
      await adminPage.getByRole('button', { name: 'Başvuruyu onayla' }).click()
      await expect(adminPage.getByText('Başvuru onaylandı.')).toBeVisible()
    })

    let operatorSchoolId = ''
    await test.step('attach a school and save cross-district same-province coverage', async () => {
      await operatorPage.goto('/operator/schools')
      await operatorPage.getByLabel('Okul ara').fill('J03 Gerçek')
      await operatorPage.getByRole('button', { name: 'Ara' }).click()
      await operatorPage
        .getByLabel('Aktif okul')
        .selectOption({ label: 'J03 Gerçek Okulu — Kadıköy' })
      const created = operatorPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/operator/schools'),
      )
      await operatorPage.getByRole('button', { name: 'Okulu ekle' }).click()
      operatorSchoolId = ((await (await created).json()) as { id: string }).id

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
        operatorPage.getByText(/Hizmet kapsamı kaydedildi/),
      ).toBeVisible()
    })

    await test.step('enforce role and ownership boundaries through the real API', async () => {
      const adminCsrf = await csrf(adminPage)
      const adminDenied = await adminPage.request.post(
        '/api/v1/operator/schools',
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: { schoolId: '10000000-0000-4000-8000-000000000001' },
        },
      )
      expect(adminDenied.status()).toBe(403)

      const operatorCsrf = await csrf(operatorPage)
      const missingOwnedResource = await operatorPage.request.patch(
        '/api/v1/operator/schools/20000000-0000-4000-8000-000000000002',
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { active: false },
        },
      )
      expect(missingOwnedResource.status()).toBe(404)
    })

    await test.step('discover the operator anonymously without vehicle or offering', async () => {
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: '1 işletmeci bulundu' }),
      ).toBeVisible()
      await expect(publicPage.getByText('J03 Gerçek Servis')).toBeVisible()
      await expect(
        publicPage.getByRole('link', { name: '+905321112244' }),
      ).toBeVisible()
      await expect(
        publicPage.getByText('Paylaşılan servis bilgileri'),
      ).toHaveCount(0)
      await expect(publicPage.getByText(operatorEmail)).toHaveCount(0)
      await expect(
        publicPage.getByText('Bu tarife kişisel fiyat teklifi değildir.'),
      ).toBeVisible()
    })

    await test.step('invalidate and restore publication through profile and coverage state', async () => {
      await operatorPage.goto('/operator/profile')
      await operatorPage.getByLabel('Profilimi velilere göster').uncheck()
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
      ).toBeVisible()

      await operatorPage.getByLabel('Profilimi velilere göster').check()
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await operatorPage.goto('/operator/schools')
      await operatorPage
        .getByRole('button', { name: 'Kapsamı düzenle' })
        .click()
      await operatorPage
        .getByRole('group', { name: 'Kadıköy' })
        .getByRole('button', { name: 'Kadıköy' })
        .click()
      await operatorPage
        .getByRole('group', { name: 'Üsküdar' })
        .getByRole('button', { name: 'Üsküdar' })
        .click()
      await operatorPage.getByRole('checkbox', { name: 'Moda' }).uncheck()
      await operatorPage.getByRole('checkbox', { name: 'Acıbadem' }).uncheck()
      await operatorPage.getByRole('button', { name: 'Kapsamı kaydet' }).click()
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
      ).toBeVisible()

      const operatorCsrf = await csrf(operatorPage)
      const restored = await operatorPage.request.put(
        `/api/v1/operator/schools/${operatorSchoolId}/coverage`,
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { neighborhoodIds: [340101, 340201] },
        },
      )
      expect(restored.ok()).toBe(true)
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: '1 işletmeci bulundu' }),
      ).toBeVisible()
    })

    await test.step('persist an immutable UKOME version and expose it publicly', async () => {
      await adminPage.goto('/admin/tariffs')
      const editor = adminPage.getByLabel('Tarife JSON içeriği')
      const tariff = JSON.parse(await editor.inputValue()) as Record<
        string,
        unknown
      >
      tariff.version = 'j03-v2'
      tariff.sourceTitle = 'J03 güncel sentetik UKOME kararı'
      await editor.fill(JSON.stringify(tariff, null, 2))
      await adminPage.getByRole('button', { name: 'Tarifeyi kaydet' }).click()
      await expect(
        adminPage.getByText('Tarife j03-v2 sürümüyle kaydedildi.'),
      ).toBeVisible()

      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('link', {
          name: 'J03 güncel sentetik UKOME kararı kaynağını aç',
        }),
      ).toBeVisible()
    })

    await test.step('cover a mobile keyboard path without sharing authenticated state', async () => {
      await publicPage.setViewportSize({ width: 390, height: 844 })
      await publicPage.goto('/')
      await publicPage.bringToFront()
      await publicPage.evaluate(() => {
        document.body.tabIndex = -1
        document.body.focus()
      })
      await publicPage.keyboard.press('Tab')
      await expect(
        publicPage.getByRole('link', { name: 'İçeriğe geç' }),
      ).toBeFocused()
      await publicPage.evaluate(() => document.body.removeAttribute('tabindex'))
      expect(
        await publicPage.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(
        await publicPage.evaluate(() => document.documentElement.clientWidth),
      )
    })

    await test.step('suspend the operator, revoke the session, and remove discovery', async () => {
      await adminPage.goto('/admin/applications')
      await adminPage.getByLabel('Başvuru durumu').selectOption('APPROVED')
      await adminPage.getByRole('link', { name: 'Başvuruyu incele' }).click()
      await adminPage
        .getByRole('button', { name: 'İşletmeciyi askıya al' })
        .click()
      await expect(
        adminPage.getByText('İşletmeci askıya alındı.'),
      ).toBeVisible()

      await operatorPage.goto('/operator/profile')
      await expect(operatorPage).toHaveURL(
        /\/operator\/login\?.*reason=session/,
      )
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
      ).toBeVisible()
    })
  } finally {
    await Promise.all([
      operatorContext.close(),
      adminContext.close(),
      publicContext.close(),
    ])
  }
})

async function login(
  page: Page,
  email: string,
  password: string,
  expectedRole: 'admin' | 'operator',
) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill(password)
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      candidate.url().endsWith('/api/v1/auth/login'),
  )
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  expect((await response).status()).toBe(200)
  await expect(page).toHaveURL(new RegExp(`/${expectedRole}(?:/|$)`))
}

async function search(page: Page, district: string, neighborhood: string) {
  await page.goto('/')
  await page
    .getByLabel('Okulun bulunduğu il')
    .selectOption({ label: 'İstanbul' })
  await page
    .getByRole('button', { name: 'J03 Gerçek Okulu okulunu seç' })
    .click()
  await page
    .getByLabel('Servis alınacak ilçe')
    .selectOption({ label: district })
  await page
    .getByLabel('Servis alınacak mahalle')
    .selectOption({ label: neighborhood })
  await page.getByRole('button', { name: 'Servis işletmecilerini bul' }).click()
}

async function csrf(
  page: Page,
): Promise<{ headerName: string; token: string }> {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.ok()).toBe(true)
  return (await response.json()) as { headerName: string; token: string }
}
