import { useState } from "react";
import { registerRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { getPasswordChecks, isStrongPassword } from "../utils/passwordPolicy";
import styles from "./RegisterPage.module.css";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordChecks = getPasswordChecks(password);

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");

    if (!isStrongPassword(password)) {
      setError(t("auth.passwordRequirementsError"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await registerRequest({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      });
      login(data.user, data.token);
      navigate(location.state?.from || "/espace", { replace: true });
    } catch (err) {
      const message = err?.message;
      if (message === "EMAIL_ALREADY_EXISTS") {
        setError(t("auth.emailAlreadyExists"));
      } else if (message === "PASSWORD_WEAK") {
        setError(t("auth.passwordRequirementsError"));
      } else if (message === "PASSWORD_CONFIRMATION_MISMATCH") {
        setError(t("auth.passwordMismatch"));
      } else {
        setError(t("auth.registerError"));
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
          <p className={styles.eyebrow}>{t("auth.registerEyebrow")}</p>
          <h1 className={styles.introTitle}>{t("auth.register")}</h1>
          <p className={styles.introText}>{t("auth.registerIntroText")}</p>
          <div className={styles.featureList}>
            <span className={styles.featurePill}>{t("auth.registerFeatureJourney")}</span>
            <span className={styles.featurePill}>{t("auth.registerFeaturePayment")}</span>
            <span className={styles.featurePill}>{t("auth.registerFeatureAdmin")}</span>
          </div>
        </section>

        <div className={styles.card}>
          <p className={styles.cardEyebrow}>{t("auth.registerCardEyebrow")}</p>
          <h2 className={styles.title}>{t("auth.register")}</h2>
          <p className={styles.subtitle}>{t("auth.registerSubtitle")}</p>
          <form onSubmit={submit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t("auth.firstName")}</label>
                <input
                  type="text"
                  placeholder={t("auth.firstName")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t("auth.lastName")}</label>
                <input
                  type="text"
                  placeholder={t("auth.lastName")}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
            </div>
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
              <label className={styles.label}>{t("auth.confirmPassword")}</label>
              <input
                type="password"
                placeholder={t("auth.confirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? t("auth.registeringButton") : t("auth.registerButton")}
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.footer}>
            <p className={styles.link}>
              {t("auth.hasAccount")} <Link to="/login" state={{ from: location.state?.from }}>{t("auth.loginLink")}</Link>
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
