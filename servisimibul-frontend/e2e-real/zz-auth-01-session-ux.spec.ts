import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// AUTH-SESSION-UX (#273): public-header session behaviour against the real
// backend, disposable PostgreSQL and synthetic users only.

const parentPassword = process.env.J03_PARENT_PASSWORD
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD
const parentEmail = 'auth01.parent@example.test'
const operatorEmail = 'auth01.operator@example.test'
const operatorPassword = 'AUTH01-operator-password'

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 800 },
]

type Role = 'PARENT' | 'OPERATOR' | 'ADMIN'

const roles: Record<
  Role,
  {
    email: () => string
    password: () => string
    sessionLabel: string
    home?: string
    landing: RegExp
    afterLogout: RegExp
    expiredLogin: RegExp
  }
> = {
  PARENT: {
    email: () => parentEmail,
    password: () => parentPassword!,
    sessionLabel: 'Veli oturumu açık',
    landing: /\/demands$/,
    afterLogout: /\/parent\/login$/,
    expiredLogin: /\/parent\/login\?reason=session$/,
  },
  OPERATOR: {
    email: () => operatorEmail,
    password: () => operatorPassword,
    sessionLabel: 'İşletmeci oturumu açık',
    home: 'İşletmeci paneli',
    landing: /\/operator(\/profile)?$/,
    afterLogout: /\/operator\/login$/,
    expiredLogin: /\/operator\/login\?reason=session$/,
  },
  ADMIN: {
    email: () => adminEmail,
    password: () => adminPassword!,
    sessionLabel: 'Yönetici oturumu açık',
    home: 'Yönetim paneli',
    landing: /\/admin(\/applications)?$/,
    afterLogout: /\/$/,
    expiredLogin: /\/login\?reason=session$/,
  },
}

test('AUTH-01 keeps the public header in step with real sessions', async ({
  browser,
}) => {
  expect(parentPassword, 'J03_PARENT_PASSWORD must be supplied').toBeTruthy()
  expect(adminPassword, 'J03_ADMIN_PASSWORD must be supplied').toBeTruthy()

  const setup = await browser.newContext()
  const setupPage = await setup.newPage()
  try {
    await register(setupPage, '/api/v1/auth/parent/register', {
      email: parentEmail,
      password: parentPassword,
    })
    await register(setupPage, '/api/v1/auth/register', {
      email: operatorEmail,
      password: operatorPassword,
      businessName: 'AUTH-01 Gerçek Servis',
      contactPhone: '+905321234567',
    })
  } finally {
    await setup.close()
  }

  await test.step('guest header is accessible at every width', async () => {
    const context = await browser.newContext(stillMotion)
    const page = await context.newPage()
    try {
      await page.goto('/')
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        const menu = await openMenu(page)
        await expect(
          menu.getByRole('link', { name: 'Giriş yap' }),
        ).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Kayıt ol' })).toBeVisible()
        await expect(
          menu.getByRole('button', { name: 'Çıkış yap' }),
        ).toHaveCount(0)
        await assertLayout(page)
        await closeMenu(page)
      }
    } finally {
      await context.close()
    }
  })

  for (const role of ['PARENT', 'OPERATOR', 'ADMIN'] as const) {
    await test.step(`${role}: role header, 204 logout and same-tab re-login`, async () => {
      const spec = roles[role]
      const context = await browser.newContext(stillMotion)
      const page = await context.newPage()
      try {
        await uiLogin(page, spec.email(), spec.password())
        await expect(page).toHaveURL(spec.landing)
        await page.goto('/')

        for (const viewport of viewports) {
          await page.setViewportSize(viewport)
          const menu = await openMenu(page)
          if (spec.home) {
            await expect(
              menu.getByRole('link', { name: spec.home }),
            ).toBeVisible()
          }
          await expect(
            menu.getByRole('link', { name: 'Giriş yap' }),
          ).toHaveCount(0)
          await expect(
            menu.getByRole('link', { name: 'Kayıt ol' }),
          ).toHaveCount(0)
          await expect(
            menu.getByRole('button', { name: 'Hesabım' }),
          ).toBeVisible()
          await expect(menu.getByText(spec.sessionLabel)).toHaveCount(0)
          const accountMenu = await openAccountMenu(page)
          await expect(accountMenu.getByText(spec.sessionLabel)).toBeVisible()
          await expect(
            accountMenu.getByRole('button', { name: 'Çıkış yap' }),
          ).toBeEnabled()
          await assertLayout(page)
          await closeMenu(page)
        }

        await page.setViewportSize(viewports[0])
        for (let round = 0; round < 2; round += 1) {
          const logout = page.waitForResponse(isLogout)
          await (
            await openAccountMenu(page)
          )
            .getByRole('button', { name: 'Çıkış yap' })
            .click()
          expect((await logout).status()).toBe(204)
          await expect(page).toHaveURL(spec.afterLogout)
          expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401)
          await expect(
            page
              .getByRole('navigation', { name: 'Ana menü' })
              .getByText(spec.sessionLabel),
          ).toHaveCount(0)

          // Same tab, no reload: the header must not keep a stale busy state.
          await uiLogin(page, spec.email(), spec.password())
          await expect(page).toHaveURL(spec.landing)
          await page.goto('/')
          const accountMenu = await openAccountMenu(page)
          await expect(accountMenu.getByText(spec.sessionLabel)).toBeVisible()
          await expect(
            accountMenu.getByRole('button', { name: 'Çıkış yapılıyor…' }),
          ).toHaveCount(0)
          await expect(
            accountMenu.getByRole('button', { name: 'Çıkış yap' }),
          ).toBeEnabled()
          await closeMenu(page)
        }
      } finally {
        await context.close()
      }
    })
  }

  await test.step('network and 5xx logout failures keep the session and allow retry', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await uiLogin(page, operatorEmail, operatorPassword)
      await page.goto('/')
      for (const failure of ['abort', '503'] as const) {
        await page.route('**/api/v1/auth/logout', (route) =>
          failure === 'abort'
            ? route.abort('failed')
            : route.fulfill({
                status: 503,
                contentType: 'application/problem+json',
                body: JSON.stringify({
                  title: 'Unavailable',
                  status: 503,
                  code: 'UNAVAILABLE',
                }),
              }),
        )
        await (
          await openAccountMenu(page)
        )
          .getByRole('button', { name: 'Çıkış yap' })
          .click()
        await expect(page.getByRole('alert')).toContainText(
          'Çıkış yapılamadı. Tekrar deneyin.',
        )
        await expect(page).toHaveURL(/\/$/)
        expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200)
        const accountMenu = await openAccountMenu(page)
        await expect(
          accountMenu.getByText(roles.OPERATOR.sessionLabel),
        ).toBeVisible()
        await expect(
          accountMenu.getByRole('button', { name: 'Çıkış yap' }),
        ).toBeEnabled()
        await closeMenu(page)
        await page.unroute('**/api/v1/auth/logout')
      }

      const retry = page.waitForResponse(isLogout)
      await (
        await openAccountMenu(page)
      )
        .getByRole('button', { name: 'Çıkış yap' })
        .click()
      expect((await retry).status()).toBe(204)
      await expect(page).toHaveURL(roles.OPERATOR.afterLogout)
    } finally {
      await context.close()
    }
  })

  for (const role of ['PARENT', 'OPERATOR', 'ADMIN'] as const) {
    await test.step(`${role}: an expired session sends logout to the role login`, async () => {
      const spec = roles[role]
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        await uiLogin(page, spec.email(), spec.password())
        await page.goto('/')
        await expect(
          (await openAccountMenu(page)).getByText(spec.sessionLabel),
        ).toBeVisible()
        await closeMenu(page)

        // The server-side session ends while the tab still shows it.
        await context.clearCookies()

        await (
          await openAccountMenu(page)
        )
          .getByRole('button', { name: 'Çıkış yap' })
          .click()
        await expect(page).toHaveURL(spec.expiredLogin)
        await expect(
          page.getByText(
            'Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.',
          ),
        ).toBeVisible()
        await expect(
          page
            .getByRole('navigation', { name: 'Ana menü' })
            .getByText(spec.sessionLabel),
        ).toHaveCount(0)
      } finally {
        await context.close()
      }
    })
  }

  await test.step('another tab follows login and logout without a reload', async () => {
    const context = await browser.newContext()
    const [first, second] = await Promise.all([
      context.newPage(),
      context.newPage(),
    ])
    try {
      await second.goto('/')
      await expect(
        second
          .getByRole('navigation', { name: 'Ana menü' })
          .getByRole('link', { name: 'Giriş yap' }),
      ).toBeVisible()

      await uiLogin(first, parentEmail, parentPassword!)
      await expect(
        second
          .getByRole('navigation', { name: 'Ana menü' })
          .getByRole('button', { name: 'Hesabım' }),
      ).toBeVisible()
      await expect(
        (await openAccountMenu(second)).getByText(roles.PARENT.sessionLabel),
      ).toBeVisible()
      await closeMenu(second)

      await first.goto('/')
      const logout = first.waitForResponse(isLogout)
      await (
        await openAccountMenu(first)
      )
        .getByRole('button', { name: 'Çıkış yap' })
        .click()
      expect((await logout).status()).toBe(204)
      await expect(
        second
          .getByRole('navigation', { name: 'Ana menü' })
          .getByRole('link', { name: 'Giriş yap' }),
      ).toBeVisible()
      await expect(
        second
          .getByRole('navigation', { name: 'Ana menü' })
          .getByText(roles.PARENT.sessionLabel),
      ).toHaveCount(0)

      // Account switch in one tab: the other tab shows the new role, not the cached one.
      await uiLogin(first, operatorEmail, operatorPassword)
      await expect(
        second
          .getByRole('navigation', { name: 'Ana menü' })
          .getByRole('link', { name: roles.OPERATOR.home! }),
      ).toBeVisible()
      await expect(
        (await openAccountMenu(second)).getByText(roles.OPERATOR.sessionLabel),
      ).toBeVisible()
      await expect(
        second
          .getByRole('group', { name: 'Hesabım' })
          .getByText(roles.PARENT.sessionLabel),
      ).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  await test.step('a signed-in role cannot reach another role workspace', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await uiLogin(page, parentEmail, parentPassword!)
      for (const path of ['/admin', '/admin/schools', '/operator']) {
        await page.goto(path)
        await expect(
          page.getByRole('link', { name: 'Yönetim paneli' }),
        ).toHaveCount(0)
        await expect(
          page.getByRole('link', { name: 'İşletmeci paneli' }),
        ).toHaveCount(0)
      }
      expect((await page.request.get('/api/v1/admin/schools')).status()).toBe(
        403,
      )
      expect(
        (await page.request.get('/api/v1/operator/profile')).status(),
      ).toBe(403)

      // A crafted next= cannot carry a parent into a foreign or off-site destination.
      await page.context().clearCookies()
      for (const next of [
        '/admin/schools',
        '//evil.example/demands',
        '/demands/%2e%2e/admin',
      ]) {
        await page.goto(`/login?next=${encodeURIComponent(next)}`)
        await submitLogin(page, parentEmail, parentPassword!)
        await expect(page).toHaveURL(/\/demands$/)
        await page.context().clearCookies()
      }
    } finally {
      await context.close()
    }
  })
})

async function register(
  page: Page,
  path: string,
  data: Record<string, unknown>,
) {
  const token = await csrf(page)
  const response = await page.request.post(path, {
    headers: { [token.headerName]: token.token },
    data,
  })
  expect(response.status()).toBe(202)
}

async function csrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  return (await response.json()) as { headerName: string; token: string }
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login')
  await submitLogin(page, email, password)
}

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill(password)
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      candidate.url().endsWith('/api/v1/auth/login'),
  )
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click()
  expect((await response).status()).toBe(200)
  await expect(page).not.toHaveURL(/\/login(\?|$)/)
}

function isLogout(response: {
  request(): { method(): string }
  url(): string
}) {
  return (
    response.request().method() === 'POST' &&
    response.url().endsWith('/api/v1/auth/logout')
  )
}

async function openMenu(page: Page) {
  const toggle = page.getByRole('button', { name: 'Menü' })
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true')
      await toggle.click()
    await expect(page.getByRole('dialog', { name: 'Ana menü' })).toBeVisible()
  }
  return page.getByRole('navigation', { name: 'Ana menü' })
}

async function openAccountMenu(page: Page) {
  const navigation = await openMenu(page)
  const trigger = navigation.getByRole('button', { name: 'Hesabım' })
  await expect(trigger).toBeVisible()
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  const accountMenu = navigation.getByRole('group', { name: 'Hesabım' })
  await expect(accountMenu).toBeVisible()
  return accountMenu
}

async function closeMenu(page: Page) {
  const accountTrigger = page.getByRole('button', { name: 'Hesabım' })
  if (
    (await accountTrigger.isVisible()) &&
    (await accountTrigger.getAttribute('aria-expanded')) === 'true'
  ) {
    await page.keyboard.press('Escape')
    await expect(accountTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(accountTrigger).toBeFocused()
  }
  const toggle = page.getByRole('button', { name: 'Menü' })
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute('aria-expanded')) === 'true'
  ) {
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  }
}

// Axe samples computed colours; a nav link mid-transition reports blended,
// never-final colours. The app's reduced-motion rule makes transitions 0 ms.
const stillMotion = { reducedMotion: 'reduce' } as const

async function assertLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1)
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([])
}
