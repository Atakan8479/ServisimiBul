import { z } from 'zod'
import { ApiError, apiRequest, resetCsrfToken } from '../../api/client'

const AUTH_ROLE_KEY = 'servisimibul.auth-role'
export const AUTH_ROLE_CHANGED_EVENT = 'servisimibul:auth-role-changed'

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'OPERATOR', 'PARENT']),
  operatorApprovalRequired: z.boolean(),
  approvalStatus: z
    .enum(['DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'APPROVED'])
    .nullable(),
})

export type AuthUser = z.infer<typeof authUserSchema>
export type AuthRole = AuthUser['role']

export interface RegisterOperatorRequest {
  email: string
  password: string
  businessName: string
  contactPhone: string
}

export interface RegisterParentRequest {
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe: boolean
}

export function registerOperator(request: RegisterOperatorRequest) {
  return apiRequest('/auth/register', { method: 'POST', json: request })
}

export function registerParent(request: RegisterParentRequest) {
  return apiRequest('/auth/parent/register', { method: 'POST', json: request })
}

export function verifyEmail(token: string) {
  return apiRequest('/auth/verify-email', {
    method: 'POST',
    json: { token },
  })
}

export function forgotPassword(email: string) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    json: { email },
  })
}

export function resetPassword(token: string, newPassword: string) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    json: { token, newPassword },
  })
}

export async function login(request: LoginRequest): Promise<AuthUser> {
  const user = await apiRequest('/auth/login', {
    method: 'POST',
    json: request,
    schema: authUserSchema,
  })
  resetCsrfToken()
  setKnownAuthRole(user.role)
  return user
}

export async function currentUser(): Promise<AuthUser> {
  try {
    const user = await apiRequest('/auth/me', {
      requiresSession: true,
      schema: authUserSchema,
    })
    setKnownAuthRole(user.role)
    return user
  } catch (error) {
    if (error instanceof ApiError && error.problem.status === 401) {
      clearKnownAuthRole()
    }
    throw error
  }
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
    requiresSession: true,
  })
  resetCsrfToken()
  clearKnownAuthRole()
}

export function knownAuthRole(): AuthRole | undefined {
  const role = window.sessionStorage.getItem(AUTH_ROLE_KEY)
  return role === 'ADMIN' || role === 'OPERATOR' || role === 'PARENT'
    ? role
    : undefined
}

export function clearKnownAuthRole(): void {
  window.sessionStorage.removeItem(AUTH_ROLE_KEY)
  window.dispatchEvent(new Event(AUTH_ROLE_CHANGED_EVENT))
}

function setKnownAuthRole(role: AuthRole): void {
  window.sessionStorage.setItem(AUTH_ROLE_KEY, role)
  window.dispatchEvent(new Event(AUTH_ROLE_CHANGED_EVENT))
}
