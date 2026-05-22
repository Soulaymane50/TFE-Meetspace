import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./Footer.module.css";

const productLinks = [
  { to: "/events", label: "nav.events" },
  { to: "/espace", label: "nav.spaces" },
  { to: "/parking", label: "nav.parking" },
  { to: "/contact", label: "nav.contact" },
];

const legalLinks = [
  { to: "/mentions-legales", label: "legal.legalNotice.title" },
  { to: "/confidentialite", label: "legal.privacy.title" },
  { to: "/conditions-utilisation", label: "legal.terms.title" },
  { to: "/annulation-remboursement", label: "legal.cancellation.title" },
];

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <strong>MeetSpace</strong>
          <p>{t("footer.description")}</p>
        </div>

        <nav className={styles.links} aria-label={t("footer.productLinks")}>
          <span>{t("footer.productLinks")}</span>
          {productLinks.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {t(link.label)}
            </NavLink>
          ))}
        </nav>

        <nav className={styles.links} aria-label={t("footer.legalLinks")}>
          <span>{t("footer.legalLinks")}</span>
          {legalLinks.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {t(link.label)}
            </NavLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}
