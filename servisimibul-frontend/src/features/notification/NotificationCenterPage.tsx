import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel } from '../../components/design-system'
import {
  listNotifications,
  markNotificationRead,
  type NotificationItem,
  type NotificationPage,
} from './notification-api'
import './notification-ui.css'

export function NotificationCenterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<NotificationPage>()
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string>()
  const [error, setError] = useState<string>()

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(undefined)
      try {
        setResult(await listNotifications(page, signal))
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === 'AbortError')
          return
        if (failure instanceof ApiError && failure.sessionExpired) {
          const loginPath =
            location.pathname === '/notifications'
              ? '/parent/login'
              : '/operator/login'
          const next = `${location.pathname}${location.search}`
          void navigate(
            `${loginPath}?next=${encodeURIComponent(next)}&reason=session`,
            { replace: true },
          )
          return
        }
        setError(
          failure instanceof ApiError
            ? failure.problem.detail
            : 'Bildirimler yüklenemedi. Lütfen tekrar deneyin.',
        )
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [location.pathname, location.search, navigate, page],
  )

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load])

  async function openNotification(notification: NotificationItem) {
    setOpeningId(notification.id)
    setError(undefined)
    try {
      if (!notification.readAt) await markNotificationRead(notification.id)
      void navigate(notification.href, { viewTransition: true })
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.problem.detail
          : 'Bildirim açılamadı. Lütfen tekrar deneyin.',
      )
      setOpeningId(undefined)
    }
  }

  return (
    <section className="workspace-page notification-page">
      <div className="page-heading notification-heading">
        <div>
          <h1>Bildirim merkezi</h1>
          <p>Hesabınızla ilgili yeni gelişmeleri tek yerde takip edin.</p>
        </div>
        {result && result.totalElements > 0 && (
          <span className="count-badge">{result.totalElements} bildirim</span>
        )}
      </div>

      {error && (
        <div className="form-error notification-error" role="alert">
          <span>{error}</span>
          <button
            className="secondary-button"
            onClick={() => void load()}
            type="button"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {loading ? (
        <StatePanel
          detail="Güncel bildirimleriniz getiriliyor."
          title="Bildirimler yükleniyor"
          tone="loading"
        />
      ) : !result || result.content.length === 0 ? (
        <StatePanel
          detail="Yeni bir gelişme olduğunda burada göreceksiniz."
          title="Henüz bildiriminiz yok"
        />
      ) : (
        <ol className="notification-list">
          {result.content.map((notification) => (
            <li
              className={notification.readAt ? 'is-read' : 'is-unread'}
              key={notification.id}
            >
              <button
                disabled={openingId === notification.id}
                onClick={() => void openNotification(notification)}
                type="button"
              >
                <span className="notification-copy">
                  <span className="notification-title-row">
                    <strong>{notification.title}</strong>
                    {!notification.readAt && (
                      <span className="unread-marker">Yeni</span>
                    )}
                  </span>
                  <span>{notification.message}</span>
                  <time dateTime={notification.createdAt}>
                    {formatDate(notification.createdAt)}
                  </time>
                </span>
                <span className="notification-action">
                  {openingId === notification.id ? 'Açılıyor…' : 'Ayrıntıyı aç'}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {result && result.totalPages > 1 && (
        <nav className="pagination" aria-label="Bildirim sayfaları">
          <button
            className="secondary-button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            type="button"
          >
            Önceki
          </button>
          <span>
            Sayfa {result.page + 1} / {result.totalPages}
          </span>
          <button
            className="secondary-button"
            disabled={page + 1 >= result.totalPages}
            onClick={() => setPage(page + 1)}
            type="button"
          >
            Sonraki
          </button>
        </nav>
      )}
    </section>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
