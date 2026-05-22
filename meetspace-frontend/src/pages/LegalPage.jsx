import { useTranslation } from "react-i18next";
import styles from "./LegalPage.module.css";

export default function LegalPage({ pageKey }) {
  const { t } = useTranslation();
  const sections = t(`legal.${pageKey}.sections`, { returnObjects: true });

  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>{t("legal.kicker")}</p>
        <h1>{t(`legal.${pageKey}.title`)}</h1>
        <p>{t(`legal.${pageKey}.intro`)}</p>
      </header>

      <div className={styles.sections}>
        {Array.isArray(sections) && sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
