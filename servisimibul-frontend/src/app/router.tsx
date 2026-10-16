import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router-dom'
import { PublicLayout } from '../components/layouts'
import { NotFoundPage, RouteErrorPage } from '../components/route-states'
import { ApiError } from '../api/client'
import { PublicDiscoveryPage } from '../features/discovery/PublicDiscoveryPage'
import {
  LoginPage,
  RegisterPage,
  VerifyEmailPage,
} from '../features/auth/AuthPages'
import { currentUser } from '../features/auth/auth-api'
import {
  AdminApplicationDetailPage,
  AdminApplicationsPage,
} from '../features/admin/AdminApplicationsPage'
import { AdminSchoolsPage } from '../features/admin/AdminSchoolsPage'
import { AdminWorkspaceLayout } from '../features/admin/AdminWorkspaceLayout'
import { OperatorOverviewPage } from '../features/operator/OperatorOverviewPage'
import { OperatorProfilePage } from '../features/operator/OperatorProfilePage'
import { OperatorSchoolsPage } from '../features/operator/OperatorSchoolsPage'
import { OperatorWorkspaceLayout } from '../features/operator/OperatorWorkspaceLayout'

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: PublicLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: PublicDiscoveryPage },
      { path: 'operator/register', Component: RegisterPage },
      { path: 'operator/verify-email', Component: VerifyEmailPage },
      { path: 'operator/login', Component: LoginPage },
    ],
  },
  {
    id: 'operator',
    path: '/operator',
    loader: operatorLoader,
    Component: OperatorWorkspaceLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: OperatorOverviewPage },
      { path: 'profile', Component: OperatorProfilePage },
      { path: 'schools', Component: OperatorSchoolsPage },
    ],
  },
  {
    id: 'admin',
    path: '/admin',
    loader: adminLoader,
    Component: AdminWorkspaceLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, loader: () => redirect('/admin/applications') },
      { path: 'applications', Component: AdminApplicationsPage },
      {
        path: 'applications/:applicationId',
        Component: AdminApplicationDetailPage,
      },
      { path: 'schools', Component: AdminSchoolsPage },
    ],
  },
  { path: '*', Component: NotFoundPage },
]

export const router = createBrowserRouter(routes)

async function operatorLoader({ request }: LoaderFunctionArgs) {
  try {
    const user = await currentUser()
    if (user.role !== 'OPERATOR') {
      throw new Response('Forbidden', { status: 403 })
    }
    return user
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.problem.status === 401 || error.problem.status === 403)
    ) {
      const url = new URL(request.url)
      const next = `${url.pathname}${url.search}`
      const reason = error.sessionExpired ? '&reason=session' : ''
      throw redirect(
        `/operator/login?next=${encodeURIComponent(next)}${reason}`,
      )
    }
    throw error
  }
}

async function adminLoader({ request }: LoaderFunctionArgs) {
  try {
    const user = await currentUser()
    if (user.role !== 'ADMIN') {
      throw new Response('Forbidden', { status: 403 })
    }
    return user
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.problem.status === 401 || error.problem.status === 403)
    ) {
      const url = new URL(request.url)
      const next = `${url.pathname}${url.search}`
      const reason = error.sessionExpired ? '&reason=session' : ''
      throw redirect(
        `/operator/login?next=${encodeURIComponent(next)}${reason}`,
      )
    }
    throw error
  }
}
