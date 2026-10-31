import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  createMockApiState,
  demandId,
  installMockApi,
} from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 844 },
] as const

for (const viewport of viewports) {
  test(`D02 demand detail remains accessible on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const state = createDetailState()
    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await page.goto(`/demands/${demandId}`)

    await expect(
      page.getByRole('heading', { name: 'Örnek Okulu' }),
    ).toBeVisible()
    await expect(page.getByText('Moda Öğrenci Servisi')).toBeVisible()
    await expect(
      page.getByText('Sabah yönü için servis bilgisi arıyoruz.'),
    ).toBeVisible()
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

    if (viewport.name === 'desktop' || viewport.name === 'mobile') {
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`d02-${viewport.name}.png`),
      })
    }
  })
}

test('D02 report dialog keeps keyboard focus contained and restores it on Escape', async ({
  page,
}, testInfo) => {
  const state = createDetailState()
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, state)
  await loginAsParent(page)
  await page.goto(`/demands/${demandId}`)

  const trigger = page.getByRole('button', { name: 'Talebi bildir' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'İçeriği bildir' })
  await expect(dialog).toBeVisible()
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true)
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('d02-report-dialog.png'),
  })

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('D02 explains an inactive closure and preserves parent reactivation', async ({
  page,
}, testInfo) => {
  const state = createDetailState()
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, state)
  await loginAsParent(page)
  await page.route(`**/api/v1/demands/${demandId}`, async (route) => {
    await route.fulfill({ json: closedInactiveDemand() })
  })
  await page.goto(`/demands/${demandId}`)

  await expect(page.getByText('Katılıma kapalı')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Desteğimi yeniden etkinleştir' }),
  ).toBeVisible()
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('d02-inactive-reactivation.png'),
  })

  await page
    .getByRole('button', { name: 'Desteğimi yeniden etkinleştir' })
    .click()
  await page
    .getByRole('button', { name: 'Desteğimi yeniden etkinleştir' })
    .click()
  await expect(
    page.getByText('Desteğiniz yeniden etkinleştirildi.'),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Katılıma açık' }),
  ).toBeVisible()
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('d02-reopened.png'),
  })
})

for (const feedbackStatus of [
  'AWAITING_FEEDBACK',
  'SATISFIED',
  'NOT_SATISFIED',
] as const) {
  test(`D02 renders ${feedbackStatus} feedback from the backend`, async ({
    page,
  }, testInfo) => {
    const state = createDetailState()
    await page.setViewportSize({ width: 1440, height: 900 })
    await installMockApi(page, state)
    await loginAsParent(page)
    await page.route(`**/api/v1/demands/${demandId}`, async (route) => {
      await route.fulfill({ json: demandForFeedback(feedbackStatus) })
    })
    await page.route(
      `**/api/v1/demands/${demandId}/feedback/open`,
      async (route) => {
        await route.fulfill({ json: feedbackResponse(feedbackStatus) })
      },
    )
    await page.goto(`/demands/${demandId}`)

    await expect(
      page.getByRole('heading', { name: 'Servis ihtiyacınız karşılandı mı?' }),
    ).toBeVisible()
    await expect(
      page.getByText(feedbackStateCopy(feedbackStatus)),
    ).toBeVisible()
    if (feedbackStatus === 'AWAITING_FEEDBACK') {
      await expect(
        page.getByRole('button', { name: 'Desteğimi geri çek' }),
      ).toBeVisible()
    }
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(
        `d02-feedback-${feedbackStatus.toLowerCase().replaceAll('_', '-')}.png`,
      ),
    })
  })
}

test('D02 keeps a clear retry path when demand loading fails', async ({
  page,
}, testInfo) => {
  const state = createDetailState()
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, state)
  await page.route(`**/api/v1/demands/${demandId}`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Service unavailable',
        status: 503,
        detail: 'Service unavailable',
      }),
    })
  })
  await page.goto(`/demands/${demandId}`)

  await expect(page.getByRole('alert')).toContainText(
    'Talep ayrıntıları yüklenemedi',
  )
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('d02-load-error.png'),
  })
})

async function loginAsParent(page: Page) {
  await page.goto('/parent/login')
  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL('/demands')
}

function createDetailState() {
  const state = createMockApiState()
  state.demandCreated = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Moda Öğrenci Servisi'
  state.operatorSchoolAdded = true
  state.generalCoverage = [201]
  state.serviceResponse = {
    id: '2dcf008e-c803-40fe-9f20-59ef8cf50fc4',
    status: 'ACTIVE',
    offersMorning: true,
    offersAfternoon: true,
    publicationVersion: 2,
    publicationEventId: 'a3022096-ab72-4311-8464-a7ed1272cffe',
    publishedAt: '2026-10-27T09:30:00Z',
    withdrawnAt: null,
  }
  state.demandComments = [
    {
      id: '36e19b9f-b04c-4aaa-85c7-6829c10269bd',
      body: 'Sabah yönü için servis bilgisi arıyoruz.',
      author: {
        role: 'PARENT',
        displayName: 'Veli',
        operatorProfileId: null,
      },
      canDelete: false,
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
    },
  ]
  return state
}

function closedInactiveDemand() {
  return {
    id: demandId,
    status: 'CLOSED',
    closureReason: 'INACTIVE',
    closedAt: '2026-10-30T10:00:00Z',
    academicYear: '2026-2027',
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-30T10:00:00Z',
    school: {
      id: 'f90c36da-1b74-4d48-ae61-95e74b07541f',
      name: 'Örnek Okulu',
    },
    neighborhood: {
      id: 201,
      name: 'Acıbadem',
      districtId: 11,
      districtName: 'Üsküdar',
      provinceId: 34,
      provinceCode: '34',
      provinceName: 'İstanbul',
    },
    supporterCount: 0,
    morningCount: 0,
    afternoonCount: 0,
    reasonCounts: [],
    currentUserSupport: {
      id: 'b6586a84-6094-4ddb-80ea-e36756cf1915',
      status: 'INACTIVE_EXPIRED',
      needsMorning: true,
      needsAfternoon: false,
      reasons: ['NO_SUITABLE_SERVICE'],
    },
  }
}

function demandForFeedback(
  status: 'AWAITING_FEEDBACK' | 'SATISFIED' | 'NOT_SATISFIED',
) {
  const base = closedInactiveDemand()
  const satisfied = status === 'SATISFIED'
  return {
    ...base,
    status: satisfied ? 'CLOSED' : 'OPEN',
    closureReason: satisfied ? 'FULFILLED' : null,
    closedAt: satisfied ? '2026-10-29T09:00:00Z' : null,
    supporterCount: 1,
    morningCount: 1,
    reasonCounts: [{ reason: 'NO_SUITABLE_SERVICE', count: 1 }],
    currentUserSupport: {
      ...base.currentUserSupport,
      status: satisfied
        ? 'SATISFIED'
        : status === 'AWAITING_FEEDBACK'
          ? 'AWAITING_FEEDBACK'
          : 'ACTIVE',
    },
  }
}

function feedbackResponse(
  status: 'AWAITING_FEEDBACK' | 'SATISFIED' | 'NOT_SATISFIED',
) {
  return {
    demandId,
    disclaimer:
      'İşletmeci bildirimleri uygunluk beyanıdır; rezervasyon veya hizmet garantisi değildir.',
    feedback: [
      {
        publicationEventId: 'a3022096-ab72-4311-8464-a7ed1272cffe',
        operatorId: '2778473a-5886-454c-a6d8-a2eaa4f585b1',
        operatorBusinessName: 'Moda Öğrenci Servisi',
        offersMorning: true,
        offersAfternoon: false,
        publishedAt: '2026-10-27T09:30:00Z',
        status,
        openedAt: '2026-10-28T09:00:00Z',
        reminderDueAt: '2026-10-29T09:00:00Z',
        reminderTriggeredAt:
          status === 'AWAITING_FEEDBACK' ? '2026-10-29T09:05:00Z' : null,
        expiresAt: '2026-11-04T09:00:00Z',
        evaluatedAt:
          status === 'AWAITING_FEEDBACK' ? null : '2026-10-29T10:00:00Z',
        canEvaluate: status === 'AWAITING_FEEDBACK',
      },
    ],
  }
}

function feedbackStateCopy(
  status: 'AWAITING_FEEDBACK' | 'SATISFIED' | 'NOT_SATISFIED',
) {
  if (status === 'SATISFIED') {
    return 'Talebinizin karşılandığını bildirdiniz.'
  }
  if (status === 'NOT_SATISFIED') {
    return 'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.'
  }
  return 'Hatırlatma: Yanıt süresi dolmadan seçiminizi yapın.'
}
