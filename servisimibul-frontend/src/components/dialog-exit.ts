import { flushSync } from 'react-dom'

/**
 * Plays the CSS exit (`dialog[data-closing]` in styles.css) before `done`
 * closes or unmounts the dialog. React removes most dialogs in the same commit
 * that closes them, so CSS alone cannot animate their exit.
 */
export function exitDialog(
  dialog: HTMLDialogElement | null | undefined,
  done: () => void,
) {
  if (!dialog?.open) return done()
  if ('closing' in dialog.dataset) return
  dialog.dataset.closing = ''
  // Empty under reduced motion (0ms tokens) and in jsdom: close immediately.
  const animations = dialog.getAnimations?.() ?? []
  if (animations.length === 0) return done()
  // Keep Enter/Space from activating a control in the fading dialog.
  if (dialog.contains(document.activeElement))
    (document.activeElement as HTMLElement).blur()
  // flushSync keeps the commit synchronous, as it was inside the original event.
  void Promise.allSettled(
    animations.map((animation) => animation.finished),
  ).then(() => flushSync(done))
}
