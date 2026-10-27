import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ServiceResponseValues } from './demand-api'

const responseSchema = z
  .object({
    offersMorning: z.boolean(),
    offersAfternoon: z.boolean(),
  })
  .refine((value) => value.offersMorning || value.offersAfternoon, {
    message: 'En az bir servis yönü seçin.',
    path: ['offersMorning'],
  })

interface DemandServiceResponseFormProps {
  initialValues?: ServiceResponseValues
  onCancel(): void
  onSubmit(values: ServiceResponseValues): Promise<void>
}

export function DemandServiceResponseForm({
  initialValues,
  onCancel,
  onSubmit,
}: DemandServiceResponseFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceResponseValues>({
    resolver: zodResolver(responseSchema),
    defaultValues: initialValues ?? {
      offersMorning: true,
      offersAfternoon: false,
    },
  })

  return (
    <form
      className="demand-service-response-form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <fieldset>
        <legend>Hangi yönlerde servis sunuyorsunuz?</legend>
        <p className="fieldset-help">
          Paylaştığınız bilgiler kesin fiyat veya boş yer garantisi değildir.
        </p>
        <div className="demand-choice-grid">
          <label className="checkbox-row">
            <input type="checkbox" {...register('offersMorning')} />
            <span>
              <strong>Sabah</strong>
              <small>Mahalleden okula</small>
            </span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" {...register('offersAfternoon')} />
            <span>
              <strong>Öğleden sonra</strong>
              <small>Okuldan mahalleye</small>
            </span>
          </label>
        </div>
        {errors.offersMorning?.message && (
          <span className="field-error" role="alert">
            {errors.offersMorning.message}
          </span>
        )}
      </fieldset>
      <div className="button-row">
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Yayınlanıyor…' : 'Servis bildirimini yayınla'}
        </button>
        <button
          className="secondary-button"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Vazgeç
        </button>
      </div>
    </form>
  )
}
