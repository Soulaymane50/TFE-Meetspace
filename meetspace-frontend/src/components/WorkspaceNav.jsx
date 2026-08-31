import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import styles from "./WorkspaceNav.module.css";

export default function WorkspaceNav({ scope = "account" }) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const links = scope === "admin"
    ? [
        { to: "/admin", label: t("admin.overview"), end: true },
        { to: "/admin/finances", label: t("adminFinance.navLabel") },
        { to: "/admin/espaces", label: t("nav.spaces") },
        { to: "/admin/events", label: t("nav.events") },
        { to: "/admin/parking", label: t("nav.parking") },
        { to: "/admin/parking/check-in", label: t("parking.accessControl", { defaultValue: "Contrôle parking" }) },
      ]
    : scope === "organizer"
      ? [
          { to: "/organizer/events", label: t("organizer.myEvents"), end: true },
          { to: "/organizer/events/new", label: t("organizer.createEvent") },
          { to: "/my-reservations", label: t("nav.myReservations") },
          { to: "/profile", label: t("nav.profile") },
        ]
      : [
          { to: "/my-reservations", label: t("nav.myReservations") },
          ...(user?.role === "ORGANIZER" || user?.role === "ADMIN"
            ? [{ to: "/organizer/events", label: t("nav.organizerEventsShort") }]
            : []),
          ...(user?.role === "ADMIN" ? [{ to: "/admin", label: t("nav.admin") }] : []),
          { to: "/profile", label: t("nav.profile") },
        ];

  return (
    <nav className={styles.nav} aria-label={t("workspace.navigation", { defaultValue: "Navigation de l'espace" })}>
      <span className={styles.label}>
        {scope === "admin"
          ? t("workspace.adminLabel", { defaultValue: "Administration" })
          : scope === "organizer"
            ? t("workspace.organizerLabel", { defaultValue: "Espace organisateur" })
            : t("workspace.accountLabel", { defaultValue: "Espace personnel" })}
      </span>
      <div className={styles.links}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
