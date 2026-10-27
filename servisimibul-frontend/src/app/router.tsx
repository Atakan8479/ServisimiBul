import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router-dom'
import { PublicLayout, RouteAccessibility } from '../components/layouts'
import {
  LoadingPage,
  NotFoundPage,
  RouteErrorPage,
} from '../components/route-states'
import { ApiError } from '../api/client'
import { PublicDiscoveryPage } from '../features/discovery/PublicDiscoveryPage'
import { currentUser } from '../features/auth/auth-api'

const applicationRoutes: RouteObject[] = [
  {
    path: '/',
    Component: PublicLayout,
    handle: { pageTitle: 'ServisimiBul' },
    ErrorBoundary: RouteErrorPage,
    children: [
      {
        index: true,
        Component: PublicDiscoveryPage,
        handle: { pageTitle: 'ServisimiBul' },
      },
      {
        path: 'demands',
        handle: { pageTitle: 'Servis talep panosu' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/demand/DemandBoardPage'))
            .DemandBoardPage,
        }),
      },
      {
        path: 'demands/:demandId',
        handle: { pageTitle: 'Talep ayrıntısı' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/demand/DemandDetailPage'))
            .DemandDetailPage,
        }),
      },
      {
        path: 'notifications',
        handle: { pageTitle: 'Bildirim merkezi' },
        loader: parentLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (
            await import('../features/notification/NotificationCenterPage')
          ).NotificationCenterPage,
        }),
      },
      {
        path: 'register',
        handle: { pageTitle: 'Hesap türü seçimi' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/SignupPages'))
            .SignupChoicePage,
        }),
      },
      {
        path: 'parent/register',
        handle: { pageTitle: 'Veli kaydı' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages'))
            .ParentSignupPage,
        }),
      },
      {
        path: 'parent/login',
        handle: { pageTitle: 'Veli girişi' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages'))
            .ParentLoginPage,
        }),
      },
      {
        path: 'operator/register',
        handle: { pageTitle: 'İşletmeci kaydı' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages')).RegisterPage,
        }),
      },
      {
        path: 'operator/verify-email',
        handle: { pageTitle: 'E-posta doğrulama' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages'))
            .VerifyEmailPage,
        }),
      },
      {
        path: 'operator/login',
        handle: { pageTitle: 'Giriş' },
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
    handle: { pageTitle: 'Genel bakış' },
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
        handle: { pageTitle: 'Genel bakış' },
        lazy: async () => ({
          Component: (await import('../features/operator/OperatorOverviewPage'))
            .OperatorOverviewPage,
        }),
      },
      {
        path: 'profile',
        handle: { pageTitle: 'Profil' },
        lazy: async () => ({
          Component: (await import('../features/operator/OperatorProfilePage'))
            .OperatorProfilePage,
        }),
      },
      {
        path: 'schools',
        handle: { pageTitle: 'Okullar ve kapsam' },
        lazy: async () => ({
          Component: (await import('../features/operator/OperatorSchoolsPage'))
            .OperatorSchoolsPage,
        }),
      },
      {
        path: 'offerings',
        handle: { pageTitle: 'Araçlar ve servisler' },
        lazy: async () => ({
          Component: (
            await import('../features/operator/OperatorOfferingsPage')
          ).OperatorOfferingsPage,
        }),
      },
      {
        path: 'notifications',
        handle: { pageTitle: 'Bildirim merkezi' },
        lazy: async () => ({
          Component: (
            await import('../features/notification/NotificationCenterPage')
          ).NotificationCenterPage,
        }),
      },
    ],
  },
  {
    id: 'admin',
    path: '/admin',
    handle: { pageTitle: 'Yönetim' },
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
        handle: { pageTitle: 'İşletmeciler' },
        lazy: async () => ({
          Component: (await import('../features/admin/AdminApplicationsPage'))
            .AdminApplicationsPage,
        }),
      },
      {
        path: 'applications/:applicationId',
        handle: { pageTitle: 'İşletmeci ayrıntısı' },
        lazy: async () => ({
          Component: (await import('../features/admin/AdminApplicationsPage'))
            .AdminApplicationDetailPage,
        }),
      },
      {
        path: 'schools',
        handle: { pageTitle: 'Okullar' },
        lazy: async () => ({
          Component: (await import('../features/admin/AdminSchoolsPage'))
            .AdminSchoolsPage,
        }),
      },
      {
        path: 'tariffs',
        handle: { pageTitle: 'Resmî tarifeler' },
        lazy: async () => ({
          Component: (await import('../features/admin/AdminTariffsPage'))
            .AdminTariffsPage,
        }),
      },
      {
        path: 'moderation',
        handle: { pageTitle: 'İçerik bildirimleri' },
        lazy: async () => ({
          Component: (await import('../features/admin/AdminModerationPage'))
            .AdminModerationPage,
        }),
      },
      {
        path: 'notifications',
        handle: { pageTitle: 'Bildirim merkezi' },
        lazy: async () => ({
          Component: (
            await import('../features/notification/NotificationCenterPage')
          ).NotificationCenterPage,
        }),
      },
    ],
  },
  {
    path: '*',
    Component: NotFoundPage,
    handle: { pageTitle: 'Sayfa bulunamadı' },
  },
]

export const routes: RouteObject[] = [
  { Component: RouteAccessibility, children: applicationRoutes },
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

async function parentLoader({ request }: LoaderFunctionArgs) {
  try {
    const user = await currentUser()
    if (user.role !== 'PARENT') {
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
      throw redirect(`/parent/login?next=${encodeURIComponent(next)}${reason}`)
    }
    throw error
  }
}
