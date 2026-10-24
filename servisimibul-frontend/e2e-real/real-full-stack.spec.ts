import { expect, test, type Page } from '@playwright/test'

const operatorEmail = 'j03.operator@example.test'
const operatorPassword = 'J03-operator-password'
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD
const parentEmail = process.env.J03_PARENT_EMAIL ?? 'j03.parent@example.test'
const parentPassword = process.env.J03_PARENT_PASSWORD
const parentDemandPath =
  '/demands?schoolId=10000000-0000-4000-8000-000000000001&pickupDistrictId=3402&neighborhoodId=340201&intent=create'

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
  const parentContext = await browser.newContext()
  const operatorPage = await operatorContext.newPage()
  const adminPage = await adminContext.newPage()
  const publicPage = await publicContext.newPage()
  const parentPage = await parentContext.newPage()

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

    await test.step('register a parent and return safely to the intended demand', async () => {
      expect(
        parentPassword,
        'J03_PARENT_PASSWORD must be supplied by the isolated runner',
      ).toBeTruthy()
      await parentPage.goto(
        `/parent/register?next=${encodeURIComponent(parentDemandPath)}`,
      )
      await parentPage.getByLabel('E-posta').fill(parentEmail)
      await parentPage.getByLabel('Şifre').fill(parentPassword!)
      const registration = parentPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/auth/parent/register'),
      )
      await parentPage
        .getByRole('button', { name: 'Veli hesabı oluştur' })
        .click()
      expect((await registration).status()).toBe(202)
      await expect(parentPage).toHaveURL(
        /\/operator\/login\?.*registered=parent/,
      )
      await expect(parentPage.getByText(/Kayıt isteğiniz alındı/)).toBeVisible()

      await parentPage.getByLabel('E-posta').fill(parentEmail)
      await parentPage.getByLabel('Şifre').fill(parentPassword!)
      await parentPage.getByRole('button', { name: 'Giriş yap' }).click()
      await expect
        .poll(() => {
          const url = new URL(parentPage.url())
          return `${url.pathname}${url.search}`
        })
        .toBe(parentDemandPath)
      await expect(parentPage.getByText(/Seçiminiz korundu/)).toBeVisible()
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

    let operatorProfileId = ''
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
      await expect(adminPage).toHaveURL(/\/admin\/applications\/[0-9a-f-]+$/)
      operatorProfileId = new URL(adminPage.url()).pathname.split('/').at(-1)!
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

      const adminCsrf = await csrf(adminPage)
      const approved = await adminPage.request.post(
        `/api/v1/admin/operators/${operatorProfileId}/approve`,
        { headers: { [adminCsrf.headerName]: adminCsrf.token } },
      )
      expect(approved.status()).toBe(200)
      expect(
        (await approved.json()) as {
          profile: { approvalStatus: string }
        },
      ).toMatchObject({ profile: { approvalStatus: 'APPROVED' } })
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

    await test.step('publish a demand service and resolve parent feedback against the real API', async () => {
      await parentPage.goto(parentDemandPath)
      await expect(parentPage.getByText(/Seçiminiz korundu/)).toBeVisible()
      await parentPage
        .getByRole('button', { name: 'Mevcut servisleri kontrol et' })
        .click()
      await expect(
        parentPage.getByRole('heading', { name: '1 mevcut servis bulundu' }),
      ).toBeVisible()
      await parentPage
        .getByRole('button', { name: 'Yine de servise ihtiyacım var' })
        .click()
      await parentPage.getByLabel('Uygun servis bulamıyorum').check()
      const created = parentPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/demands'),
      )
      await parentPage
        .getByRole('button', { name: 'Talebi ve desteğimi oluştur' })
        .click()
      expect((await created).status()).toBe(201)
      await expect(
        parentPage.getByText('Talebiniz oluşturuldu ve desteğiniz eklendi.'),
      ).toBeVisible()
      const demandId = new URL(parentPage.url()).pathname.split('/').at(-1)!
      const responsePath = `/api/v1/operator/demands/${demandId}/response`
      const operatorCsrf = await csrf(operatorPage)
      const published = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: false },
      })
      expect(published.status()).toBe(200)
      expect((await published.json()) as { published: boolean }).toMatchObject({
        published: true,
      })

      await parentPage.goto(`/demands/${demandId}`)
      await parentPage
        .getByRole('button', { name: 'Bildir', exact: true })
        .click()
      await expect(
        parentPage.getByText(/içeriği otomatik olarak gizlemez/),
      ).toBeVisible()
      await parentPage
        .getByLabel('Bildirim nedeni')
        .selectOption('MISLEADING_SERVICE')
      await parentPage
        .getByLabel('Açıklama (isteğe bağlı)')
        .fill('Gerçek tam yığın yönetim incelemesi.')
      await parentPage.getByRole('button', { name: 'Bildirimi gönder' }).click()
      await expect(parentPage.getByText('Bildirim alındı')).toBeVisible()
      await expect(
        parentPage
          .getByRole('region', { name: 'İşletmeci servis bildirimleri' })
          .getByText('J03 Gerçek Servis'),
      ).toBeVisible()

      await parentPage.getByRole('button', { name: 'Karşılanmadı' }).click()
      await expect(
        parentPage.getByText(
          'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.',
        ),
      ).toBeVisible()
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ]) {
        await parentPage.setViewportSize(viewport)
        await parentPage.reload()
        await expect(
          parentPage.getByText(
            'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.',
          ),
        ).toBeVisible()
        expect(
          await parentPage.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(
          await parentPage.evaluate(() => document.documentElement.clientWidth),
        )
      }

      await adminPage.goto('/admin/moderation')
      await expect(
        adminPage.getByRole('heading', { name: 'İçerik bildirimleri' }),
      ).toBeVisible()
      await adminPage
        .getByRole('button', { name: /J03 Gerçek Servis service declaration/ })
        .click()
      await adminPage
        .getByLabel('Yönetici gerekçesi')
        .fill('Yanıltıcı hizmet bildirimi yönetici incelemesi.')
      await adminPage
        .getByRole('button', { name: 'Servis bildirimini geri çek' })
        .click()
      await expect(
        adminPage.getByText('Servis bildirimini geri çek işlemi kaydedildi.'),
      ).toBeVisible()

      await parentPage.reload()
      await expect(
        parentPage.getByRole('heading', { name: 'Henüz servis bildirimi yok' }),
      ).toBeVisible()
      const republished = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: false },
      })
      expect(republished.status()).toBe(200)
      await parentPage.reload()
      const satisfy = parentPage.getByRole('button', {
        name: 'Talebim karşılandı',
      })
      await satisfy.focus()
      await expect(satisfy).toBeFocused()
      await parentPage.keyboard.press('Enter')
      await expect(parentPage.getByText('Katılıma kapalı')).toBeVisible()
      const closed = await parentPage.request.get(`/api/v1/demands/${demandId}`)
      expect((await closed.json()) as { closureReason: string }).toMatchObject({
        closureReason: 'FULFILLED',
      })
    })

    await test.step('cover a mobile keyboard path without sharing authenticated state', async () => {
      // A fresh page avoids retained focus from the preceding real discovery journey.
      // A real browser Tab must focus the skip link; programmatic focus would hide regressions.
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      })
      try {
        const mobilePage = await mobileContext.newPage()
        await mobilePage.goto('/')
        const skipLink = mobilePage.getByRole('link', { name: 'İçeriğe geç' })
        await expect(skipLink).toBeAttached()
        await expect(
          mobilePage.getByRole('heading', { name: 'ServisimiBul' }),
        ).toBeVisible()
        await mobilePage.bringToFront()
        await mobilePage.keyboard.press('Tab')
        await expect(skipLink).toBeFocused()
        expect(
          await mobilePage.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(
          await mobilePage.evaluate(() => document.documentElement.clientWidth),
        )
        await expect(
          mobilePage.getByRole('link', { name: 'Giriş' }),
        ).toBeVisible()
      } finally {
        await mobileContext.close()
      }
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
      parentContext.close(),
    ])
  }
})

async function login(
  page: Page,
  email: string,
  password: string,
  expectedRole: 'admin' | 'operator' | 'parent',
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
  await expect(page).toHaveURL(
    expectedRole === 'parent'
      ? /\/demands(?:\/|$)/
      : new RegExp(`/${expectedRole}(?:/|$)`),
  )
}

async function search(page: Page, district: string, neighborhood: string) {
  await page.goto('/')
  await page
    .getByLabel('Okulun bulunduğu il')
    .selectOption({ label: 'İstanbul' })
  await page
    .getByRole('button', { name: 'J03 Gerçek Okulu okulunu seç' })
    .click()
  await selectLoadedOption(page, 'Servis alınacak ilçe', district)
  await selectLoadedOption(page, 'Servis alınacak mahalle', neighborhood)
  await page.getByRole('button', { name: 'Servis işletmecilerini bul' }).click()
}

async function selectLoadedOption(
  page: Page,
  fieldLabel: string,
  optionLabel: string,
) {
  const field = page.getByLabel(fieldLabel)
  const retry = page.getByRole('button', { name: 'Tekrar dene' })
  await expect
    .poll(
      async () => {
        if (await retry.isVisible()) await retry.click()
        return field.locator('option').allTextContents()
      },
      {
        message: `${fieldLabel} should load ${optionLabel}`,
        timeout: 15_000,
      },
    )
    .toContain(optionLabel)
  await field.selectOption({ label: optionLabel })
}

async function csrf(
  page: Page,
): Promise<{ headerName: string; token: string }> {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.ok()).toBe(true)
  return (await response.json()) as { headerName: string; token: string }
}
