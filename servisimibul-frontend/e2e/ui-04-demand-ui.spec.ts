import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  createMockApiState,
  demandId,
  installMockApi,
} from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

for (const viewport of viewports) {
  test(`demand board and detail remain clear on ${viewport.name}`, async ({
    page,
  }) => {
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

    await page.setViewportSize(viewport)
    await installMockApi(page, state)
    await page.goto('/demands')
    await expect(
      page.getByRole('heading', { name: 'Servis talep panosu' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Örnek Okulu' }),
    ).toBeVisible()

    if (process.env.UI04_CAPTURE !== 'before') {
      await expect(page.getByText('Hesapsız inceleme')).toBeVisible()
      await expect(page.getByText('Katılıma açık').first()).toBeVisible()
      await expect(page.getByText(/veli bu ihtiyacı destekliyor/)).toBeVisible()
    }

    await assertAccessibleAndContained(page)
    await capture(page, 'board', viewport.name)

    await page.goto(`/demands/${demandId}`)
    await expect(
      page.getByRole('heading', { name: 'Örnek Okulu' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'İşletmecilerin servis duyuruları' }),
    ).toBeVisible()
    await expect(page.getByText('Moda Öğrenci Servisi')).toBeVisible()

    if (process.env.UI04_CAPTURE !== 'before') {
      await expect(page.getByText('Yayın 2 ·', { exact: false })).toBeVisible()
      await expect(page.getByText(/Veliler takma adla görünür/)).toBeVisible()
      await expect(
        page.getByText('Sabah yönü için servis bilgisi arıyoruz.'),
      ).toBeVisible()
    }

    await assertAccessibleAndContained(page)
    await capture(page, 'detail', viewport.name)
  })
}

async function assertAccessibleAndContained(
  page: import('@playwright/test').Page,
) {
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

async function capture(
  page: import('@playwright/test').Page,
  surface: 'board' | 'detail',
  viewport: (typeof viewports)[number]['name'],
) {
  const stage = process.env.UI04_CAPTURE
  if (
    (stage !== 'before' && stage !== 'after') ||
    (viewport !== 'desktop' && viewport !== 'mobile')
  ) {
    return
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    fullPage: true,
    path: `../docs/screenshots/ui-04/${stage}/${surface}-${viewport}.png`,
  })
}
