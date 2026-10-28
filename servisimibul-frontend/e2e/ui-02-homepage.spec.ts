import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const

for (const viewport of viewports) {
  test(`public discovery remains complete at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installMockApi(page, createMockApiState())
    await page.goto('/')

    await expect(
      page.getByRole('heading', {
        name: 'Okulunu seç. Mahallene hizmet veren işletmecileri bul.',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Talep panosunu incele' }),
    ).toHaveAttribute('href', '/demands')
    await expect(
      page.getByRole('img', {
        name: "İstanbul'da ilerleyen sarı okul servis aracı",
      }),
    ).toBeVisible()
    expect(
      await page
        .getByRole('img', {
          name: "İstanbul'da ilerleyen sarı okul servis aracı",
        })
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0)

    await expect(page.getByLabel('Okulun bulunduğu il')).toBeEnabled()
    await expect(page.getByLabel('Okulun ilçesi')).toBeDisabled()
    await expect(page.getByLabel('Servis alınacak ilçe')).toBeDisabled()
    await expect(page.getByLabel('Servis alınacak mahalle')).toBeDisabled()

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)

    if (process.env.UI02_CAPTURE === '1') {
      const filename =
        viewport.width === 1440
          ? 'public-desktop.png'
          : viewport.width === 390
            ? 'public-mobile.png'
            : undefined
      if (filename) {
        await page.screenshot({
          fullPage: true,
          path: `../docs/screenshots/ui-02/after/${filename}`,
        })
      }
    }
  })
}

test('hero CTA moves keyboard focus into the unchanged live search flow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, createMockApiState())
  await page.goto('/')

  const searchCta = page.getByRole('link', { name: 'Okul aramaya başla' })
  await searchCta.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/#school-search$/)
  await expect(
    page.getByRole('heading', { name: 'Önce okulunuzu seçin' }),
  ).toBeInViewport()

  await page.getByLabel('Okulun bulunduğu il').selectOption('34')
  await expect(page.getByLabel('Okulun ilçesi')).toBeEnabled()
  await page.getByRole('button', { name: 'Örnek Okulu okulunu seç' }).click()
  await expect(page.getByLabel('Servis alınacak ilçe')).toBeEnabled()
})
