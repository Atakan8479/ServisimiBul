import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLoaderData, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../api/client'
import {
  Button,
  FormField,
  StatusBadge,
  SurfaceCard,
} from '../../components/design-system'
import {
  confirmEmailChange,
  requestEmailChange,
  type AuthUser,
} from '../auth/auth-api'
import './account-settings.css'

const emailChangeSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
})

type EmailChangeForm = z.infer<typeof emailChangeSchema>

export function EmailChangePage() {
  const user = useLoaderData() as AuthUser
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState<string>()
  const isOperator = user.role === 'OPERATOR'
  const accountPath = isOperator ? '/operator/account' : '/parent/account'
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailChangeForm>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { email: '' },
  })

  async function submit({ email }: EmailChangeForm) {
    setFormError(undefined)
    try {
      await requestEmailChange(email)
      setComplete(true)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.problem.fieldErrors?.email) {
          setError('email', {
            type: 'server',
            message: 'Geçerli bir e-posta adresi girin.',
          })
        } else {
          setFormError(error.problem.detail)
        }
        return
      }
      setFormError(
        'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    }
  }

  return (
    <section className="account-password-page">
      <header className="account-settings-header">
        <div>
          <p className="account-password-eyebrow">Güvenlik</p>
          <h1>E-posta adresini değiştir</h1>
          <p>
            Yeni adres doğrulanana kadar mevcut e-postanız kullanılmaya devam
            eder.
          </p>
        </div>
        <StatusBadge tone="info">
          {isOperator ? 'İşletmeci hesabı' : 'Veli hesabı'}
        </StatusBadge>
      </header>

      <SurfaceCard className="account-password-card">
        {!user.emailChangeAvailable ? (
          <div className="account-email-unavailable" role="status">
            <h2>E-posta değişikliği şu anda kullanılamıyor</h2>
            <p>
              E-posta teslimi ve gerekli hukuki kararlar tamamlanana kadar yeni
              adres kaydedilemez.
            </p>
            <Link
              className="ui-button ui-button-secondary"
              to={accountPath}
              viewTransition
            >
              Hesap ayarlarına dön
            </Link>
          </div>
        ) : complete ? (
          <div className="account-email-pending" role="status">
            <h2>İstek alındı</h2>
            <p>
              Adres kullanılabiliyorsa ve teslimat başarılıysa doğrulama
              bağlantısı gönderilir. Bağlantı doğrulanana kadar mevcut
              e-postanız değişmez.
            </p>
            <Link
              className="ui-button ui-button-secondary"
              to={accountPath}
              viewTransition
            >
              Hesap ayarlarına dön
            </Link>
          </div>
        ) : (
          <>
            {formError && (
              <div className="account-password-error" role="alert">
                {formError}
              </div>
            )}
            <dl className="account-email-current">
              <dt>Mevcut hesap e-postası</dt>
              <dd>{user.email}</dd>
            </dl>
            <form onSubmit={handleSubmit(submit)} noValidate>
              <FormField
                error={errors.email?.message}
                htmlFor="new-email"
                label="Yeni e-posta adresi"
              >
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  {...register('email')}
                />
              </FormField>
              <p className="account-password-session-note">
                Değişiklik doğrulandığında tüm açık oturumlarınız sona erer ve
                yeni e-posta adresinizle yeniden giriş yapmanız gerekir.
              </p>
              <div className="account-password-actions">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'İşleniyor…' : 'Doğrulama isteği oluştur'}
                </Button>
                <Link
                  className="ui-button ui-button-secondary"
                  to={accountPath}
                  viewTransition
                >
                  Vazgeç
                </Link>
              </div>
            </form>
          </>
        )}
      </SurfaceCard>
    </section>
  )
}

export function EmailChangeConfirmationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [complete, setComplete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function confirm() {
    if (!token) {
      setError('Doğrulama bağlantısı geçersiz veya eksik.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      await confirmEmailChange(token)
      setComplete(true)
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.problem.detail
          : 'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="account-password-page account-email-confirmation">
      <header className="account-settings-header">
        <div>
          <p className="account-password-eyebrow">Hesap güvenliği</p>
          <h1>E-posta değişikliğini doğrula</h1>
          <p>
            Bu işlem yeni adresi hesabınıza bağlar ve açık oturumları kapatır.
          </p>
        </div>
      </header>
      <SurfaceCard className="account-password-card">
        {complete ? (
          <div className="account-email-pending" role="status">
            <h2>E-posta adresiniz değiştirildi</h2>
            <p>
              Tüm açık oturumlar sonlandırıldı. Yeni adresinizle giriş yapın.
            </p>
            <div className="account-password-actions">
              <Link
                className="ui-button ui-button-primary"
                to="/parent/login"
                viewTransition
              >
                Veli girişi
              </Link>
              <Link
                className="ui-button ui-button-secondary"
                to="/operator/login"
                viewTransition
              >
                İşletmeci girişi
              </Link>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="account-password-error" role="alert">
                {error}
              </div>
            )}
            <p className="account-password-session-note">
              Doğrulama bağlantısı tek kullanımlıktır ve 24 saat sonra geçersiz
              olur.
            </p>
            <div className="account-password-actions">
              <Button disabled={pending} onClick={confirm} type="button">
                {pending ? 'Doğrulanıyor…' : 'E-posta değişikliğini doğrula'}
              </Button>
              <Link
                className="ui-button ui-button-secondary"
                to="/"
                viewTransition
              >
                Ana sayfaya dön
              </Link>
            </div>
          </>
        )}
      </SurfaceCard>
    </section>
  )
}
