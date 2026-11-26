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
  registerOperator,
  registerParent,
  resetPassword,
  verifyEmail,
} from './auth-api'
import {
  demandDestination,
  isCanonicalPathUnder,
  isDemandCommentPath,
  isDemandPath,
  isDemandResponsePath,
  operatorDemandDestination,
  operatorDestination,
  parentDestination,
} from './auth-redirects'
import { AuthFrame } from './AuthFrame'
import { passwordSchema } from './password-policy'
import './auth-ui.css'

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
  const [searchParams] = useSearchParams()
  const emailVerificationRequired =
    import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED !== 'false'
  const next = operatorDemandDestination(searchParams.get('next'))
  const operatorLoginPath = next
    ? `/operator/login?next=${encodeURIComponent(next)}`
    : '/operator/login'
  const verificationPath = next
    ? `/operator/verify-email?next=${encodeURIComponent(next)}`
    : '/operator/verify-email'
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
            : 'İşlem tamamlandı'
        }
      >
        {/* Duplicate emails get the same 202 response; never confirm an account exists. */}
        <div className="auth-completion" role="status">
          <p>
            {emailVerificationRequired
              ? 'Doğrulama e-postası geldiyse bağlantıyı açın. Hesabınız zaten varsa giriş yapın.'
              : 'Hesabınız varsa giriş yapın.'}
          </p>
          <Link className="button-link" to={operatorLoginPath} viewTransition>
            İşletmeci girişine git
          </Link>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="İşletmeci hesabı oluşturun">
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
            Profil görünürlüğü
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
        <Link to={operatorLoginPath} viewTransition>
          İşletmeci girişi
        </Link>
      </div>
      {emailVerificationRequired && (
        <div className="auth-context-link">
          <span>Doğrulama bağlantınız var mı?</span>
          <Link to={verificationPath} viewTransition>
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
          'Çok fazla kayıt denemesi yapıldı. Daha sonra tekrar deneyin.',
        )
        return
      }
      if (error instanceof ApiError && error.problem.status === 503) {
        setFormError(
          'Veli kaydı şu anda kullanılamıyor. Daha sonra tekrar deneyin.',
        )
        return
      }
      if (!(error instanceof ApiError)) {
        setFormError('Bağlantı kurulamadı. Tekrar deneyin.')
        return
      }
      setFormError(applyFieldErrors(error, setError, parentRegistrationFields))
    }
  }

  return (
    <AuthFrame title="Veli hesabı oluşturun">
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
  const next = operatorDemandDestination(searchParams.get('next'))
  const operatorLoginPath = next
    ? `/operator/login?next=${encodeURIComponent(next)}`
    : '/operator/login'
  const registrationPath = next
    ? `/operator/register?next=${encodeURIComponent(next)}`
    : '/operator/register'
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
      subtitle="E-postanızdaki doğrulama bağlantısını açın."
    >
      {complete ? (
        <div className="auth-completion" role="status">
          <p>E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.</p>
          <Link className="button-link" to={operatorLoginPath} viewTransition>
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
          <Link to={registrationPath} viewTransition>
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
            Bu adresle bir hesap varsa şifre yenileme bağlantısı gönderildi.
          </p>
          <Link className="button-link" to="/login" viewTransition>
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
            <Link to="/login" viewTransition>
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
          : 'Şifreniz değişince açık oturumlarınız kapatılır.'
      }
    >
      {complete ? (
        <div className="auth-completion" role="status">
          <p>Şifreniz yenilendi. Açık oturumlarınız kapatıldı.</p>
          <Link className="button-link" to="/login" viewTransition>
            Giriş yap
          </Link>
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

// One login for every role; the server-confirmed role picks the destination (#276).
export function LoginPage() {
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
        const next = searchParams.get('next')
        void navigate(isCanonicalPathUnder(next, '/admin') ? next : '/admin', {
          replace: true,
          viewTransition: typeof document.startViewTransition === 'function',
        })
        return
      }
      void navigate(operatorDestination(searchParams.get('next')), {
        replace: true,
        viewTransition: typeof document.startViewTransition === 'function',
      })
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? applyFieldErrors(error, setError, loginFields)
          : 'Bağlantı kurulamadı. Tekrar deneyin.',
      )
    }
  }

  const content = (
    <>
      {searchParams.get('registered') === 'parent' && (
        <div className="status-banner success" role="status">
          İşlem tamamlandı. Hesabınız varsa giriş yapın.
        </div>
      )}
      {searchParams.get('reason') === 'session' && (
        <div className="status-banner warning" role="status">
          Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın.
        </div>
      )}
      {searchParams.get('passwordChanged') === 'true' && (
        <div className="status-banner success" role="status">
          Şifreniz güncellendi ve açık oturumlarınız kapatıldı. Yeni şifrenizle
          giriş yapın.
        </div>
      )}
      {searchParams.get('accountDeactivated') === 'true' && (
        <div className="status-banner success" role="status">
          Hesabınız devre dışı bırakıldı ve açık oturumlarınız sonlandırıldı.
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
          <Link to="/forgot-password" viewTransition>
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
      <div className="auth-switch">
        {isDemandResponsePath(searchParams.get('next')) ? (
          <>
            İşletmeci hesabınız yoksa{' '}
            <Link
              to={`/operator/register?next=${encodeURIComponent(operatorDestination(searchParams.get('next')))}`}
              viewTransition
            >
              kayıt olun
            </Link>
            .
          </>
        ) : isDemandCommentPath(searchParams.get('next')) ? (
          // Parents and operators can both comment, so offer the role choice.
          <>
            Hesabınız yok mu?{' '}
            <Link
              to={`/register?next=${encodeURIComponent(parentDestination(searchParams.get('next')))}`}
              viewTransition
            >
              Kayıt olun
            </Link>
          </>
        ) : isDemandPath(searchParams.get('next')) ? (
          <>
            Veli hesabınız yoksa{' '}
            <Link
              to={`/parent/register?next=${encodeURIComponent(parentDestination(searchParams.get('next')))}`}
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
    </>
  )

  return <AuthFrame title="Giriş yap">{content}</AuthFrame>
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
    return 'İşlem tamamlanamadı. Tekrar deneyin.'
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
