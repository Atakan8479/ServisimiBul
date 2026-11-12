import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { settleDialogMotion } from '../e2e/support/dialog-motion'

const schoolId = '10000000-0000-4000-8000-000000000001'
const password = process.env.J03_PARENT_PASSWORD
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD

test('QA-01 verifies the enabled account lifecycle on the real stack', async ({
  browser,
}) => {
  expect(password, 'J03_PARENT_PASSWORD must be supplied').toBeTruthy()
  expect(adminPassword, 'J03_ADMIN_PASSWORD must be supplied').toBeTruthy()

  const contexts = await Promise.all(
    Array.from({ length: 7 }, () => browser.newContext()),
  )
  const [
    parent,
    parentSecondSession,
    otherParent,
    operator,
    operatorSecondSession,
    admin,
    anonymous,
  ] = await Promise.all(contexts.map((context) => context.newPage()))
  const parentEmail = 'qa01.parent@example.test'
  const otherParentEmail = 'qa01.parent.other@example.test'
  const operatorEmail = 'qa01.operator@example.test'
  const operatorPassword = 'QA01-operator-password'

  try {
    await registerParent(parent, parentEmail, password!)
    await registerParent(otherParent, otherParentEmail, password!)
    await login(parent, parentEmail, password!, 'parent')
    await login(parentSecondSession, parentEmail, password!, 'parent')
    await login(otherParent, otherParentEmail, password!, 'parent')
    await login(admin, adminEmail, adminPassword!, 'admin')

    const anonymousCsrf = await csrf(anonymous)
    expect(
      (
        await anonymous.request.post('/api/v1/auth/deactivate', {
          headers: { [anonymousCsrf.headerName]: anonymousCsrf.token },
        })
      ).status(),
    ).toBe(401)

    const adminCsrf = await csrf(admin)
    expect(
      (
        await admin.request.post('/api/v1/auth/deactivate', {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
        })
      ).status(),
    ).toBe(403)

    expect(
      await parent.evaluate(async () => {
        const response = await fetch('/api/v1/auth/deactivate', {
          method: 'POST',
          credentials: 'include',
        })
        return response.status
      }),
    ).toBe(403)
    expect((await parent.request.get('/api/v1/auth/me')).status()).toBe(200)
    expect(
      (await parent.request.get('/api/v1/data-rights-requests')).status(),
    ).toBe(503)

    const demandSchool = await admin.request.post('/api/v1/admin/schools', {
      headers: { [adminCsrf.headerName]: adminCsrf.token },
      data: {
        neighborhoodId: 340101,
        name: 'QA-01 Paylaşılan Talep Okulu',
        address: null,
        sourceName: 'QA-01 synthetic fixture',
        sourceCode: 'QA01-SHARED-DEMAND',
        active: true,
      },
    })
    expect(demandSchool.status()).toBe(201)
    const demandSchoolId = ((await demandSchool.json()) as { id: string }).id

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 800 },
    ]) {
      await parent.setViewportSize(viewport)
      await parent.goto('/parent/account')
      const trigger = parent.getByRole('button', {
        name: 'Hesabı devre dışı bırak',
      })
      await expect(trigger).toBeVisible()
      expect(await horizontalOverflow(parent)).toBeLessThanOrEqual(1)
      expect(
        (
          await new AxeBuilder({ page: parent })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([])
    }

    const demandId = await joinSharedDemand(parent, otherParent, demandSchoolId)
    const otherSupportBefore = await demand(otherParent, demandId)
    const supporterCountBefore = otherSupportBefore.supporterCount
    const otherSupportId = otherSupportBefore.currentUserSupport?.id
    expect(otherSupportId).toBeTruthy()

    const trigger = parent.getByRole('button', {
      name: 'Hesabı devre dışı bırak',
    })
    await trigger.click()
    const cancel = parent.getByRole('button', { name: 'Vazgeç' })
    await expect(cancel).toBeFocused()
    await settleDialogMotion(parent)
    expect(
      (
        await new AxeBuilder({ page: parent })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([])

    const deactivation = parent.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/v1/auth/deactivate'),
    )
    await parent.getByRole('button', { name: 'Evet, devre dışı bırak' }).click()
    expect((await deactivation).status()).toBe(204)
    await expect(parent).toHaveURL(/\/parent\/login\?accountDeactivated=true/)
    expect((await parent.request.get('/api/v1/auth/me')).status()).toBe(401)
    expect(
      (await parentSecondSession.request.get('/api/v1/auth/me')).status(),
    ).toBe(401)
    expect(await loginStatus(parentSecondSession, parentEmail, password!)).toBe(
      401,
    )

    const sharedAfter = await demand(otherParent, demandId)
    expect(sharedAfter.supporterCount).toBe(supporterCountBefore - 1)
    expect(sharedAfter.currentUserSupport?.id).toBe(otherSupportId)

    await registerOperator(
      operator,
      operatorEmail,
      operatorPassword,
      'QA-01 Gerçek Servis',
    )
    await login(operator, operatorEmail, operatorPassword, 'operator')
    await login(
      operatorSecondSession,
      operatorEmail,
      operatorPassword,
      'operator',
    )
    const operatorCsrf = await csrf(operator)
    const profile = await operator.request.get('/api/v1/operator/profile')
    const profileId = ((await profile.json()) as { id: string }).id
    expect(
      (
        await operator.request.post('/api/v1/operator/application/submit', {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await admin.request.post(
          `/api/v1/admin/operators/${profileId}/approve`,
          { headers: { [adminCsrf.headerName]: adminCsrf.token } },
        )
      ).status(),
    ).toBe(200)
    const school = await operator.request.post('/api/v1/operator/schools', {
      headers: { [operatorCsrf.headerName]: operatorCsrf.token },
      data: { schoolId },
    })
    const operatorSchoolId = ((await school.json()) as { id: string }).id
    expect(
      (
        await operator.request.put(
          `/api/v1/operator/schools/${operatorSchoolId}/coverage`,
          {
            headers: { [operatorCsrf.headerName]: operatorCsrf.token },
            data: { neighborhoodIds: [340201] },
          },
        )
      ).status(),
    ).toBe(200)
    expect(await publicOperatorIds(anonymous)).toContain(profileId)

    const secondOperatorCsrf = await csrf(operatorSecondSession)
    const concurrent = await Promise.all([
      operator.request.post('/api/v1/auth/deactivate', {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
      }),
      operatorSecondSession.request.post('/api/v1/auth/deactivate', {
        headers: {
          [secondOperatorCsrf.headerName]: secondOperatorCsrf.token,
        },
      }),
    ])
    const statuses = concurrent.map((response) => response.status())
    expect(statuses).toContain(204)
    expect(
      statuses.every(
        (status) => status === 204 || status === 401 || status === 403,
      ),
    ).toBe(true)
    expect((await operator.request.get('/api/v1/auth/me')).status()).toBe(401)
    expect(
      (await operatorSecondSession.request.get('/api/v1/auth/me')).status(),
    ).toBe(401)
    expect(await loginStatus(operator, operatorEmail, operatorPassword)).toBe(
      401,
    )
    expect(await publicOperatorIds(anonymous)).not.toContain(profileId)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})

async function registerParent(page: Page, email: string, userPassword: string) {
  const token = await csrf(page)
  const response = await page.request.post('/api/v1/auth/parent/register', {
    headers: { [token.headerName]: token.token },
    data: { email, password: userPassword },
  })
  expect(response.status()).toBe(202)
}

async function registerOperator(
  page: Page,
  email: string,
  userPassword: string,
  businessName: string,
) {
  const token = await csrf(page)
  const response = await page.request.post('/api/v1/auth/register', {
    headers: { [token.headerName]: token.token },
    data: {
      email,
      password: userPassword,
      businessName,
      contactPhone: '+905321234567',
    },
  })
  expect(response.status()).toBe(202)
}

async function login(
  page: Page,
  email: string,
  userPassword: string,
  role: 'admin' | 'operator' | 'parent',
) {
  expect(await loginStatus(page, email, userPassword)).toBe(200)
  await page.goto(role === 'parent' ? '/demands' : `/${role}`)
}

async function loginStatus(page: Page, email: string, userPassword: string) {
  const token = await csrf(page)
  const response = await page.request.post('/api/v1/auth/login', {
    headers: { [token.headerName]: token.token },
    data: { email, password: userPassword, rememberMe: false },
  })
  return response.status()
}

async function csrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  return (await response.json()) as { headerName: string; token: string }
}

async function joinSharedDemand(
  first: Page,
  second: Page,
  demandSchoolId: string,
) {
  const data = {
    schoolId: demandSchoolId,
    neighborhoodId: 340101,
    needsMorning: true,
    needsAfternoon: false,
    reasons: ['NO_SUITABLE_SERVICE'],
  }
  const firstCsrf = await csrf(first)
  const firstResponse = await first.request.post('/api/v1/demands', {
    headers: { [firstCsrf.headerName]: firstCsrf.token },
    data,
  })
  expect([200, 201]).toContain(firstResponse.status())
  const demandId = ((await firstResponse.json()) as { demand: { id: string } })
    .demand.id
  const secondCsrf = await csrf(second)
  const secondResponse = await second.request.post(
    `/api/v1/demands/${demandId}/support`,
    {
      headers: { [secondCsrf.headerName]: secondCsrf.token },
      data: {
        needsMorning: false,
        needsAfternoon: true,
        reasons: ['NO_AVAILABLE_SEATS'],
      },
    },
  )
  expect(secondResponse.status()).toBe(200)
  return demandId
}

async function demand(page: Page, demandId: string) {
  const response = await page.request.get(`/api/v1/demands/${demandId}`)
  expect(response.status()).toBe(200)
  return (await response.json()) as {
    supporterCount: number
    currentUserSupport: { id: string } | null
  }
}

async function publicOperatorIds(page: Page) {
  const response = await page.request.get(
    `/api/v1/operators?schoolId=${schoolId}&neighborhoodId=340201&size=50`,
  )
  expect(response.status()).toBe(200)
  return (
    (await response.json()) as {
      content: Array<{ operatorId: string }>
    }
  ).content.map(({ operatorId }) => operatorId)
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
}
