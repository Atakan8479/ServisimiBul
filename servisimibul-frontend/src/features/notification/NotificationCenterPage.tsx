import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel, StatusBadge } from '../../components/design-system'
import {
  listNotifications,
  markNotificationRead,
  unreadCountChangedEvent,
  unreadNotificationCount,
  type NotificationItem,
  type NotificationPage,
} from './notification-api'
import './notification-ui.css'

const roleCopy = {
  parent: {
    eyebrow: 'Veli hesabı',
    title: 'Bildirimler',
    detail: 'Talep ve servis gelişmelerini burada görün.',
    account: 'veli hesabı',
    back: 'Talep panosuna dön',
    backTo: '/demands',
  },
  operator: {
    eyebrow: 'İşletmeci paneli',
    title: 'Bildirimler',
    detail: 'Servis talepleri ve hesabınızla ilgili gelişmeleri burada görün.',
    account: 'işletmeci hesabı',
    back: 'Panele dön',
    backTo: '/operator',
  },
  admin: {
    eyebrow: 'Yönetim paneli',
    title: 'Yönetim bildirimleri',
    detail: 'İçerik bildirimleri ve yönetim gelişmelerini burada görün.',
    account: 'yönetici hesabı',
    back: 'Panele dön',
    backTo: '/admin/applications',
  },
} as const

function roleFromPath(pathname: string) {
  if (pathname.startsWith('/admin')) return roleCopy.admin
  if (pathname.startsWith('/operator')) return roleCopy.operator
  return roleCopy.parent
}

const typeTones: Record<NotificationItem['type'], string> = {
  DEMAND_CREATED: 'info',
  SERVICE_PUBLISHED: 'success',
  FEEDBACK_REMINDER: 'info',
  SUPPORT_EXPIRED: 'warning',
  SERVICE_WITHDRAWN: 'warning',
  CONTENT_REPORTED: 'warning',
}

const typeIcons: Record<NotificationItem['type'], string> = {
  DEMAND_CREATED: 'M12 5v14M5 12h14',
  SERVICE_PUBLISHED: 'M5 12.5l4.5 4.5L19 7.5',
  FEEDBACK_REMINDER: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5',
  SUPPORT_EXPIRED: 'M12 7v5l3.5 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  SERVICE_WITHDRAWN: 'M6 6l12 12M18 6L6 18',
  CONTENT_REPORTED: 'M6 21V4h11l-2 4 2 4H6',
}

const bellIcon = 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 21h4'
const checkIcon = 'M5 12.5l4.5 4.5L19 7.5'

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d={path} />
    </svg>
  )
}

export function NotificationCenterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<NotificationPage>()
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState<number>()
  const [openingId, setOpeningId] = useState<string>()
  const [markingId, setMarkingId] = useState<string>()
  const [focusId, setFocusId] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const copy = roleFromPath(location.pathname)

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
    const timer = window.setTimeout(() => {
      void load(controller.signal)
      void refreshUnreadCount(controller.signal)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load])

  useEffect(() => {
    if (focusId) document.getElementById(`notification-${focusId}`)?.focus()
  }, [focusId])

  async function refreshUnreadCount(signal?: AbortSignal) {
    try {
      const response = await unreadNotificationCount(signal)
      setUnreadCount(response.unreadCount)
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === 'AbortError')) {
        setUnreadCount(undefined)
      }
    }
  }

  async function markRead(notification: NotificationItem) {
    setMarkingId(notification.id)
    setError(undefined)
    setNotice(undefined)
    try {
      const updated = await markNotificationRead(notification.id)
      setResult((current) =>
        current
          ? {
              ...current,
              content: current.content.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      )
      setFocusId(updated.id)
      setNotice('Bildirim okundu olarak işaretlendi.')
      window.dispatchEvent(new Event(unreadCountChangedEvent))
      await refreshUnreadCount()
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.problem.detail
          : 'Bildirim işaretlenemedi. Lütfen tekrar deneyin.',
      )
    } finally {
      setMarkingId(undefined)
    }
  }

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
      <div className="notification-heading">
        <div>
          <p className="notification-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.detail}</p>
        </div>
        {unreadCount === 0 && !!result?.totalElements && (
          <StatusBadge tone="success">Hepsi okundu</StatusBadge>
        )}
      </div>

      {notice && (
        <div className="status-banner success" role="status">
          {notice}
        </div>
      )}

      {error && (
        <div className="form-error notification-error" role="alert">
          <span>{error}</span>
          <button
            className="secondary-button"
            onClick={() => {
              void load()
              void refreshUnreadCount()
            }}
            type="button"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {result && !loading && (
        <div className="notification-summary">
          <span className="notification-icon notification-icon-info">
            <Icon path={bellIcon} />
          </span>
          <div>
            {unreadCount !== undefined && (
              <strong>{unreadCount} okunmamış bildirim</strong>
            )}
            <p>
              {result.totalElements} toplam bildirim · {copy.account}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <StatePanel
          detail="Güncel bildirimleriniz getiriliyor."
          title="Bildirimler yükleniyor"
          tone="loading"
        />
      ) : result?.content.length === 0 ? (
        <StatePanel
          detail="Yeni bir gelişme olduğunda burada göreceksiniz."
          title="Henüz bildiriminiz yok"
        />
      ) : result ? (
        <section aria-labelledby="notification-feed-title">
          <h2 className="notification-feed-title" id="notification-feed-title">
            Son güncellemeler
          </h2>
          <ol className="notification-feed">
            {result.content.map((notification) => {
              const titleId = `notification-title-${notification.id}`
              return (
                <li
                  className={notification.readAt ? 'is-read' : 'is-unread'}
                  key={notification.id}
                >
                  <span
                    className={`notification-icon notification-icon-${typeTones[notification.type]}`}
                  >
                    <Icon path={typeIcons[notification.type]} />
                  </span>
                  <div className="notification-body">
                    <h3 id={titleId}>{notification.title}</h3>
                    <p>{notification.message}</p>
                    <time dateTime={notification.createdAt}>
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>
                  <div className="notification-actions">
                    {!notification.readAt && (
                      <span className="notification-new">
                        <span>Yeni</span>
                      </span>
                    )}
                    <button
                      aria-describedby={titleId}
                      className="notification-open"
                      disabled={openingId === notification.id}
                      id={`notification-${notification.id}`}
                      onClick={() => void openNotification(notification)}
                      type="button"
                    >
                      {openingId === notification.id ? 'Açılıyor…' : 'İncele'}
                      <span aria-hidden="true"> ›</span>
                    </button>
                    {!notification.readAt && (
                      <button
                        aria-describedby={titleId}
                        aria-label="Okundu olarak işaretle"
                        className="notification-mark"
                        disabled={markingId === notification.id}
                        onClick={() => void markRead(notification)}
                        title="Okundu olarak işaretle"
                        type="button"
                      >
                        <Icon path={checkIcon} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

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

      <Link className="notification-back" to={copy.backTo} viewTransition>
        {copy.back} <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
