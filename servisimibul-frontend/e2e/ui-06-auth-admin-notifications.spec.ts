import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'mobile-320', width: 320, height: 844 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

test('auth screens remain accessible and contained at every supported width', async ({
  page,
}) => {
  await installMockApi(page, createMockApiState())

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/parent/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoOverflow(page)
    await expectAxeClean(page)

    await page.goto('/operator/register')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoOverflow(page)
    await expectAxeClean(page)
  }

  await page.setViewportSize(viewports[1])
  await page.goto('/operator/register')
  await capture(page, 'operator-registration-mobile.png')
  await page.setViewportSize(viewports[3])
  await page.goto('/parent/login')
  await capture(page, 'parent-login-desktop.png')
})

test('admin and notification workspaces remain accessible and contained', async ({
  page,
}) => {
  await installMockApi(page, createMockApiState())
  await page.route('**/api/v1/notifications*', async (route) => {
    if (new URL(route.request().url()).pathname !== '/api/v1/notifications') {
      await route.fallback()
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: '7bd12425-ea60-45e5-b937-ddf75db2eb45',
            type: 'DEMAND_CREATED',
            demandId: '481be36b-c8ee-4c03-868e-47bbc19b7735',
            serviceResponseId: null,
            publicationEventId: null,
            feedbackId: null,
            moderationCaseId: null,
            title: 'Yeni servis talebi',
            message:
              'Hizmet verdiğiniz okulun kapsama alanında yeni bir talep oluşturuldu.',
            href: '/demands/481be36b-c8ee-4c03-868e-47bbc19b7735',
            createdAt: '2026-10-29T09:00:00Z',
            readAt: null,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    })
  })

  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill('admin@example.com')
  await page.getByLabel('Şifre').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/admin\/applications$/)
  await settleAnimations(page)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/admin/applications')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoOverflow(page)
    await expectAxeClean(page)

    await page.goto('/admin/notifications')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoOverflow(page)
    await expectAxeClean(page)
  }

  await page.setViewportSize(viewports[1])
  await page.goto('/admin/notifications')
  await expect(page.getByText('Yeni servis talebi')).toBeVisible()
  await capture(page, 'notification-center-mobile.png')
  await page.setViewportSize(viewports[3])
  await page.goto('/admin/applications')
  await expect(page.getByText('İsimsiz işletme')).toBeVisible()
  await capture(page, 'admin-workspace-desktop.png')
})

async function expectAxeClean(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(scan.violations).toEqual([])
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
}

async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    )
  })
}

async function capture(page: Page, fileName: string) {
  const phase = process.env.UI06_SCREENSHOT_PHASE
  if (phase !== 'before' && phase !== 'after') return
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: `../docs/screenshots/ui-06/${phase}/${fileName}`,
  })
}
