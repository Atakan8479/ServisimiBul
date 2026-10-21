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
  await expect(page).toHaveURL(/\/operator\/login\?next=/)
  await expect(page.getByText(/Veli hesapları pilot kapsamında/)).toBeVisible()

  await page.getByLabel('E-posta').fill('parent@example.com')
  await page.getByLabel('Şifre').fill('parent password')
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

  await expect(
    page.getByText('Talebiniz oluşturuldu ve desteğiniz eklendi.'),
  ).toBeVisible()
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
