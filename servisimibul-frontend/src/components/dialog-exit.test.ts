import { expect, test, vi } from 'vitest'
import { exitDialog } from './dialog-exit'

function openDialog() {
  const dialog = document.createElement('dialog')
  dialog.setAttribute('open', '')
  document.body.append(dialog)
  return dialog
}

test('closes immediately when nothing animates', () => {
  const done = vi.fn()
  exitDialog(openDialog(), done)
  expect(done).toHaveBeenCalledOnce()
})

test('waits for the exit transition and ignores repeated dismissals', async () => {
  const dialog = openDialog()
  let finish = () => {}
  const finished = new Promise<void>((resolve) => (finish = resolve))
  dialog.getAnimations = () => [{ finished } as unknown as Animation]
  const done = vi.fn()

  exitDialog(dialog, done)
  exitDialog(dialog, done)
  expect(dialog.dataset.closing).toBe('')
  expect(done).not.toHaveBeenCalled()

  finish()
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce())
})
