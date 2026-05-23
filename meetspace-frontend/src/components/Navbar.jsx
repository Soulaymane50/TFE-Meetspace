import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserNotificationCenter from "./UserNotificationCenter";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

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

        <nav className={styles.productNav} aria-label={t("footer.productLinks")}>
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
          <NavLink
            to="/contact"
            className={({ isActive }) => `${styles.productLink} ${isActive ? styles.productLinkActive : ""}`}
          >
            {t("nav.contact")}
          </NavLink>
        </nav>

        <div className={styles.topUtilities}>
          <div className={styles.controls}>
            {user && <UserNotificationCenter token={token} user={user} />}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          {user ? (
            <details className={styles.accountMenu}>
              <summary className={styles.accountButton}>
                <span className={styles.accountEyebrow}>{t("nav.accountMenu")}</span>
                <strong>{user.firstName}</strong>
              </summary>

              <div className={styles.accountPanel}>
                <div className={styles.accountHeader}>
                  <span>{t("nav.hello")}</span>
                  <strong>{user.firstName}</strong>
                </div>

                <NavLink
                  to="/my-reservations"
                  className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}
                >
                  {t("nav.myReservations")}
                </NavLink>

                {user.role === "ORGANIZER" || user.role === "ADMIN" ? (
                  <NavLink
                    to="/organizer/events"
                    className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}
                  >
                    {t("nav.organizerEventsShort")}
                  </NavLink>
                ) : null}

                {user.role === "ADMIN" ? (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}
                  >
                    {t("nav.admin")}
                  </NavLink>
                ) : null}

                <NavLink
                  to="/profile"
                  className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}
                >
                  {t("nav.profile")}
                </NavLink>

                <button onClick={handleLogout} className={styles.menuLogout}>
                  {t("nav.logout")}
                </button>
              </div>
            </details>
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
    </header>
  );
}
