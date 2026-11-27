import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(12, 'Şifre en az 12 karakter olmalıdır.')
  .max(64, 'Şifre en fazla 64 karakter olabilir.')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Şifre 72 baytı aşamaz. Türkçe harfler ve emojiler daha fazla yer kaplar; şifreyi kısaltın.',
  )
