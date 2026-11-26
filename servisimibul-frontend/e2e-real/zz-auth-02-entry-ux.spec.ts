import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'

// AUTH-ENTRY-UX (#276, with #277): one login and one registration entry
// against the real backend, disposable PostgreSQL and synthetic users. Every
// role and status comes from the real backend; nothing is intercepted.
// The backend allows 10 logins per account per 15 minutes and 20
// registrations per IP per hour across the whole suite, so this spec registers
// two accounts, keeps each account under 10 logins, and signs in as the second
// bootstrap admin, which no other spec uses. Admin self-signup through a
// smuggled role is covered by the backend ParentRegistrationSecurityTests.

const parentPassword = process.env.J03_PARENT_PASSWORD
const adminEmail = 'j03.admin.two@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD
const parentEmail = 'auth02.parent@example.test'
const operatorEmail = 'auth02.operator@example.test'
const operatorPassword = 'AUTH02-operator-password'
const districtId = 3401
const neighborhoodId = 340101
const entries = ['/login', '/parent/login', '/operator/login'] as const
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
]

type Role = 'PARENT' | 'OPERATOR' | 'ADMIN'

const accounts: Record<
  Role,
  { email: () => string; password: () => string; home: RegExp }
> = {
  PARENT: {
    email: () => parentEmail,
    password: () => parentPassword!,
    home: /\/demands$/,
  },
  OPERATOR: {
    email: () => operatorEmail,
    password: () => operatorPassword,
    home: /\/operator$/,
  },
  ADMIN: {
    email: () => adminEmail,
    password: () => adminPassword!,
    home: /\/admin\/applications$/,
  },
}

test('AUTH-02 routes one login and one registration by the real server role', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000)
  const appOrigin = new URL(baseURL!).origin
  expect(parentPassword, 'J03_PARENT_PASSWORD must be supplied').toBeTruthy()
  expect(adminPassword, 'J03_ADMIN_PASSWORD must be supplied').toBeTruthy()

  const setup = await browser.newContext()
  const admin = await setup.newPage()
  const parentSetup = await (await browser.newContext()).newPage()
  let schoolId = ''
  let demandId = ''
  try {
    await apiLogin(admin, adminEmail, adminPassword!)
    const adminCsrf = await csrf(admin)
    const school = await admin.request.post('/api/v1/admin/schools', {
      headers: { [adminCsrf.headerName]: adminCsrf.token },
      data: {
        neighborhoodId,
        name: 'AUTH-02 Giriş Okulu',
        address: null,
        sourceName: 'AUTH-02 synthetic fixture',
        sourceCode: 'AUTH02-ENTRY',
        active: true,
      },
    })
    expect(school.status()).toBe(201)
    schoolId = ((await school.json()) as { id: string }).id

    // An approved operator, so comment and response intents are genuine.
    {
      const email = operatorEmail
      const operatorSetup = await (await browser.newContext()).newPage()
      try {
        await register(operatorSetup, '/api/v1/auth/register', {
          email,
          password: operatorPassword,
          businessName: 'AUTH-02 Servis',
          contactPhone: '+905321234570',
        })
        await apiLogin(operatorSetup, email, operatorPassword)
        const operatorCsrf = await csrf(operatorSetup)
        expect(
          (
            await operatorSetup.request.post(
              '/api/v1/operator/application/submit',
              { headers: { [operatorCsrf.headerName]: operatorCsrf.token } },
            )
          ).status(),
        ).toBe(200)
        const profileId = (
          (await (
            await operatorSetup.request.get('/api/v1/operator/profile')
          ).json()) as { id: string }
        ).id
        expect(
          (
            await admin.request.post(
              `/api/v1/admin/operators/${profileId}/approve`,
              { headers: { [adminCsrf.headerName]: adminCsrf.token } },
            )
          ).status(),
        ).toBe(200)
      } finally {
        await operatorSetup.context().close()
      }
    }

    await register(parentSetup, '/api/v1/auth/parent/register', {
      email: parentEmail,
      password: parentPassword,
    })
    await apiLogin(parentSetup, parentEmail, parentPassword!)
    const parentCsrf = await csrf(parentSetup)
    const created = await parentSetup.request.post('/api/v1/demands', {
      headers: { [parentCsrf.headerName]: parentCsrf.token },
      data: {
        schoolId,
        neighborhoodId,
        needsMorning: true,
        needsAfternoon: false,
        reasons: ['NO_SUITABLE_SERVICE'],
      },
    })
    expect(created.status()).toBe(201)
    demandId = ((await created.json()) as { demand: { id: string } }).demand.id
  } finally {
    await setup.close()
    await parentSetup.context().close()
  }

  await test.step('guest header and footer offer only Giriş Yap and Kayıt Ol', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto('/')
      const footer = page.getByRole('navigation', { name: 'Alt menü' })
      await expect(
        footer.getByRole('link', { name: 'Giriş yap', exact: true }),
      ).toHaveAttribute('href', '/login')
      await expect(
        footer.getByRole('link', { name: 'Kayıt ol', exact: true }),
      ).toHaveAttribute('href', '/register')
      const header = page.getByRole('navigation', { name: 'Ana menü' })
      await expect(
        header.getByRole('link', { name: 'Giriş yap', exact: true }),
      ).toHaveAttribute('href', '/login')
      await expect(
        header.getByRole('link', { name: 'Kayıt ol', exact: true }),
      ).toHaveAttribute('href', '/register')
      await expect(
        page.getByRole('link', {
          name: /^(Veli|İşletmeci) (Girişi|Kaydı)$/i,
        }),
      ).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  await test.step('registration offers parent or operator only; no admin self-signup', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto('/register')
      const options = page.locator('.account-type-options').getByRole('link')
      await expect(options).toHaveCount(2)
      await expect(options.nth(0)).toHaveAccessibleName(/^Veli olarak/)
      await expect(options.nth(1)).toHaveAccessibleName(/^İşletmeci olarak/)
      await expect(page.getByText(/yönetici/i)).toHaveCount(0)

      // Keyboard: Tab moves between the two choices and Enter opens one.
      await options.nth(0).focus()
      await page.keyboard.press('Tab')
      await expect(options.nth(1)).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/parent\/register\?next=%2Fdemands$/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Veli hesabı oluşturun' }),
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })

  for (const role of ['PARENT', 'OPERATOR', 'ADMIN'] as const) {
    await test.step(`${role}: every login URL keeps the session and opens the role home`, async () => {
      for (const entry of entries) {
        await withLogin(browser, async (page, logouts) => {
          // A wrong-role legacy login also reaches an already open tab.
          const watcher =
            role === 'OPERATOR' && entry === '/parent/login'
              ? await page.context().newPage()
              : undefined
          await watcher?.goto('/')
          await page.goto(entry)
          await expect(
            page.getByRole('heading', { level: 1, name: 'Giriş yap' }),
          ).toBeVisible()
          await submitLogin(
            page,
            accounts[role].email(),
            accounts[role].password(),
          )
          await expect(page).toHaveURL(accounts[role].home)
          await expectSession(page, role)
          expect(logouts(), `${role} via ${entry}`).toBe(0)
          if (watcher) {
            await expect(
              watcher.getByRole('link', { name: 'İşletmeci paneli' }).first(),
            ).toBeAttached()
            await expectSession(watcher, 'OPERATOR')
          }
        })
      }
    })
  }

  await test.step('safe next intents survive login for each server role', async () => {
    const demand = `/demands/${demandId}`
    const create = `/demands/new?schoolId=${schoolId}&pickupDistrictId=${districtId}&neighborhoodId=${neighborhoodId}&academicYear=2026-2027`
    const cases: [Role, (typeof entries)[number], string, RegExp][] = [
      [
        'PARENT',
        '/parent/login',
        create,
        new RegExp(`/demands/new\\?schoolId=${schoolId}&`),
      ],
      [
        'PARENT',
        '/login',
        `${demand}?action=comment`,
        new RegExp(`${demand}$`),
      ],
      ['PARENT', '/login', '/notifications', /\/notifications$/],
      [
        'OPERATOR',
        '/operator/login',
        `${demand}?action=response`,
        new RegExp(`${demand}$`),
      ],
      ['ADMIN', '/login', '/admin/schools', /\/admin\/schools$/],
    ]
    for (const [role, entry, next, expected] of cases) {
      await withLogin(browser, async (page, logouts) => {
        await page.goto(`${entry}?next=${encodeURIComponent(next)}`)
        await submitLogin(
          page,
          accounts[role].email(),
          accounts[role].password(),
        )
        await expect(page, `${role} next=${next}`).toHaveURL(expected)
        expect(new URL(page.url()).origin).toBe(appOrigin)
        await expectSession(page, role)
        expect(logouts()).toBe(0)
      })
    }
  })

  await test.step('an operator comment link resumes the comment after login (#277)', async () => {
    for (const entry of ['/operator/login'] as const) {
      await withLogin(browser, async (page, logouts) => {
        await page.goto(
          `${entry}?next=${encodeURIComponent(`/demands/${demandId}?action=comment`)}`,
        )
        await submitLogin(page, operatorEmail, operatorPassword)
        await expect(page).toHaveURL(new RegExp(`/demands/${demandId}$`))
        const field = page.getByLabel('Yorumunuz')
        await expect(field).toBeVisible()
        await expect(field).toBeFocused()
        expect(logouts()).toBe(0)
      })
    }
  })

  await test.step('external, malformed and cross-role next values fall back to the role home', async () => {
    const cases: [Role, string][] = [
      ['OPERATOR', '/admin/schools'],
      ['OPERATOR', '//evil.example/operator'],
      ['ADMIN', '/operator/profile'],
      ['ADMIN', `/demands/${demandId}?action=comment`],
      ['ADMIN', '//evil.example/admin'],
      ['PARENT', '/operator/notifications'],
      ['PARENT', `/demands/${demandId}?action=response`],
    ]
    for (const [role, next] of cases) {
      await withLogin(browser, async (page, logouts) => {
        await page.goto(`/login?next=${encodeURIComponent(next)}`)
        await submitLogin(
          page,
          accounts[role].email(),
          accounts[role].password(),
        )
        await expect(page, `${role} next=${next}`).toHaveURL(
          accounts[role].home,
        )
        expect(new URL(page.url()).origin).toBe(appOrigin)
        await expectSession(page, role)
        expect(logouts()).toBe(0)
      })
    }
    // Malformed percent-encoding is passed raw, never decoded into a target.
    await withLogin(browser, async (page) => {
      await page.goto('/operator/login?next=%E0%A4%A')
      await submitLogin(page, adminEmail, adminPassword!)
      await expect(page).toHaveURL(accounts.ADMIN.home)
    })
  })

  await test.step('password reset and verification pages stay on the shared login', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto('/login')
      await page.getByRole('link', { name: 'Şifremi unuttum' }).click()
      await expect(page).toHaveURL(/\/forgot-password$/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Şifrenizi yenileyin' }),
      ).toBeVisible()
      await page.getByLabel('E-posta').fill(parentEmail)
      const forgot = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/auth/forgot-password'),
      )
      await page
        .getByRole('button', { name: 'Yenileme bağlantısı gönder' })
        .click()
      // The real-stack profile keeps email disabled, so the backend reports
      // EMAIL_UNAVAILABLE and the form must surface it instead of hanging.
      expect((await forgot).status()).toBe(503)
      await expect(page.getByRole('alert').first()).toBeVisible()
      await expect(page).toHaveURL(/\/forgot-password$/)
      await page
        .getByRole('link', { name: 'Giriş sayfasına dön' })
        .first()
        .click()
      await expect(page).toHaveURL(/\/login$/)

      // Email delivery is disabled, so only an unknown token can be tried.
      await page.goto('/reset-password?token=auth02-unknown-token')
      await page
        .getByLabel('Yeni şifre', { exact: true })
        .fill('AUTH02-new-password')
      const reset = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/auth/reset-password'),
      )
      await page.getByRole('button', { name: 'Şifreyi yenile' }).click()
      expect((await reset).status()).toBeGreaterThanOrEqual(400)
      await expect(page.getByRole('alert').first()).toBeVisible()
      await expect(page).toHaveURL(/\/reset-password/)

      // Same path the backend verification email links to.
      await page.goto('/operator/verify-email?token=auth02-unknown-token')
      const verify = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/auth/verify-email'),
      )
      await page
        .getByRole('button', { name: 'E-posta adresini doğrula' })
        .click()
      expect((await verify).status()).toBeGreaterThanOrEqual(400)
      await expect(page.getByRole('alert').first()).toBeVisible()
      await page.getByRole('link', { name: 'Veli girişi' }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Giriş yap' }),
      ).toBeVisible()

      // The post-change banners still render on the legacy and shared URLs.
      for (const [path, text] of [
        [
          '/parent/login?accountDeactivated=true',
          'Hesabınız devre dışı bırakıldı',
        ],
        ['/login?passwordChanged=true', 'Şifreniz güncellendi'],
        ['/operator/login?reason=session', 'Oturumunuz sona erdi'],
      ] as const) {
        await page.goto(path)
        await expect(
          page.getByRole('status').filter({ hasText: text }),
        ).toBeVisible()
      }
    } finally {
      await context.close()
    }
  })

  await test.step('login and registration are keyboard-operable and accessible at every width', async () => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    try {
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        for (const path of [
          '/login',
          '/parent/login',
          '/operator/login',
          '/register',
        ]) {
          await page.goto(path)
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          await assertLayout(page)
        }
      }

      // Keyboard-only sign-in at the narrowest width: type, Tab, Enter.
      await page.goto(
        `/operator/login?next=${encodeURIComponent('/operator/notifications')}`,
      )
      await page.getByLabel('E-posta').focus()
      await page.keyboard.type(operatorEmail)
      await page.keyboard.press('Tab')
      await expect(page.getByLabel('Şifre', { exact: true })).toBeFocused()
      await page.keyboard.type(operatorPassword)
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/operator\/notifications$/)
      await expectSession(page, 'OPERATOR')
    } finally {
      await context.close()
    }
  })
})

async function withLogin(
  browser: Browser,
  run: (page: Page, logouts: () => number) => Promise<void>,
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  let logouts = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/v1/auth/logout')
    )
      logouts += 1
  })
  try {
    await run(page, () => logouts)
  } finally {
    await context.close()
  }
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

// The session the server holds after login, not what the UI shows.
async function expectSession(page: Page, role: Role) {
  const me = await page.request.get('/api/v1/auth/me')
  expect(me.status()).toBe(200)
  expect(((await me.json()) as { role: Role }).role).toBe(role)
}

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

async function apiLogin(page: Page, email: string, password: string) {
  const token = await csrf(page)
  const response = await page.request.post('/api/v1/auth/login', {
    headers: { [token.headerName]: token.token },
    data: { email, password, rememberMe: false },
  })
  expect(response.status()).toBe(200)
  return (await response.json()) as { role: Role }
}

async function csrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  return (await response.json()) as { headerName: string; token: string }
}

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
