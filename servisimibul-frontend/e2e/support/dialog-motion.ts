import type { Page } from '@playwright/test'

/** Axe must read settled colours, not a dialog that is still fading in. */
export async function settleDialogMotion(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('dialog[open]')].flatMap((dialog) =>
        dialog.getAnimations().map((animation) => animation.finished),
      ),
    ),
  )
}
