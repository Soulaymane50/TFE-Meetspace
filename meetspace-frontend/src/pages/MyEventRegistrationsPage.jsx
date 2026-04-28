import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyEventRegistrations, cancelEventRegistration } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import styles from "./MyEventRegistrationsPage.module.css";

export default function MyEventRegistrationsPage() {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyEventRegistrations(token);
      setRegistrations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const run = async () => {
      await fetchRegistrations();
    };
    run();
  }, [fetchRegistrations]);

  const handleCancel = async (id) => {
    if (!window.confirm(t("events.confirmCancel"))) return;

    try {
      await cancelEventRegistration(id, token);
      fetchRegistrations();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p className={styles.info}>{t("common.loading")}</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t("events.myRegistrations")}</h1>

      <p className={styles.linkRow}>
        <Link to="/events" className={styles.linkGhost}>
          ← {t("events.backToEvents")}
        </Link>
      </p>

      {registrations.length === 0 ? (
        <p className={styles.info}>{t("events.noRegistrations")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("events.event")}</th>
              <th>{t("common.date")}</th>
              <th>{t("events.participants")}</th>
              <th>{t("common.total")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => {
              const isPast = new Date(r.eventStartDateTime) < new Date();
              const canCancel = !isPast && r.status !== "CANCELLED";

              return (
                <tr key={r.id}>
                  <td>{r.eventTitle}</td>
                  <td>{r.eventStartDateTime.replace("T", " ")}</td>
                  <td>{r.numberOfParticipants}</td>
                  <td>{r.totalPrice > 0 ? `${r.totalPrice} €` : t("events.free")}</td>
                  <td>{t(`status.${r.status.toLowerCase()}`)}</td>
                  <td>
                    {canCancel ? (
                      <button onClick={() => handleCancel(r.id)} className={styles.cancelButton}>
                        {t("events.cancelRegistration")}
                      </button>
                    ) : (
                      <span className={styles.disabledText}>{isPast ? t("events.eventPassed") : "-"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
