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
      await prepare(page, role, feed(role.id))
      await page.goto(role.path)
      await expect(page.getByText('Yeni').first()).toBeAttached()
      await assertAccessibleAndContained(page)
      await capture(page, `${role.id}-${viewport.name}`, viewport.name)
    })
  }
}

test('N01 marks every unread item through the real endpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const notifications = feed('N01')
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
  const notifications = feed('N01')
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

test('N03 opens a report through its backend deep link and marks it read', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const notifications = feed('N03')
  await prepare(page, roles[2], notifications)
  const marked: string[] = []
  await page.route('**/api/v1/notifications/*/read', async (route) => {
    marked.push(route.request().url().split('/').at(-2)!)
    await route.fulfill({
      json: { ...notifications[0], readAt: '2026-10-25T09:30:00Z' },
    })
  })
  await page.goto('/admin/notifications')

  await page.getByRole('button', { name: 'İncele' }).first().click()

  await expect(page).toHaveURL(/\/admin\/moderation\?caseId=/)
  expect(marked).toEqual([notifications[0]!.id])
})

test('N01 keeps text readable and keyboard focus visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page, roles[0], feed('N01'))
  await page.goto('/notifications')
  const open = page.getByRole('button', { name: 'İncele' }).first()
  await expect(open).toBeVisible()

  expect(
    await page
      .locator('.road-lane')
      .first()
      .evaluate((node) => Number(getComputedStyle(node).opacity)),
  ).toBeLessThanOrEqual(0.12)
  const width = await page
    .locator('.notification-page')
    .evaluate((node) => node.getBoundingClientRect().width)
  expect(width).toBeGreaterThan(864)

  await open.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(open).toBeFocused()
  const outline = await open.evaluate((node) => {
    const style = getComputedStyle(node)
    return `${style.outlineStyle} ${style.outlineWidth}`
  })
  expect(outline).toBe('solid 3px')
})

test('N01 keeps keyboard access after failed actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page, roles[0], feed('N01'))
  const failure = {
    status: 503,
    contentType: 'application/problem+json',
    json: { title: 'Error', status: 503, detail: 'İşlem başarısız.' },
  }
  await page.route('**/api/v1/notifications/*/read', (route) =>
    route.fulfill(failure),
  )
  await page.route('**/api/v1/notifications/read-all', (route) =>
    route.fulfill(failure),
  )
  await page.goto('/notifications')

  for (const action of [
    page.getByRole('button', { name: 'İncele' }).first(),
    page.getByRole('button', { name: 'Okundu olarak işaretle' }).first(),
    page.getByRole('button', { name: 'Tümünü okundu işaretle' }),
  ]) {
    await action.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText('İşlem başarısız.')
    await expect(action).toBeEnabled()
    await expect(action).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('body')).not.toBeFocused()
  }
  await expect(page.getByText('2 okunmamış bildirim')).toBeVisible()
})

test('N02 shows an empty center without read actions', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await prepare(page, roles[1], [])
  await page.goto('/operator/notifications')

  await expect(page.getByText('Henüz bildiriminiz yok')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Tümünü okundu işaretle' }),
  ).toHaveCount(0)
  await assertAccessibleAndContained(page)
})

test('N01 retries a failed list and pages through results', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const notifications = feed('N01')
  await prepare(page, roles[0], notifications)
  let attempts = 0
  await page.route('**/api/v1/notifications?*', async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        json: { title: 'Error', status: 503, detail: 'Servis kullanılamıyor.' },
      })
      return
    }
    const requested = Number(
      new URL(route.request().url()).searchParams.get('page'),
    )
    await route.fulfill({
      json: {
        content: [notifications[requested]],
        page: requested,
        size: 20,
        totalElements: 21,
        totalPages: 2,
      },
    })
  })
  await page.goto('/notifications')

  await expect(page.getByRole('alert')).toContainText('Servis kullanılamıyor.')
  await expect(page.getByText('Henüz bildiriminiz yok')).toHaveCount(0)
  await assertAccessibleAndContained(page)
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByText('Servis uygunluğu bildirildi')).toBeVisible()
  await page.getByRole('button', { name: 'Sonraki' }).click()
  await expect(page.getByText('Geri bildiriminizi bekliyoruz')).toBeVisible()
  await expect(page.getByText('Sayfa 2 / 2')).toBeVisible()
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

const demandId = '481be36b-c8ee-4c03-868e-47bbc19b7735'

// Types and copy follow NotificationDeliveryService and NotificationService.
function feed(roleId: (typeof roles)[number]['id']) {
  if (roleId === 'N02') {
    return [
      notification(
        1,
        'DEMAND_CREATED',
        'Yeni servis talebi',
        'Hizmet verdiğiniz okulun mevcut kapsama alanında yeni bir talep oluşturuldu.',
        `/demands/${demandId}`,
        null,
      ),
      notification(
        2,
        'DEMAND_CREATED',
        'Yeni servis talebi',
        'Hizmet verdiğiniz okulun mevcut kapsama alanında yeni bir talep oluşturuldu.',
        `/demands/${demandId}`,
        null,
      ),
      notification(
        3,
        'DEMAND_CREATED',
        'Yeni servis talebi',
        'Hizmet verdiğiniz okulun mevcut kapsama alanında yeni bir talep oluşturuldu.',
        `/demands/${demandId}`,
        '2026-10-25T09:10:00Z',
      ),
    ]
  }
  if (roleId === 'N03') {
    return [
      notification(
        1,
        'CONTENT_REPORTED',
        'Yeni içerik bildirimi',
        'İnceleme kuyruğuna yeni bir kullanıcı bildirimi eklendi.',
        `/admin/moderation?caseId=${demandId}`,
        null,
      ),
      notification(
        2,
        'CONTENT_REPORTED',
        'Yeni içerik bildirimi',
        'İnceleme kuyruğuna yeni bir kullanıcı bildirimi eklendi.',
        `/admin/moderation?caseId=${demandId}`,
        null,
      ),
      notification(
        3,
        'CONTENT_REPORTED',
        'Yeni içerik bildirimi',
        'İnceleme kuyruğuna yeni bir kullanıcı bildirimi eklendi.',
        `/admin/moderation?caseId=${demandId}`,
        '2026-10-25T09:10:00Z',
      ),
    ]
  }
  return [
    notification(
      1,
      'SERVICE_PUBLISHED',
      'Servis uygunluğu bildirildi',
      'Bir işletmeci servis uygunluğu bildirdi. Bu beyan platform tarafından doğrulanmamıştır.',
      `/demands/${demandId}?feedback=${demandId}`,
      null,
    ),
    notification(
      2,
      'FEEDBACK_REMINDER',
      'Geri bildiriminizi bekliyoruz',
      'İşletmecinin uygunluk beyanı için geri bildirim süreniz devam ediyor.',
      `/demands/${demandId}?feedback=${demandId}`,
      null,
    ),
    notification(
      3,
      'SUPPORT_EXPIRED',
      'Destek süresi sona erdi',
      'Yanıtlanmayan servis uygunluğu bildirimi için desteğiniz pasif duruma alındı.',
      `/demands/${demandId}`,
      '2026-10-25T09:10:00Z',
    ),
    notification(
      4,
      'SERVICE_WITHDRAWN',
      'Servis uygunluğu geri çekildi',
      'İşletmeci servis uygunluğu bildirimini geri çekti; talep desteğiniz yeniden etkinleştirildi.',
      `/demands/${demandId}`,
      '2026-10-25T09:10:00Z',
    ),
  ]
}

function notification(
  index: number,
  type: string,
  title: string,
  message: string,
  href: string,
  readAt: string | null,
) {
  return {
    id: `aaaaaaaa-0000-4000-8000-00000000000${index}`,
    type,
    demandId: null,
    serviceResponseId: null,
    publicationEventId: null,
    feedbackId: null,
    moderationCaseId: null,
    title,
    message,
    href,
    createdAt: '2026-10-25T09:00:00Z',
    readAt,
  }
}
