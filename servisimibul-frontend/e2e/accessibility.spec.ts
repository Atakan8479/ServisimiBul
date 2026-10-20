import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`${viewport.name} routes meet WCAG 2.2 AA and do not overflow`, async ({
    page,
  }) => {
    const state = createMockApiState()
    const consoleProblems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        consoleProblems.push(message.text())
      }
    })
    page.on('pageerror', (error) => consoleProblems.push(error.message))
    state.registered = true
    state.verified = true
    state.approvalStatus = 'APPROVED'
    state.businessName = 'Örnek Servis'
    state.operatorSchoolAdded = true
    state.generalCoverage = [101, 201]

    await page.setViewportSize(viewport)
    await installMockApi(page, state)

    await page.goto('/')
    await audit(page, 'public discovery')

    await page.goto('/operator/register')
    await audit(page, 'registration')

    await page.goto('/operator/login')
    await assertVisibleKeyboardFocus(page)
    await login(page, 'operator@example.com')
    await expect(
      page.getByRole('heading', {
        name: 'Aramalarda görünmeye hazır mısınız?',
      }),
    ).toBeVisible()
    await audit(page, 'operator readiness overview')
    await page.goto('/operator/profile')
    await expect(
      page.getByRole('heading', { name: 'İşletme bilgileriniz' }),
    ).toBeVisible()
    await audit(page, 'operator profile')

    await page.goto('/operator/schools')
    await expect(
      page.getByRole('heading', { name: 'Hizmet ağınız' }),
    ).toBeVisible()
    await audit(page, 'operator schools')

    await page.goto('/operator/offerings')
    await expect(
      page.getByRole('heading', { name: 'Servis ayrıntılarınız' }),
    ).toBeVisible()
    await audit(page, 'operator offerings')

    await login(page, 'admin@example.com')
    await page.goto('/admin/applications')
    await expect(
      page.getByRole('heading', { name: 'Başvurular' }),
    ).toBeVisible()
    await audit(page, 'admin applications')

    await page.getByRole('link', { name: 'Başvuruyu incele' }).click()
    await expect(
      page.getByRole('heading', { name: 'Örnek Servis' }),
    ).toBeVisible()
    await audit(page, 'admin application detail')

    await page.goto('/admin/schools')
    await expect(
      page.getByRole('heading', { name: 'Okulları yönetin' }),
    ).toBeVisible()
    await audit(page, 'admin schools')

    await page.goto('/admin/tariffs')
    await expect(
      page.getByRole('heading', { name: 'Resmî tarifeler' }),
    ).toBeVisible()
    await audit(page, 'admin tariffs')
    expect(consoleProblems).toEqual([])
  })
}

test('route changes restore page context and mobile controls meet the touch target floor', async ({
  page,
}) => {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.operatorSchoolAdded = true
  state.generalCoverage = [101]

  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, state)
  await login(page, 'operator@example.com')

  const overviewHeading = page.getByRole('heading', {
    name: 'Aramalarda görünmeye hazır mısınız?',
  })
  await expect(overviewHeading).toBeFocused()
  await expect(page).toHaveTitle('Genel bakış | ServisimiBul')

  await page.getByRole('link', { name: 'Okullar ve kapsam' }).click()
  const schoolsHeading = page.getByRole('heading', { name: 'Hizmet ağınız' })
  await expect(schoolsHeading).toBeFocused()
  await expect(page).toHaveTitle('Okullar ve kapsam | ServisimiBul')

  await page.getByRole('button', { name: 'Kapsamı düzenle' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Örnek Okulu için hizmet mahalleleri',
    }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Kadıköy' }).click()
  await expect(page.getByRole('checkbox', { name: 'Moda' })).toBeVisible()

  const undersizedControls = await page
    .locator(
      '.workspace-sidebar nav a, button:not([disabled]), summary, label.checkbox-row.compact',
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rectangle = element.getBoundingClientRect()
        if (rectangle.width === 0 || rectangle.height === 0) return []
        return rectangle.width + 0.5 < 44 || rectangle.height + 0.5 < 44
          ? [
              {
                label: element.textContent?.trim(),
                width: rectangle.width,
                height: rectangle.height,
              },
            ]
          : []
      }),
    )
  expect(undersizedControls).toEqual([])

  const districtListStyle = await page
    .locator('.district-groups')
    .evaluate((element) => ({
      maxHeight: getComputedStyle(element).maxHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))
  expect(districtListStyle).toEqual({ maxHeight: 'none', overflowY: 'visible' })
})

test('long Turkish content reflows at a 320px CSS viewport with enlarged text', async ({
  page,
}) => {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  state.businessName =
    'İstanbul Özel Eğitim Kurumları Öğrenci Taşımacılığı Kooperatifi Hizmetleri'

  await page.setViewportSize({ width: 320, height: 720 })
  await installMockApi(page, state)
  await login(page, 'admin@example.com')
  await page.goto('/admin/applications')
  await expect(page.getByText(state.businessName)).toBeVisible()
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = '200%'
  })

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  const overflowingElements = await page
    .locator('body *')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rectangle = element.getBoundingClientRect()
        if (rectangle.left >= -1 && rectangle.right <= window.innerWidth + 1) {
          return []
        }
        return [
          {
            className: element.className,
            tagName: element.tagName,
            text: element.textContent?.trim().slice(0, 80),
            left: rectangle.left,
            right: rectangle.right,
          },
        ]
      }),
    )
  expect(
    overflow,
    JSON.stringify(overflowingElements, null, 2),
  ).toBeLessThanOrEqual(1)
})

test('reduced-motion mode removes decorative and page-transition motion', async ({
  page,
}) => {
  const state = createMockApiState()
  state.registered = true
  state.verified = true
  state.approvalStatus = 'APPROVED'
  await page.addInitScript(() => {
    Element.prototype.scrollIntoView = function (
      options?: ScrollIntoViewOptions,
    ) {
      ;(
        window as Window & { __lastScrollBehavior?: ScrollBehavior }
      ).__lastScrollBehavior = options?.behavior
    }
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page, state)
  await page.goto('/')

  const animationName = await page
    .locator('.road-minibus')
    .first()
    .evaluate((element) => getComputedStyle(element).animationName)
  expect(animationName).toBe('none')

  await login(page, 'operator@example.com')
  await page.goto('/operator/schools')
  await page
    .getByLabel('Aktif okul')
    .selectOption({ label: 'Örnek Okulu — Kadıköy' })
  await page.getByRole('button', { name: 'Okulu ekle' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Örnek Okulu için hizmet mahalleleri',
    }),
  ).toBeFocused()
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __lastScrollBehavior?: ScrollBehavior })
          .__lastScrollBehavior,
    ),
  ).toBe('auto')
})

async function audit(page: Page, surface: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations, `${surface} axe violations`).toEqual([])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${surface} horizontal overflow`).toBeLessThanOrEqual(1)
}

async function assertVisibleKeyboardFocus(page: Page) {
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'İçeriğe geç' })
  await expect(skipLink).toBeFocused()
  const focusStyle = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0)
}

async function login(page: Page, email: string) {
  await page.goto('/operator/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('uzun-ve-guvenli-sifre')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  // The login handler navigates asynchronously; the next page must not race it.
  await expect(page).toHaveURL(
    email === 'admin@example.com' ? /\/admin(?:\/|$)/ : /\/operator(?:\/|$)/,
  )
}
