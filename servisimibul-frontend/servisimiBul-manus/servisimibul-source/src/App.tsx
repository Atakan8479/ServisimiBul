import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { HomePage, SearchResultsPage, TariffPage } from './features/public/PublicPages';
import { DemandBoardPage, DemandDetailPage } from './features/demands/DemandPages';
import { AccountTypePage, AuthPage } from './features/auth/AuthPages';
import { OperatorOverviewPage, OperatorProfilePage, OperatorSchoolsPage, OperatorOfferingsPage } from './features/operator/OperatorPages';
import { AdminApplicationsPage, AdminApplicationDetailPage, AdminTariffsPage } from './features/admin/AdminPages';
import { AdminSchoolsPage } from './features/admin/AdminSchoolsPage';
import { AdminModerationPage } from './features/admin/AdminModerationPage';
import { NotificationsPage } from './features/notifications/NotificationPages';
import { PublicLayout } from './components/Shells';
import { Button } from './components/ui';

function NotFound() {
  return (
    <PublicLayout>
      <main className="not-found container">
        <span className="eyebrow">404 · ROTA BULUNAMADI</span>
        <h1>Bu ekranı bulamadık.</h1>
        <p>Adres değişmiş olabilir. Anasayfaya dönüp yeni bir arama başlatabilirsin.</p>
        <Button asChild><Link to="/">Anasayfaya dön</Link></Button>
      </main>
    </PublicLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/arama" element={<SearchResultsPage />} />
      <Route path="/tarife" element={<TariffPage />} />
      <Route path="/demands" element={<DemandBoardPage />} />
      <Route path="/demands/:demandId" element={<DemandDetailPage />} />
      <Route path="/register" element={<AccountTypePage />} />
      <Route path="/parent/register" element={<AuthPage screen="parent-register" />} />
      <Route path="/parent/login" element={<AuthPage screen="parent-login" />} />
      <Route path="/operator/register" element={<AuthPage screen="operator-register" />} />
      <Route path="/operator/login" element={<AuthPage screen="operator-login" />} />
      <Route path="/operator/verify-email" element={<AuthPage screen="verify-email" />} />
      <Route path="/forgot-password" element={<AuthPage screen="forgot-password" />} />
      <Route path="/reset-password" element={<AuthPage screen="reset-password" />} />
      <Route path="/operator" element={<OperatorOverviewPage />} />
      <Route path="/isletmeci" element={<Navigate to="/operator" replace />} />
      <Route path="/operator/profile" element={<OperatorProfilePage />} />
      <Route path="/operator/schools" element={<OperatorSchoolsPage />} />
      <Route path="/operator/offerings" element={<OperatorOfferingsPage />} />
      <Route path="/admin/applications" element={<AdminApplicationsPage />} />
      <Route path="/admin/applications/:applicationId" element={<AdminApplicationDetailPage />} />
      <Route path="/admin/schools" element={<AdminSchoolsPage />} />
      <Route path="/admin/tariffs" element={<AdminTariffsPage />} />
      <Route path="/admin/moderation" element={<AdminModerationPage />} />
      <Route path="/notifications" element={<NotificationsPage role="parent" />} />
      <Route path="/operator/notifications" element={<NotificationsPage role="operator" />} />
      <Route path="/admin/notifications" element={<NotificationsPage role="admin" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
