import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router-dom'
import { AdminLayout, PublicLayout } from '../components/layouts'
import { FoundationPage, HomePage } from '../components/pages'
import { NotFoundPage, RouteErrorPage } from '../components/route-states'
import { ApiError } from '../api/client'
import {
  LoginPage,
  RegisterPage,
  VerifyEmailPage,
} from '../features/auth/AuthPages'
import { currentUser } from '../features/auth/auth-api'
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
      { index: true, Component: HomePage },
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
    path: '/admin',
    Component: AdminLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      {
        index: true,
        element: (
          <FoundationPage
            eyebrow="Yönetim"
            title="Yönetim alanı hazır"
            detail="Pilot okul ve başvuru ekranları sonraki onaylı görevlerde eklenecek."
          />
        ),
      },
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
