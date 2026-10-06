import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { resetPasswordRequest } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { getPasswordChecks, isStrongPassword } from "../utils/passwordPolicy";
import styles from "./ResetPasswordPage.module.css";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const passwordChecks = getPasswordChecks(password);

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => navigate("/login"), 3000);
    return () => window.clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current) return;
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    if (!isStrongPassword(password)) {
      setError(t("auth.passwordRequirementsError"));
      return;
    }

    submitLock.current = true;
    setLoading(true);

    try {
      await resetPasswordRequest(token, password);
      setSuccess(true);

    } catch (err) {
      if (err.message === "PASSWORD_WEAK") {
        setError(t("auth.passwordRequirementsError"));
      } else if (err.message === "PASSWORD_RESET_EXPIRED") {
        setError(t("auth.passwordResetExpired"));
      } else if (err.message === "PASSWORD_RESET_INVALID") {
        setError(t("auth.passwordResetInvalid"));
      } else {
        setError(t("auth.resetPasswordError"));
      }
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.ambient} />
        <div className={styles.languageSwitcherWrapper}>
          <LanguageSwitcher />
        </div>
        <div className={styles.shell}>
          <section className={styles.introPanel}>
            <p className={styles.eyebrow}>{t("auth.securityEyebrow")}</p>
            <h1 className={styles.introTitle}>{t("auth.resetPassword")}</h1>
            <p className={styles.introText}>{t("auth.invalidLinkIntroText")}</p>
          </section>
          <div className={styles.card}>
            <h2 className={styles.title}>{t("auth.invalidLink")}</h2>
            <p className={styles.errorText}>{t("auth.invalidLinkDescription")}</p>
            <Link to="/forgot-password" className={styles.backLink}>
              {t("auth.requestNewLink")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.ambient} />
        <div className={styles.languageSwitcherWrapper}>
          <LanguageSwitcher />
        </div>
        <div className={styles.shell}>
          <section className={styles.introPanel}>
            <p className={styles.eyebrow}>{t("auth.securityEyebrow")}</p>
            <h1 className={styles.introTitle}>{t("auth.resetPassword")}</h1>
            <p className={styles.introText}>{t("auth.resetSuccessIntroText")}</p>
          </section>
          <div className={styles.card}>
            <div className={styles.successIcon}>OK</div>
            <h2 className={styles.title}>{t("auth.passwordResetSuccess")}</h2>
            <p className={styles.successText}>{t("auth.redirectingToLogin")}</p>
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
          <p className={styles.eyebrow}>{t("auth.securityEyebrow")}</p>
          <h1 className={styles.introTitle}>{t("auth.resetPassword")}</h1>
          <p className={styles.introText}>{t("auth.resetIntroText")}</p>
        </section>
        <div className={styles.card}>
          <p className={styles.cardEyebrow}>{t("auth.resetCardEyebrow")}</p>
          <h2 className={styles.title}>{t("auth.resetPassword")}</h2>
          <p className={styles.subtitle}>{t("auth.enterNewPassword")}</p>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="reset-new-password">{t("profile.newPassword")}</label>
              <input
                id="reset-new-password"
                autoComplete="new-password"
                disabled={loading}
                type="password"
                placeholder={t("profile.newPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
                minLength={8}
              />
            </div>

            <div className={styles.passwordRules} aria-live="polite">
              <p className={styles.passwordRulesTitle}>{t("auth.passwordRulesTitle")}</p>
              <ul>
                {passwordChecks.map((check) => (
                  <li
                    key={check.key}
                    className={check.isValid ? styles.passwordRuleValid : styles.passwordRule}
                  >
                    <span className={styles.passwordRuleDot} />
                    {t(`auth.passwordRule${check.key.charAt(0).toUpperCase()}${check.key.slice(1)}`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="reset-confirm-password">{t("profile.confirmPassword")}</label>
              <input
                id="reset-confirm-password"
                autoComplete="new-password"
                disabled={loading}
                type="password"
                placeholder={t("profile.confirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                required
                minLength={8}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? t("common.loading") : t("auth.resetPassword")}
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
