import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// One entry per started route transition; null until its animations are known.
type TransitionLog = (string[] | null)[]

const contentMotion = [
  '::view-transition-new(page-content):page-enter',
  '::view-transition-old(page-content):page-exit',
]

test.beforeEach(async ({ page }) => {
  // Record the animations each route view transition actually runs.
  await page.addInitScript(() => {
    const log: (string[] | null)[] = []
    Object.assign(window, { routeTransitions: log })
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    document.startViewTransition = ((update: () => Promise<void>) => {
      const transition = start(update)
      const index = log.push(null) - 1
      transition.ready.then(
        () => {
          log[index] = document
            .getAnimations()
            .map((animation) => {
              const pseudo =
                (animation.effect as KeyframeEffect | null)?.pseudoElement ?? ''
              const name = (animation as CSSAnimation).animationName
              return `${pseudo}:${name}`
            })
            .filter((entry) => entry.startsWith('::view-transition'))
            .sort()
        },
        // A newer navigation replaced this transition before it started.
        () => (log[index] = ['skipped']),
      )
      return transition
    }) as typeof document.startViewTransition
  })
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]
  state.demandCreated = true
  await installMockApi(page, state)
})

test('public navigation moves only the page content and keeps history and focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('#main-content')).toHaveCSS(
    'view-transition-name',
    'page-content',
  )
  await expect(page.locator('.site-header')).toHaveCSS(
    'view-transition-name',
    'site-header',
  )

  const boardLink = page
    .locator('.site-nav')
    .getByRole('link', { name: 'Talep panosu' })
  await boardLink.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Servis talep panosu' }),
  ).toBeVisible()
  // Each page still moves focus to its heading, as before.
  await expect(
    page.getByRole('heading', { name: 'Servis talep panosu' }),
  ).toBeFocused()
  expect(await lastTransition(page)).toEqual(
    expect.arrayContaining(contentMotion),
  )
  // Header and backdrop only cross-fade in place; they never slide.
  expect(
    (await lastTransition(page)).filter(
      (entry) =>
        /page-(enter|exit)$/.test(entry) && !/page-content/.test(entry),
    ),
  ).toEqual([])

  await page.getByRole('button', { name: 'Önizlemeyi aç' }).first().click()
  await page.getByRole('link', { name: 'Tüm detayları görüntüle' }).click()
  await expect(page).toHaveURL(/\/demands\/[0-9a-f-]+$/)
  await expect(page.getByText('Talep ayrıntısı')).toBeVisible()
  await expect.poll(() => transitionCount(page)).toBe(2)

  await page.goBack()
  await expect(page).toHaveURL(/\/demands$/)
  await expect(
    page.getByRole('heading', { name: 'Servis talep panosu' }),
  ).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/\/demands\/[0-9a-f-]+$/)
  await expect(page.getByText('Talep ayrıntısı')).toBeVisible()
  // React Router replays the transition for history entries that used one.
  await expect.poll(() => transitionCount(page)).toBe(4)

  await page.locator('.demand-breadcrumb a').click()
  await expect(page).toHaveURL(/\/demands$/)
  await page
    .locator('.site-footer')
    .getByRole('link', { name: 'Kullanım koşulları' })
    .click()
  await expect(page).toHaveURL(/\/terms$/)
  await expect.poll(() => transitionCount(page)).toBe(6)
})

test('reduced motion navigates without any transition animation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page
    .locator('.site-nav')
    .getByRole('link', { name: 'Talep panosu' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Servis talep panosu' }),
  ).toBeVisible()
  expect(await lastTransition(page)).toEqual([])
})

for (const width of [390, 320]) {
  test(`mobile menu navigation transitions and closes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Menü' }).click()
    await page
      .getByRole('dialog', { name: 'Ana menü' })
      .getByRole('link', { name: 'Talep panosu' })
      .click()
    await expect(page).toHaveURL(/\/demands$/)
    await expect(page.getByRole('dialog', { name: 'Ana menü' })).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Servis talep panosu' }),
    ).toBeVisible()
    expect(await lastTransition(page)).toEqual(
      expect.arrayContaining(contentMotion),
    )
    // The new page is usable straight away; the snapshot never blocks it.
    await page.getByRole('button', { name: 'Menü' }).click()
    await expect(page.getByRole('dialog', { name: 'Ana menü' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })
}

for (const workspace of [
  {
    name: 'operator',
    email: 'operator@example.com',
    start: '/operator',
    target: '/operator/schools',
  },
  {
    name: 'admin',
    email: 'admin@example.com',
    start: '/admin/applications',
    target: '/admin/schools',
  },
]) {
  test(`${workspace.name} sidebar navigation keeps the sidebar still`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/operator/login')
    await page.getByLabel('E-posta').fill(workspace.email)
    await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto(workspace.start)

    await expect(page.locator('.workspace-content')).toHaveCSS(
      'view-transition-name',
      'page-content',
    )
    await expect(page.locator('.workspace-sidebar')).toHaveCSS(
      'view-transition-name',
      'workspace-sidebar',
    )
    const link = page.locator(
      `.workspace-sidebar nav a[href="${workspace.target}"]`,
    )
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${workspace.target}$`))
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('h1')).toBeFocused()
    expect(await lastTransition(page)).toEqual(
      expect.arrayContaining(contentMotion),
    )

    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${workspace.start}$`))
  })
}

const transitions = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { routeTransitions: TransitionLog })
        .routeTransitions,
  )

async function transitionCount(page: Page) {
  return (await transitions(page)).length
}

async function lastTransition(page: Page) {
  await expect.poll(async () => (await transitions(page)).at(-1)).toBeTruthy()
  return (await transitions(page)).at(-1)!
}
