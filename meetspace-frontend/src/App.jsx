import { Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EspacesPage from "./pages/EspacesPage";
import MyReservationsPage from "./pages/MyReservationsPage";
import CreateReservationPage from "./pages/CreateReservationPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEspaceForm from "./pages/AdminEspaceForm";
import AdminEspacesPage from "./pages/AdminEspacesPage";
import AdminEventsPage from "./pages/AdminEventsPage";
import AdminParkingPage from "./pages/AdminParkingPage";
import EventsPage from "./pages/EventsPage";
import EventRegisterPage from "./pages/EventRegisterPage";
import AdminEventForm from "./pages/AdminEventForm";
import ParkingPage from "./pages/ParkingPage";
import ParkingReservePage from "./pages/ParkingReservePage";
import AdminParkingForm from "./pages/AdminParkingForm";
import MyParkingReservationsPage from "./pages/MyParkingReservationsPage";
import ProfilePage from "./pages/ProfilePage";
import OrganizerEventsPage from "./pages/OrganizerEventsPage";
import OrganizerEventForm from "./pages/OrganizerEventForm";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

export default function App() {

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/espace"
        element={
          <Layout>
            <EspacesPage />
          </Layout>
        }
      />

      <Route
        path="/my-reservations"
        element={
          <Layout>
            <MyReservationsPage />
          </Layout>
        }
      />

      <Route
        path="/reservations/new/:espaceId"
        element={
          <Layout>
            <CreateReservationPage />
          </Layout>
        }
      />

      <Route
        path="/events"
        element={
          <Layout>
            <EventsPage />
          </Layout>
        }
      />

      <Route
        path="/events/register/:id"
        element={
          <Layout>
            <EventRegisterPage />
          </Layout>
        }
      />

      <Route
        path="/parking"
        element={
          <Layout>
            <ParkingPage />
          </Layout>
        }
      />

      <Route
        path="/parking/reserve/:id"
        element={
          <Layout>
            <ParkingReservePage />
          </Layout>
        }
      />

      <Route
        path="/my-parking-reservations"
        element={
          <Layout>
            <MyParkingReservationsPage />
          </Layout>
        }
      />

      <Route
        path="/profile"
        element={
          <Layout>
            <ProfilePage />
          </Layout>
        }
      />

      <Route
        path="/organizer/events"
        element={
          <Layout>
            <OrganizerEventsPage />
          </Layout>
        }
      />

      <Route
        path="/organizer/events/new"
        element={
          <Layout>
            <OrganizerEventForm />
          </Layout>
        }
      />

      <Route
        path="/organizer/events/edit/:id"
        element={
          <Layout>
            <OrganizerEventForm />
          </Layout>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <Layout>
            <AdminDashboard />
          </Layout>
        }
      />

      <Route
        path="/admin/espaces"
        element={
          <Layout>
            <AdminEspacesPage />
          </Layout>
        }
      />

      <Route
        path="/admin/espaces/new"
        element={
          <Layout>
            <AdminEspaceForm />
          </Layout>
        }
      />

      <Route
        path="/admin/espaces/:id/edit"
        element={
          <Layout>
            <AdminEspaceForm />
          </Layout>
        }
      />

      <Route
        path="/admin/events"
        element={
          <Layout>
            <AdminEventsPage />
          </Layout>
        }
      />

      <Route
        path="/admin/events/new"
        element={
          <Layout>
            <AdminEventForm />
          </Layout>
        }
      />

      <Route
        path="/admin/events/:id/edit"
        element={
          <Layout>
            <AdminEventForm />
          </Layout>
        }
      />

      <Route
        path="/admin/parking"
        element={
          <Layout>
            <AdminParkingPage />
          </Layout>
        }
      />

      <Route
        path="/admin/parking/new"
        element={
          <Layout>
            <AdminParkingForm />
          </Layout>
        }
      />

      <Route
        path="/admin/parking/edit/:id"
        element={
          <Layout>
            <AdminParkingForm />
          </Layout>
        }
      />

      <Route
        path="*"
        element={
          <Layout>
            <NotFoundPage />
          </Layout>
        }
      />
    </Routes>
  );
}
