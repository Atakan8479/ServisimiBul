import { zodResolver } from '@hookform/resolvers/zod'
import {
  cloneElement,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  useForm,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../api/client'
import {
  forgotPassword,
  login,
  logout,
  registerOperator,
  registerParent,
  resetPassword,
  verifyEmail,
} from './auth-api'
import { AuthFrame } from './AuthFrame'
import './auth-ui.css'

const passwordSchema = z
  .string()
  .min(12, 'Şifre en az 12 karakter olmalıdır.')
  .max(64, 'Şifre en fazla 64 karakter olabilir.')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Şifre UTF-8 olarak en fazla 72 bayt olabilir.',
  )

const registrationSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  password: passwordSchema,
  businessName: z
    .string()
    .trim()
    .max(120, 'İşletme adı en fazla 120 karakter olabilir.')
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      'İşletme adı en az 2 karakter olmalıdır.',
    ),
  contactPhone: z.string().trim().min(1, 'İletişim telefonu zorunludur.'),
})

const parentRegistrationSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  password: passwordSchema,
})

const loginSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Şifrenizi girin.'),
  rememberMe: z.boolean(),
})

const verificationSchema = z.object({
  token: z.string().trim().min(1, 'Doğrulama kodu zorunludur.'),
})

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
})

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Şifre yenileme kodu zorunludur.'),
  newPassword: passwordSchema,
})

type RegistrationForm = z.infer<typeof registrationSchema>
type ParentRegistrationForm = z.infer<typeof parentRegistrationSchema>
type LoginForm = z.infer<typeof loginSchema>
type VerificationForm = z.infer<typeof verificationSchema>
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

export function RegisterPage() {
  const emailVerificationRequired =
    import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED !== 'false'
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationForm>({ resolver: zodResolver(registrationSchema) })

  async function submit(values: RegistrationForm) {
    setFormError(undefined)
    try {
      await registerOperator(values)
      setComplete(true)
    } catch (error) {
      setFormError(applyFieldErrors(error, setError, registrationFields))
    }
  }

  if (complete) {
    return (
      <AuthFrame
        title={
          emailVerificationRequired
            ? 'E-postanızı kontrol edin'
            : 'Hesabınız hazır'
        }
        subtitle={
          emailVerificationRequired
            ? 'Doğrulama bağlantısı gönderildiyse hesabınızı etkinleştirmek için bağlantıyı açın.'
            : 'İşletmeci hesabınız oluşturuldu; şimdi güvenli oturum açabilirsiniz.'
        }
      >
        <div className="auth-completion" role="status">
          <p>
            {emailVerificationRequired
              ? 'Hesap varsa doğrulama bağlantısı gönderildi. Bağlantıyı açtıktan sonra giriş yapabilirsiniz.'
              : 'Kayıt tamamlandı. Şimdi giriş yapabilirsiniz.'}
          </p>
          <Link className="button-link" to="/operator/login" viewTransition>
            İşletmeci girişine git
          </Link>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame
      title="İşletmenizi tanıtalım."
      subtitle="Hizmet verdiğiniz okul ve mahalle kapsamını paylaşın."
    >
      <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
        <FormField
          label="İşletme adı (isteğe bağlı)"
          error={errors.businessName?.message}
          input={
            <input autoComplete="organization" {...register('businessName')} />
          }
        />
        <FormField
          label="E-posta"
          error={errors.email?.message}
          input={
            <input type="email" autoComplete="email" {...register('email')} />
          }
        />
        <FormField
          label="Herkese açık iletişim telefonu"
          hint="Örnek: 0532 123 45 67"
          error={errors.contactPhone?.message}
          input={
            <input
              type="tel"
              autoComplete="tel"
              {...register('contactPhone')}
            />
          }
        />
        <FormField
          label="Şifre"
          hint="12–64 karakter; boşluk kullanabilirsiniz."
          error={errors.password?.message}
          endAction={
            <PasswordVisibilityButton
              visible={showPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
          }
          input={
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
            />
          }
        />
        <aside
          aria-labelledby="public-profile-disclosure-title"
          className="status-banner neutral registration-disclosure"
        >
          <strong id="public-profile-disclosure-title">
            İşletme profilinizin görünürlüğü
          </strong>
          <p>
            {emailVerificationRequired ? (
              <>
                E-posta doğrulamanızı tamamlayıp hizmet verdiğiniz okul ve
                mahalleleri ekleyin.
              </>
            ) : (
              <>
                Profilinizin aramalarda görünmesi için hizmet verdiğiniz okul ve
                mahalleleri ekleyin.
              </>
            )}
          </p>
          <p>
            Telefonunuz ve paylaştığınız işletme bilgileri ziyaretçilere
            görünebilir.
          </p>
        </aside>
        <FormError message={formError} />
        <button
          className="primary-button auth-submit"
          disabled={isSubmitting}
          type="submit"
        >
          <span>
            {isSubmitting ? 'Kaydediliyor…' : 'İşletmeci hesabı oluştur'}
          </span>
          {!isSubmitting && <span className="auth-arrow" aria-hidden="true" />}
        </button>
      </form>
      <div className="auth-context-link">
        <span>Zaten hesabınız var mı?</span>
        <Link to="/operator/login" viewTransition>
          İşletmeci girişi
        </Link>
      </div>
      {emailVerificationRequired && (
        <div className="auth-context-link">
          <span>Doğrulama bağlantınız var mı?</span>
          <Link to="/operator/verify-email" viewTransition>
            E-postayı doğrulayın
          </Link>
        </div>
      )}
      <div className="auth-context-link">
        <span>Veli misiniz?</span>
        <Link to="/parent/login" viewTransition>
          Veli girişi
        </Link>
      </div>
    </AuthFrame>
  )
}

export function ParentSignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string>()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ParentRegistrationForm>({
    resolver: zodResolver(parentRegistrationSchema),
  })

  async function submit(values: ParentRegistrationForm) {
    setFormError(undefined)
    try {
      await registerParent(values)
      const parameters = new URLSearchParams({
        next: demandDestination(searchParams.get('next')),
        registered: 'parent',
      })
      void navigate(`/parent/login?${parameters}`, {
        replace: true,
        viewTransition: typeof document.startViewTransition === 'function',
      })
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 429) {
        setFormError(
          'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.',
        )
        return
      }
      if (error instanceof ApiError && error.problem.status === 503) {
        setFormError(
          'Veli kaydı şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
        )
        return
      }
      if (!(error instanceof ApiError)) {
        setFormError(
          'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
        )
        return
      }
      setFormError(applyFieldErrors(error, setError, parentRegistrationFields))
    }
  }

  return (
    <AuthFrame
      title="Veli hesabı oluşturun"
      subtitle="Servis taleplerini takip etmek, desteklemek ve bildirimlerinizi yönetmek için hesabınızı oluşturun."
    >
      <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
        <FormField
          label="E-posta"
          error={errors.email?.message}
          input={
            <input type="email" autoComplete="email" {...register('email')} />
          }
        />
        <FormField
          label="Şifre"
          hint="12–64 karakter; boşluk kullanabilirsiniz."
          error={errors.password?.message}
          endAction={
            <PasswordVisibilityButton
              visible={showPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
          }
          input={
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
            />
          }
        />
        <p className="auth-security-note">
          Veli hesabı servis aramak için zorunlu değildir; yalnızca talep ve
          bildirim işlemlerinde kullanılır.
        </p>
        <FormError message={formError} />
        <button
          className="primary-button auth-submit"
          disabled={isSubmitting}
          type="submit"
        >
          <span>{isSubmitting ? 'Kaydediliyor…' : 'Veli hesabı oluştur'}</span>
          {!isSubmitting && <span className="auth-arrow" aria-hidden="true" />}
        </button>
      </form>
      <div className="auth-context-link">
        <span>Zaten hesabınız var mı?</span>
        <Link
          to={`/parent/login?next=${encodeURIComponent(parentDestination(searchParams.get('next')))}`}
          viewTransition
        >
          Veli girişi
        </Link>
      </div>
      <div className="auth-context-link">
        <span>İşletmeci misiniz?</span>
        <Link to="/operator/login" viewTransition>
          İşletmeci girişi
        </Link>
      </div>
      <p className="auth-back-link">
        <Link to="/register" viewTransition>
          Hesap türüne geri dön
        </Link>
      </p>
    </AuthFrame>
  )
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VerificationForm>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  })

  async function submit({ token }: VerificationForm) {
    setFormError(undefined)
    try {
      await verifyEmail(token)
      setComplete(true)
    } catch (error) {
      setFormError(applyFieldErrors(error, setError, ['token']))
    }
  }

  return (
    <AuthFrame
      title="E-posta adresinizi doğrulayın"
      subtitle="E-postanızdaki bağlantı hesabınıza ait güvenli doğrulama bilgisini bu ekrana taşır."
    >
      {complete ? (
        <div className="auth-completion" role="status">
          <p>
            E-posta adresiniz doğrulandı. Artık işletmeci hesabınızla güvenli
            şekilde giriş yapabilirsiniz.
          </p>
          <Link className="button-link" to="/operator/login" viewTransition>
            İşletmeci girişi
          </Link>
        </div>
      ) : (
        <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
          <FormField
            label="Doğrulama kodu"
            hint="E-postadaki bağlantı bu alanı otomatik doldurur."
            error={errors.token?.message}
            input={
              <input autoComplete="one-time-code" {...register('token')} />
            }
          />
          <FormError message={formError} />
          <button
            className="primary-button auth-submit"
            disabled={isSubmitting}
            type="submit"
          >
            <span>
              {isSubmitting ? 'Doğrulanıyor…' : 'E-posta adresini doğrula'}
            </span>
            {!isSubmitting && (
              <span className="auth-arrow" aria-hidden="true" />
            )}
          </button>
        </form>
      )}
      {!complete && (
        <div className="auth-context-link">
          <span>Bağlantınız çalışmıyor mu?</span>
          <Link to="/operator/register" viewTransition>
            Kayıt adımına dönün
          </Link>
        </div>
      )}
      <div className="auth-context-link">
        <span>Veli misiniz?</span>
        <Link to="/parent/login" viewTransition>
          Veli girişi
        </Link>
      </div>
    </AuthFrame>
  )
}

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  })
  const loginPath =
    searchParams.get('from') === 'parent' ? '/parent/login' : '/operator/login'

  async function submit({ email }: ForgotPasswordForm) {
    setFormError(undefined)
    try {
      await forgotPassword(email)
      setComplete(true)
    } catch (error) {
      setFormError(applyFieldErrors(error, setError, ['email']))
    }
  }

  return (
    <AuthFrame
      title="Şifrenizi yenileyin"
      subtitle={
        complete
          ? undefined
          : 'Hesabınızda kullandığınız e-posta adresini girin.'
      }
    >
      {complete ? (
        <div className="auth-completion" role="status">
          <p>
            Hesap uygunsa şifre yenileme bağlantısı e-posta adresine gönderildi.
          </p>
          <Link className="button-link" to={loginPath} viewTransition>
            Giriş sayfasına dön
          </Link>
        </div>
      ) : (
        <>
          <form
            className="form-stack"
            onSubmit={handleSubmit(submit)}
            noValidate
          >
            <FormField
              label="E-posta"
              error={errors.email?.message}
              input={
                <input
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                />
              }
            />
            <FormError message={formError} />
            <button
              className="primary-button auth-submit"
              disabled={isSubmitting}
              type="submit"
            >
              <span>
                {isSubmitting ? 'Gönderiliyor…' : 'Yenileme bağlantısı gönder'}
              </span>
              {!isSubmitting && (
                <span className="auth-arrow" aria-hidden="true" />
              )}
            </button>
          </form>
          <p className="auth-back-link">
            <Link to={loginPath} viewTransition>
              <span className="auth-arrow back" aria-hidden="true" />
              Giriş sayfasına dön
            </Link>
          </p>
        </>
      )}
    </AuthFrame>
  )
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  })

  async function submit({ token, newPassword }: ResetPasswordForm) {
    setFormError(undefined)
    try {
      await resetPassword(token, newPassword)
      setComplete(true)
    } catch (error) {
      setFormError(applyFieldErrors(error, setError, ['token', 'newPassword']))
    }
  }

  return (
    <AuthFrame
      title="Yeni şifrenizi belirleyin"
      subtitle={
        complete
          ? undefined
          : 'Yeni şifreniz kaydedildiğinde açık oturumlarınız güvenli biçimde kapatılır.'
      }
    >
      {complete ? (
        <div className="auth-completion" role="status">
          <p>
            Şifreniz yenilendi. Açık oturumlarınız güvenli biçimde kapatıldı.
          </p>
          <div className="auth-completion-actions">
            <Link className="button-link" to="/parent/login" viewTransition>
              Veli girişi
            </Link>
            <Link
              className="secondary-button"
              to="/operator/login"
              viewTransition
            >
              İşletmeci veya yönetici girişi
            </Link>
          </div>
        </div>
      ) : (
        <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
          <FormField
            label="Şifre yenileme kodu"
            hint="E-postadaki bağlantı bu alanı otomatik doldurur."
            error={errors.token?.message}
            input={
              <input autoComplete="one-time-code" {...register('token')} />
            }
          />
          <FormField
            label="Yeni şifre"
            hint="12–64 karakter; boşluk kullanabilirsiniz."
            error={errors.newPassword?.message}
            endAction={
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
              />
            }
            input={
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('newPassword')}
              />
            }
          />
          <FormError message={formError} />
          <button
            className="primary-button auth-submit"
            disabled={isSubmitting}
            type="submit"
          >
            <span>{isSubmitting ? 'Kaydediliyor…' : 'Şifreyi yenile'}</span>
            {!isSubmitting && (
              <span className="auth-arrow" aria-hidden="true" />
            )}
          </button>
        </form>
      )}
    </AuthFrame>
  )
}

export function LoginPage() {
  return <LoginScreen parentOnly={false} />
}

export function ParentLoginPage() {
  return <LoginScreen parentOnly />
}

function LoginScreen({ parentOnly }: { parentOnly: boolean }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string>()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  async function submit(values: LoginForm) {
    setFormError(undefined)
    try {
      const user = await login(values)
      if (parentOnly && user.role !== 'PARENT') {
        try {
          await logout()
          setFormError(
            'Bu giriş yalnızca veli hesapları içindir. İşletmeci veya yönetici girişini kullanın.',
          )
        } catch {
          setFormError(
            'Bu hesap veli hesabı değil ve açılan oturum güvenli biçimde kapatılamadı. Sayfayı yenileyip tekrar deneyin.',
          )
        }
        return
      }
      if (user.role === 'PARENT') {
        const next = searchParams.get('next')
        const destination = parentDestination(next)
        void navigate(destination, {
          replace: true,
          viewTransition: typeof document.startViewTransition === 'function',
        })
        return
      }
      if (user.role === 'ADMIN') {
        void navigate('/admin', {
          replace: true,
          viewTransition: typeof document.startViewTransition === 'function',
        })
        return
      }
      const next = searchParams.get('next')
      const destination =
        next === '/operator' || next?.startsWith('/operator/')
          ? next
          : isDemandResponsePath(next)
            ? next
            : '/operator'
      void navigate(destination, {
        replace: true,
        viewTransition: typeof document.startViewTransition === 'function',
      })
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? applyFieldErrors(error, setError, loginFields)
          : 'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    }
  }

  const content = (
    <>
      {searchParams.get('registered') === 'parent' && (
        <div className="status-banner success" role="status">
          Devam etmek için veli hesabınızla giriş yapın.
        </div>
      )}
      {searchParams.get('reason') === 'session' && (
        <div className="status-banner warning" role="status">
          Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.
        </div>
      )}
      <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
        <FormField
          label="E-posta"
          error={errors.email?.message}
          input={
            <input type="email" autoComplete="email" {...register('email')} />
          }
        />
        <FormField
          label="Şifre"
          error={errors.password?.message}
          endAction={
            <PasswordVisibilityButton
              visible={showPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
          }
          input={
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
            />
          }
        />
        <div className="auth-password-actions">
          <Link
            to={`/forgot-password?from=${parentOnly ? 'parent' : 'operator'}`}
            viewTransition
          >
            Şifremi unuttum
          </Link>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" {...register('rememberMe')} />
          <strong>Beni hatırla</strong>
        </label>
        <FormError message={formError} />
        <button
          className="primary-button auth-submit"
          disabled={isSubmitting}
          type="submit"
        >
          <span>{isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}</span>
          {!isSubmitting && <span className="auth-arrow" aria-hidden="true" />}
        </button>
      </form>
      <div className={parentOnly ? 'auth-context-link' : 'auth-switch'}>
        {parentOnly ? (
          <>
            <span>Hesabınız yok mu?</span>
            <Link
              to={`/parent/register?next=${encodeURIComponent(parentDestination(searchParams.get('next')))}`}
              viewTransition
            >
              Veli hesabı oluşturun
            </Link>
          </>
        ) : isDemandResponsePath(searchParams.get('next')) ? (
          <>
            İşletmeci hesabınız yoksa{' '}
            <Link to="/operator/register" viewTransition>
              kayıt olun
            </Link>
            .
          </>
        ) : isDemandPath(searchParams.get('next')) ? (
          <>
            Veli hesabınız yoksa{' '}
            <Link
              to={`/parent/register?next=${encodeURIComponent(demandDestination(searchParams.get('next')))}`}
              viewTransition
            >
              veli hesabı oluşturun
            </Link>
            .
          </>
        ) : (
          <>
            Hesabınız yok mu?{' '}
            <Link to="/register" viewTransition>
              Kayıt olun
            </Link>
          </>
        )}
      </div>
      {parentOnly && (
        <div className="auth-context-link">
          <span>İşletmeci veya yönetici misiniz?</span>
          <Link to="/operator/login" viewTransition>
            İşletmeci girişi
          </Link>
        </div>
      )}
    </>
  )

  return parentOnly ? (
    <AuthFrame
      title="Yeniden hoş geldiniz."
      subtitle="Servis taleplerinizi ve bildirimlerinizi yönetmek için giriş yapın."
    >
      {content}
    </AuthFrame>
  ) : (
    <AuthFrame
      title="İşletmeci paneline giriş"
      subtitle="Profilinizi, okul kapsamınızı ve bildirimlerinizi yönetin."
    >
      {content}
    </AuthFrame>
  )
}

function isDemandPath(path: string | null): path is string {
  return Boolean(
    path &&
    (path === '/demands' ||
      path.startsWith('/demands?') ||
      path.startsWith('/demands/')),
  )
}

function demandDestination(path: string | null): string {
  return isDemandPath(path) ? path : '/demands'
}

function parentDestination(path: string | null): string {
  if (path === '/notifications' || path?.startsWith('/notifications?')) {
    return path
  }
  if (!isDemandPath(path)) return '/demands'

  try {
    const url = new URL(path, window.location.origin)
    const action = url.searchParams.get('action')
    return isDemandPath(url.pathname) &&
      (action === null || action === 'support' || action === 'comment')
      ? path
      : '/demands'
  } catch {
    return '/demands'
  }
}

function isDemandResponsePath(path: string | null): path is string {
  if (!isDemandPath(path)) return false
  const url = new URL(path, window.location.origin)
  return url.searchParams.get('action') === 'response'
}

const registrationFields = [
  'email',
  'password',
  'businessName',
  'contactPhone',
] as const
const parentRegistrationFields = ['email', 'password'] as const
const loginFields = ['email', 'password', 'rememberMe'] as const

function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string {
  if (!(error instanceof ApiError)) {
    return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
  }

  const allowed = new Set<string>(fields)
  for (const [field, message] of Object.entries(
    error.problem.fieldErrors ?? {},
  )) {
    if (allowed.has(field)) {
      setError(field as Path<T>, { type: 'server', message })
    }
  }
  return error.problem.detail
}

function FormField({
  label,
  hint,
  error,
  endAction,
  input,
}: {
  label: string
  hint?: string
  error?: string
  endAction?: ReactNode
  input: ReactElement<InputHTMLAttributes<HTMLInputElement>>
}) {
  const id = `field-${label.toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}`
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      <div className="auth-input-wrap">
        {cloneElement(input, {
          id,
          'aria-invalid': Boolean(error),
          'aria-describedby': describedBy || undefined,
        })}
        {endAction}
      </div>
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  )
}

function FormError({ message }: { message?: string }) {
  return message ? (
    <div className="form-error" role="alert">
      {message}
    </div>
  ) : null
}

function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean
  onToggle: () => void
}) {
  return (
    <button
      aria-label={visible ? 'Parolayı gizle' : 'Parolayı göster'}
      aria-pressed={visible}
      className="auth-field-action"
      onClick={onToggle}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.75" />
        {visible && <path d="m4 4 16 16" />}
      </svg>
    </button>
  )
}
