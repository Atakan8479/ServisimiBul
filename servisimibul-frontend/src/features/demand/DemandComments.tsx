import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { currentUser, knownAuthRole, type AuthRole } from '../auth/auth-api'
import { ReportControl } from '../moderation/ReportControl'
import {
  createDemandComment,
  deleteDemandComment,
  listDemandComments,
  type DemandComment,
  type DemandCommentPage,
} from './demand-api'

interface DemandCommentsProps {
  demandId: string
  open: boolean
  parentHasActiveSupport: boolean
}

export function DemandComments({
  demandId,
  open,
  parentHasActiveSupport,
}: DemandCommentsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [comments, setComments] = useState<DemandComment[]>([])
  const [pageInfo, setPageInfo] = useState<DemandCommentPage>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [formOpen, setFormOpen] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const requestVersion = useRef(0)
  const resumeHandled = useRef(false)
  const commentButtonRef = useRef<HTMLButtonElement>(null)
  const commentBodyRef = useRef<HTMLTextAreaElement>(null)

  const loadFirstPage = useCallback(async () => {
    const request = ++requestVersion.current
    setLoading(true)
    setLoadError(undefined)
    try {
      const result = await listDemandComments(demandId, 0)
      if (request !== requestVersion.current) return
      setComments(result.content)
      setPageInfo(result)
    } catch {
      if (request !== requestVersion.current) return
      setLoadError('Yorumlar yüklenemedi. Tekrar deneyin.')
    } finally {
      if (request === requestVersion.current) setLoading(false)
    }
  }, [demandId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFirstPage(), 0)
    return () => {
      window.clearTimeout(timer)
      requestVersion.current += 1
    }
  }, [loadFirstPage])

  useEffect(() => {
    if (
      loading ||
      searchParams.get('action') !== 'comment' ||
      resumeHandled.current
    ) {
      return
    }
    resumeHandled.current = true
    setSearchParams({}, { replace: true })
    void beginComment()
    // Resume only once after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams, setSearchParams])

  function redirectToLogin(
    sessionExpired = false,
    role: AuthRole | undefined = knownAuthRole(),
  ) {
    const next = `${location.pathname}?action=comment`
    const reason = sessionExpired ? '&reason=session' : ''
    const loginPath = role === 'OPERATOR' ? '/operator/login' : '/parent/login'
    void navigate(`${loginPath}?next=${encodeURIComponent(next)}${reason}`)
  }

  async function beginComment() {
    setActionError(undefined)
    setNotice(undefined)
    if (!open) {
      setActionError('Katılıma kapalı taleplere yeni yorum eklenemez.')
      return
    }
    const role = knownAuthRole()
    try {
      const user = await currentUser()
      if (user.role === 'PARENT' && !parentHasActiveSupport) {
        setActionError('Yorum yazmak için önce bu talebe destek verin.')
        return
      }
      if (user.role === 'ADMIN') {
        setActionError('Yorumlar veli ve servis işletmecisi hesapları içindir.')
        return
      }
      setFormOpen(true)
      window.requestAnimationFrame(() => commentBodyRef.current?.focus())
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        redirectToLogin(error.sessionExpired, role)
        return
      }
      setActionError('Oturum bilgisi kontrol edilemedi. Tekrar deneyin.')
    }
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = body.trim()
    const length = Array.from(normalized).length
    if (length < 2 || length > 1000) {
      setActionError('Yorum 2–1000 karakter arasında olmalıdır.')
      return
    }
    setSubmitting(true)
    setActionError(undefined)
    setNotice(undefined)
    try {
      await createDemandComment(demandId, normalized)
      setBody('')
      setFormOpen(false)
      setNotice('Yorumunuz yayınlandı.')
      await loadFirstPage()
    } catch (error) {
      handleMutationError(error, 'Yorumunuz yayınlanamadı. Tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  async function removeComment(commentId: string) {
    setDeletingId(commentId)
    setActionError(undefined)
    setNotice(undefined)
    try {
      await deleteDemandComment(demandId, commentId)
      await loadFirstPage()
      setNotice('Yorumunuz silindi.')
    } catch (error) {
      handleMutationError(error, 'Yorum silinemedi. Tekrar deneyin.')
    } finally {
      setDeletingId(undefined)
    }
  }

  async function loadMore() {
    if (!pageInfo || pageInfo.page + 1 >= pageInfo.totalPages) return
    setLoadingMore(true)
    setLoadError(undefined)
    try {
      const result = await listDemandComments(demandId, pageInfo.page + 1)
      setComments((current) => [...current, ...result.content])
      setPageInfo(result)
    } catch {
      setLoadError('Diğer yorumlar yüklenemedi. Tekrar deneyin.')
    } finally {
      setLoadingMore(false)
    }
  }

  function handleMutationError(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.problem.status === 401) {
      redirectToLogin(true)
      return
    }
    setActionError(error instanceof ApiError ? error.problem.detail : fallback)
  }

  const characterCount = Array.from(body).length
  const hasMore = Boolean(pageInfo && pageInfo.page + 1 < pageInfo.totalPages)

  return (
    <section className="demand-comments" aria-labelledby="comments-title">
      <div className="section-heading">
        <div>
          <h2 id="comments-title">Yorumlar</h2>
        </div>
        {open && !formOpen && (
          <button
            className="secondary-button"
            ref={commentButtonRef}
            type="button"
            onClick={() => void beginComment()}
          >
            Yorum yaz
          </button>
        )}
      </div>

      {formOpen && (
        <form className="demand-comment-form" onSubmit={submitComment}>
          <label htmlFor="demand-comment-body">Yorumunuz</label>
          <p className="fieldset-help" id="comment-privacy-help">
            Öğrenci adı, telefon numarası veya açık ev adresi paylaşmayın.
          </p>
          <textarea
            id="demand-comment-body"
            aria-describedby="comment-privacy-help comment-character-count"
            maxLength={1000}
            ref={commentBodyRef}
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <small
            className={
              characterCount > 1000 ? 'field-error' : 'character-count'
            }
            id="comment-character-count"
          >
            {characterCount}/1000 karakter
          </small>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Yayınlanıyor…' : 'Yorumu yayınla'}
            </button>
            <button
              className="secondary-button"
              disabled={submitting}
              type="button"
              onClick={() => {
                setFormOpen(false)
                setActionError(undefined)
                window.requestAnimationFrame(() =>
                  commentButtonRef.current?.focus(),
                )
              }}
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {notice && (
        <div className="status-banner success" role="status">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="form-error" role="alert">
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="comment-state" role="status">
          Yorumlar yükleniyor…
        </p>
      ) : loadError && comments.length === 0 ? (
        <div className="demand-load-error" role="alert">
          <p>{loadError}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadFirstPage()}
          >
            Tekrar dene
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="comment-state">
          Henüz yorum yok. İlk bilgiyi siz paylaşın.
        </p>
      ) : (
        <ol className="demand-comment-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <article>
                <header>
                  <div>
                    <strong>{comment.author.displayName}</strong>
                    <span>
                      {comment.author.role === 'PARENT'
                        ? 'Destekleyen'
                        : 'İşletmeci'}
                    </span>
                  </div>
                  <time dateTime={comment.createdAt}>
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </header>
                <p>{comment.body}</p>
                <div className="comment-actions">
                  <ReportControl targetId={comment.id} targetType="COMMENT" />
                  {comment.canDelete && (
                    <button
                      className="text-button danger-text"
                      disabled={deletingId === comment.id}
                      type="button"
                      onClick={() => void removeComment(comment.id)}
                    >
                      {deletingId === comment.id
                        ? 'Siliniyor…'
                        : 'Yorumumu sil'}
                    </button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}

      {loadError && comments.length > 0 && (
        <div className="form-error" role="alert">
          {loadError}
        </div>
      )}
      {hasMore && (
        <button
          className="secondary-button demand-comments-more"
          disabled={loadingMore}
          type="button"
          onClick={() => void loadMore()}
        >
          {loadingMore ? 'Yükleniyor…' : 'Daha fazla yorum göster'}
        </button>
      )}
    </section>
  )
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
