import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { confirmAccountDeletion } from "../services/api";
import PageState from "../components/PageState";
import styles from "./ProfilePage.module.css";

export default function ConfirmAccountDeletionPage() {
  const { token, logout } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deletionToken = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setError("");
    setLoading(true);

    try {
      await confirmAccountDeletion(deletionToken, token);
      setSuccess(true);
      await logout();
      setTimeout(() => navigate("/", { replace: true }), 2500);
    } catch (err) {
      if (err?.message === "ACCOUNT_DELETION_EXPIRED") {
        setError(t("accountDeletion.expired"));
      } else if (err?.message === "ACCOUNT_DELETION_INVALID") {
        setError(t("accountDeletion.invalid"));
      } else {
        setError(t("accountDeletion.failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!deletionToken) {
    return <PageState type="error" title={t("accountDeletion.invalidTitle")} message={t("accountDeletion.missingToken")} />;
  }

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{t("accountDeletion.kicker")}</p>
          <h1 className={styles.title}>{t("accountDeletion.title")}</h1>
          <p className={styles.subtitle}>{t("accountDeletion.subtitle")}</p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h2 className={styles.sectionTitle}>{t("accountDeletion.confirmTitle")}</h2>
        <p className={styles.dangerText}>{t("accountDeletion.confirmText")}</p>

        {success ? (
          <p className={styles.success}>{t("accountDeletion.success")}</p>
        ) : (
          <>
            <div className={styles.confirmButtons}>
              <button type="button" className={styles.dangerButton} onClick={handleConfirm} disabled={loading}>
                {loading ? t("common.loading") : t("accountDeletion.confirmButton")}
              </button>
              <button type="button" className={styles.button} onClick={() => navigate("/profile")}>
                {t("common.cancel")}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
      </section>
    </div>
  );
}
