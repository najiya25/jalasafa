import { Navigate, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { useI18n } from './lib/i18n';
import { AdminPage } from './pages/AdminPage';
import { FacilityPage } from './pages/FacilityPage';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import { ReportPickerPage } from './pages/ReportPickerPage';
import { RoutePage } from './pages/RoutePage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { TicketPage } from './pages/TicketPage';

export default function App() {
  const { t } = useI18n();
  return (
    <>
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/report" element={<ReportPickerPage />} />
          <Route path="/facility/:id" element={<FacilityPage />} />
          <Route path="/report/:facilityId" element={<ReportPage />} />
          <Route path="/ticket/:id" element={<TicketPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site">
        <div className="container">
          <p>
            <b>JalSafa</b> — find public toilets &amp; drinking water near you. Demo city: <b>Kochi, Kerala</b>.
            Facility dataset, local-body mapping and workflow rules are sample data pending the organiser's official
            files.
          </p>
          <p>
            <b>Privacy:</b> we never ask for your name, phone or email. Your device location is used only in your
            browser to sort nearby facilities — it is never stored, never sent to the server, and no movement history
            is kept.
          </p>
          <p>
            <b>Simulated workflow:</b> ticket routing to local bodies is a demonstration of the flow; no live
            government API is connected. Always verify a facility before travelling.
          </p>
        </div>
      </footer>
    </>
  );
}
