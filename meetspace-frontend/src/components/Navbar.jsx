import { NavLink, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { getMyReservations } from "../services/api";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserNotificationCenter from "./UserNotificationCenter";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [approvedCount, setApprovedCount] = useState(0);

  const loadApprovedCount = useCallback(async () => {
    if (user && token) {
      try {
        const reservations = await getMyReservations(token);
        const count = reservations.filter((r) => r.status === "APPROVED").length;
        setApprovedCount(count);
      } catch {
        setApprovedCount(0);
      }
    } else {
      setApprovedCount(0);
    }
  }, [token, user]);

  useEffect(() => {
    const run = async () => {
      await loadApprovedCount();
    };

    run();
  }, [loadApprovedCount]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className={styles.header}>
      <div className={styles.topShell}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandMark}>M</span>
          <div className={styles.brandCopy}>
            <strong className={styles.brandName}>MeetSpace</strong>
            <span className={styles.brandSub}>{t("nav.logoSubtitle")}</span>
          </div>
        </NavLink>

        <div className={styles.topUtilities}>
          {user && (
            <span className={styles.userLabel}>
              {t("nav.hello")}, <b>{user.firstName}</b>
            </span>
          )}

          {user && (
            <NavLink
              to="/my-reservations"
              className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.utilityLinkActive : ""}`}
            >
              {t("nav.myReservations")}
              {approvedCount > 0 && <span className={styles.notifBadge}>{approvedCount}</span>}
            </NavLink>
          )}

          {user && (user.role === "ORGANIZER" || user.role === "ADMIN") && (
            <NavLink
              to="/organizer/events"
              className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.utilityLinkActive : ""}`}
            >
              {t("nav.organizerEvents")}
            </NavLink>
          )}

          {user?.role === "ADMIN" && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.utilityLinkActive : ""}`}
            >
              {t("nav.admin")}
            </NavLink>
          )}

          {user && (
            <NavLink
              to="/profile"
              className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.utilityLinkActive : ""}`}
            >
              {t("nav.profile")}
            </NavLink>
          )}

          <div className={styles.controls}>
            {user && <UserNotificationCenter token={token} user={user} />}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          {user ? (
            <button onClick={handleLogout} className={styles.logoutButton}>
              {t("nav.logout")}
            </button>
          ) : (
            <div className={styles.authLinks}>
              <NavLink
                to="/login"
                className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.utilityLinkActive : ""}`}
              >
                {t("nav.login")}
              </NavLink>
              <NavLink to="/register" className={styles.registerButton}>
                {t("nav.register")}
              </NavLink>
            </div>
          )}
        </div>
      </div>

      <div className={styles.navShell}>
        <nav className={styles.productNav}>
          <NavLink
            to="/events"
            className={({ isActive }) => `${styles.productLink} ${isActive ? styles.productLinkActive : ""}`}
          >
            {t("nav.events")}
          </NavLink>
          <NavLink
            to="/espace"
            className={({ isActive }) => `${styles.productLink} ${isActive ? styles.productLinkActive : ""}`}
          >
            {t("nav.spaces")}
          </NavLink>
          <NavLink
            to="/parking"
            className={({ isActive }) => `${styles.productLink} ${isActive ? styles.productLinkActive : ""}`}
          >
            {t("nav.parking")}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
