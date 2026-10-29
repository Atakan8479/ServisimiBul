import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useRouteLoaderData } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../api/client'
import { StatusBadge } from '../../components/design-system'
import type { AuthUser } from '../auth/auth-api'
import {
  getProfile,
  resubmitApplication,
  submitApplication,
  updateProfile,
  type ApprovalStatus,
  type OperatorProfile,
} from './operator-api'

const profileFormSchema = z.object({
  businessName: z
    .string()
    .trim()
    .max(120, 'İşletme adı en fazla 120 karakter olabilir.')
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      'İşletme adı en az 2 karakter olmalıdır.',
    ),
  contactPhone: z.string().trim().min(1, 'İletişim telefonu zorunludur.'),
  description: z.string(),
  publiclyVisible: z.boolean(),
})

type ProfileForm = z.infer<typeof profileFormSchema>

const statusContent: Record<
  ApprovalStatus,
  { label: string; detail: string; tone: string }
> = {
  DRAFT: {
    label: 'Taslak',
    detail: 'Bilgilerinizi tamamlayıp incelemeye gönderebilirsiniz.',
    tone: 'neutral',
  },
  PENDING: {
    label: 'İncelemede',
    detail: 'Başvurunuz yönetici incelemesini bekliyor.',
    tone: 'pending',
  },
  CHANGES_REQUESTED: {
    label: 'Düzeltme istendi',
    detail: 'Profil bilgilerinizi güncelledikten sonra yeniden gönderin.',
    tone: 'warning',
  },
  APPROVED: {
    label: 'Onaylandı',
    detail:
      'Geçerli görünürlük koşulları sağlandığında profiliniz bulunabilir.',
    tone: 'success',
  },
}

export function OperatorProfilePage() {
  const navigate = useNavigate()
  const user = useRouteLoaderData('operator') as AuthUser
  const [profile, setProfile] = useState<OperatorProfile>()
  const [loadError, setLoadError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [actionPending, setActionPending] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      businessName: '',
      contactPhone: '',
      description: '',
      publiclyVisible: true,
    },
  })

  useEffect(() => {
    let active = true
    void getProfile()
      .then((result) => {
        if (!active) return
        setProfile(result)
        reset(toForm(result))
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.sessionExpired) {
          void navigate('/operator/login?reason=session', { replace: true })
          return
        }
        setLoadError(messageFor(error))
      })
    return () => {
      active = false
    }
  }, [navigate, reset])

  async function save(values: ProfileForm) {
    setLoadError(undefined)
    setNotice(undefined)
    try {
      const updated = await updateProfile({
        ...values,
        description: values.description.trim() || null,
      })
      setProfile(updated)
      reset(toForm(updated))
      setNotice('Profil bilgileriniz kaydedildi.')
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        void navigate('/operator/login?reason=session', { replace: true })
        return
      }
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(
          error.problem.fieldErrors ?? {},
        )) {
          if (
            field === 'businessName' ||
            field === 'contactPhone' ||
            field === 'description' ||
            field === 'publiclyVisible'
          ) {
            setError(field, { type: 'server', message })
          }
        }
      }
      setLoadError(messageFor(error))
    }
  }

  async function moveApplication() {
    if (!profile) return
    setActionPending(true)
    setLoadError(undefined)
    setNotice(undefined)
    try {
      const updated =
        profile.approvalStatus === 'CHANGES_REQUESTED'
          ? await resubmitApplication()
          : await submitApplication()
      setProfile(updated)
      reset(toForm(updated))
      setNotice('Başvurunuz incelemeye gönderildi.')
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        void navigate('/operator/login?reason=session', { replace: true })
        return
      }
      setLoadError(messageFor(error))
    } finally {
      setActionPending(false)
    }
  }

  if (!profile && !loadError) {
    return <PageLoading label="Profil yükleniyor" />
  }

  const profileEditable =
    !user.operatorApprovalRequired || profile?.approvalStatus !== 'PENDING'

  return (
    <section className="workspace-page operator-workspace-page operator-profile-page">
      <header className="operator-page-header">
        <h1>İşletme bilgileriniz</h1>
        <p>
          Velilerin göreceği iletişim ve profil bilgilerini güncel tutun.
          {user.operatorApprovalRequired && (
            <> İletişim telefonu onaydan sonra velilere gösterilir.</>
          )}
        </p>
      </header>

      {profile && user.operatorApprovalRequired && (
        <div
          className={`status-banner operator-profile-status ${statusContent[profile.approvalStatus].tone}`}
          role="status"
        >
          <StatusBadge
            tone={
              profile.approvalStatus === 'APPROVED'
                ? 'success'
                : profile.approvalStatus === 'CHANGES_REQUESTED'
                  ? 'warning'
                  : profile.approvalStatus === 'PENDING'
                    ? 'info'
                    : 'neutral'
            }
          >
            {statusContent[profile.approvalStatus].label}
          </StatusBadge>
          <span>{statusContent[profile.approvalStatus].detail}</span>
        </div>
      )}
      {profile && !user.operatorApprovalRequired && (
        <div className="status-banner success" role="status">
          <strong>Yönetici onayı gerekmiyor</strong>
        </div>
      )}
      {loadError && (
        <div className="form-error" role="alert">
          {loadError}
        </div>
      )}
      {notice && (
        <div
          className="status-banner operator-action-notice success"
          role="status"
        >
          {notice}
        </div>
      )}

      {profile && (
        <form
          className="form-card form-stack operator-profile-form"
          onSubmit={handleSubmit(save)}
          noValidate
        >
          <label className="form-field">
            <span>İşletme adı (isteğe bağlı)</span>
            <input
              aria-invalid={Boolean(errors.businessName)}
              autoComplete="organization"
              disabled={!profileEditable}
              {...register('businessName')}
            />
            {errors.businessName && (
              <small className="field-error">
                {errors.businessName.message}
              </small>
            )}
          </label>
          <label className="form-field">
            <span>Herkese açık iletişim telefonu</span>

            <input
              aria-invalid={Boolean(errors.contactPhone)}
              autoComplete="tel"
              disabled={!profileEditable}
              type="tel"
              {...register('contactPhone')}
            />
            {errors.contactPhone && (
              <small className="field-error">
                {errors.contactPhone.message}
              </small>
            )}
          </label>
          <label className="form-field">
            <span>Kısa açıklama</span>
            <textarea
              disabled={!profileEditable}
              rows={5}
              {...register('description')}
            />
          </label>
          <label className="checkbox-row visibility-control">
            <input
              disabled={!profileEditable}
              type="checkbox"
              {...register('publiclyVisible')}
            />
            <span>
              <strong>Profilimi velilere göster</strong>
              <small>
                Bu ayarı kapatırsanız profiliniz aramalarda görünmez.
              </small>
            </span>
          </label>
          <div className="button-row">
            {profileEditable && (
              <button
                className="primary-button"
                disabled={isSubmitting || !isDirty}
                type="submit"
              >
                {isSubmitting ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
              </button>
            )}
            {user.operatorApprovalRequired &&
              (profile.approvalStatus === 'DRAFT' ||
                profile.approvalStatus === 'CHANGES_REQUESTED') && (
                <button
                  className="secondary-button"
                  disabled={actionPending || isDirty}
                  onClick={moveApplication}
                  type="button"
                >
                  {actionPending
                    ? 'Gönderiliyor…'
                    : profile.approvalStatus === 'DRAFT'
                      ? 'Başvuruyu gönder'
                      : 'Yeniden gönder'}
                </button>
              )}
          </div>
          {user.operatorApprovalRequired &&
            isDirty &&
            (profile.approvalStatus === 'DRAFT' ||
              profile.approvalStatus === 'CHANGES_REQUESTED') && (
              <small>Başvuruyu göndermeden önce değişiklikleri kaydedin.</small>
            )}
          {user.operatorApprovalRequired && !profileEditable && (
            <small>
              İnceleme tamamlanana kadar başvuru bilgileri salt okunurdur.
            </small>
          )}
        </form>
      )}
    </section>
  )
}

function toForm(profile: OperatorProfile): ProfileForm {
  return {
    businessName: profile.businessName ?? '',
    contactPhone: profile.contactPhone,
    description: profile.description ?? '',
    publiclyVisible: profile.publiclyVisible,
  }
}

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.problem.detail
    : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
}

function PageLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" aria-busy="true" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}
