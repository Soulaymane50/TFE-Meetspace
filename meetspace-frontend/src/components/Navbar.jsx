import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const productLinkClass = ({ isActive }) =>
    `${styles.productLink} ${isActive ? styles.productLinkActive : ""}`;

  return (
    <header className={styles.header}>
      <div className={styles.topShell}>
        <NavLink to="/" className={styles.brand} aria-label="MeetSpace — Accueil">
          <span className={styles.brandMark}>M</span>
          <span className={styles.brandCopy}>
            <strong className={styles.brandName}>MeetSpace</strong>
            <span className={styles.brandSub}>{t("nav.logoSubtitle")}</span>
          </span>
        </NavLink>

        <button
          type="button"
          className={`${styles.menuToggle} ${menuOpen ? styles.menuToggleOpen : ""}`}
          aria-expanded={menuOpen}
          aria-controls="meetspace-navigation"
          aria-label={t("nav.openMenu", { defaultValue: "Ouvrir le menu" })}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div
          id="meetspace-navigation"
          className={`${styles.navRegion} ${menuOpen ? styles.navRegionOpen : ""}`}
          onClick={(event) => {
            if (event.target.closest("a")) setMenuOpen(false);
          }}
        >
          <nav className={styles.productNav} aria-label={t("footer.productLinks")}>
            <NavLink to="/events" className={productLinkClass}>{t("nav.events")}</NavLink>
            <NavLink to="/espace" className={productLinkClass}>{t("nav.spaces")}</NavLink>
            <NavLink to="/parking" className={productLinkClass}>{t("nav.parking")}</NavLink>
            <NavLink to="/contact" className={productLinkClass}>{t("nav.contact")}</NavLink>
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
                  <span className={styles.accountAvatar} aria-hidden="true">
                    {(user.firstName || "M").slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <small>{t("nav.accountMenu")}</small>
                    <strong>{user.firstName}</strong>
                  </span>
                </summary>

                <div className={styles.accountPanel}>
                  <div className={styles.accountHeader}>
                    <span>{t("nav.hello")}</span>
                    <strong>{user.firstName}</strong>
                  </div>

                  <NavLink to="/my-reservations" className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}>
                    {t("nav.myReservations")}
                  </NavLink>

                  {user.role === "ORGANIZER" || user.role === "ADMIN" ? (
                    <NavLink to="/organizer/events" className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}>
                      {t("nav.organizerEventsShort")}
                    </NavLink>
                  ) : null}

                  {user.role === "ADMIN" ? (
                    <NavLink to="/admin" className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}>
                      {t("nav.admin")}
                    </NavLink>
                  ) : null}

                  <NavLink to="/profile" className={({ isActive }) => `${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}>
                    {t("nav.profile")}
                  </NavLink>

                  <button type="button" onClick={handleLogout} className={styles.menuLogout}>
                    {t("nav.logout")}
                  </button>
                </div>
              </details>
            ) : (
              <div className={styles.authLinks}>
                <NavLink to="/login" className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.utilityLinkActive : ""}`}>
                  {t("nav.login")}
                </NavLink>
                <NavLink to="/register" className={styles.registerButton}>
                  {t("nav.register")}
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
