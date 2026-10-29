import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

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

  await page
    .getByRole('button', { name: 'Mevcut servisleri kontrol et' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Görünür servis bulunamadı' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yeni talep oluştur' }).click()
  await expect(page).toHaveURL(/\/parent\/login\?next=/)
  await page.getByRole('link', { name: 'Veli hesabı oluşturun' }).click()
  await expect(page).toHaveURL(/\/parent\/register\?next=/)

  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')
  await page.getByRole('button', { name: 'Veli hesabı oluştur' }).click()
  await expect(page).toHaveURL(/\/parent\/login\?.*registered=parent/)
  await expect(
    page.getByText(/Devam etmek için veli hesabınızla giriş yapın/),
  ).toBeVisible()
  expect(state.parentRegistered).toBe(true)

  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByText(/Seçiminiz korundu/)).toBeVisible()
  await page
    .getByRole('button', { name: 'Mevcut servisleri kontrol et' })
    .click()
  await page.getByRole('button', { name: 'Yeni talep oluştur' }).click()
  await page.getByLabel('Uygun servis bulamıyorum').check()
  await page
    .getByRole('button', { name: 'Talebi ve desteğimi oluştur' })
    .click()

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
