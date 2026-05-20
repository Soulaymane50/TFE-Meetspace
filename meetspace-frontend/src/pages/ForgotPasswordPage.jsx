import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { forgotPasswordRequest } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import styles from "./ForgotPasswordPage.module.css";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await forgotPasswordRequest(email);
      setSuccess(true);
    } catch {
      setError(t("auth.forgotPasswordError"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.ambient} />
        <div className={styles.languageSwitcherWrapper}>
          <LanguageSwitcher />
        </div>
        <div className={styles.shell}>
          <section className={styles.introPanel}>
            <p className={styles.eyebrow}>{t("auth.recoveryEyebrow")}</p>
            <h1 className={styles.introTitle}>{t("auth.forgotPassword")}</h1>
            <p className={styles.introText}>{t("auth.recoverySuccessIntroText")}</p>
          </section>
          <div className={styles.card}>
            <div className={styles.successIcon}>OK</div>
            <h2 className={styles.title}>{t("auth.emailSent")}</h2>
            <p className={styles.successText}>{t("auth.checkYourEmail")}</p>
            <Link to="/login" className={styles.backLink}>
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.ambient} />
      <div className={styles.languageSwitcherWrapper}>
        <LanguageSwitcher />
      </div>
      <div className={styles.shell}>
        <section className={styles.introPanel}>
          <p className={styles.eyebrow}>{t("auth.recoveryEyebrow")}</p>
          <h1 className={styles.introTitle}>{t("auth.forgotPassword")}</h1>
          <p className={styles.introText}>{t("auth.forgotIntroText")}</p>
        </section>
        <div className={styles.card}>
          <p className={styles.cardEyebrow}>{t("auth.accountRecoveryEyebrow")}</p>
          <h2 className={styles.title}>{t("auth.forgotPassword")}</h2>
          <p className={styles.subtitle}>{t("auth.forgotPasswordDescription")}</p>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t("auth.email")}</label>
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? t("common.loading") : t("auth.sendResetLink")}
            </button>
          </form>

          <p className={styles.link}>
            <Link to="/login">{t("auth.backToLogin")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
