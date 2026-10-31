import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

const operatorEmail = 'j03.operator@example.test'
const operatorPassword = 'J03-operator-password'
const secondOperatorEmail = 'j03.operator.two@example.test'
const secondOperatorPassword = 'J03-second-operator-password'
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

interface PublicResponsePage {
  content: Array<{
    id: string
    publicationEventId: string
    operatorId: string
    businessName: string
  }>
  totalElements: number
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
    publicationEventId: string | null
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
  const secondOperatorContext = await browser.newContext()
  const operatorPage = await operatorContext.newPage()
  const adminPage = await adminContext.newPage()
  const publicPage = await publicContext.newPage()
  const parentPage = await parentContext.newPage()
  const secondParentPage = await secondParentContext.newPage()
  const nonSupportingParentPage = await nonSupportingParentContext.newPage()
  const secondOperatorPage = await secondOperatorContext.newPage()

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
      await operatorPage
        .getByRole('button', { name: 'İşletmeci hesabı oluştur' })
        .click()
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
      await parentPage
        .getByRole('textbox', { name: 'Şifre', exact: true })
        .fill(parentPassword!)
      const registration = parentPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/auth/parent/register'),
      )
      await parentPage
        .getByRole('button', { name: 'Veli hesabı oluştur' })
        .click()
      expect((await registration).status()).toBe(202)
      await expect(parentPage).toHaveURL(/\/parent\/login\?.*registered=parent/)
      await expect(
        parentPage.getByText(/Devam etmek için veli hesabınızla giriş yapın/),
      ).toBeVisible()

      await parentPage.getByLabel('E-posta').fill(parentEmail)
      await parentPage
        .getByRole('textbox', { name: 'Şifre', exact: true })
        .fill(parentPassword!)
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

    let secondOperatorProfileId = ''
    await test.step('prepare a second eligible operator without a vehicle or offering', async () => {
      const registrationCsrf = await csrf(secondOperatorPage)
      const registration = await secondOperatorPage.request.post(
        '/api/v1/auth/register',
        {
          headers: {
            [registrationCsrf.headerName]: registrationCsrf.token,
          },
          data: {
            email: secondOperatorEmail,
            password: secondOperatorPassword,
            businessName: 'J03 İkinci Servis',
            contactPhone: '+905321112255',
          },
        },
      )
      expect(registration.status()).toBe(202)
      await login(
        secondOperatorPage,
        secondOperatorEmail,
        secondOperatorPassword,
        'operator',
      )

      const secondCsrf = await csrf(secondOperatorPage)
      const profile = await secondOperatorPage.request.get(
        '/api/v1/operator/profile',
      )
      expect(profile.status()).toBe(200)
      secondOperatorProfileId = ((await profile.json()) as { id: string }).id
      const submitted = await secondOperatorPage.request.post(
        '/api/v1/operator/application/submit',
        { headers: { [secondCsrf.headerName]: secondCsrf.token } },
      )
      expect(submitted.status()).toBe(200)

      const adminCsrf = await csrf(adminPage)
      const approved = await adminPage.request.post(
        `/api/v1/admin/operators/${secondOperatorProfileId}/approve`,
        { headers: { [adminCsrf.headerName]: adminCsrf.token } },
      )
      expect(approved.status()).toBe(200)

      const school = await secondOperatorPage.request.post(
        '/api/v1/operator/schools',
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: { schoolId: '10000000-0000-4000-8000-000000000001' },
        },
      )
      expect(school.status()).toBe(201)
      const secondOperatorSchoolId = ((await school.json()) as { id: string })
        .id
      const coverage = await secondOperatorPage.request.put(
        `/api/v1/operator/schools/${secondOperatorSchoolId}/coverage`,
        {
          headers: { [secondCsrf.headerName]: secondCsrf.token },
          data: { neighborhoodIds: [340101] },
        },
      )
      expect(coverage.status()).toBe(200)

      for (const path of [
        '/api/v1/operator/vehicles',
        '/api/v1/operator/offerings',
      ]) {
        const resources = await secondOperatorPage.request.get(path)
        expect(resources.status()).toBe(200)
        expect(await resources.json()).toEqual([])
      }
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
        publicPage.getByRole('link', {
          name: 'Telefonla ara: +905321112244',
        }),
      ).toBeVisible()
      await expect(
        publicPage.getByText('Servis ayrıntısı yayımlanmamış'),
      ).toBeVisible()
      await expect(publicPage.getByText(operatorEmail)).toHaveCount(0)
      await expect(
        publicPage.getByText(
          'Mesafe kademelerine göre azami tutarları inceleyin. Kesin ücret ve hizmet koşulları için işletmeciyle görüşün.',
        ),
      ).toBeVisible()
      await expect(publicPage.getByText('₺12.000,00')).toBeVisible()
      await expect(publicPage.getByText('Her km için +₺87,99')).toBeVisible()
      await publicPage.getByRole('button', { name: 'Yıllık' }).click()
      await expect(publicPage.getByText('₺108.000,00')).toBeVisible()
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
          name: 'Resmî belgeyi aç (yeni sekmede)',
        }),
      ).toBeVisible()
      await expect(
        publicPage.getByText('J03 güncel sentetik UKOME kararı'),
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

      await assertAccessibleWorkflow(
        parentPage,
        `/demands/${sharedDemandId}`,
        { width: 390, height: 844 },
        parentPage.getByRole('button', { name: 'Desteğimi düzenle' }),
      )
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
      const demandReport = (await demandReportResponse.json()) as ReportReceipt

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

      const parentModerationDenied = await parentPage.request.post(
        `/api/v1/admin/moderation/cases/${demandReport.caseId}/actions`,
        {
          headers: { [firstCsrf.headerName]: firstCsrf.token },
          data: {
            action: 'RESOLVE_NO_ACTION',
            reason: 'Yetkisiz işlem doğrulaması.',
          },
        },
      )
      expect(parentModerationDenied.status()).toBe(403)

      const resolvedWithoutAction = await adminPage.request.post(
        `/api/v1/admin/moderation/cases/${demandReport.caseId}/actions`,
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: {
            action: 'RESOLVE_NO_ACTION',
            reason: 'İçerik kurallara uygun bulundu.',
          },
        },
      )
      expect(resolvedWithoutAction.status()).toBe(200)
      expect(await resolvedWithoutAction.json()).toMatchObject({
        summary: { status: 'RESOLVED' },
        audit: [{ action: 'RESOLVE_NO_ACTION' }],
      })
      expect(await demand(publicPage, sharedDemandId)).toMatchObject({
        status: 'OPEN',
        supporterCount: 2,
      })

      const duplicateResolution = await adminPage.request.post(
        `/api/v1/admin/moderation/cases/${demandReport.caseId}/actions`,
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: {
            action: 'RESOLVE_NO_ACTION',
            reason: 'Tekrarlanan işlem engellenmeli.',
          },
        },
      )
      expect(duplicateResolution.status()).toBe(409)

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

      await assertAccessibleWorkflow(
        adminPage,
        '/admin/moderation',
        { width: 1440, height: 900 },
        adminPage.getByRole('button', { name: 'Filtrele' }),
      )
    })

    await test.step('keep two operator publications independent and close only after every active parent is satisfied', async () => {
      const responsePath = `/api/v1/operator/demands/${sharedDemandId}/response`
      const operatorCsrf = await csrf(operatorPage)
      const secondOperatorCsrf = await csrf(secondOperatorPage)

      await assertAccessibleWorkflow(
        operatorPage,
        `/demands/${sharedDemandId}`,
        { width: 768, height: 1024 },
        operatorPage.getByRole('button', {
          name: 'Bu talep için servis ekle',
        }),
      )
      await operatorPage
        .getByRole('button', { name: 'Bu talep için servis ekle' })
        .click()
      await operatorPage.getByLabel('Sabah').uncheck()
      await operatorPage
        .getByRole('button', { name: 'Servis bildirimini yayınla' })
        .click()
      await expect(
        operatorPage.getByRole('alert').filter({
          hasText: 'En az bir servis yönü seçin.',
        }),
      ).toBeVisible()

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

      const secondPublication = await secondOperatorPage.request.post(
        responsePath,
        {
          headers: {
            [secondOperatorCsrf.headerName]: secondOperatorCsrf.token,
          },
          data: { offersMorning: false, offersAfternoon: true },
        },
      )
      expect(secondPublication.status()).toBe(200)
      const otherPublished =
        (await secondPublication.json()) as PublishedResponse
      expect(otherPublished).toMatchObject({
        published: true,
        response: {
          status: 'ACTIVE',
          offersMorning: false,
          offersAfternoon: true,
          publicationVersion: 1,
        },
      })
      expect(otherPublished.response.id).not.toBe(firstPublished.response.id)
      expect(await demand(publicPage, sharedDemandId)).toMatchObject({
        status: 'OPEN',
        supporterCount: 2,
      })

      const bothResponses = (await (
        await publicPage.request.get(
          `/api/v1/demands/${sharedDemandId}/responses?size=10`,
        )
      ).json()) as PublicResponsePage
      expect(bothResponses.totalElements).toBe(2)
      expect(bothResponses.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: firstPublished.response.id,
            businessName: 'J03 Gerçek Servis',
          }),
          expect.objectContaining({
            id: otherPublished.response.id,
            operatorId: secondOperatorProfileId,
            businessName: 'J03 İkinci Servis',
          }),
        ]),
      )

      for (const [page, expectedEventId, unexpectedEventId] of [
        [
          parentPage,
          firstPublished.response.publicationEventId,
          otherPublished.response.publicationEventId,
        ],
        [
          secondParentPage,
          otherPublished.response.publicationEventId,
          firstPublished.response.publicationEventId,
        ],
      ] as const) {
        const feedback = (await (
          await page.request.get(`/api/v1/demands/${sharedDemandId}/feedback`)
        ).json()) as FeedbackList
        const feedbackEvents = feedback.feedback.map(
          ({ publicationEventId }) => publicationEventId,
        )
        expect(feedbackEvents).toContain(expectedEventId)
        expect(feedbackEvents).not.toContain(unexpectedEventId)
        const notifications = (await (
          await page.request.get('/api/v1/notifications?size=50')
        ).json()) as NotificationPage
        const notificationEvents = notifications.content
          .filter(
            ({ demandId, type }) =>
              demandId === sharedDemandId && type === 'SERVICE_PUBLISHED',
          )
          .map(({ publicationEventId }) => publicationEventId)
        expect(notificationEvents).toContain(expectedEventId)
        expect(notificationEvents).not.toContain(unexpectedEventId)
      }

      await assertAccessibleWorkflow(
        parentPage,
        '/notifications',
        { width: 320, height: 844 },
        parentPage.getByRole('button', { name: /Ayrıntıyı aç/ }).first(),
      )

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
        (await hiddenResponses.json()) as PublicResponsePage,
      ).toMatchObject({
        totalElements: 1,
        content: [
          expect.objectContaining({
            id: otherPublished.response.id,
            businessName: 'J03 İkinci Servis',
          }),
        ],
      })
      expect(await demand(publicPage, sharedDemandId)).toMatchObject({
        status: 'OPEN',
        supporterCount: 2,
      })

      const republished = await operatorPage.request.post(responsePath, {
        headers: { [operatorCsrf.headerName]: operatorCsrf.token },
        data: { offersMorning: true, offersAfternoon: true },
      })
      expect(republished.status()).toBe(200)
      const republishedFirst = (await republished.json()) as PublishedResponse
      expect(republishedFirst).toMatchObject({
        published: true,
        response: {
          id: firstPublished.response.id,
          offersMorning: true,
          offersAfternoon: true,
          publicationVersion: 2,
        },
      })
      expect(republishedFirst.response.publicationEventId).not.toBe(
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
      ).feedback.find(
        ({ publicationEventId, canEvaluate }) =>
          canEvaluate &&
          publicationEventId === republishedFirst.response.publicationEventId,
      )!
      const secondFeedback = (
        (await secondOpened.json()) as FeedbackList
      ).feedback.find(
        ({ publicationEventId, canEvaluate }) =>
          canEvaluate &&
          publicationEventId === republishedFirst.response.publicationEventId,
      )!
      expect(firstFeedback).toBeDefined()
      expect(secondFeedback).toBeDefined()
      expect(firstFeedback.publicationEventId).toBe(
        republishedFirst.response.publicationEventId,
      )
      expect(secondFeedback.publicationEventId).toBe(
        republishedFirst.response.publicationEventId,
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
      await expect(parentPage.getByText('Talebiniz oluşturuldu.')).toBeVisible()
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
        parentPage.getByText(/İçerik hemen kaldırılmaz/),
      ).toBeVisible()
      await parentPage
        .getByLabel('Bildirim nedeni')
        .selectOption('MISLEADING_SERVICE')
      await parentPage
        .getByLabel('Açıklama (isteğe bağlı)')
        .fill('Gerçek tam yığın yönetim incelemesi.')
      const reportCreated = parentPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/v1/reports'),
      )
      await parentPage.getByRole('button', { name: 'Bildirimi gönder' }).click()
      const serviceReport = (await (
        await reportCreated
      ).json()) as ReportReceipt
      await expect(parentPage.getByText('Bildirim alındı')).toBeVisible()
      await expect(
        parentPage
          .getByRole('region', { name: 'İşletmecilerin servis duyuruları' })
          .getByText('J03 Gerçek Servis'),
      ).toBeVisible()

      await parentPage.getByRole('button', { name: 'Karşılanmadı' }).click()
      await expect(
        parentPage.getByText(
          'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.',
        ),
      ).toBeVisible()
      for (const viewport of [
        { width: 320, height: 844 },
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

      const adminCsrf = await csrf(adminPage)
      const duplicateWithdrawal = await adminPage.request.post(
        `/api/v1/admin/moderation/cases/${serviceReport.caseId}/actions`,
        {
          headers: { [adminCsrf.headerName]: adminCsrf.token },
          data: {
            action: 'WITHDRAW_SERVICE_RESPONSE',
            reason: 'Tekrarlanan işlem engellenmeli.',
          },
        },
      )
      expect(duplicateWithdrawal.status()).toBe(409)

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
          mobilePage.getByRole('heading', {
            name: 'Okul servisini birlikte bulalım.',
          }),
        ).toBeVisible()
        await mobilePage.bringToFront()
        await mobilePage.keyboard.press('Tab')
        await expect(skipLink).toBeFocused()
        expect(
          await mobilePage.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(
          await mobilePage.evaluate(() => document.documentElement.clientWidth),
        )
        await mobilePage.keyboard.press('Tab')
        await mobilePage.keyboard.press('Tab')
        const menu = mobilePage.getByRole('button', { name: 'Menü' })
        await expect(menu).toBeFocused()
        await mobilePage.keyboard.press('Enter')
        await expect(
          mobilePage.getByRole('link', { name: 'Veli girişi' }),
        ).toBeVisible()
        await expect(mobilePage.locator('#public-navigation')).toHaveCSS(
          'opacity',
          '1',
        )
        const accessibility = await new AxeBuilder({ page: mobilePage })
          .include('#public-navigation')
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
      await adminPage
        .locator(`a[href="/admin/applications/${operatorProfileId}"]`)
        .click()
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

    await test.step('persist and securely end the parent session', async () => {
      await parentPage.goto('/demands')
      await parentPage.reload()
      await expect(parentPage.getByText('Veli oturumu açık')).toBeVisible()
      expect((await parentPage.request.get('/api/v1/auth/me')).status()).toBe(
        200,
      )

      await parentPage.getByRole('button', { name: 'Çıkış yap' }).click()
      await expect(parentPage).toHaveURL(/\/parent\/login$/)
      expect((await parentPage.request.get('/api/v1/auth/me')).status()).toBe(
        401,
      )
      await parentPage.goto('/notifications')
      await expect(parentPage).toHaveURL(
        /\/parent\/login\?.*next=%2Fnotifications/,
      )
    })
  } finally {
    await Promise.all([
      operatorContext.close(),
      adminContext.close(),
      publicContext.close(),
      parentContext.close(),
      secondParentContext.close(),
      nonSupportingParentContext.close(),
      secondOperatorContext.close(),
    ])
  }
})

async function login(
  page: Page,
  email: string,
  password: string,
  expectedRole: 'admin' | 'operator' | 'parent',
) {
  await page.goto(
    expectedRole === 'parent' ? '/parent/login' : '/operator/login',
  )
  await page.getByLabel('E-posta').fill(email)
  await page.getByRole('textbox', { name: 'Şifre', exact: true }).fill(password)
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
    .getByRole('button', { name: 'Bu okulu seç: J03 Gerçek Okulu' })
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

async function assertAccessibleWorkflow(
  page: Page,
  path: string,
  viewport: { width: number; height: number },
  action: Locator,
) {
  await page.setViewportSize(viewport)
  await page.goto(path)
  await expect(action).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  )

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
  })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'İçeriğe geç' })).toBeFocused()

  const target = await action.boundingBox()
  expect(target).not.toBeNull()
  expect(target!.width).toBeGreaterThanOrEqual(44)
  expect(target!.height).toBeGreaterThanOrEqual(44)

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
}
