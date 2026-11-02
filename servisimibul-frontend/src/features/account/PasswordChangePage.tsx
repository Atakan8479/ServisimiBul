import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLoaderData, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../api/client'
import {
  Button,
  FormField,
  StatusBadge,
  SurfaceCard,
} from '../../components/design-system'
import {
  changePassword,
  clearKnownAuthRole,
  type AuthUser,
} from '../auth/auth-api'
import { passwordSchema } from '../auth/password-policy'
import './account-settings.css'

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifrenizi girin.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Yeni şifrenizi tekrar girin.'),
  })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, context) => {
    if (newPassword === currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Yeni şifre mevcut şifreden farklı olmalıdır.',
      })
    }
    if (confirmPassword !== newPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Yeni şifreler eşleşmiyor.',
      })
    }
  })

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>

export function PasswordChangePage() {
  const user = useLoaderData() as AuthUser
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string>()
  const isOperator = user.role === 'OPERATOR'
  const accountPath = isOperator ? '/operator/account' : '/parent/account'
  const loginPath = isOperator ? '/operator/login' : '/parent/login'
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function submit({ currentPassword, newPassword }: PasswordChangeForm) {
    setFormError(undefined)
    try {
      await changePassword(currentPassword, newPassword)
      void navigate(`${loginPath}?passwordChanged=true`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        clearKnownAuthRole()
        void navigate(`${loginPath}?reason=session`, { replace: true })
        return
      }
      if (error instanceof ApiError) {
        const fields = Object.keys(error.problem.fieldErrors ?? {})
        for (const field of fields) {
          if (
            field === 'currentPassword' ||
            field === 'newPassword' ||
            field === 'confirmPassword'
          ) {
            setError(field, {
              type: 'server',
              message:
                field === 'currentPassword'
                  ? 'Mevcut şifre doğrulanamadı.'
                  : field === 'newPassword'
                    ? 'Yeni şifre, şifre kurallarına uymuyor.'
                    : 'Yeni şifreler eşleşmiyor.',
            })
          }
        }
        if (fields.length === 0) {
          setFormError(
            error.problem.code === 'RATE_LIMITED'
              ? 'Çok sık denediniz. Biraz sonra tekrar deneyin.'
              : error.problem.detail,
          )
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
          <h1>Şifreyi değiştir</h1>
          <p>Mevcut şifrenizi doğrulayın ve yeni şifrenizi iki kez girin.</p>
        </div>
        <StatusBadge tone="info">
          {isOperator ? 'İşletmeci hesabı' : 'Veli hesabı'}
        </StatusBadge>
      </header>

      <SurfaceCard className="account-password-card">
        {formError && (
          <div className="account-password-error" role="alert">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit(submit)} noValidate>
          <FormField
            error={errors.currentPassword?.message}
            htmlFor="current-password"
            label="Mevcut şifre"
          >
            <input
              autoComplete="current-password"
              type="password"
              {...register('currentPassword')}
            />
          </FormField>
          <FormField
            error={errors.newPassword?.message}
            hint="12–64 karakter; UTF-8 olarak en fazla 72 bayt."
            htmlFor="new-password"
            label="Yeni şifre"
          >
            <input
              autoComplete="new-password"
              type="password"
              {...register('newPassword')}
            />
          </FormField>
          <FormField
            error={errors.confirmPassword?.message}
            htmlFor="confirm-password"
            label="Yeni şifreyi tekrar girin"
          >
            <input
              autoComplete="new-password"
              type="password"
              {...register('confirmPassword')}
            />
          </FormField>
          <p className="account-password-session-note">
            Şifreniz değiştiğinde bu cihaz dahil tüm açık oturumlarınız sona
            erer. Yeni şifrenizle yeniden giriş yapmanız gerekir.
          </p>
          <div className="account-password-actions">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Güncelleniyor…' : 'Şifreyi güncelle'}
            </Button>
            <Link className="ui-button ui-button-secondary" to={accountPath}>
              Vazgeç
            </Link>
          </div>
        </form>
      </SurfaceCard>
    </section>
  )
}
