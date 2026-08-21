import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import PageState from "./PageState";

export default function ProtectedRoute({ children, roles }) {
  const { user, isLoading, sessionExpired } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <PageState
        type="loading"
        title={t("system.sessionCheckTitle")}
        message={t("system.sessionCheckMessage")}
      />
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}`, sessionExpired }}
      />
    );
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
