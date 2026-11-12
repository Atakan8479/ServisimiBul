import { expect, test } from '@playwright/test'
import { createMockApiState, installMockApi } from './support/mock-api'

test('the road backdrop stays quiet and minibuses drive once on the homepage only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installMockApi(page, createMockApiState())

  for (const route of ['/demands', '/parent/login', '/privacy/notice']) {
    await page.goto(route)
    await expect(page.locator('.road-lane')).toHaveCount(2)
    await expect(page.locator('.road-minibus'), route).toHaveCount(0)
    expect(
      await page
        .locator('.road-lane')
        .first()
        .evaluate((node) => Number(getComputedStyle(node).opacity)),
      route,
    ).toBeLessThanOrEqual(0.12)
  }

  await page.goto('/')
  const animations = await page.locator('.road-minibus').evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node)
      return [style.animationName, style.animationIterationCount]
    }),
  )
  expect(animations).toEqual([
    ['drive-right', '1'],
    ['drive-left', '1'],
  ])

  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page
      .locator('.road-lane')
      .first()
      .evaluate((node) => Number(getComputedStyle(node).opacity)),
  ).toBeLessThanOrEqual(0.12)
})
