import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const operatorEmail = 'j03.operator@example.test'
const operatorPassword = 'J03-operator-password'
const adminEmail = process.env.J03_ADMIN_EMAIL ?? 'j03.admin.one@example.test'
const adminPassword = process.env.J03_ADMIN_PASSWORD
const parentEmail = process.env.J03_PARENT_EMAIL ?? 'j03.parent@example.test'
const secondParentEmail = 'j03.parent.two@example.test'
const parentPassword = process.env.J03_PARENT_PASSWORD
const parentDemandPath =
  '/demands?schoolId=10000000-0000-4000-8000-000000000001&pickupDistrictId=3402&neighborhoodId=340201&intent=create'

interface DemandState {
  id: string
  status: 'OPEN' | 'CLOSED'
  closureReason: 'FULFILLED' | 'INACTIVE' | null
  supporterCount: number
  morningCount: number
  afternoonCount: number
  currentUserSupport: {
    id: string
    status: string
    needsMorning: boolean
    needsAfternoon: boolean
    reasons: string[]
  } | null
}

interface DemandCreation {
  created: boolean
  demand: DemandState
}

interface PublishedResponse {
  published: boolean
  response: {
    id: string
    status: string
    offersMorning: boolean
    offersAfternoon: boolean
    publicationVersion: number
    publicationEventId: string
  }
}

interface FeedbackList {
  feedback: Array<{
    publicationEventId: string
    status: string
    canEvaluate: boolean
  }>
}

interface CommentPage {
  content: Array<{
    id: string
    body: string
    author: {
      role: 'PARENT' | 'OPERATOR'
      displayName: string
      operatorProfileId: string | null
    }
    canDelete: boolean
  }>
  totalElements: number
}

interface ReportReceipt {
  id: string
  caseId: string
  targetType: 'COMMENT' | 'DEMAND' | 'SERVICE_RESPONSE'
  targetId: string
}

interface NotificationPage {
  content: Array<{
    id: string
    type: string
    demandId: string | null
    moderationCaseId: string | null
    readAt: string | null
  }>
  totalElements: number
}

test('runs the approved MVP journey against the real backend and PostgreSQL', async ({
  browser,
}) => {
  expect(
    adminPassword,
    'J03_ADMIN_PASSWORD must be supplied by the isolated runner',
  ).toBeTruthy()

  const operatorContext = await browser.newContext()
  const adminContext = await browser.newContext()
  const publicContext = await browser.newContext()
  const parentContext = await browser.newContext()
  const secondParentContext = await browser.newContext()
  const nonSupportingParentContext = await browser.newContext()
  const operatorPage = await operatorContext.newPage()
  const adminPage = await adminContext.newPage()
  const publicPage = await publicContext.newPage()
  const parentPage = await parentContext.newPage()
  const secondParentPage = await secondParentContext.newPage()
  const nonSupportingParentPage = await nonSupportingParentContext.newPage()

  adminPage.on('dialog', (dialog) => void dialog.accept())

  try {
    await test.step('register through the local-only verification bypass', async () => {
      await operatorPage.goto('/operator/register')
      await operatorPage.getByLabel('E-posta').fill(operatorEmail)
      await operatorPage.getByLabel('Şifre').fill(operatorPassword)
      await operatorPage
        .getByLabel('İşletme adı (isteğe bağlı)')
        .fill('J03 Gerçek Servis')
      await operatorPage
        .getByLabel('Herkese açık iletişim telefonu')
        .fill('0532 111 22 33')
      await operatorPage.getByRole('button', { name: 'Hesap oluştur' }).click()
      await expect(
        operatorPage.getByRole('heading', { name: 'Hesabınız hazır' }),
      ).toBeVisible()
    })

    await test.step('register a parent and return safely to the intended demand', async () => {
      expect(
        parentPassword,
        'J03_PARENT_PASSWORD must be supplied by the isolated runner',
      ).toBeTruthy()
      await parentPage.goto(
        `/parent/register?next=${encodeURIComponent(parentDemandPath)}`,
      )
      await parentPage.getByLabel('E-posta').fill(parentEmail)
      await parentPage.getByLabel('Şifre').fill(parentPassword!)
      const registration = parentPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/auth/parent/register'),
      )
      await parentPage
        .getByRole('button', { name: 'Veli hesabı oluştur' })
        .click()
      expect((await registration).status()).toBe(202)
      await expect(parentPage).toHaveURL(
        /\/operator\/login\?.*registered=parent/,
      )
      await expect(parentPage.getByText(/Kayıt isteğiniz alındı/)).toBeVisible()

      await parentPage.getByLabel('E-posta').fill(parentEmail)
      await parentPage.getByLabel('Şifre').fill(parentPassword!)
      await parentPage.getByRole('button', { name: 'Giriş yap' }).click()
      await expect
        .poll(() => {
          const url = new URL(parentPage.url())
          return `${url.pathname}${url.search}`
        })
        .toBe(parentDemandPath)
      await expect(parentPage.getByText(/Seçiminiz korundu/)).toBeVisible()

      const secondParentCsrf = await csrf(secondParentPage)
      const secondRegistration = await secondParentPage.request.post(
        '/api/v1/auth/parent/register',
        {
          headers: {
            [secondParentCsrf.headerName]: secondParentCsrf.token,
          },
          data: { email: secondParentEmail, password: parentPassword },
        },
      )
      expect(secondRegistration.status()).toBe(202)
      await login(
        secondParentPage,
        secondParentEmail,
        parentPassword!,
        'parent',
      )

      const nonSupporterCsrf = await csrf(nonSupportingParentPage)
      const nonSupporterRegistration =
        await nonSupportingParentPage.request.post(
          '/api/v1/auth/parent/register',
          {
            headers: {
              [nonSupporterCsrf.headerName]: nonSupporterCsrf.token,
            },
            data: {
              email: 'j03.parent.non-supporter@example.test',
              password: parentPassword,
            },
          },
        )
      expect(nonSupporterRegistration.status()).toBe(202)
      await login(
        nonSupportingParentPage,
        'j03.parent.non-supporter@example.test',
        parentPassword!,
        'parent',
      )
    })

    await test.step('use a real session and reject a mutation without CSRF', async () => {
      await login(operatorPage, operatorEmail, operatorPassword, 'operator')
      await expect(operatorPage).toHaveURL(/\/operator$/)

      const csrfStatus = await operatorPage.evaluate(async () => {
        const response = await fetch('/api/v1/operator/application/submit', {
          method: 'POST',
          credentials: 'include',
        })
        return response.status
      })
      expect(csrfStatus).toBe(403)
    })

    let operatorProfileId = ''
    await test.step('complete, submit, correct, and approve the profile', async () => {
      await operatorPage.goto('/operator/profile')
      await operatorPage
        .getByLabel('Kısa açıklama')
        .fill('J03 gerçek tam yığın doğrulaması')
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await expect(
        operatorPage.getByText('Profil bilgileriniz kaydedildi.'),
      ).toBeVisible()
      await operatorPage
        .getByRole('button', { name: 'Başvuruyu gönder' })
        .click()
      await expect(operatorPage.getByText('İncelemede')).toBeVisible()

      await login(adminPage, adminEmail, adminPassword!, 'admin')
      await adminPage.goto('/admin/applications')
      await adminPage.getByRole('link', { name: 'Başvuruyu incele' }).click()
      await expect(adminPage).toHaveURL(/\/admin\/applications\/[0-9a-f-]+$/)
      operatorProfileId = new URL(adminPage.url()).pathname.split('/').at(-1)!
      await adminPage
        .getByLabel('Düzeltme nedeni')
        .fill('J03 düzeltme ve yeniden gönderim kontrolü.')
      await adminPage.getByRole('button', { name: 'Düzeltme iste' }).click()
      await expect(
        adminPage.getByText('Düzeltme talebi gönderildi.'),
      ).toBeVisible()

      await operatorPage.reload()
      await expect(operatorPage.getByText('Düzeltme istendi')).toBeVisible()
      await operatorPage
        .getByLabel('Herkese açık iletişim telefonu')
        .fill('+905321112244')
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await operatorPage.getByRole('button', { name: 'Yeniden gönder' }).click()
      await expect(operatorPage.getByText('İncelemede')).toBeVisible()

      const adminCsrf = await csrf(adminPage)
      const approved = await adminPage.request.post(
        `/api/v1/admin/operators/${operatorProfileId}/approve`,
        { headers: { [adminCsrf.headerName]: adminCsrf.token } },
      )
      expect(approved.status()).toBe(200)
      expect(
        (await approved.json()) as {
          profile: { approvalStatus: string }
        },
      ).toMatchObject({ profile: { approvalStatus: 'APPROVED' } })
    })

    let operatorSchoolId = ''
    await test.step('attach a school and save cross-district same-province coverage', async () => {
      await operatorPage.goto('/operator/schools')
      await operatorPage.getByLabel('Okul ara').fill('J03 Gerçek')
      await operatorPage.getByRole('button', { name: 'Ara' }).click()
      await operatorPage
        .getByLabel('Aktif okul')
        .selectOption({ label: 'J03 Gerçek Okulu — Kadıköy' })
      const created = operatorPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/operator/schools'),
      )
      await operatorPage.getByRole('button', { name: 'Okulu ekle' }).click()
      operatorSchoolId = ((await (await created).json()) as { id: string }).id

      await operatorPage
        .getByRole('group', { name: 'Kadıköy' })
        .getByRole('button', { name: 'Kadıköy' })
        .click()
      await operatorPage
        .getByRole('group', { name: 'Kadıköy' })
        .getByRole('checkbox', { name: 'Moda' })
        .check()
      await operatorPage
        .getByRole('group', { name: 'Üsküdar' })
        .getByRole('button', { name: 'Üsküdar' })
        .click()
      await operatorPage
        .getByRole('group', { name: 'Üsküdar' })
        .getByRole('checkbox', { name: 'Acıbadem' })
        .check()
      await operatorPage.getByRole('button', { name: 'Kapsamı kaydet' }).click()
      await expect(
        operatorPage.getByText(/Hizmet kapsamı kaydedildi/),
      ).toBeVisible()
    })

    await test.step('enforce role and ownership boundaries through the real API', async () => {
      const adminCsrf = await csrf(adminPage)
      const adminDenied = await adminPage.request.post(
        '/api/v1/operator/schools',
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: { schoolId: '10000000-0000-4000-8000-000000000001' },
        },
      )
      expect(adminDenied.status()).toBe(403)

      const operatorCsrf = await csrf(operatorPage)
      const missingOwnedResource = await operatorPage.request.patch(
        '/api/v1/operator/schools/20000000-0000-4000-8000-000000000002',
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { active: false },
        },
      )
      expect(missingOwnedResource.status()).toBe(404)
    })

    await test.step('discover the operator anonymously without vehicle or offering', async () => {
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: '1 işletmeci bulundu' }),
      ).toBeVisible()
      await expect(publicPage.getByText('J03 Gerçek Servis')).toBeVisible()
      await expect(
        publicPage.getByRole('link', { name: '+905321112244' }),
      ).toBeVisible()
      await expect(
        publicPage.getByText('Paylaşılan servis bilgileri'),
      ).toHaveCount(0)
      await expect(publicPage.getByText(operatorEmail)).toHaveCount(0)
      await expect(
        publicPage.getByText('Bu tarife kişisel fiyat teklifi değildir.'),
      ).toBeVisible()
    })

    await test.step('invalidate and restore publication through profile and coverage state', async () => {
      await operatorPage.goto('/operator/profile')
      await operatorPage.getByLabel('Profilimi velilere göster').uncheck()
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
      ).toBeVisible()

      await operatorPage.getByLabel('Profilimi velilere göster').check()
      await operatorPage
        .getByRole('button', { name: 'Değişiklikleri kaydet' })
        .click()
      await operatorPage.goto('/operator/schools')
      await operatorPage
        .getByRole('button', { name: 'Kapsamı düzenle' })
        .click()
      await operatorPage
        .getByRole('group', { name: 'Kadıköy' })
        .getByRole('button', { name: 'Kadıköy' })
        .click()
      await operatorPage
        .getByRole('group', { name: 'Üsküdar' })
        .getByRole('button', { name: 'Üsküdar' })
        .click()
      await operatorPage.getByRole('checkbox', { name: 'Moda' }).uncheck()
      await operatorPage.getByRole('checkbox', { name: 'Acıbadem' }).uncheck()
      await operatorPage.getByRole('button', { name: 'Kapsamı kaydet' }).click()
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
      ).toBeVisible()

      const operatorCsrf = await csrf(operatorPage)
      const restored = await operatorPage.request.put(
        `/api/v1/operator/schools/${operatorSchoolId}/coverage`,
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { neighborhoodIds: [340101, 340201] },
        },
      )
      expect(restored.ok()).toBe(true)
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: '1 işletmeci bulundu' }),
      ).toBeVisible()
    })

    await test.step('persist an immutable UKOME version and expose it publicly', async () => {
      await adminPage.goto('/admin/tariffs')
      const editor = adminPage.getByLabel('Tarife JSON içeriği')
      const tariff = JSON.parse(await editor.inputValue()) as Record<
        string,
        unknown
      >
      tariff.version = 'j03-v2'
      tariff.sourceTitle = 'J03 güncel sentetik UKOME kararı'
      await editor.fill(JSON.stringify(tariff, null, 2))
      await adminPage.getByRole('button', { name: 'Tarifeyi kaydet' }).click()
      await expect(
        adminPage.getByText('Tarife j03-v2 sürümüyle kaydedildi.'),
      ).toBeVisible()

      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('link', {
          name: 'J03 güncel sentetik UKOME kararı kaynağını aç',
        }),
      ).toBeVisible()
    })

    let sharedDemandId = ''
    let firstParentSupportId = ''
    let secondParentSupportId = ''
    const firstParentSupport = {
      needsMorning: true,
      needsAfternoon: false,
      reasons: ['NO_SUITABLE_SERVICE'],
    }
    const secondParentSupport = {
      needsMorning: false,
      needsAfternoon: true,
      reasons: ['NO_AVAILABLE_SEATS'],
    }

    await test.step('concurrently create one demand for two real parents without leaking ownership', async () => {
      const firstCsrf = await csrf(parentPage)
      const secondCsrf = await csrf(secondParentPage)
      const demandKey = {
        schoolId: '10000000-0000-4000-8000-000000000001',
        neighborhoodId: 340101,
      }
      const [firstCreation, secondCreation] = await Promise.all([
        parentPage.request.post('/api/v1/demands', {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: { ...demandKey, ...firstParentSupport },
        }),
        secondParentPage.request.post('/api/v1/demands', {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: { ...demandKey, ...secondParentSupport },
        }),
      ])
      expect([firstCreation.status(), secondCreation.status()].sort()).toEqual([
        200, 201,
      ])
      const creations = [
        (await firstCreation.json()) as DemandCreation,
        (await secondCreation.json()) as DemandCreation,
      ]
      expect(creations.map(({ created }) => created).sort()).toEqual([
        false,
        true,
      ])
      expect(new Set(creations.map(({ demand }) => demand.id)).size).toBe(1)
      sharedDemandId = creations[0].demand.id

      let firstState = await demand(parentPage, sharedDemandId)
      let secondState = await demand(secondParentPage, sharedDemandId)
      expect(firstState.supporterCount).toBe(1)
      expect(secondState.supporterCount).toBe(1)

      if (!firstState.currentUserSupport) {
        const joined = await parentPage.request.post(
          `/api/v1/demands/${sharedDemandId}/support`,
          {
            headers: { [firstCsrf.headerName]: firstCsrf.token },
            data: firstParentSupport,
          },
        )
        expect(joined.status()).toBe(200)
      } else {
        const joined = await secondParentPage.request.post(
          `/api/v1/demands/${sharedDemandId}/support`,
          {
            headers: { [secondCsrf.headerName]: secondCsrf.token },
            data: secondParentSupport,
          },
        )
        expect(joined.status()).toBe(200)
      }

      firstState = await demand(parentPage, sharedDemandId)
      secondState = await demand(secondParentPage, sharedDemandId)
      firstParentSupportId = firstState.currentUserSupport!.id
      secondParentSupportId = secondState.currentUserSupport!.id
      expect(firstParentSupportId).not.toBe(secondParentSupportId)
      expect(firstState).toMatchObject({
        supporterCount: 2,
        morningCount: 1,
        afternoonCount: 1,
        currentUserSupport: firstParentSupport,
      })
      expect(secondState).toMatchObject({
        supporterCount: 2,
        currentUserSupport: secondParentSupport,
      })

      const anonymous = await demand(publicPage, sharedDemandId)
      expect(anonymous.currentUserSupport).toBeNull()
      expect(JSON.stringify(anonymous)).not.toContain(parentEmail)
      expect(JSON.stringify(anonymous)).not.toContain(secondParentEmail)
    })

    await test.step('isolate support ownership and close then reopen an inactive demand', async () => {
      const secondCsrf = await csrf(secondParentPage)
      const editedSupport = {
        needsMorning: true,
        needsAfternoon: true,
        reasons: ['PRICE_TOO_HIGH'],
      }
      const edited = await secondParentPage.request.put(
        `/api/v1/demands/${sharedDemandId}/support`,
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: editedSupport,
        },
      )
      expect(edited.status()).toBe(200)
      expect((await edited.json()) as DemandState).toMatchObject({
        currentUserSupport: {
          id: secondParentSupportId,
          ...editedSupport,
        },
      })
      expect(await demand(parentPage, sharedDemandId)).toMatchObject({
        currentUserSupport: {
          id: firstParentSupportId,
          ...firstParentSupport,
        },
      })

      const missingCsrf = await secondParentPage.request.put(
        `/api/v1/demands/${sharedDemandId}/support`,
        { data: secondParentSupport },
      )
      expect(missingCsrf.status()).toBe(403)

      const operatorCsrf = await csrf(operatorPage)
      const operatorDenied = await operatorPage.request.post(
        `/api/v1/demands/${sharedDemandId}/support`,
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: firstParentSupport,
        },
      )
      expect(operatorDenied.status()).toBe(403)
      const parentDenied = await secondParentPage.request.post(
        `/api/v1/operator/demands/${sharedDemandId}/response`,
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: { offersMorning: true, offersAfternoon: false },
        },
      )
      expect(parentDenied.status()).toBe(403)

      const withdrewSecond = await secondParentPage.request.delete(
        `/api/v1/demands/${sharedDemandId}/support`,
        { headers: { [secondCsrf.headerName]: secondCsrf.token } },
      )
      expect(withdrewSecond.status()).toBe(204)
      expect(await demand(parentPage, sharedDemandId)).toMatchObject({
        status: 'OPEN',
        supporterCount: 1,
      })
      const reactivatedSecond = await secondParentPage.request.post(
        `/api/v1/demands/${sharedDemandId}/support`,
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: secondParentSupport,
        },
      )
      expect(reactivatedSecond.status()).toBe(200)
      expect((await reactivatedSecond.json()) as DemandState).toMatchObject({
        supporterCount: 2,
        currentUserSupport: { id: secondParentSupportId },
      })

      const firstCsrf = await csrf(parentPage)
      const withdrewFirst = await parentPage.request.delete(
        `/api/v1/demands/${sharedDemandId}/support`,
        { headers: { [firstCsrf.headerName]: firstCsrf.token } },
      )
      expect(withdrewFirst.status()).toBe(204)
      const withdrewLast = await secondParentPage.request.delete(
        `/api/v1/demands/${sharedDemandId}/support`,
        { headers: { [secondCsrf.headerName]: secondCsrf.token } },
      )
      expect(withdrewLast.status()).toBe(204)
      expect(await demand(publicPage, sharedDemandId)).toMatchObject({
        status: 'CLOSED',
        closureReason: 'INACTIVE',
        supporterCount: 0,
      })

      const reopened = await parentPage.request.post(
        `/api/v1/demands/${sharedDemandId}/support`,
        {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: firstParentSupport,
        },
      )
      expect(reopened.status()).toBe(200)
      expect((await reopened.json()) as DemandState).toMatchObject({
        status: 'OPEN',
        supporterCount: 1,
        currentUserSupport: { id: firstParentSupportId },
      })
      const rejoined = await secondParentPage.request.post(
        `/api/v1/demands/${sharedDemandId}/support`,
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: secondParentSupport,
        },
      )
      expect(rejoined.status()).toBe(200)
      expect((await rejoined.json()) as DemandState).toMatchObject({
        status: 'OPEN',
        supporterCount: 2,
        currentUserSupport: { id: secondParentSupportId },
      })
    })

    await test.step('enforce real comment privacy, ownership, escaping, moderation, and notification boundaries', async () => {
      const commentsPath = `/api/v1/demands/${sharedDemandId}/comments`
      const firstCsrf = await csrf(parentPage)
      const secondCsrf = await csrf(secondParentPage)
      const operatorCsrf = await csrf(operatorPage)
      const nonSupporterCsrf = await csrf(nonSupportingParentPage)
      const unsafeLookingText =
        '<img src=x onerror=alert(1)> gerçek veli yorumu'

      const parentCommentResponse = await parentPage.request.post(
        commentsPath,
        {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: { body: unsafeLookingText },
        },
      )
      expect(parentCommentResponse.status()).toBe(201)
      const parentComment = (await parentCommentResponse.json()) as {
        id: string
      }

      const operatorCommentResponse = await operatorPage.request.post(
        commentsPath,
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { body: 'Bu mahalle için sabah yönünde hizmet verebilirim.' },
        },
      )
      expect(operatorCommentResponse.status()).toBe(201)

      const nonSupporterDenied = await nonSupportingParentPage.request.post(
        commentsPath,
        {
          headers: { [nonSupporterCsrf.headerName]: nonSupporterCsrf.token },
          data: { body: 'Bu yorum yayınlanmamalı.' },
        },
      )
      expect(nonSupporterDenied.status()).toBe(403)

      const publicCommentsResponse = await publicPage.request.get(commentsPath)
      expect(publicCommentsResponse.status()).toBe(200)
      const publicComments =
        (await publicCommentsResponse.json()) as CommentPage
      expect(publicComments.totalElements).toBe(2)
      expect(publicComments.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: parentComment.id,
            body: unsafeLookingText,
            author: expect.objectContaining({
              role: 'PARENT',
              displayName: 'Veli',
              operatorProfileId: null,
            }),
            canDelete: false,
          }),
          expect.objectContaining({
            author: expect.objectContaining({
              role: 'OPERATOR',
              displayName: 'J03 Gerçek Servis',
              operatorProfileId,
            }),
          }),
        ]),
      )
      expect(JSON.stringify(publicComments)).not.toContain(parentEmail)
      expect(JSON.stringify(publicComments)).not.toContain(operatorEmail)

      const firstCommentPage = (await (
        await publicPage.request.get(`${commentsPath}?page=0&size=1`)
      ).json()) as CommentPage
      const secondCommentPage = (await (
        await publicPage.request.get(`${commentsPath}?page=1&size=1`)
      ).json()) as CommentPage
      expect(firstCommentPage.totalElements).toBe(2)
      expect(secondCommentPage.totalElements).toBe(2)
      expect(firstCommentPage.content).toHaveLength(1)
      expect(secondCommentPage.content).toHaveLength(1)
      expect(firstCommentPage.content[0].id).not.toBe(
        secondCommentPage.content[0].id,
      )

      await publicPage.goto(`/demands/${sharedDemandId}`)
      await expect(publicPage.getByText(unsafeLookingText)).toBeVisible()
      expect(await publicPage.locator('img[src="x"]').count()).toBe(0)

      const foreignDelete = await secondParentPage.request.delete(
        `${commentsPath}/${parentComment.id}`,
        { headers: { [secondCsrf.headerName]: secondCsrf.token } },
      )
      expect(foreignDelete.status()).toBe(404)

      const commentReportResponse = await secondParentPage.request.post(
        '/api/v1/reports',
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: {
            targetType: 'COMMENT',
            targetId: parentComment.id,
            reason: 'PERSONAL_DATA',
            explanation: 'Sentetik yorum moderasyon doğrulaması.',
          },
        },
      )
      expect(commentReportResponse.status()).toBe(201)
      const commentReport =
        (await commentReportResponse.json()) as ReportReceipt

      const demandReportResponse = await operatorPage.request.post(
        '/api/v1/reports',
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: {
            targetType: 'DEMAND',
            targetId: sharedDemandId,
            reason: 'OTHER',
            explanation: 'Sentetik talep bildirimi doğrulaması.',
          },
        },
      )
      expect(demandReportResponse.status()).toBe(201)

      expect(
        (
          (await (
            await publicPage.request.get(commentsPath)
          ).json()) as CommentPage
        ).content.map(({ id }) => id),
      ).toContain(parentComment.id)
      expect(await demand(publicPage, sharedDemandId)).toMatchObject({
        status: 'OPEN',
        supporterCount: 2,
      })

      const adminCsrf = await csrf(adminPage)
      const adminNotificationsResponse = await adminPage.request.get(
        '/api/v1/notifications?size=50',
      )
      expect(adminNotificationsResponse.status()).toBe(200)
      const adminNotifications =
        (await adminNotificationsResponse.json()) as NotificationPage
      const commentReportNotification = adminNotifications.content.find(
        ({ moderationCaseId }) => moderationCaseId === commentReport.caseId,
      )
      expect(commentReportNotification).toMatchObject({
        type: 'CONTENT_REPORTED',
        readAt: null,
      })

      const parentCannotReadAdminNotification = await parentPage.request.put(
        `/api/v1/notifications/${commentReportNotification!.id}/read`,
        { headers: { [firstCsrf.headerName]: firstCsrf.token } },
      )
      expect(parentCannotReadAdminNotification.status()).toBe(404)
      const markedRead = await adminPage.request.put(
        `/api/v1/notifications/${commentReportNotification!.id}/read`,
        { headers: { [adminCsrf.headerName]: adminCsrf.token } },
      )
      expect(markedRead.status()).toBe(200)
      expect(
        (await markedRead.json()) as { readAt: string | null },
      ).toMatchObject({ readAt: expect.any(String) })

      const caseDetailResponse = await adminPage.request.get(
        `/api/v1/admin/moderation/cases/${commentReport.caseId}`,
      )
      expect(caseDetailResponse.status()).toBe(200)
      const caseDetailText = await caseDetailResponse.text()
      expect(caseDetailText).not.toContain(parentEmail)
      expect(caseDetailText).not.toContain(secondParentEmail)

      const hidden = await adminPage.request.post(
        `/api/v1/admin/moderation/cases/${commentReport.caseId}/actions`,
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: {
            action: 'HIDE_COMMENT',
            reason: 'Sentetik kişisel veri moderasyon kontrolü.',
          },
        },
      )
      expect(hidden.status()).toBe(200)
      expect(
        (
          (await (
            await publicPage.request.get(commentsPath)
          ).json()) as CommentPage
        ).content.map(({ id }) => id),
      ).not.toContain(parentComment.id)

      const restored = await adminPage.request.post(
        `/api/v1/admin/moderation/cases/${commentReport.caseId}/actions`,
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: {
            action: 'RESTORE_COMMENT',
            reason: 'Sentetik yorum geri yükleme kontrolü.',
          },
        },
      )
      expect(restored.status()).toBe(200)
      expect(
        (
          (await (
            await publicPage.request.get(commentsPath)
          ).json()) as CommentPage
        ).content.map(({ id }) => id),
      ).toContain(parentComment.id)
    })

    await test.step('keep publication idempotent and close only after every active parent is satisfied', async () => {
      const responsePath = `/api/v1/operator/demands/${sharedDemandId}/response`
      const operatorCsrf = await csrf(operatorPage)
      const firstPublication = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: false },
      })
      expect(firstPublication.status()).toBe(200)
      const firstPublished =
        (await firstPublication.json()) as PublishedResponse
      expect(firstPublished).toMatchObject({
        published: true,
        response: {
          status: 'ACTIVE',
          offersMorning: true,
          offersAfternoon: false,
          publicationVersion: 1,
        },
      })

      const duplicatePublication = await operatorPage.request.post(
        responsePath,
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { offersMorning: false, offersAfternoon: true },
        },
      )
      expect(duplicatePublication.status()).toBe(200)
      expect(
        (await duplicatePublication.json()) as PublishedResponse,
      ).toMatchObject({
        published: false,
        response: {
          id: firstPublished.response.id,
          publicationEventId: firstPublished.response.publicationEventId,
          offersMorning: true,
          offersAfternoon: false,
          publicationVersion: 1,
        },
      })

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const withdrawn = await operatorPage.request.delete(responsePath, {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        })
        expect(withdrawn.status()).toBe(200)
        expect((await withdrawn.json()) as { status: string }).toMatchObject({
          status: 'WITHDRAWN',
        })
      }
      const hiddenResponses = await publicPage.request.get(
        `/api/v1/demands/${sharedDemandId}/responses`,
      )
      expect(hiddenResponses.status()).toBe(200)
      expect(
        (await hiddenResponses.json()) as { totalElements: number },
      ).toMatchObject({ totalElements: 0 })

      const republished = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: true },
      })
      expect(republished.status()).toBe(200)
      const secondPublished = (await republished.json()) as PublishedResponse
      expect(secondPublished).toMatchObject({
        published: true,
        response: {
          id: firstPublished.response.id,
          offersMorning: true,
          offersAfternoon: true,
          publicationVersion: 2,
        },
      })
      expect(secondPublished.response.publicationEventId).not.toBe(
        firstPublished.response.publicationEventId,
      )

      const firstCsrf = await csrf(parentPage)
      const secondCsrf = await csrf(secondParentPage)
      const firstOpened = await parentPage.request.post(
        `/api/v1/demands/${sharedDemandId}/feedback/open`,
        { headers: { [firstCsrf.headerName]: firstCsrf.token } },
      )
      const secondOpened = await secondParentPage.request.post(
        `/api/v1/demands/${sharedDemandId}/feedback/open`,
        { headers: { [secondCsrf.headerName]: secondCsrf.token } },
      )
      expect(firstOpened.status()).toBe(200)
      expect(secondOpened.status()).toBe(200)
      const firstFeedback = (
        (await firstOpened.json()) as FeedbackList
      ).feedback.find(({ canEvaluate }) => canEvaluate)!
      const secondFeedback = (
        (await secondOpened.json()) as FeedbackList
      ).feedback.find(({ canEvaluate }) => canEvaluate)!
      expect(firstFeedback).toBeDefined()
      expect(secondFeedback).toBeDefined()
      expect(firstFeedback.publicationEventId).toBe(
        secondPublished.response.publicationEventId,
      )
      expect(secondFeedback.publicationEventId).toBe(
        secondPublished.response.publicationEventId,
      )

      const firstSatisfied = await parentPage.request.put(
        `/api/v1/demands/${sharedDemandId}/feedback/${firstFeedback.publicationEventId}`,
        {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: { satisfied: true },
        },
      )
      expect(firstSatisfied.status()).toBe(200)
      expect(await demand(parentPage, sharedDemandId)).toMatchObject({
        status: 'OPEN',
        supporterCount: 1,
      })

      const secondSatisfied = await secondParentPage.request.put(
        `/api/v1/demands/${sharedDemandId}/feedback/${secondFeedback.publicationEventId}`,
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: { satisfied: true },
        },
      )
      expect(secondSatisfied.status()).toBe(200)
      expect(await demand(publicPage, sharedDemandId)).toMatchObject({
        status: 'CLOSED',
        closureReason: 'FULFILLED',
        supporterCount: 0,
      })
    })

    await test.step('publish a demand service and resolve parent feedback against the real API', async () => {
      await parentPage.goto(parentDemandPath)
      await expect(parentPage.getByText(/Seçiminiz korundu/)).toBeVisible()
      await parentPage
        .getByRole('button', { name: 'Mevcut servisleri kontrol et' })
        .click()
      await expect(
        parentPage.getByRole('heading', { name: '1 mevcut servis bulundu' }),
      ).toBeVisible()
      await parentPage
        .getByRole('button', { name: 'Yine de servise ihtiyacım var' })
        .click()
      await parentPage.getByLabel('Uygun servis bulamıyorum').check()
      const created = parentPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/demands'),
      )
      await parentPage
        .getByRole('button', { name: 'Talebi ve desteğimi oluştur' })
        .click()
      expect((await created).status()).toBe(201)
      await expect(
        parentPage.getByText('Talebiniz oluşturuldu ve desteğiniz eklendi.'),
      ).toBeVisible()
      const demandId = new URL(parentPage.url()).pathname.split('/').at(-1)!
      const responsePath = `/api/v1/operator/demands/${demandId}/response`
      const operatorCsrf = await csrf(operatorPage)
      const published = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: false },
      })
      expect(published.status()).toBe(200)
      expect((await published.json()) as { published: boolean }).toMatchObject({
        published: true,
      })

      await parentPage.goto(`/demands/${demandId}`)
      await parentPage
        .getByRole('button', { name: 'Bildir', exact: true })
        .click()
      await expect(
        parentPage.getByText(/içeriği otomatik olarak gizlemez/),
      ).toBeVisible()
      await parentPage
        .getByLabel('Bildirim nedeni')
        .selectOption('MISLEADING_SERVICE')
      await parentPage
        .getByLabel('Açıklama (isteğe bağlı)')
        .fill('Gerçek tam yığın yönetim incelemesi.')
      await parentPage.getByRole('button', { name: 'Bildirimi gönder' }).click()
      await expect(parentPage.getByText('Bildirim alındı')).toBeVisible()
      await expect(
        parentPage
          .getByRole('region', { name: 'İşletmeci servis bildirimleri' })
          .getByText('J03 Gerçek Servis'),
      ).toBeVisible()

      await parentPage.getByRole('button', { name: 'Karşılanmadı' }).click()
      await expect(
        parentPage.getByText(
          'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.',
        ),
      ).toBeVisible()
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ]) {
        await parentPage.setViewportSize(viewport)
        await parentPage.reload()
        await expect(
          parentPage.getByText(
            'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.',
          ),
        ).toBeVisible()
        expect(
          await parentPage.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(
          await parentPage.evaluate(() => document.documentElement.clientWidth),
        )
      }

      await adminPage.goto('/admin/moderation')
      await expect(
        adminPage.getByRole('heading', { name: 'İçerik bildirimleri' }),
      ).toBeVisible()
      await adminPage
        .getByRole('button', { name: /J03 Gerçek Servis service declaration/ })
        .click()
      await adminPage
        .getByLabel('Yönetici gerekçesi')
        .fill('Yanıltıcı hizmet bildirimi yönetici incelemesi.')
      await adminPage
        .getByRole('button', { name: 'Servis bildirimini geri çek' })
        .click()
      await expect(
        adminPage.getByText('Servis bildirimini geri çek işlemi kaydedildi.'),
      ).toBeVisible()

      await parentPage.reload()
      await expect(
        parentPage.getByRole('heading', { name: 'Henüz servis bildirimi yok' }),
      ).toBeVisible()
      const republished = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: false },
      })
      expect(republished.status()).toBe(200)
      await parentPage.reload()
      const satisfy = parentPage.getByRole('button', {
        name: 'Talebim karşılandı',
      })
      await satisfy.focus()
      await expect(satisfy).toBeFocused()
      await parentPage.keyboard.press('Enter')
      await expect(parentPage.getByText('Katılıma kapalı')).toBeVisible()
      const closed = await parentPage.request.get(`/api/v1/demands/${demandId}`)
      expect((await closed.json()) as { closureReason: string }).toMatchObject({
        closureReason: 'FULFILLED',
      })
    })

    await test.step('run reminder and opened/unopened expiry through the real idempotent scheduler', async () => {
      const operatorCsrf = await csrf(operatorPage)
      const firstCsrf = await csrf(parentPage)
      const secondCsrf = await csrf(secondParentPage)
      const coverage = await operatorPage.request.put(
        `/api/v1/operator/schools/${operatorSchoolId}/coverage`,
        {
          headers: { [operatorCsrf.headerName]: operatorCsrf.token },
          data: { neighborhoodIds: [340101, 340201, 340202, 340203] },
        },
      )
      expect(coverage.status()).toBe(200)

      const support = {
        needsMorning: true,
        needsAfternoon: false,
        reasons: ['SCHEDULE_UNSUITABLE'],
      }
      const openedCreationResponse = await parentPage.request.post(
        '/api/v1/demands',
        {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: {
            schoolId: '10000000-0000-4000-8000-000000000001',
            neighborhoodId: 340202,
            ...support,
          },
        },
      )
      const unopenedCreationResponse = await secondParentPage.request.post(
        '/api/v1/demands',
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: {
            schoolId: '10000000-0000-4000-8000-000000000001',
            neighborhoodId: 340203,
            ...support,
          },
        },
      )
      expect(openedCreationResponse.status()).toBe(201)
      expect(unopenedCreationResponse.status()).toBe(201)
      const openedCreation =
        (await openedCreationResponse.json()) as DemandCreation
      const unopenedCreation =
        (await unopenedCreationResponse.json()) as DemandCreation
      const openedDemandId = openedCreation.demand.id
      const unopenedDemandId = unopenedCreation.demand.id
      const stableSupportId = openedCreation.demand.currentUserSupport!.id

      for (const demandId of [openedDemandId, unopenedDemandId]) {
        const published = await operatorPage.request.post(
          `/api/v1/operator/demands/${demandId}/response`,
          {
            headers: { [operatorCsrf.headerName]: operatorCsrf.token },
            data: { offersMorning: true, offersAfternoon: false },
          },
        )
        expect(published.status()).toBe(200)
        expect((await published.json()) as PublishedResponse).toMatchObject({
          published: true,
          response: { publicationVersion: 1 },
        })
      }

      const openedFeedbackResponse = await parentPage.request.post(
        `/api/v1/demands/${openedDemandId}/feedback/open`,
        { headers: { [firstCsrf.headerName]: firstCsrf.token } },
      )
      expect(openedFeedbackResponse.status()).toBe(200)

      await expect
        .poll(
          async () => {
            const notifications = (await (
              await parentPage.request.get('/api/v1/notifications?size=50')
            ).json()) as NotificationPage
            return notifications.content
              .filter(
                ({ demandId, type }) =>
                  demandId === openedDemandId &&
                  (type === 'FEEDBACK_REMINDER' || type === 'SUPPORT_EXPIRED'),
              )
              .map(({ type }) => type)
          },
          {
            message: 'opened feedback should receive one reminder then expire',
            timeout: 20_000,
          },
        )
        .toEqual(
          expect.arrayContaining(['FEEDBACK_REMINDER', 'SUPPORT_EXPIRED']),
        )

      await expect
        .poll(
          async () => {
            const notifications = (await (
              await secondParentPage.request.get(
                '/api/v1/notifications?size=50',
              )
            ).json()) as NotificationPage
            return notifications.content
              .filter(
                ({ demandId, type }) =>
                  demandId === unopenedDemandId &&
                  (type === 'FEEDBACK_REMINDER' || type === 'SUPPORT_EXPIRED'),
              )
              .map(({ type }) => type)
          },
          {
            message: 'unopened feedback should expire without a reminder',
            timeout: 20_000,
          },
        )
        .toEqual(['SUPPORT_EXPIRED'])

      expect(await demand(publicPage, openedDemandId)).toMatchObject({
        status: 'CLOSED',
        closureReason: 'INACTIVE',
        supporterCount: 0,
      })
      expect(await demand(publicPage, unopenedDemandId)).toMatchObject({
        status: 'CLOSED',
        closureReason: 'INACTIVE',
        supporterCount: 0,
      })

      const reopenedResponse = await parentPage.request.post(
        `/api/v1/demands/${openedDemandId}/support`,
        {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: support,
        },
      )
      expect(reopenedResponse.status()).toBe(200)
      expect((await reopenedResponse.json()) as DemandState).toMatchObject({
        status: 'OPEN',
        supporterCount: 1,
        currentUserSupport: {
          id: stableSupportId,
          status: 'ACTIVE',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 1_500))
      const openedNotifications = (await (
        await parentPage.request.get('/api/v1/notifications?size=50')
      ).json()) as NotificationPage
      expect(
        openedNotifications.content.filter(
          ({ demandId, type }) =>
            demandId === openedDemandId && type === 'FEEDBACK_REMINDER',
        ),
      ).toHaveLength(1)
      expect(
        openedNotifications.content.filter(
          ({ demandId, type }) =>
            demandId === openedDemandId && type === 'SUPPORT_EXPIRED',
        ),
      ).toHaveLength(1)
    })

    await test.step('cover a mobile keyboard path without sharing authenticated state', async () => {
      // A fresh page avoids retained focus from the preceding real discovery journey.
      // A real browser Tab must focus the skip link; programmatic focus would hide regressions.
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      })
      try {
        const mobilePage = await mobileContext.newPage()
        await mobilePage.goto('/')
        const skipLink = mobilePage.getByRole('link', { name: 'İçeriğe geç' })
        await expect(skipLink).toBeAttached()
        await expect(
          mobilePage.getByRole('heading', { name: 'ServisimiBul' }),
        ).toBeVisible()
        await mobilePage.bringToFront()
        await mobilePage.keyboard.press('Tab')
        await expect(skipLink).toBeFocused()
        expect(
          await mobilePage.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(
          await mobilePage.evaluate(() => document.documentElement.clientWidth),
        )
        await expect(
          mobilePage.getByRole('link', { name: 'Giriş' }),
        ).toBeVisible()
        const accessibility = await new AxeBuilder({ page: mobilePage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        expect(accessibility.violations).toEqual([])
      } finally {
        await mobileContext.close()
      }
    })

    await test.step('suspend the operator, revoke the session, and remove discovery', async () => {
      await adminPage.goto('/admin/applications')
      await adminPage.getByLabel('Başvuru durumu').selectOption('APPROVED')
      await adminPage.getByRole('link', { name: 'Başvuruyu incele' }).click()
      await adminPage
        .getByRole('button', { name: 'İşletmeciyi askıya al' })
        .click()
      await expect(
        adminPage.getByText('İşletmeci askıya alındı.'),
      ).toBeVisible()

      await operatorPage.goto('/operator/profile')
      await expect(operatorPage).toHaveURL(
        /\/operator\/login\?.*reason=session/,
      )
      await search(publicPage, 'Üsküdar', 'Acıbadem')
      await expect(
        publicPage.getByRole('heading', { name: 'Henüz bir eşleşme yok' }),
      ).toBeVisible()
    })
  } finally {
    await Promise.all([
      operatorContext.close(),
      adminContext.close(),
      publicContext.close(),
      parentContext.close(),
      secondParentContext.close(),
      nonSupportingParentContext.close(),
    ])
  }
})

async function login(
  page: Page,
  email: string,
  password: string,
  expectedRole: 'admin' | 'operator' | 'parent',
) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill(password)
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      candidate.url().endsWith('/api/v1/auth/login'),
  )
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  expect((await response).status()).toBe(200)
  await expect(page).toHaveURL(
    expectedRole === 'parent'
      ? /\/demands(?:\/|$)/
      : new RegExp(`/${expectedRole}(?:/|$)`),
  )
}

async function search(page: Page, district: string, neighborhood: string) {
  await page.goto('/')
  await page
    .getByLabel('Okulun bulunduğu il')
    .selectOption({ label: 'İstanbul' })
  await page
    .getByRole('button', { name: 'J03 Gerçek Okulu okulunu seç' })
    .click()
  await selectLoadedOption(page, 'Servis alınacak ilçe', district)
  await selectLoadedOption(page, 'Servis alınacak mahalle', neighborhood)
  await page.getByRole('button', { name: 'Servis işletmecilerini bul' }).click()
}

async function selectLoadedOption(
  page: Page,
  fieldLabel: string,
  optionLabel: string,
) {
  const field = page.getByLabel(fieldLabel)
  const retry = page.getByRole('button', { name: 'Tekrar dene' })
  await expect
    .poll(
      async () => {
        if (await retry.isVisible()) await retry.click()
        return field.locator('option').allTextContents()
      },
      {
        message: `${fieldLabel} should load ${optionLabel}`,
        timeout: 15_000,
      },
    )
    .toContain(optionLabel)
  await field.selectOption({ label: optionLabel })
}

async function csrf(
  page: Page,
): Promise<{ headerName: string; token: string }> {
  const response = await page.request.get('/api/v1/auth/csrf')
  expect(response.ok()).toBe(true)
  return (await response.json()) as { headerName: string; token: string }
}

async function demand(page: Page, id: string): Promise<DemandState> {
  const response = await page.request.get(`/api/v1/demands/${id}`)
  expect(response.status()).toBe(200)
  return (await response.json()) as DemandState
}
