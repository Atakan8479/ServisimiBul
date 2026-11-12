import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

test('keeps a prefilled mobile selection while starting creation from a populated non-open tab', async ({
  page,
}) => {
  const state = createMockApiState()
  state.demandCreated = true
  state.demandClosure = 'FULFILLED'
  await page.setViewportSize({ width: 320, height: 800 })
  await installMockApi(page, state)
  await page.goto(
    '/demands?schoolId=6de54e65-6e04-4168-a1cb-967a98d7ec12&pickupDistrictId=11&neighborhoodId=201&academicYear=2026-2027&intent=create',
  )

  await expect(page.getByLabel('Eğitim yılı')).toHaveValue('2026-2027')
  await page.getByRole('button', { name: 'Karşılandı' }).click()
  await expect(
    page.getByText('1 karşılanan talep', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Yeni talep oluştur' }).first().click()

  await expect(page).toHaveURL(/\/demands\/new\?.*schoolId=/)
  await expect(
    page.getByRole('heading', { name: 'Yeni servis talebi oluştur' }),
  ).toBeVisible()
  await expect(page.getByLabel('Eğitim yılı')).toHaveValue('2026-2027')
  await expect(page.getByLabel('Servis alınacak mahalle')).toHaveValue('201')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
})

test('parent creates and manages an anonymous demand after checking operators', async ({
  page,
}) => {
  const state = createMockApiState()
  await installMockApi(page, state)
  await page.goto('/demands')

  await page.getByLabel('Okulun bulunduğu il').selectOption('34')
  await page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }).click()
  await page.getByLabel('Servis alınacak ilçe').selectOption('11')
  await page.getByLabel('Servis alınacak mahalle').selectOption('201')
  await page.getByRole('button', { name: 'Talepleri göster' }).click()
  await expect(
    page.getByRole('heading', { name: 'Bu seçim için açık talep yok' }),
  ).toBeVisible()

  await expect(
    page.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Yeni talep oluştur' }).first().click()
  await expect(
    page.getByRole('heading', { name: 'Yeni servis talebi oluştur' }),
  ).toBeVisible()
  await page.getByLabel('Uygun servis bulamıyorum').check()
  await page.getByRole('button', { name: 'Bilgileri gözden geçir' }).click()
  await expect(page).toHaveURL(/\/parent\/login\?next=/)
  await expect(page).not.toHaveURL(/NO_SUITABLE_SERVICE/)
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Yeni servis talebi oluştur' }),
  ).toBeVisible()
  await expect(page.getByLabel('Uygun servis bulamıyorum')).toBeChecked()
  await page.goForward()
  await expect(
    page.getByRole('heading', { name: 'Yeniden hoş geldiniz.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Veli hesabı oluşturun' }).click()
  await expect(page).toHaveURL(/\/parent\/register\?next=/)
  // The URL updates before the view transition swaps out the login form's same-labelled fields.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Veli hesabı oluşturun' }),
  ).toBeVisible()

  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/auth/parent/register'),
  )
  await page.getByRole('button', { name: 'Veli hesabı oluştur' }).click()

  const registrationResponse = await registrationResponsePromise
  expect(registrationResponse.status()).toBe(202)
  expect(registrationResponse.request().postDataJSON()).toEqual({
    email: 'parent@example.com',
    password: 'parent password',
  })
  expect(registrationResponse.request().headers()['x-csrf-token']).toBe(
    'e2e-csrf-token',
  )
  expect(state.parentRegistered).toBe(true)

  await expect(page).toHaveURL(/\/parent\/login\?.*registered=parent/)
  await expect(
    page.getByText(/Devam etmek için veli hesabınızla giriş yapın/),
  ).toBeVisible()

  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/demands\/new\?.*schoolId=/)
  await expect(page.getByLabel('Uygun servis bulamıyorum')).toBeChecked()
  await page.reload()
  await expect(page.getByLabel('Uygun servis bulamıyorum')).not.toBeChecked()
  await expect(page.getByLabel(/^Sabah/)).toBeChecked()
  await page.getByLabel('Uygun servis bulamıyorum').check()
  await page.getByRole('button', { name: 'Bilgileri gözden geçir' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Talebi onaylayın' })
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByText('Örnek Okulu')).toBeVisible()
  await expect(confirmation.getByText('Acıbadem, Üsküdar')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Bilgileri gözden geçir' }),
  ).toBeFocused()
  await expect(page.getByLabel('Uygun servis bulamıyorum')).toBeChecked()
  await page.getByRole('button', { name: 'Bilgileri gözden geçir' }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Talebi oluştur' }).click()

  await expect(page.getByText('Talebiniz oluşturuldu.')).toBeVisible()
  await expect(page.getByText('Destekliyorsunuz')).toBeVisible()
  expect(state.demandCreated).toBe(true)
  expect(state.parentSupport?.status).toBe('ACTIVE')

  await page.getByRole('button', { name: 'Desteğimi düzenle' }).click()
  await page.getByLabel(/^Öğleden sonra/).check()
  await page.getByRole('button', { name: 'Tercihlerimi kaydet' }).click()
  await expect(
    page.getByText('Destek tercihleriniz güncellendi.'),
  ).toBeVisible()
  expect(state.parentSupport?.needsAfternoon).toBe(true)

  await page.getByRole('button', { name: 'Desteğimi geri çek' }).click()
  await expect(page.getByText(/Desteğiniz geri çekildi/)).toBeVisible()
  expect(state.parentSupport?.status).toBe('WITHDRAWN')

  await page
    .getByRole('button', { name: 'Desteğimi yeniden etkinleştir' })
    .click()
  await page
    .getByRole('button', { name: 'Desteğimi yeniden etkinleştir' })
    .click()
  await expect(
    page.getByText('Desteğiniz yeniden etkinleştirildi.'),
  ).toBeVisible()
  expect(state.parentSupport?.status).toBe('ACTIVE')

  await page.getByRole('button', { name: 'Yorum yaz' }).click()
  await page
    .getByLabel('Yorumunuz')
    .fill('Sabah saati için iletişim kurabiliriz.')
  await page.getByRole('button', { name: 'Yorumu yayınla' }).click()
  await expect(page.getByText('Yorumunuz yayınlandı.')).toBeVisible()
  await expect(
    page.getByText('Sabah saati için iletişim kurabiliriz.'),
  ).toBeVisible()
  expect(state.demandComments).toHaveLength(1)

  await page.getByRole('button', { name: 'Yorumumu sil' }).click()
  await expect(page.getByText('Yorumunuz silindi.')).toBeVisible()
  expect(state.demandComments).toHaveLength(0)
})

test('eligible operator publishes and withdraws a demand-specific service response', async ({
  page,
}) => {
  const state = createMockApiState()
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Moda Öğrenci Servisi'
  state.operatorSchoolAdded = true
  state.generalCoverage = [201]
  state.demandCreated = true
  await installMockApi(page, state)

  await page.goto(`/demands/481be36b-c8ee-4c03-868e-47bbc19b7735`)
  await page.getByRole('button', { name: 'Bu talep için servis ekle' }).click()
  await expect(page).toHaveURL(/\/operator\/login\?next=/)
  await expect(page.getByText(/İşletmeci hesabınız yoksa/)).toBeVisible()

  await page.getByLabel('E-posta').fill('operator@example.com')
  await page.getByLabel('Şifre').fill('operator password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(
    page.getByRole('group', { name: 'Hangi yönlerde servis sunuyorsunuz?' }),
  ).toBeVisible()
  await page.getByLabel(/^Öğleden sonra/).check()
  await page.getByRole('button', { name: 'Servis bildirimini yayınla' }).click()

  await expect(
    page.getByText('Servis bildiriminiz velilere hemen yayınlandı.'),
  ).toBeVisible()
  await expect(page.getByText('Moda Öğrenci Servisi')).toBeVisible()
  await expect(page.getByText('Bildiriminiz yayında')).toBeVisible()
  expect(state.serviceResponse).toMatchObject({
    status: 'ACTIVE',
    offersMorning: true,
    offersAfternoon: true,
    publicationVersion: 1,
  })

  await page.getByRole('button', { name: 'Bildirimi geri çek' }).click()
  await expect(page.getByText(/Servis bildiriminiz geri çekildi/)).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Henüz servis bildirimi yok' }),
  ).toBeVisible()
  expect(state.serviceResponse?.status).toBe('WITHDRAWN')
})
