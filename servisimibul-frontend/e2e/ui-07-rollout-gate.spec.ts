import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createMockApiState,
  demandId,
  installMockApi,
  mockNotifications,
  type MockApiState,
} from './support/mock-api'

// UI-07 gate: every Manus screen ID at every supported width, with axe and overflow checks.
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 320, height: 800 },
] as const

const capture = process.env.UI_07_CAPTURE === '1'

interface Screen {
  id: string
  path: string
  // The page's own h1, in production copy.
  heading: string
  // A control or landmark only this screen has, when the heading is shared.
  marker?: (page: Page) => Locator
  // Optional interaction that reaches the screen from its route.
  reach?: (page: Page) => Promise<void>
}

const publicScreens: Screen[] = [
  { id: 'P01', path: '/', heading: 'Okul servisini birlikte bulalım.' },
  {
    id: 'P02',
    path: '/',
    heading: 'Okul servisini birlikte bulalım.',
    marker: (page) =>
      page.getByRole('heading', { name: '1 işletmeci bulundu' }),
    reach: async (page) => {
      await chooseSchool(page)
      await page.getByLabel('Servis alınacak ilçe').selectOption('11')
      await page.getByLabel('Servis alınacak mahalle').selectOption('201')
      await page
        .getByRole('button', { name: 'Servis işletmecilerini bul' })
        .click()
      await expect(
        page.getByRole('heading', { name: '1 işletmeci bulundu' }),
      ).toBeVisible()
    },
  },
  {
    id: 'P03',
    path: '/',
    heading: 'Okul servisini birlikte bulalım.',
    marker: (page) =>
      page.getByRole('region', { name: 'Mesafeye göre aylık resmî ücretler' }),
    reach: async (page) => {
      await chooseSchool(page)
      await expect(
        page.getByRole('region', {
          name: 'Mesafeye göre aylık resmî ücretler',
        }),
      ).toBeVisible()
    },
  },
  {
    id: 'D01',
    path: '/demands',
    heading: 'Servis talep panosu',
    marker: (page) =>
      page.getByRole('group', { name: 'Talep durumuna göre filtrele' }),
  },
  {
    id: 'D02',
    path: `/demands/${demandId}`,
    heading: 'Örnek Okulu',
    marker: (page) => page.getByRole('heading', { name: 'Yorumlar' }),
  },
  { id: 'A01', path: '/register', heading: 'Nasıl katılmak istersiniz?' },
  { id: 'A02', path: '/parent/register', heading: 'Veli hesabı oluşturun' },
  { id: 'A03', path: '/parent/login', heading: 'Yeniden hoş geldiniz.' },
  {
    id: 'A04',
    path: '/operator/register',
    heading: 'İşletmenizi tanıtalım.',
  },
  {
    id: 'A05',
    path: '/operator/login',
    heading: 'İşletmeci paneline giriş',
  },
  {
    id: 'A06',
    path: '/operator/verify-email?token=email-token',
    heading: 'E-posta adresinizi doğrulayın',
  },
  { id: 'A07', path: '/forgot-password', heading: 'Şifrenizi yenileyin' },
  {
    id: 'A08',
    path: '/reset-password?token=reset-token',
    heading: 'Yeni şifrenizi belirleyin',
  },
]

const operatorScreens: Screen[] = [
  { id: 'O01', path: '/operator', heading: 'Genel bakış' },
  { id: 'O02', path: '/operator/profile', heading: 'İşletme profilim' },
  {
    id: 'O03',
    path: '/operator/schools',
    heading: 'Okullar ve hizmet kapsamı',
  },
  {
    id: 'O04',
    path: '/operator/offerings',
    heading: 'Araçlar ve servis teklifleri',
  },
  {
    id: 'N02',
    path: '/operator/notifications',
    heading: 'Bildirimler',
    marker: (page) =>
      page.getByRole('group', { name: 'Okunma durumuna göre filtrele' }),
  },
]

const adminScreens: Screen[] = [
  {
    id: 'M01',
    path: '/admin/applications',
    heading: 'İşletmeci başvuruları',
    marker: (page) => page.getByRole('region', { name: 'İşletmeci özeti' }),
  },
  {
    id: 'M02',
    path: '/admin/applications/99dd588e-2b72-419e-aa29-28fb97f8ad20',
    heading: 'Moda Öğrenci Servisi',
  },
  { id: 'M03', path: '/admin/schools', heading: 'Okul kataloğu' },
  { id: 'M04', path: '/admin/tariffs', heading: 'UKOME tarife yönetimi' },
  {
    id: 'M05',
    path: '/admin/moderation',
    heading: 'Raporlama ve moderasyon',
  },
  {
    id: 'N03',
    path: '/admin/notifications',
    heading: 'Yönetim bildirimleri',
    marker: (page) =>
      page.getByRole('group', { name: 'Okunma durumuna göre filtrele' }),
  },
]

const parentScreens: Screen[] = [
  {
    id: 'N01',
    path: '/notifications',
    heading: 'Bildirimler',
    marker: (page) =>
      page.getByRole('group', { name: 'Okunma durumuna göre filtrele' }),
  },
]

const groups = [
  { name: 'public', screens: publicScreens, signIn: undefined },
  { name: 'parent', screens: parentScreens, signIn: signInParent },
  { name: 'operator', screens: operatorScreens, signIn: signInOperator },
  { name: 'admin', screens: adminScreens, signIn: signInAdmin },
] as const

for (const group of groups) {
  for (const viewport of viewports) {
    test(`UI-07 ${group.name} screens are accessible and contained at ${viewport.width}px`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(viewport)
      await installMockApi(page, gateState())
      await routeModeration(page)
      await group.signIn?.(page)

      for (const screen of group.screens) {
        await page.goto(screen.path)
        await screen.reach?.(page)
        await expectScreen(page, screen)
        await expectContained(page, screen.id)
        await expectAxeClean(page, screen.id)

        if (
          capture &&
          (viewport.name === 'desktop' || viewport.name === 'mobile')
        ) {
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            // The site scrolls smoothly, so an animated reset would still be moving.
            window.scrollTo({ top: 0, behavior: 'instant' })
          })
          await page.screenshot({
            fullPage: true,
            path: `../docs/screenshots/ui-07/${screen.id}-${viewport.name}.png`,
          })
        }

        if (viewport.name === 'desktop') {
          // Doubling the root font size approximates 200% text zoom.
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%'
          })
          await expectContained(page, `${screen.id} at 200% text`)
          await page.evaluate(() => {
            document.documentElement.style.fontSize = ''
          })
        }
      }
    })
  }

  test(`UI-07 ${group.name} screens start keyboard navigation at the skip link`, async ({
    page,
  }) => {
    await page.setViewportSize(viewports[0])
    await installMockApi(page, gateState())
    await group.signIn?.(page)

    for (const screen of group.screens.filter((item) => !item.reach)) {
      await page.goto(screen.path)
      await expectScreen(page, screen)
      await page.locator('body').focus()
      await page.keyboard.press('Tab')
      const skipLink = page.getByRole('link', { name: 'İçeriğe geç' })
      await expect(skipLink, `${screen.id} skip link`).toBeFocused()
      const outline = await skipLink.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      )
      expect(outline, `${screen.id} skip link focus ring`).not.toBe('none')
      await page.keyboard.press('Enter')
      // The target is not focusable itself, so the next Tab must land inside it.
      await page.keyboard.press('Tab')
      expect(
        await page.evaluate(() => {
          const active = document.activeElement
          const main = document.querySelector('main')
          return Boolean(main && active && main.contains(active))
        }),
        `${screen.id} skip link moves keyboard focus into main`,
      ).toBe(true)
    }
  })
}

test('UI-07 screen identity check rejects the wrong screen', async ({
  page,
}) => {
  await installMockApi(page, gateState())
  // An unauthenticated visit to O01 lands on the login screen instead.
  const overview = operatorScreens.find((item) => item.id === 'O01')!
  await page.goto(overview.path)
  await expect(expectScreen(page, overview, 1_500)).rejects.toThrow()
  // A missing route renders the not-found screen, never a gate screen.
  await page.goto('/demands-missing')
  await expect(
    expectScreen(
      page,
      publicScreens.find((item) => item.id === 'D01')!,
      1_500,
    ),
  ).rejects.toThrow()
})

test('UI-07 reduced motion removes transitions on every workspace shell', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page, gateState())
  for (const [signIn, path] of [
    [undefined, '/'],
    [signInOperator, '/operator/schools'],
    [signInAdmin, '/admin/moderation'],
  ] as const) {
    await signIn?.(page)
    await page.goto(path)
    await settle(page, path)
    const animated = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => {
          const style = getComputedStyle(element)
          const duration = (value: string) =>
            Math.max(...value.split(',').map((part) => parseFloat(part) || 0))
          return (
            (style.animationName !== 'none' &&
              duration(style.animationDuration) > 0.01) ||
            duration(style.transitionDuration) > 0.01
          )
        })
        .map((element) => element.className.toString().slice(0, 60))
        .slice(0, 10),
    )
    expect(animated, `${path} moving elements under reduced motion`).toEqual([])
  }
})

function gateState(): MockApiState {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName = 'Moda Öğrenci Servisi'
  state.description = 'Kadıköy ve Üsküdar çevresinde okul servisi.'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101, 201]
  state.demandCreated = true
  state.notifications = mockNotifications(6)
  state.vehicles = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      plate: '34 ABC 123',
      capacity: 16,
      active: true,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ]
  state.offerings = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      operatorSchoolId: '75ef6bb0-e313-43fb-a01c-c935774434b4',
      schoolId: '6de54e65-6e04-4168-a1cb-967a98d7ec12',
      schoolName: 'Örnek Okulu',
      vehicleId: '11111111-1111-4111-8111-111111111111',
      vehiclePlate: '34 ABC 123',
      vehicleCapacity: 16,
      availableSeats: 3,
      description: 'Sabah ve akşam servisi',
      published: true,
      coverage: [
        {
          neighborhoodId: 101,
          neighborhoodName: 'Moda',
          districtId: 10,
          districtName: 'Kadıköy',
          provinceId: 34,
          provinceCode: '34',
          provinceName: 'İstanbul',
        },
      ],
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ]
  return state
}

// The shared mock API has no moderation queue, so the gate supplies one case.
async function routeModeration(page: Page) {
  const moderationCase = {
    id: '1b0b4456-5e55-4814-b8f8-64d1343617fd',
    targetType: 'COMMENT',
    targetId: '75c3339d-f6f0-4e8e-aad9-2d783f7f2760',
    status: 'OPEN',
    target: {
      title: 'Örnek Okulu yorumu',
      snapshot: 'Yorumda kişisel telefon numarası paylaşılmış olabilir.',
      currentlyVisible: true,
      operatorProfileId: null,
    },
    reporterCount: 2,
    reasonCounts: { PERSONAL_DATA: 2 },
    createdAt: '2026-10-24T08:00:00Z',
    updatedAt: '2026-10-24T09:00:00Z',
    resolvedAt: null,
  }
  await page.route('**/api/v1/admin/moderation/cases?*', (route) =>
    route.fulfill({
      json: {
        content: [moderationCase],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    }),
  )
}

async function chooseSchool(page: Page) {
  await page.getByLabel('Okulun bulunduğu il').selectOption('34')
  await page.getByRole('button', { name: 'Bu okulu seç: Örnek Okulu' }).click()
}

// Proves the intended screen loaded, not an error, fallback or another route.
async function expectScreen(page: Page, screen: Screen, timeout = 5_000) {
  await expect(
    page.getByRole('heading', { level: 1, name: screen.heading, exact: true }),
    `${screen.id} heading`,
  ).toBeVisible({ timeout })
  if (screen.marker) {
    await expect(screen.marker(page), `${screen.id} marker`).toBeVisible({
      timeout,
    })
  }
  await expect(
    page.getByText(/yüklenemedi|Mock route not found|Sayfa bulunamadı/),
    `${screen.id} shows no load error`,
  ).toHaveCount(0, { timeout })
  await settle(page, screen.id)
}

async function settle(page: Page, id: string) {
  await expect(page.locator('main h1').first(), `${id} heading`).toBeVisible()
  await expect(
    page.locator('main [aria-busy="true"]'),
    `${id} finished loading`,
  ).toHaveCount(0)
}

async function expectContained(page: Page, id: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${id} horizontal overflow`).toBeLessThanOrEqual(1)
}

async function expectAxeClean(page: Page, id: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    })),
    `${id} axe violations`,
  ).toEqual([])
}

async function signInOperator(page: Page) {
  await signIn(page, 'operator@example.com', /\/operator$/)
}

async function signInAdmin(page: Page) {
  await signIn(page, 'admin@example.com', /\/admin\/applications$/)
}

async function signIn(page: Page, email: string, landing: RegExp) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('Password123!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(landing)
}

async function signInParent(page: Page) {
  await page.goto('/parent/login')
  await page.getByLabel('E-posta').fill('parent@example.com')
  await page
    .getByRole('textbox', { name: 'Şifre', exact: true })
    .fill('parent password')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL('/demands')
}
