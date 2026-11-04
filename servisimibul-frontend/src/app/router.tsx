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
        path: 'parent/account',
        handle: { pageTitle: 'Hesap ve gizlilik' },
        loader: parentLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => {
          const account =
            await import('../features/account/AccountSettingsPage')
          return {
            Component: account.AccountSettingsPage,
            ErrorBoundary: account.AccountSettingsRouteError,
          }
        },
      },
      {
        path: 'parent/account/password',
        handle: { pageTitle: 'Şifreyi değiştir' },
        loader: parentLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/account/PasswordChangePage'))
            .PasswordChangePage,
        }),
      },
      {
        path: 'parent/account/email',
        handle: { pageTitle: 'E-posta adresini değiştir' },
        loader: parentLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/account/EmailChangePage'))
            .EmailChangePage,
        }),
      },
      {
        path: 'parent/privacy/requests/new',
        handle: { pageTitle: 'Kişisel veri başvurusu' },
        loader: parentLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/legal/LegalPages'))
            .ParentRequestFormPage,
        }),
      },
      {
        path: 'verify-email-change',
        handle: { pageTitle: 'E-posta değişikliğini doğrula' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/account/EmailChangePage'))
            .EmailChangeConfirmationPage,
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
        path: 'forgot-password',
        handle: { pageTitle: 'Şifre yenileme' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages'))
            .ForgotPasswordPage,
        }),
      },
      {
        path: 'reset-password',
        handle: { pageTitle: 'Yeni şifre' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/auth/AuthPages'))
            .ResetPasswordPage,
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
      {
        path: 'privacy/notice',
        handle: { pageTitle: 'Gizlilik ve kişisel veriler' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/legal/LegalPages'))
            .PrivacyNoticePage,
        }),
      },
      {
        path: 'privacy/requests',
        handle: { pageTitle: 'Kişisel veri başvuru yolu' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/legal/LegalPages'))
            .PublicRequestEntryPage,
        }),
      },
      {
        path: 'terms',
        handle: { pageTitle: 'Kullanım koşulları' },
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/legal/LegalPages')).TermsPage,
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
      {
        path: 'account',
        handle: { pageTitle: 'Hesap ve gizlilik' },
        loader: operatorLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => {
          const account =
            await import('../features/account/AccountSettingsPage')
          return {
            Component: account.AccountSettingsPage,
            ErrorBoundary: account.AccountSettingsRouteError,
          }
        },
      },
      {
        path: 'account/password',
        handle: { pageTitle: 'Şifreyi değiştir' },
        loader: operatorLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/account/PasswordChangePage'))
            .PasswordChangePage,
        }),
      },
      {
        path: 'account/email',
        handle: { pageTitle: 'E-posta adresini değiştir' },
        loader: operatorLoader,
        HydrateFallback: LoadingPage,
        lazy: async () => ({
          Component: (await import('../features/account/EmailChangePage'))
            .EmailChangePage,
        }),
      },
      {
        path: 'privacy/requests/new',
        handle: { pageTitle: 'Kişisel veri başvurusu' },
        lazy: async () => ({
          Component: (await import('../features/legal/LegalPages'))
            .OperatorRequestFormPage,
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
        handle: { pageTitle: 'UKOME tarifesi' },
        lazy: async () => ({
          Component: (await import('../features/admin/AdminTariffsPage'))
            .AdminTariffsPage,
        }),
      },
      {
        path: 'moderation',
        handle: { pageTitle: 'Moderasyon' },
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
