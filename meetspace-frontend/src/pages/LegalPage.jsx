import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./LegalPage.module.css";

const documents = [
  { to: "/mentions-legales", key: "legalNotice" },
  { to: "/confidentialite", key: "privacy" },
  { to: "/conditions-utilisation", key: "terms" },
  { to: "/annulation-remboursement", key: "cancellation" },
];

export default function LegalPage({ pageKey }) {
  const { t } = useTranslation();
  const translatedSections = t(`legal.${pageKey}.sections`, { returnObjects: true });
  const sections = Array.isArray(translatedSections) ? translatedSections : [];

  return (
    <article className={styles.page}>
      <nav className={styles.documents} aria-label={t("legal.navigationLabel")}>
        {documents.map(({ to, key }) => (
          <NavLink key={key} to={to} className={({ isActive }) => isActive ? styles.activeDocument : undefined}>
            {t(`legal.${key}.title`)}
          </NavLink>
        ))}
      </nav>
      <header className={styles.hero}>
        <p className={styles.kicker}>{t("legal.kicker")}</p>
        <h1>{t(`legal.${pageKey}.title`)}</h1>
        <p>{t(`legal.${pageKey}.intro`)}</p>
      </header>
      <nav className={styles.contents} aria-label={t("legal.contents")}>
        <strong>{t("legal.contents")}</strong>
        <ol>
          {sections.map((section, index) => (
            <li key={section.title}><a href={`#${pageKey}-section-${index + 1}`}>{section.title}</a></li>
          ))}
        </ol>
      </nav>
      <div className={styles.sections}>
        {sections.map((section, index) => (
          <section key={section.title} id={`${pageKey}-section-${index + 1}`} className={styles.section}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </div>
      <aside className={styles.help}>
        <h2>{t("legal.helpTitle")}</h2>
        <p>{t("legal.helpText")}</p>
        <div className={styles.actions}>
          <Link to="/contact">{t("legal.contactAction")}</Link>
          {pageKey === "privacy" && <Link to="/profile">{t("legal.profileAction")}</Link>}
        </div>
      </aside>
    </article>
  );
}
