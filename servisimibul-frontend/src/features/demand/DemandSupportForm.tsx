import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { supportReasons, type SupportValues } from './demand-api'
import { reasonLabel } from './demand-labels'

const supportFormSchema = z
  .object({
    needsMorning: z.boolean(),
    needsAfternoon: z.boolean(),
    reasons: z.array(z.enum(supportReasons)).min(1, 'En az bir neden seçin.'),
  })
  .refine((values) => values.needsMorning || values.needsAfternoon, {
    message: 'Sabah veya öğleden sonra yönlerinden en az birini seçin.',
    path: ['needsMorning'],
  })

export function DemandSupportForm({
  initialValues,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: SupportValues
  submitLabel: string
  busyLabel: string
  onSubmit: (values: SupportValues) => Promise<void>
  onCancel: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportValues>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: initialValues ?? {
      needsMorning: true,
      needsAfternoon: false,
      reasons: [],
    },
  })

  useEffect(() => {
    reset(
      initialValues ?? {
        needsMorning: true,
        needsAfternoon: false,
        reasons: [],
      },
    )
  }, [initialValues, reset])

  return (
    <form
      className="demand-support-form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <fieldset
        aria-describedby={errors.needsMorning ? 'direction-error' : undefined}
      >
        <legend>Hangi yönde servise ihtiyacınız var?</legend>
        <div className="demand-choice-grid">
          <label className="checkbox-row compact">
            <input type="checkbox" {...register('needsMorning')} />
            <span>
              <strong>Sabah</strong>
              <small>Okula gidiş</small>
            </span>
          </label>
          <label className="checkbox-row compact">
            <input type="checkbox" {...register('needsAfternoon')} />
            <span>
              <strong>Öğleden sonra</strong>
              <small>Okuldan dönüş</small>
            </span>
          </label>
        </div>
        {errors.needsMorning && (
          <small className="field-error" id="direction-error" role="alert">
            {errors.needsMorning.message}
          </small>
        )}
      </fieldset>

      <fieldset aria-describedby={errors.reasons ? 'reason-error' : undefined}>
        <legend>Neden yeni bir servise ihtiyaç duyuyorsunuz?</legend>
        <p className="fieldset-help">
          Birden fazla neden seçebilirsiniz. Bu bilgiler yalnızca toplu sayılar
          halinde gösterilir.
        </p>
        <div className="demand-reason-grid">
          {supportReasons.map((reason) => (
            <label className="checkbox-row compact" key={reason}>
              <input type="checkbox" value={reason} {...register('reasons')} />
              <span>{reasonLabel(reason)}</span>
            </label>
          ))}
        </div>
        {errors.reasons && (
          <small className="field-error" id="reason-error" role="alert">
            {errors.reasons.message}
          </small>
        )}
      </fieldset>

      <div className="button-row">
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? busyLabel : submitLabel}
        </button>
        <button
          className="secondary-button"
          disabled={isSubmitting}
          type="button"
          onClick={onCancel}
        >
          Vazgeç
        </button>
      </div>
    </form>
  )
}
