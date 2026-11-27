import { expect, test, type Page } from '@playwright/test'

// ROLE-UX (#272): role-aware demand, comment and report actions plus
// operator approval-gated deep links against the real backend, disposable
// PostgreSQL and synthetic users only (OPERATOR_APPROVAL_REQUIRED=true here;
// approval-exempt mode is covered by backend ApprovalDisabled tests and the
// router unit tests).

const parentPassword = process.env.J03_PARENT_PASSWORD
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD
const operatorPassword = 'ROLE01-operator-password'
const neighborhoodId = 340101

const publishHeading = 'Bu konuma servis sunuyor musunuz?'
const publishButton = 'Servis duyurusu ekle'
const joinButton = 'Benim de ihtiyacım var'
const commentButton = 'Yorum yaz'
const commentText = 'ROLE-01 herkese açık yorum.'

test('ROLE-01 shows only the actions each real role may take', async ({
  browser,
}) => {
  expect(parentPassword, 'J03_PARENT_PASSWORD must be supplied').toBeTruthy()
  expect(adminPassword, 'J03_ADMIN_PASSWORD must be supplied').toBeTruthy()

  const contexts = await Promise.all(
    Array.from({ length: 7 }, () => browser.newContext()),
  )
  const [guest, supporter, bystander, approved, pending, draft, admin] =
    await Promise.all(contexts.map((context) => context.newPage()))

  try {
    await apiLogin(admin, adminEmail, adminPassword!)
    const adminCsrf = await csrf(admin)
    const school = await admin.request.post('/api/v1/admin/schools', {
      headers: { [adminCsrf.headerName]: adminCsrf.token },
      data: {
        neighborhoodId,
        name: 'ROLE-01 Rol Okulu',
        address: null,
        sourceName: 'ROLE-01 synthetic fixture',
        sourceCode: 'ROLE01-SCHOOL',
        active: true,
      },
    })
    expect(school.status()).toBe(201)
    const schoolId = ((await school.json()) as { id: string }).id

    for (const [page, email] of [
      [supporter, 'role01.supporter@example.test'],
      [bystander, 'role01.bystander@example.test'],
    ] as const) {
      await register(page, '/api/v1/auth/parent/register', {
        email,
        password: parentPassword,
      })
      await apiLogin(page, email, parentPassword!)
    }

    const operators = [
      [approved, 'role01.approved@example.test', 'submit-approve'],
      [pending, 'role01.pending@example.test', 'submit'],
      [draft, 'role01.draft@example.test', 'none'],
    ] as const
    for (const [page, email, step] of operators) {
      await register(page, '/api/v1/auth/register', {
        email,
        password: operatorPassword,
        businessName: `ROLE-01 ${step}`,
        contactPhone: '+905321234567',
      })
      await apiLogin(page, email, operatorPassword)
      if (step === 'none') continue
      const token = await csrf(page)
      expect(
        (
          await page.request.post('/api/v1/operator/application/submit', {
            headers: { [token.headerName]: token.token },
          })
        ).status(),
      ).toBe(200)
      if (step === 'submit-approve') {
        const profile = await page.request.get('/api/v1/operator/profile')
        const profileId = ((await profile.json()) as { id: string }).id
        expect(
          (
            await admin.request.post(
              `/api/v1/admin/operators/${profileId}/approve`,
              { headers: { [adminCsrf.headerName]: adminCsrf.token } },
            )
          ).status(),
        ).toBe(200)
      }
    }

    const supporterCsrf = await csrf(supporter)
    const created = await supporter.request.post('/api/v1/demands', {
      headers: { [supporterCsrf.headerName]: supporterCsrf.token },
      data: {
        schoolId,
        neighborhoodId,
        needsMorning: true,
        needsAfternoon: false,
        reasons: ['NO_SUITABLE_SERVICE'],
      },
    })
    expect([200, 201]).toContain(created.status())
    const demandId = ((await created.json()) as { demand: { id: string } })
      .demand.id
    const demandPath = `/demands/${demandId}`
    expect(
      (
        await supporter.request.post(`/api/v1/demands/${demandId}/comments`, {
          headers: { [supporterCsrf.headerName]: supporterCsrf.token },
          data: { body: commentText },
        })
      ).status(),
    ).toBe(201)

    // Collect any wrong-role alert that a normal first click might trigger.
    const roleErrors: string[] = []
    for (const page of [
      guest,
      supporter,
      bystander,
      approved,
      pending,
      draft,
      admin,
    ]) {
      page.on('response', (response) => {
        if (
          response.url().includes(`/api/v1/demands/${demandId}`) &&
          response.request().method() !== 'GET' &&
          response.status() === 403
        ) {
          roleErrors.push(`${response.request().method()} ${response.url()}`)
        }
      })
    }

    await test.step('guest reads everything and only sees sign-in routes', async () => {
      await guest.goto(demandPath)
      await expectPublicContent(guest)
      await expect(
        guest.getByRole('heading', { name: publishHeading }),
      ).toBeVisible()
      await expect(
        guest.getByRole('link', { name: 'İşletmeci olarak giriş yap' }),
      ).toBeVisible()
      await expect(
        guest.getByRole('link', { name: 'Veli olarak giriş yap' }),
      ).toBeVisible()
      await expect(
        guest.getByRole('link', { name: 'Yorum yapmak için giriş yap' }),
      ).toBeVisible()
      await expect(
        guest.getByRole('link', { name: 'Giriş yaparak bildir' }).first(),
      ).toBeVisible()
      await expectNoButton(guest, publishButton, joinButton, commentButton)
      await expectNoButton(guest, 'Talebi bildir', 'Bildir')

      const token = await csrf(guest)
      const headers = { [token.headerName]: token.token }
      for (const [path, data] of [
        [
          `/api/v1/demands/${demandId}/support`,
          {
            needsMorning: true,
            needsAfternoon: false,
            reasons: ['NO_SUITABLE_SERVICE'],
          },
        ],
        [`/api/v1/demands/${demandId}/comments`, { body: 'Yetkisiz yorum.' }],
        [
          '/api/v1/reports',
          {
            targetType: 'DEMAND',
            targetId: demandId,
            reason: 'SPAM',
            explanation: null,
          },
        ],
      ] as const) {
        expect(
          (await guest.request.post(path, { headers, data })).status(),
        ).toBe(401)
      }
    })

    await test.step('a parent without support can join but not publish or comment', async () => {
      await bystander.goto(demandPath)
      await expectPublicContent(bystander)
      await expect(
        bystander.getByRole('button', { name: joinButton }),
      ).toBeVisible()
      await expect(
        bystander.getByText('Yorum yazmak için önce bu talebe destek verin.'),
      ).toBeVisible()
      await expect(
        bystander.getByRole('button', { name: 'Talebi bildir' }),
      ).toBeVisible()
      await expectNoButton(bystander, publishButton, commentButton)
      await expect(
        bystander.getByRole('heading', { name: publishHeading }),
      ).toHaveCount(0)
      await expect(
        bystander.getByRole('link', {
          name: /olarak giriş yap|için giriş yap/,
        }),
      ).toHaveCount(0)

      const token = await csrf(bystander)
      expect(
        (
          await bystander.request.post(`/api/v1/demands/${demandId}/comments`, {
            headers: { [token.headerName]: token.token },
            data: { body: 'Desteksiz yorum.' },
          })
        ).status(),
      ).toBe(403)
    })

    await test.step('the supporting parent manages support and comments only', async () => {
      await supporter.goto(demandPath)
      await expectPublicContent(supporter)
      await expect(
        supporter.getByRole('button', { name: 'Desteğimi düzenle' }),
      ).toBeVisible()
      await expect(
        supporter.getByRole('button', { name: 'Desteğimi geri çek' }),
      ).toBeVisible()
      await supporter.getByRole('button', { name: commentButton }).click()
      await expect(supporter.getByLabel('Yorumunuz')).toBeVisible()
      await expectNoButton(supporter, publishButton, joinButton)
      await expect(supporter.getByRole('alert')).toHaveCount(0)
    })

    await test.step('an approved operator can publish and comment but not support', async () => {
      await approved.goto(demandPath)
      await expectPublicContent(approved)
      await expect(
        approved.getByRole('button', { name: publishButton }),
      ).toBeVisible()
      // Client-side return to the page re-arms the delayed heading focus; a
      // keyboard user who acts first must keep focus in the comment field.
      await approved
        .getByRole('navigation', { name: 'Ana menü' })
        .getByRole('link', { name: 'Talep panosu' })
        .click()
      await expect(approved).toHaveURL(/\/demands$/)
      // The URL changes before the view transition swaps the page; going back
      // earlier would act on the outgoing demand page's controls.
      await expect(
        approved.getByRole('heading', {
          level: 1,
          name: 'Servis talep panosu',
        }),
      ).toBeVisible()
      await approved.goBack()
      await expect(
        approved.getByRole('heading', { level: 1, name: 'ROLE-01 Rol Okulu' }),
      ).toBeVisible()
      const commentTrigger = approved.getByRole('button', {
        name: commentButton,
      })
      await commentTrigger.focus()
      await approved.keyboard.press('Enter')
      const commentField = approved.getByLabel('Yorumunuz')
      await expect(commentField).toBeFocused()
      await approved.keyboard.type('Klavye')
      await approved.waitForTimeout(2_100)
      await expect(commentField).toBeFocused()
      await expect(commentField).toHaveValue('Klavye')
      await expect(
        approved.getByRole('button', { name: 'Talebi bildir' }),
      ).toBeVisible()
      await expectNoButton(approved, joinButton)
      await expect(
        approved.getByRole('heading', { name: 'Talebi destekleyin' }),
      ).toHaveCount(0)
      await expect(approved.getByRole('alert')).toHaveCount(0)

      const token = await csrf(approved)
      expect(
        (
          await approved.request.post(`/api/v1/demands/${demandId}/support`, {
            headers: { [token.headerName]: token.token },
            data: {
              needsMorning: true,
              needsAfternoon: false,
              reasons: ['NO_SUITABLE_SERVICE'],
            },
          })
        ).status(),
      ).toBe(403)
    })

    for (const [label, page] of [
      ['pending', pending],
      ['draft', draft],
    ] as const) {
      await test.step(`a ${label} operator gets approval guidance instead of a dead-end form`, async () => {
        await page.goto(demandPath)
        await expectPublicContent(page)
        await expect(
          page.getByText(/işletmeci başvurunuzun yönetici tarafından/),
        ).toBeVisible()
        await expect(
          page.getByRole('link', { name: 'Başvuru durumunu görüntüle' }),
        ).toHaveAttribute('href', '/operator/profile')
        await expectNoButton(page, commentButton, joinButton)
        await expect(page.getByLabel('Yorumunuz')).toHaveCount(0)

        for (const path of ['/operator/schools', '/operator/offerings']) {
          await page.goto(path)
          await expect(page).toHaveURL(/\/operator\/profile$/)
          await expect(
            page.getByRole('heading', { name: 'İşletme profilim' }),
          ).toBeVisible()
        }
        expect(
          (await page.request.get('/api/v1/operator/schools')).status(),
        ).toBe(403)
      })
    }

    await test.step('an approved operator opens the gated deep links directly', async () => {
      await approved.goto('/operator/schools')
      await expect(approved).toHaveURL(/\/operator\/schools$/)
      await expect(
        approved.getByRole('heading', { name: 'Okullar ve hizmet kapsamı' }),
      ).toBeVisible()
      await approved.goto('/operator/offerings')
      await expect(approved).toHaveURL(/\/operator\/offerings$/)
      await expect(
        approved.getByRole('heading', { name: 'Araçlar ve servis teklifleri' }),
      ).toBeVisible()
    })

    await test.step('an administrator reads without authoring or reporting controls', async () => {
      await admin.goto(demandPath)
      await expectPublicContent(admin)
      await expectNoButton(
        admin,
        publishButton,
        joinButton,
        commentButton,
        'Talebi bildir',
        'Bildir',
      )
      await expect(
        admin.getByRole('heading', { name: publishHeading }),
      ).toHaveCount(0)
      await expect(
        admin.getByRole('link', {
          name: /olarak giriş yap|için giriş yap|Giriş yaparak bildir/,
        }),
      ).toHaveCount(0)

      const token = await csrf(admin)
      const headers = { [token.headerName]: token.token }
      expect(
        (
          await admin.request.post(`/api/v1/demands/${demandId}/comments`, {
            headers,
            data: { body: 'Yönetici yorumu.' },
          })
        ).status(),
      ).toBe(403)
      expect(
        (
          await admin.request.post('/api/v1/reports', {
            headers,
            data: {
              targetType: 'DEMAND',
              targetId: demandId,
              reason: 'SPAM',
              explanation: null,
            },
          })
        ).status(),
      ).toBe(403)
    })

    expect(roleErrors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})

async function expectPublicContent(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'ROLE-01 Rol Okulu',
  )
  await expect(page.getByText(commentText)).toBeVisible()
}

async function expectNoButton(page: Page, ...names: string[]) {
  for (const name of names) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
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
}

async function csrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  return (await response.json()) as { headerName: string; token: string }
}
