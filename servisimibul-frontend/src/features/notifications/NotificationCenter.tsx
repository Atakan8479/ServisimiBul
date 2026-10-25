import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { apiRequest } from '../../api/client'

const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  href: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
})
const pageSchema = z.object({
  content: z.array(notificationSchema),
  page: z.number(),
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
})
const unreadSchema = z.object({ unreadCount: z.number() })
type Notification = z.infer<typeof notificationSchema>

export function NotificationCenter() {
  const [opened, setOpened] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()

  const load = useCallback(async (nextPage = 0) => {
    setLoading(true)
    setError(undefined)
    try {
      const [result, count] = await Promise.all([
        apiRequest(`/notifications?page=${nextPage}&size=20`, {
          schema: pageSchema,
          requiresSession: true,
        }),
        apiRequest('/notifications/unread-count', {
          schema: unreadSchema,
          requiresSession: true,
        }),
      ])
      setItems(result.content)
      setPage(result.page)
      setTotalPages(result.totalPages)
      setUnread(count.unreadCount)
    } catch {
      setError('Bildirimler yüklenemedi. Tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!opened) return
    void load()
  }, [opened, load])

  useEffect(() => {
    if (opened || document.visibilityState !== 'visible') return
    let active = true
    const refreshCount = () => {
      if (document.visibilityState !== 'visible') return
      void apiRequest('/notifications/unread-count', {
        schema: unreadSchema,
        requiresSession: true,
      })
        .then((result) => {
          if (active) setUnread(result.unreadCount)
        })
        .catch(() => {
          // Retain last known count until retry.
        })
    }
    refreshCount()
    const timer = window.setInterval(refreshCount, 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [opened])

  async function markRead(notification: Notification) {
    if (notification.readAt || busy) return
    setBusy(notification.id)
    setError(undefined)
    try {
      const result = await apiRequest(`/notifications/${notification.id}/read`, {
        method: 'PUT',
        schema: notificationSchema,
        requiresSession: true,
      })
      setItems((current) =>
        current.map((item) => (item.id === result.id ? result : item)),
      )
      setUnread((current) => Math.max(0, current - 1))
    } catch {
      setError('Bildirim okundu olarak işaretlenemedi.')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <section aria-label="Uygulama bildirimleri" className="notification-center">
      <button
        className="secondary-button"
        type="button"
        aria-expanded={opened}
        aria-controls="notification-list"
        onClick={() => setOpened((previous) => !previous)}
      >
        Bildirimler {unread > 0 ? `(${unread > 99 ? '99+' : unread})` : ''}
      </button>
      {opened && (
        <div id="notification-list" className="notification-panel">
          <h2>Bildirimler</h2>
          <button type="button" disabled={loading} onClick={() => void load(page)}>
            Yenile
          </button>
          {loading && <p role="status">Bildirimler yükleniyor…</p>}
          {error && (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => void load(page)}>
                Tekrar dene
              </button>
            </p>
          )}
          {!loading && !error && items.length === 0 && (
            <p>Henüz bildiriminiz yok.</p>
          )}
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.title}
                  {!item.readAt ? ' • Yeni' : ''}
                </strong>
                <p>{item.message}</p>
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString('tr-TR')}
                </time>
                <div>
                  {item.href.startsWith('/') && !item.href.startsWith('//') && (
                    <Link to={item.href} onClick={() => setOpened(false)}>
                      Ayrıntıya git
                    </Link>
                  )}
                  {!item.readAt && (
                    <button
                      type="button"
                      disabled={busy !== undefined}
                      onClick={() => void markRead(item)}
                    >
                      {busy === item.id ? 'Kaydediliyor…' : 'Okundu işaretle'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav aria-label="Bildirim sayfaları">
              <button
                type="button"
                disabled={loading || page === 0}
                onClick={() => void load(page - 1)}
              >
                Önceki
              </button>
              <span>
                {' '}
                Sayfa {page + 1} / {totalPages}{' '}
              </span>
              <button
                type="button"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => void load(page + 1)}
              >
                Sonraki
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  )
}
