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
import { login, registerOperator, verifyEmail } from './auth-api'

const registrationSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  password: z
    .string()
    .min(12, 'Şifre en az 12 karakter olmalıdır.')
    .max(64, 'Şifre en fazla 64 karakter olabilir.')
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'Şifre UTF-8 olarak en fazla 72 bayt olabilir.',
    ),
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

const loginSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Şifrenizi girin.'),
  rememberMe: z.boolean(),
})

const verificationSchema = z.object({
  token: z.string().trim().min(1, 'Doğrulama kodu zorunludur.'),
})

type RegistrationForm = z.infer<typeof registrationSchema>
type LoginForm = z.infer<typeof loginSchema>
type VerificationForm = z.infer<typeof verificationSchema>

export function RegisterPage() {
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
      <AuthCard eyebrow="Kayıt alındı" title="E-postanızı kontrol edin">
        <p>
          Hesap varsa doğrulama bağlantısı gönderildi. Bağlantıyı açtıktan sonra
          giriş yapabilirsiniz.
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
            E-posta doğrulamanız tamamlandığında ve hizmet verdiğiniz okul ile
            mahalle bilgilerini eklediğinizde, diğer yayın koşulları da
            sağlanıyorsa işletme profiliniz herkese açık arama sonuçlarında
            görüntülenebilir.
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string>()
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
      if (user.role !== 'OPERATOR') {
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
          : '/operator'
      void navigate(destination, {
        replace: true,
        viewTransition: typeof document.startViewTransition === 'function',
      })
    } catch (error) {
      setFormError(applyFieldErrors(error, setError, loginFields))
    }
  }

  return (
    <AuthCard eyebrow="Giriş" title="Hoş geldiniz">
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
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
          }
        />
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
        Hesabınız yok mu?{' '}
        <Link to="/operator/register" viewTransition>
          Kayıt olun
        </Link>
      </p>
    </AuthCard>
  )
}

const registrationFields = [
  'email',
  'password',
  'businessName',
  'contactPhone',
] as const
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
