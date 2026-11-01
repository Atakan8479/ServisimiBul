import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const roles = [
  {
    id: 'N01',
    email: 'parent@example.com',
    login: '/parent/login',
    landing: /\/demands$/,
    path: '/notifications',
  },
  {
    id: 'N02',
    email: 'operator@example.com',
    login: '/operator/login',
    landing: /\/operator$/,
    path: '/operator/notifications',
  },
  {
    id: 'N03',
    email: 'admin@example.com',
    login: '/operator/login',
    landing: /\/admin\/applications$/,
    path: '/admin/notifications',
  },
] as const

const stage = process.env.UI_FIDELITY_18_CAPTURE

for (const role of roles) {
  for (const viewport of viewports) {
    test(`${role.id} stays accessible and contained on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await prepare(page, role, feed())
      await page.goto(role.path)
      await expect(page.getByText('Yeni servis talebi')).toBeVisible()
      await assertAccessibleAndContained(page)
      await capture(page, `${role.id}-${viewport.name}`, viewport.name)
    })
  }
}

test('N01 marks every unread item through the real endpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const notifications = feed()
  await prepare(page, roles[0], notifications)
  const marked: string[] = []
  await page.route('**/api/v1/notifications/*/read', async (route) => {
    const id = route.request().url().split('/').at(-2)!
    marked.push(id)
    const item = notifications.find((entry) => entry.id === id)!
    item.readAt = '2026-10-25T09:30:00Z'
    await route.fulfill({ json: item })
  })
  await page.goto('/notifications')

  await expect(page.getByText('2 okunmamış bildirim').first()).toBeVisible()
  const mark = page.getByRole('button', { name: 'Okundu olarak işaretle' })
  await mark.first().click()
  await expect(mark).toHaveCount(1)
  await expect(
    page
      .getByRole('button', { name: 'İncele' })
      .and(page.locator('#notification-' + notifications[0]!.id)),
  ).toBeFocused()
  await mark.first().click()
  await expect(mark).toHaveCount(0)
  expect(marked).toHaveLength(2)

  await expect(page.getByText('Hepsi okundu')).toBeVisible()
  await expect(page.getByText('0 okunmamış bildirim')).toBeVisible()
  await assertAccessibleAndContained(page)
  await capture(page, 'state-N01-all-read', 'mobile')
})

test('N01 marks all notifications read through the real endpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const notifications = feed()
  await prepare(page, roles[0], notifications)
  let calls = 0
  await page.route('**/api/v1/notifications/read-all', async (route) => {
    expect(route.request().method()).toBe('PUT')
    calls += 1
    notifications.forEach((item) => {
      item.readAt ??= '2026-10-25T09:30:00Z'
    })
    await route.fulfill({ json: { unreadCount: 0 } })
  })
  await page.goto('/notifications')

  await page.getByRole('button', { name: 'Tümünü okundu işaretle' }).click()

  const notice = page.getByText('Tüm bildirimler okundu olarak işaretlendi.')
  await expect(notice).toBeFocused()
  expect(calls).toBe(1)
  await expect(page.getByText('Hepsi okundu')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Okundu olarak işaretle' }),
  ).toHaveCount(0)
  await expect(page.getByLabel(/okunmamış bildirim/)).toHaveCount(0)
  await assertAccessibleAndContained(page)
})

async function prepare(
  page: Page,
  role: (typeof roles)[number],
  notifications: ReturnType<typeof feed>,
) {
  const state = createMockApiState()
  state.verified = true
  await installMockApi(page, state)
  await page.route('**/api/v1/notifications*', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname !== '/api/v1/notifications') return route.fallback()
    await route.fulfill({
      json: {
        content: notifications,
        page: 0,
        size: 20,
        totalElements: notifications.length,
        totalPages: 1,
      },
    })
  })
  await page.route('**/api/v1/notifications/unread-count', (route) =>
    route.fulfill({
      json: {
        unreadCount: notifications.filter((item) => !item.readAt).length,
      },
    }),
  )
  await page.goto(role.login)
  await page.getByLabel('E-posta').fill(role.email)
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(role.landing)
}

async function assertAccessibleAndContained(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

async function capture(page: Page, name: string, viewport: string) {
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.scrollTo(0, 0)
  })
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-fidelity-18/${stage}/${name}.png`,
  })
}

function feed() {
  return [
    notification(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'DEMAND_CREATED',
      'Yeni servis talebi',
      'Örnek Okulu için yeni bir talep açıldı.',
      null,
    ),
    notification(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'CONTENT_REPORTED',
      'Yeni içerik bildirimi',
      'Bir talep yorumu incelenmeyi bekliyor.',
      null,
    ),
    notification(
      'aaaaaaaa-0000-4000-8000-000000000003',
      'SERVICE_PUBLISHED',
      'Servis yayınlandı',
      'Talebinize bir işletmeci yanıt verdi.',
      '2026-10-25T09:10:00Z',
    ),
  ]
}

function notification(
  id: string,
  type: string,
  title: string,
  message: string,
  readAt: string | null,
) {
  return {
    id,
    type,
    demandId: null,
    serviceResponseId: null,
    publicationEventId: null,
    feedbackId: null,
    moderationCaseId: null,
    title,
    message,
    href: '/demands',
    createdAt: '2026-10-25T09:00:00Z',
    readAt,
  }
}
