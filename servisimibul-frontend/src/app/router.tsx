import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router-dom'
import { PublicLayout } from '../components/layouts'
import {
  LoadingPage,
  NotFoundPage,
  RouteErrorPage,
} from '../components/route-states'
import { ApiError } from '../api/client'
import { PublicDiscoveryPage } from '../features/discovery/PublicDiscoveryPage'
import { currentUser } from '../features/auth/auth-api'

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: PublicLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: PublicDiscoveryPage },
      {
        path: 'operator/register',
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages')).RegisterPage,
        }),
      },
      {
        path: 'operator/verify-email',
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages'))
            .VerifyEmailPage,
        }),
      },
      {
        path: 'operator/login',
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages')).LoginPage,
        }),
      },
    ],
  },
  {
    id: 'operator',
    path: '/operator',
    loader: operatorLoader,
    lazy: async () => ({
      Component: (await import('../features/operator/OperatorWorkspaceLayout'))
        .OperatorWorkspaceLayout,
    }),
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: LoadingPage,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('../features/operator/OperatorOverviewPage'))
            .OperatorOverviewPage,
        }),
      },
      {
        path: 'profile',
        lazy: async () => ({
          Component: (await import('../features/operator/OperatorProfilePage'))
            .OperatorProfilePage,
        }),
      },
      {
        path: 'schools',
        lazy: async () => ({
          Component: (await import('../features/operator/OperatorSchoolsPage'))
            .OperatorSchoolsPage,
        }),
      },
      {
        path: 'offerings',
        lazy: async () => ({
          Component: (
            await import('../features/operator/OperatorOfferingsPage')
          ).OperatorOfferingsPage,
        }),
      },
    ],
  },
  {
    id: 'admin',
    path: '/admin',
    loader: adminLoader,
    lazy: async () => ({
      Component: (await import('../features/admin/AdminWorkspaceLayout'))
        .AdminWorkspaceLayout,
    }),
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: LoadingPage,
    children: [
      {
        index: true,
        loader: () => redirect('/admin/applications'),
        Component: () => null,
      },
      {
        path: 'applications',
        lazy: async () => ({
          Component: (await import('../features/admin/AdminApplicationsPage'))
            .AdminApplicationsPage,
        }),
      },
      {
        path: 'applications/:applicationId',
        lazy: async () => ({
          Component: (await import('../features/admin/AdminApplicationsPage'))
            .AdminApplicationDetailPage,
        }),
      },
      {
        path: 'schools',
        lazy: async () => ({
          Component: (await import('../features/admin/AdminSchoolsPage'))
            .AdminSchoolsPage,
        }),
      },
      {
        path: 'tariffs',
        lazy: async () => ({
          Component: (await import('../features/admin/AdminTariffsPage'))
            .AdminTariffsPage,
        }),
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
