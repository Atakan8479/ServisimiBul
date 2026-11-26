import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router-dom'

// Fast navigations finish before this and show nothing.
export const ROUTE_PENDING_DELAY_MS = 150

/**
 * While a route loader or lazy page module is still resolving, the previous
 * page stays on screen. This bar shows that the click was registered.
 */
export function RoutePendingIndicator() {
  const navigation = useNavigation()
  const pending = navigation.state !== 'idle'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!pending) return
    const timeout = window.setTimeout(
      () => setVisible(true),
      ROUTE_PENDING_DELAY_MS,
    )
    return () => {
      window.clearTimeout(timeout)
      setVisible(false)
    }
  }, [pending])

  const shown = pending && visible

  return (
    <>
      {shown && (
        <div
          className="route-pending-bar"
          aria-hidden="true"
          data-testid="route-pending"
        />
      )}
      <div className="route-pending-status" aria-live="polite">
        {shown ? 'Sayfa yükleniyor' : ''}
      </div>
    </>
  )
}
