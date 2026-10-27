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
  login,
  logout,
  registerOperator,
  registerParent,
  verifyEmail,
} from './auth-api'

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

type RegistrationForm = z.infer<typeof registrationSchema>
type ParentRegistrationForm = z.infer<typeof parentRegistrationSchema>
type LoginForm = z.infer<typeof loginSchema>
type VerificationForm = z.infer<typeof verificationSchema>

export function RegisterPage() {
  const emailVerificationRequired =
    import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED !== 'false'
  const [complete, setComplete] = useState(false)
  const [formError, setFormError] = useState<string>()
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
      <AuthCard
        eyebrow="Kayıt alındı"
        title={
          emailVerificationRequired
            ? 'E-postanızı kontrol edin'
            : 'Hesabınız hazır'
        }
      >
        <p>
          {emailVerificationRequired ? (
            <>
              Hesap varsa doğrulama bağlantısı gönderildi. Bağlantıyı açtıktan
              sonra giriş yapabilirsiniz.
            </>
          ) : (
            <>Kayıt tamamlandı. Şimdi giriş yapabilirsiniz.</>
          )}
        </p>
        <Link className="button-link" to="/operator/login" viewTransition>
          Giriş sayfasına git
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard eyebrow="İşletmeci kaydı" title="Hesap oluşturun">
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
          input={
            <input
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          }
        />
        <FormField
          label="İşletme adı (isteğe bağlı)"
          error={errors.businessName?.message}
          input={
            <input autoComplete="organization" {...register('businessName')} />
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
                E-posta doğrulamanız tamamlandığında ve hizmet verdiğiniz okul
                ile mahalle bilgilerini eklediğinizde, diğer yayın koşulları da
                sağlanıyorsa işletme profiliniz herkese açık arama sonuçlarında
                görüntülenebilir.
              </>
            ) : (
              <>
                Hizmet verdiğiniz okul ile mahalle bilgilerini eklediğinizde,
                diğer yayın koşulları da sağlanıyorsa işletme profiliniz herkese
                açık arama sonuçlarında görüntülenebilir.
              </>
            )}
          </p>
          <p>
            İletişim telefonunuz ve profilinizde paylaştığınız işletme bilgileri
            ziyaretçiler tarafından görülebilir. Profil görünürlüğünüzü
            işletmeci panelinden istediğiniz zaman kapatabilirsiniz.
          </p>
        </aside>
        <FormError message={formError} />
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Kaydediliyor…' : 'Hesap oluştur'}
        </button>
      </form>
      <p className="auth-switch">
        Zaten hesabınız var mı?{' '}
        <Link to="/operator/login" viewTransition>
          Giriş yapın
        </Link>
      </p>
      <p className="auth-switch">
        Veli misiniz?{' '}
        <Link to="/parent/register" viewTransition>
          Veli hesabı oluşturun
        </Link>
      </p>
    </AuthCard>
  )
}

export function ParentSignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string>()
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
          'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
        )
        return
      }
      setFormError(applyFieldErrors(error, setError, parentRegistrationFields))
    }
  }

  return (
    <AuthCard eyebrow="Veli kaydı" title="Veli hesabı oluşturun">
      <p>
        Veli e-posta doğrulaması pilot ortamında açıkça kapatıldığında doğrulama
        e-postası gerekmez ve hesabınız hemen girişe açılır. E-posta adresiniz
        doğrulanmış sayılmaz.
      </p>
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
          input={
            <input
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          }
        />
        <FormError message={formError} />
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Kaydediliyor…' : 'Veli hesabı oluştur'}
        </button>
      </form>
      <p className="auth-switch">
        Zaten hesabınız var mı?{' '}
        <Link
          to={`/parent/login?next=${encodeURIComponent(parentDestination(searchParams.get('next')))}`}
          viewTransition
        >
          Giriş yapın
        </Link>
      </p>
      <p className="auth-switch">
        <Link to="/register" viewTransition>
          Hesap türüne geri dön
        </Link>
      </p>
    </AuthCard>
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
    <AuthCard eyebrow="E-posta doğrulama" title="Hesabınızı doğrulayın">
      {complete ? (
        <>
          <p>
            E-posta adresiniz doğrulandı. Artık güvenli şekilde giriş
            yapabilirsiniz.
          </p>
          <Link className="button-link" to="/operator/login" viewTransition>
            Giriş yap
          </Link>
        </>
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
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Doğrulanıyor…' : 'E-postayı doğrula'}
          </button>
        </form>
      )}
    </AuthCard>
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
          : 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    }
  }

  return (
    <AuthCard
      eyebrow={parentOnly ? 'Veli girişi' : 'Giriş'}
      title={parentOnly ? 'Veli hesabınıza giriş yapın' : 'Hoş geldiniz'}
    >
      {searchParams.get('registered') === 'parent' && (
        <div className="status-banner success" role="status">
          Kayıt isteğiniz alındı. Devam etmek için veli hesabınızla giriş yapın.
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
          input={
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
            />
          }
        />
        <button
          aria-pressed={showPassword}
          className="text-button"
          onClick={() => setShowPassword((visible) => !visible)}
          type="button"
        >
          {showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
        </button>
        <label className="checkbox-row">
          <input type="checkbox" {...register('rememberMe')} />
          <strong>Beni hatırla</strong>
        </label>
        <FormError message={formError} />
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
      <p className="auth-switch">
        {parentOnly ? (
          <>
            Hesabınız yok mu?{' '}
            <Link
              to={`/parent/register?next=${encodeURIComponent(parentDestination(searchParams.get('next')))}`}
              viewTransition
            >
              Veli hesabı oluşturun
            </Link>
          </>
        ) : isDemandResponsePath(searchParams.get('next')) ? (
          <>
            Servis bildirimi yayınlamak için işletmeci hesabınızla giriş yapın.
            Hesabınız yoksa{' '}
            <Link to="/operator/register" viewTransition>
              kayıt olun
            </Link>
            .
          </>
        ) : isDemandPath(searchParams.get('next')) ? (
          <>
            Servis talebi oluşturmak için veli hesabınızla giriş yapın. Yeni
            hesabınız yoksa{' '}
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
      </p>
      {parentOnly && (
        <p className="auth-switch">
          İşletmeci veya yönetici misiniz?{' '}
          <Link to="/operator/login" viewTransition>
            İşletmeci girişi
          </Link>
        </p>
      )}
    </AuthCard>
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
  return path === '/notifications' ||
    path?.startsWith('/notifications?') ||
    isDemandPath(path)
    ? path
    : '/demands'
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

function AuthCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="auth-card">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </section>
  )
}

function FormField({
  label,
  hint,
  error,
  input,
}: {
  label: string
  hint?: string
  error?: string
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
      {cloneElement(input, {
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}
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
