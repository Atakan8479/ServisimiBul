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
  emailChangeAvailable: z.boolean().optional(),
  accountDeactivationAvailable: z.boolean().optional(),
  dataRightsRequestsAvailable: z.boolean().optional(),
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

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiRequest('/auth/change-password', {
    method: 'POST',
    json: { currentPassword, newPassword },
    requiresSession: true,
  })
  resetCsrfToken()
  clearKnownAuthRole()
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
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      requiresSession: true,
    })
  } catch (error) {
    if (error instanceof ApiError && error.sessionExpired) {
      clearKnownAuthRole()
    }
    throw error
  }
  resetCsrfToken()
  clearKnownAuthRole()
}

export async function logoutAllDevices(): Promise<void> {
  await apiRequest('/auth/logout-all', {
    method: 'POST',
    requiresSession: true,
  })
  resetCsrfToken()
  clearKnownAuthRole()
}

export async function deactivateAccount(): Promise<void> {
  await apiRequest('/auth/deactivate', {
    method: 'POST',
    requiresSession: true,
  })
  resetCsrfToken()
  clearKnownAuthRole()
}

export function requestEmailChange(email: string): Promise<void> {
  return apiRequest('/auth/email-change', {
    method: 'POST',
    json: { email },
    requiresSession: true,
  })
}

export async function confirmEmailChange(token: string): Promise<void> {
  await apiRequest('/auth/email-change/confirm', {
    method: 'POST',
    json: { token },
  })
  resetCsrfToken()
  clearKnownAuthRole()
}

let authGeneration = 0
let authCheck: { generation: number; promise: Promise<void> } | undefined

/**
 * Re-reads the server session for navigation display only (never authorization).
 * Concurrent calls share one request; a result is dropped when login/logout
 * changed the cached role while it was in flight. 401 means guest; other
 * failures reject and leave the cached role untouched.
 */
export function refreshAuthRole(): Promise<void> {
  if (authCheck?.generation === authGeneration) return authCheck.promise
  const generation = authGeneration
  const promise = apiRequest('/auth/me', {
    requiresSession: true,
    schema: authUserSchema,
  })
    .then(
      (user) => {
        if (generation === authGeneration) setKnownAuthRole(user.role)
      },
      (error: unknown) => {
        if (generation !== authGeneration) return
        if (error instanceof ApiError && error.problem.status === 401) {
          clearKnownAuthRole()
          return
        }
        throw error
      },
    )
    .finally(() => {
      if (authCheck?.promise === promise) authCheck = undefined
    })
  authCheck = { generation, promise }
  return promise
}

export function knownAuthRole(): AuthRole | undefined {
  const role = window.sessionStorage.getItem(AUTH_ROLE_KEY)
  return role === 'ADMIN' || role === 'OPERATOR' || role === 'PARENT'
    ? role
    : undefined
}

export function clearKnownAuthRole(): void {
  authGeneration += 1
  window.sessionStorage.removeItem(AUTH_ROLE_KEY)
  window.dispatchEvent(new Event(AUTH_ROLE_CHANGED_EVENT))
}

function setKnownAuthRole(role: AuthRole): void {
  authGeneration += 1
  window.sessionStorage.setItem(AUTH_ROLE_KEY, role)
  window.dispatchEvent(new Event(AUTH_ROLE_CHANGED_EVENT))
}
