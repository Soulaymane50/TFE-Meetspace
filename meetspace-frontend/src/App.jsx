import { lazy, Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";
import PageState from "./components/PageState";
import ProtectedRoute from "./components/ProtectedRoute";

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const EspacesPage = lazy(() => import("./pages/EspacesPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const ParkingPage = lazy(() => import("./pages/ParkingPage"));
const MyReservationsPage = lazy(() => import("./pages/MyReservationsPage"));
const CreateReservationPage = lazy(() => import("./pages/CreateReservationPage"));
const EventRegisterPage = lazy(() => import("./pages/EventRegisterPage"));
const ParkingReservePage = lazy(() => import("./pages/ParkingReservePage"));
const MyParkingReservationsPage = lazy(() => import("./pages/MyParkingReservationsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const OrganizerEventsPage = lazy(() => import("./pages/OrganizerEventsPage"));
const OrganizerEventForm = lazy(() => import("./pages/OrganizerEventForm"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
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

export default function App() {
  return (
    <Suspense fallback={<PageState type="loading" title="Chargement" message="Préparation de l’interface MeetSpace." />}>
      <Routes>
        <Route path="/" element={<Shell><HomePage /></Shell>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/espace" element={<Shell><EspacesPage /></Shell>} />
        <Route path="/events" element={<Shell><EventsPage /></Shell>} />
        <Route path="/parking" element={<Shell><ParkingPage /></Shell>} />

        <Route path="/my-reservations" element={<PrivatePage><MyReservationsPage /></PrivatePage>} />
        <Route path="/my-day" element={<PrivatePage><Navigate to="/my-reservations?tab=day" replace /></PrivatePage>} />
        <Route path="/reservations/new/:espaceId" element={<PrivatePage><CreateReservationPage /></PrivatePage>} />
        <Route path="/events/register/:id" element={<PrivatePage><EventRegisterPage /></PrivatePage>} />
        <Route path="/parking/reserve/:id" element={<PrivatePage><ParkingReservePage /></PrivatePage>} />
        <Route path="/my-parking-reservations" element={<PrivatePage><MyParkingReservationsPage /></PrivatePage>} />
        <Route path="/profile" element={<PrivatePage><ProfilePage /></PrivatePage>} />

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

        <Route path="/admin" element={<PrivatePage roles={["ADMIN"]}><AdminDashboard /></PrivatePage>} />
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
