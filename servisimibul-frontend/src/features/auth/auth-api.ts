import { z } from 'zod'
import { apiRequest, resetCsrfToken } from '../../api/client'

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'OPERATOR']),
})

export type AuthUser = z.infer<typeof authUserSchema>

export interface RegisterOperatorRequest {
  email: string
  password: string
  businessName: string
  contactPhone: string
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe: boolean
}

export function registerOperator(request: RegisterOperatorRequest) {
  return apiRequest('/auth/register', { method: 'POST', json: request })
}

export function verifyEmail(token: string) {
  return apiRequest('/auth/verify-email', {
    method: 'POST',
    json: { token },
  })
}

export async function login(request: LoginRequest): Promise<AuthUser> {
  const user = await apiRequest('/auth/login', {
    method: 'POST',
    json: request,
    schema: authUserSchema,
  })
  resetCsrfToken()
  return user
}

export function currentUser(): Promise<AuthUser> {
  return apiRequest('/auth/me', {
    requiresSession: true,
    schema: authUserSchema,
  })
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
    requiresSession: true,
  })
  resetCsrfToken()
}
