import { lazy, Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Layout from "./components/Layout";
import PageState from "./components/PageState";
import ProtectedRoute from "./components/ProtectedRoute";

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const EspacesPage = lazy(() => import("./pages/EspacesPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const ParkingPage = lazy(() => import("./pages/ParkingPage"));
const CatalogDetailPage = lazy(() => import("./pages/CatalogDetailPage"));
const MyReservationsPage = lazy(() => import("./pages/MyReservationsPage"));
const CreateReservationPage = lazy(() => import("./pages/CreateReservationPage"));
const RescheduleReservationPage = lazy(() => import("./pages/RescheduleReservationPage"));
const ReceiptPage = lazy(() => import("./pages/ReceiptPage"));
const EventRegisterPage = lazy(() => import("./pages/EventRegisterPage"));
const ParkingReservePage = lazy(() => import("./pages/ParkingReservePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ConfirmAccountDeletionPage = lazy(() => import("./pages/ConfirmAccountDeletionPage"));
const ConfirmEmailChangePage = lazy(() => import("./pages/ConfirmEmailChangePage"));
const OrganizerEventsPage = lazy(() => import("./pages/OrganizerEventsPage"));
const OrganizerEventForm = lazy(() => import("./pages/OrganizerEventForm"));
const OrganizerCheckInPage = lazy(() => import("./pages/OrganizerCheckInPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminFinancePage = lazy(() => import("./pages/AdminFinancePage"));
const AdminEspaceForm = lazy(() => import("./pages/AdminEspaceForm"));
const AdminEspacesPage = lazy(() => import("./pages/AdminEspacesPage"));
const AdminEventsPage = lazy(() => import("./pages/AdminEventsPage"));
const AdminEventForm = lazy(() => import("./pages/AdminEventForm"));
const AdminParkingPage = lazy(() => import("./pages/AdminParkingPage"));
const AdminParkingForm = lazy(() => import("./pages/AdminParkingForm"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function Shell({ children }) {
  return <Layout>{children}</Layout>;
}

function PrivatePage({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  );
}

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <PageState
      type="loading"
      title={t("system.interfaceLoadingTitle")}
      message={t("system.interfaceLoadingMessage")}
    />
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Shell><HomePage /></Shell>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
        <Route path="/contact" element={<Shell><ContactPage /></Shell>} />
        <Route path="/mentions-legales" element={<Shell><LegalPage pageKey="legalNotice" /></Shell>} />
        <Route path="/confidentialite" element={<Shell><LegalPage pageKey="privacy" /></Shell>} />
        <Route path="/conditions-utilisation" element={<Shell><LegalPage pageKey="terms" /></Shell>} />
        <Route path="/annulation-remboursement" element={<Shell><LegalPage pageKey="cancellation" /></Shell>} />

        <Route path="/espace" element={<Shell><EspacesPage /></Shell>} />
        <Route path="/espace/:id" element={<Shell><CatalogDetailPage type="space" /></Shell>} />
        <Route path="/events" element={<Shell><EventsPage /></Shell>} />
        <Route path="/events/:id" element={<Shell><CatalogDetailPage type="event" /></Shell>} />
        <Route path="/parking" element={<Shell><ParkingPage /></Shell>} />
        <Route path="/parking/:id" element={<Shell><CatalogDetailPage type="parking" /></Shell>} />

        <Route path="/my-reservations" element={<PrivatePage><MyReservationsPage /></PrivatePage>} />
        <Route path="/my-day" element={<PrivatePage><Navigate to="/my-reservations?tab=day" replace /></PrivatePage>} />
        <Route path="/reservations/new/:espaceId" element={<PrivatePage><CreateReservationPage /></PrivatePage>} />
        <Route path="/reservations/:id/edit" element={<PrivatePage><RescheduleReservationPage /></PrivatePage>} />
        <Route path="/receipts/:type/:id" element={<PrivatePage><ReceiptPage /></PrivatePage>} />
        <Route path="/events/register/:id" element={<PrivatePage><EventRegisterPage /></PrivatePage>} />
        <Route path="/parking/reserve/:id" element={<PrivatePage><ParkingReservePage /></PrivatePage>} />
        <Route
          path="/my-parking-reservations"
          element={<PrivatePage><Navigate to="/my-reservations?tab=parking" replace /></PrivatePage>}
        />
        <Route path="/profile" element={<PrivatePage><ProfilePage /></PrivatePage>} />
        <Route path="/confirm-account-deletion" element={<PrivatePage><ConfirmAccountDeletionPage /></PrivatePage>} />

        <Route
          path="/organizer/events"
          element={<PrivatePage roles={["ORGANIZER", "ADMIN"]}><OrganizerEventsPage /></PrivatePage>}
        />
        <Route
          path="/organizer/events/new"
          element={<PrivatePage roles={["ORGANIZER", "ADMIN"]}><OrganizerEventForm /></PrivatePage>}
        />
        <Route
          path="/organizer/events/edit/:id"
          element={<PrivatePage roles={["ORGANIZER", "ADMIN"]}><OrganizerEventForm /></PrivatePage>}
        />
        <Route
          path="/organizer/events/:id/check-in"
          element={<PrivatePage roles={["ORGANIZER", "ADMIN"]}><OrganizerCheckInPage /></PrivatePage>}
        />

        <Route path="/admin" element={<PrivatePage roles={["ADMIN"]}><AdminDashboard /></PrivatePage>} />
        <Route path="/admin/finances" element={<PrivatePage roles={["ADMIN"]}><AdminFinancePage /></PrivatePage>} />
        <Route path="/admin/espaces" element={<PrivatePage roles={["ADMIN"]}><AdminEspacesPage /></PrivatePage>} />
        <Route path="/admin/espaces/new" element={<PrivatePage roles={["ADMIN"]}><AdminEspaceForm /></PrivatePage>} />
        <Route path="/admin/espaces/:id/edit" element={<PrivatePage roles={["ADMIN"]}><AdminEspaceForm /></PrivatePage>} />
        <Route path="/admin/events" element={<PrivatePage roles={["ADMIN"]}><AdminEventsPage /></PrivatePage>} />
        <Route path="/admin/events/new" element={<PrivatePage roles={["ADMIN"]}><AdminEventForm /></PrivatePage>} />
        <Route path="/admin/events/:id/edit" element={<PrivatePage roles={["ADMIN"]}><AdminEventForm /></PrivatePage>} />
        <Route path="/admin/parking" element={<PrivatePage roles={["ADMIN"]}><AdminParkingPage /></PrivatePage>} />
        <Route path="/admin/parking/new" element={<PrivatePage roles={["ADMIN"]}><AdminParkingForm /></PrivatePage>} />
        <Route path="/admin/parking/edit/:id" element={<PrivatePage roles={["ADMIN"]}><AdminParkingForm /></PrivatePage>} />

        <Route path="*" element={<Shell><NotFoundPage /></Shell>} />
      </Routes>
    </Suspense>
  );
}
