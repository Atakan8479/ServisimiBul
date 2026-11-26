import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

// Issue #326: a slow route loader or lazy page module must show visible
// pending feedback while the previous page is still on screen.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

const screenshotDir = process.env.NAV326_SCREENSHOT_DIR
const bar = (page: Page) => page.getByTestId('route-pending')

function approvedOperator() {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]
  return state
}

async function signIn(page: Page, email = 'operator@example.com') {
  await installMockApi(page, approvedOperator())
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
}

async function signInOperator(page: Page) {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
}

/** Holds matching requests until release() so each phase can be observed. */
async function hold(page: Page, glob: string) {
  let release!: () => void
  let released = new Promise<void>((resolve) => (release = resolve))
  let held = 0
  await page.route(glob, async (route) => {
    held += 1
    await released
    return route.fallback()
  })
  return {
    held: () => held,
    release: () => {
      release()
      released = Promise.resolve()
    },
  }
}

async function openNav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Menü' })
  if (await menu.isVisible()) await menu.click()
  await page
    .getByRole('navigation', { name: /alanı menüsü$/ })
    .getByRole('link', { name, exact: true })
    .click()
}

async function expectBarInViewport(page: Page) {
  await expect(bar(page)).toBeVisible()
  const box = await bar(page).boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.y).toBe(0)
  expect(box!.height).toBeGreaterThanOrEqual(3)
  expect(box!.width).toBe(viewport.width)
}

/** Counts how often the bar is mounted on the page from now on. */
async function watchBarMounts(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as { barMounts: number }
    target.barMounts = 0
    new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (
            node instanceof HTMLElement &&
            node.classList.contains('route-pending-bar')
          ) {
            target.barMounts += 1
          }
        })
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
  return () =>
    page.evaluate(() => (window as unknown as { barMounts: number }).barMounts)
}

async function shoot(page: Page, name: string) {
  if (!screenshotDir) return
  await page.screenshot({ path: `${screenshotDir}/${name}.png` })
}

for (const viewport of viewports) {
  test(`NAV326 schools route wait and page load are both visible on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signInOperator(page)
    const me = await hold(page, '**/api/v1/auth/me')
    const schools = await hold(page, '**/api/v1/operator/schools')

    await openNav(page, 'Okullar ve kapsam')

    // Route pending: the session check runs while the old page stays.
    await expectBarInViewport(page)
    await expect(
      page.getByRole('heading', { name: 'Genel bakış', level: 1 }),
    ).toBeVisible()
    await expect(page.locator('.route-pending-status')).toHaveText(
      'Sayfa yükleniyor',
    )
    await shoot(page, `schools-route-pending-${viewport.width}`)

    // Initial page fetch: the route has committed and the inline loader is
    // inside the viewport instead of the shared bar.
    me.release()
    const loading = page.getByText('Okullar yükleniyor')
    await expect(loading).toBeInViewport()
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator('.route-pending-status')).toHaveText('')
    await expect(
      page.getByRole('heading', { name: 'Okullar ve hizmet kapsamı' }),
    ).toBeFocused()
    await shoot(page, `schools-page-loading-${viewport.width}`)

    schools.release()
    await expect(loading).toHaveCount(0)
    await expect(page.getByText('Örnek Okulu').first()).toBeVisible()
    await expect(bar(page)).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })
}

test('NAV326 fast navigation never flashes the pending bar', async ({
  page,
}) => {
  await signInOperator(page)
  const mounts = await watchBarMounts(page)

  await openNav(page, 'Profil ve başvuru')
  await expect(
    page.getByRole('heading', { name: 'İşletme profilim' }),
  ).toBeVisible()
  await openNav(page, 'Okullar ve kapsam')
  await expect(
    page.getByRole('heading', { name: 'Okullar ve hizmet kapsamı' }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'İşletme profilim' }),
  ).toBeVisible()

  expect(await mounts()).toBe(0)
})

test('NAV326 back and forward show the bar while the loader waits', async ({
  page,
}) => {
  await signInOperator(page)
  await openNav(page, 'Okullar ve kapsam')
  await expect(
    page.getByRole('heading', { name: 'Okullar ve hizmet kapsamı' }),
  ).toBeVisible()
  await openNav(page, 'Genel bakış')
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()

  const me = await hold(page, '**/api/v1/auth/me')
  await page.goBack()
  await expectBarInViewport(page)
  me.release()
  await expect(
    page.getByRole('heading', { name: 'Okullar ve hizmet kapsamı' }),
  ).toBeVisible()
  await expect(bar(page)).toHaveCount(0)

  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
  await expect(bar(page)).toHaveCount(0)
})

test('NAV326 rapid clicks keep a single bar until the last route lands', async ({
  page,
}) => {
  await signInOperator(page)
  const mounts = await watchBarMounts(page)
  const me = await hold(page, '**/api/v1/auth/me')

  await openNav(page, 'Okullar ve kapsam')
  await expectBarInViewport(page)
  await openNav(page, 'Araçlar ve servisler')
  await openNav(page, 'Hesap ve gizlilik')
  await expect(bar(page)).toHaveCount(1)

  me.release()
  await expect(
    page.getByRole('heading', { name: 'Hesap ve gizlilik', level: 1 }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/operator\/account$/)
  await expect(bar(page)).toHaveCount(0)
  expect(await mounts()).toBe(1)
})

test('NAV326 a failed route check replaces the bar with the error page', async ({
  page,
}) => {
  await signInOperator(page)
  await page.route('**/api/v1/auth/me', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        title: 'Internal Server Error',
        status: 500,
        detail: 'Sunucu şu anda yanıt veremiyor.',
      }),
    })
  })

  await openNav(page, 'Okullar ve kapsam')
  await expectBarInViewport(page)
  await expect(
    page.getByRole('heading', { name: 'İşlem tamamlanamadı' }),
  ).toBeVisible()
  await expect(bar(page)).toHaveCount(0)
})

test('NAV326 an expired session redirects to login without a stuck bar', async ({
  page,
}) => {
  await signInOperator(page)
  await page.route('**/api/v1/auth/me', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        title: 'Authentication required',
        status: 401,
        detail: 'Please sign in.',
        code: 'authentication_required',
      }),
    })
  })

  await openNav(page, 'Okullar ve kapsam')
  await expectBarInViewport(page)
  await expect(page).toHaveURL(/\/operator\/login\?next=%2Foperator%2Fschools/)
  await expect(bar(page)).toHaveCount(0)
})

test('NAV326 reduced motion shows a static bar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signInOperator(page)
  const me = await hold(page, '**/api/v1/auth/me')

  await openNav(page, 'Araçlar ve servisler')
  await expectBarInViewport(page)
  expect(
    await bar(page).evaluate(
      (element) => getComputedStyle(element, '::before').animationName,
    ),
  ).toBe('none')
  me.release()
  await expect(
    page.getByRole('heading', { name: 'Araçlar ve servis teklifleri' }),
  ).toBeVisible()
  await expect(bar(page)).toHaveCount(0)
})

for (const viewport of [viewports[0], viewports[3]]) {
  test(`NAV326 admin cold page module shows the bar on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page, 'admin@example.com')
    await expect(page).toHaveURL(/\/admin\/applications$/)
    await expect(
      page.getByRole('heading', { name: 'İşletmeci başvuruları' }),
    ).toBeVisible()
    const module = await hold(
      page,
      '**/src/features/admin/AdminSchoolsPage.tsx*',
    )

    await openNav(page, 'Okullar')
    await expectBarInViewport(page)
    await shoot(page, `admin-route-pending-${viewport.width}`)
    expect(module.held()).toBeGreaterThan(0)

    module.release()
    await expect(
      page.getByRole('heading', { name: 'Okul kataloğu' }),
    ).toBeVisible()
    await expect(bar(page)).toHaveCount(0)
  })
}
