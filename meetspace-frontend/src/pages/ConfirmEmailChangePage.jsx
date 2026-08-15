import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { confirmEmailChange } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageState from "../components/PageState";
import styles from "./ProfilePage.module.css";

export default function ConfirmEmailChangePage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState(token ? "loading" : "invalid");

  useEffect(() => {
    if (!token) return;
    let active = true;
    confirmEmailChange(token)
      .then(async () => {
        if (!active) return;
        await logout();
        if (active) setState("success");
      })
      .catch((error) => {
        if (!active) return;
        if (error?.message?.includes("EXPIRED")) setState("expired");
        else if (error?.message?.includes("EMAIL_ALREADY_EXISTS")) setState("exists");
        else setState("invalid");
      });
    return () => { active = false; };
  }, [token, logout]);

  if (state === "loading") {
    return <PageState type="loading" title={t("emailChange.confirmingTitle")} message={t("emailChange.confirmingText")} />;
  }

  const success = state === "success";
  const messageKey = success ? "success" : state;
  return (
    <main className={styles.confirmPage}>
      <section className={styles.confirmPanel} aria-live="polite">
        <p className={styles.kicker}>{t("emailChange.kicker")}</p>
        <h1 className={styles.title}>{t(success ? "emailChange.successTitle" : "emailChange.errorTitle")}</h1>
        <p className={styles.subtitle}>{t(`emailChange.${messageKey}`)}</p>
        <Link className={styles.button} to={success ? "/login" : "/profile"}>
          {t(success ? "emailChange.loginAgain" : "emailChange.back")}
        </Link>
      </section>
    </main>
  );
}
