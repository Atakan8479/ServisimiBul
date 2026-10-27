import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ApiError } from '../api/client'

export function LoadingPage() {
  return (
    <main className="state-page" aria-live="polite" aria-busy="true">
      <p className="eyebrow">ServisimiBul</p>
      <div className="loading-indicator" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h1>Yükleniyor</h1>
      
    </main>
  )
}

export function RouteErrorPage() {
  const error = useRouteError()

  if (error instanceof ApiError && error.sessionExpired) {
    return (
      <StatePage
        title="Oturumunuz sona erdi"
        detail="Devam etmek için tekrar giriş yapın."
      />
    )
  }

  if (error instanceof ApiError) {
    return (
      <StatePage title={error.problem.title} detail={error.problem.detail} />
    )
  }

  if (isRouteErrorResponse(error)) {
    return (
      <StatePage
        title={error.status === 404 ? 'Sayfa bulunamadı' : 'Bir sorun oluştu'}
        detail="İstediğiniz sayfa şu anda görüntülenemiyor."
      />
    )
  }

  return (
    <StatePage
      title="Bir sorun oluştu"
      detail="Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin."
    />
  )
}

export function NotFoundPage() {
  return (
    <StatePage
      title="Sayfa bulunamadı"
      detail="Aradığınız sayfa taşınmış veya kaldırılmış olabilir."
    />
  )
}

function StatePage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="state-page">
      <p className="eyebrow">ServisimiBul</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      <Link className="button-link" to="/" viewTransition>
        Ana sayfaya dön
      </Link>
    </main>
  )
}
