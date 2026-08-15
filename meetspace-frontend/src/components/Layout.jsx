import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "./Navbar";
import CommandPalette from "./CommandPalette";
import Footer from "./Footer";
import styles from "./Layout.module.css";

function getPageTitle(pathname, t) {
  if (pathname === "/") return "MeetSpace";
  if (pathname === "/events") return `${t("nav.events")} — MeetSpace`;
  if (pathname === "/espace") return `${t("nav.spaces")} — MeetSpace`;
  if (pathname === "/parking") return `${t("nav.parking")} — MeetSpace`;
  if (pathname === "/contact") return `${t("nav.contact")} — MeetSpace`;
  if (pathname.startsWith("/reservations/new")) return `${t("reservation.newReservation")} — MeetSpace`;
  if (pathname.startsWith("/events/register")) return `${t("events.register")} — MeetSpace`;
  if (pathname.startsWith("/parking/reserve")) return `${t("parking.reserve")} — MeetSpace`;
  if (pathname.startsWith("/my-reservations")) return `${t("nav.myReservations")} — MeetSpace`;
  if (pathname.startsWith("/profile")) return `${t("nav.profile")} — MeetSpace`;
  if (pathname.startsWith("/organizer")) return `${t("nav.organizerEvents")} — MeetSpace`;
  if (pathname.startsWith("/admin")) return `${t("nav.admin")} — MeetSpace`;
  return "MeetSpace";
}

function PageExperience() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const pageTitle = getPageTitle(location.pathname, t);

  useEffect(() => {
    const languageMap = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    document.title = pageTitle;
    document.documentElement.lang = languageMap[i18n.resolvedLanguage] || "fr-BE";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, pageTitle, i18n.language, i18n.resolvedLanguage]);

  return (
    <p className={styles.routeAnnouncement} aria-live="polite" aria-atomic="true">
      {pageTitle}
    </p>
  );
}

function BackToTop() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 640);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      type="button"
      className={`${styles.backToTop} ${visible ? styles.backToTopVisible : ""}`}
      aria-label={t("common.backToTop", { defaultValue: "Retour en haut" })}
      title={t("common.backToTop", { defaultValue: "Retour en haut" })}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}

export default function Layout({ children }) {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        {t("common.skipToContent", { defaultValue: "Aller au contenu principal" })}
      </a>
      <div className={styles.ambient} aria-hidden="true" />
      <PageExperience />
      <Navbar />
      <CommandPalette />
      <main id="main-content" className={styles.main} tabIndex="-1">
        <div className={styles.shell}>{children}</div>
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}
