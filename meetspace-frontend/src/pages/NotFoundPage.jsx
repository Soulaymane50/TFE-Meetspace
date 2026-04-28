import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./NotFoundPage.module.css";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.code}>404</h1>
        <h2 className={styles.title}>{t("error.404")}</h2>
        <p className={styles.description}>{t("error.404Description")}</p>
        <Link to="/" className={styles.button}>
          {t("error.backToHome")}
        </Link>
      </div>
    </div>
  );
}
