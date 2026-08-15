import { useState } from "react";
import { loginRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    try {
      setIsSubmitting(true);
      const data = await loginRequest(email, password);
      login(data.user, data.token);
      navigate(location.state?.from || "/espace", { replace: true });
    } catch (err) {
      if (err.message === "ACCOUNT_BANNED") {
        setError(t("auth.accountBanned"));
      } else if (err.message === "ACCOUNT_DELETED") {
        setError(t("auth.accountDeleted"));
      } else if (err.message === "ACCOUNT_INACTIVE" || err.message === "ACCOUNT_SUSPENDED") {
        setError(t("auth.accountSuspended"));
      } else if (err.message === "AUTH_SERVICE_UNAVAILABLE" || err.message === "AUTH_ACCESS_FORBIDDEN") {
        setError(t("auth.loginServiceUnavailable"));
      } else {
        setError(t("auth.loginError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.ambient} />
      <div className={styles.languageSwitcherWrapper}>
        <LanguageSwitcher />
      </div>
      <div className={styles.shell}>
        <section className={styles.introPanel}>
          <p className={styles.eyebrow}>{t("auth.accessEyebrow")}</p>
          <h1 className={styles.introTitle}>{t("auth.login")}</h1>
          <p className={styles.introText}>{t("auth.loginIntroText")}</p>
          <div className={styles.featureList}>
            <span className={styles.featurePill}>{t("auth.loginFeatureSpaces")}</span>
            <span className={styles.featurePill}>{t("auth.loginFeatureEvents")}</span>
            <span className={styles.featurePill}>{t("auth.loginFeatureParking")}</span>
          </div>
        </section>

        <div className={styles.card}>
          <p className={styles.cardEyebrow}>{t("auth.loginCardEyebrow")}</p>
          <h2 className={styles.title}>{t("auth.login")}</h2>
          <p className={styles.subtitle}>{t("auth.loginSubtitle")}</p>
          <form onSubmit={submit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t("auth.email")}</label>
              <input
                type="email"
                placeholder={t("auth.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t("auth.password")}</label>
              <input
                type="password"
                placeholder={t("auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("auth.loginButton")}
            </button>
          </form>
          <p className={styles.forgotLink}>
            <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.footer}>
            <p className={styles.link}>
              {t("auth.noAccount")} <Link to="/register" state={{ from: location.state?.from }}>{t("auth.createAccount")}</Link>
            </p>
            <p className={styles.homeLink}>
              <Link to="/">{t("auth.backToHome")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
