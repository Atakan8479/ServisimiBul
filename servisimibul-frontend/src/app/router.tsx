import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import {
  AdminLayout,
  OperatorLayout,
  PublicLayout,
} from '../components/layouts'
import { FoundationPage, HomePage } from '../components/pages'
import { NotFoundPage, RouteErrorPage } from '../components/route-states'

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: PublicLayout,
    ErrorBoundary: RouteErrorPage,
    children: [{ index: true, Component: HomePage }],
  },
  {
    path: '/operator',
    Component: OperatorLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      {
        index: true,
        element: (
          <FoundationPage
            eyebrow="İşletmeci"
            title="İşletmeci alanı hazır"
            detail="Profil, okul ve kapsam işlemleri sonraki onaylı görevlerde eklenecek."
          />
        ),
      },
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
