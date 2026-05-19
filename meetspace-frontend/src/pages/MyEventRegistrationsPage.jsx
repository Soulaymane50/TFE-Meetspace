import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelEventRegistration, getMyEventRegistrations } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import { useFeedback } from "../context/FeedbackContext";
import styles from "./MyEventRegistrationsPage.module.css";

export default function MyEventRegistrationsPage() {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const { confirm, notify } = useFeedback();

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError("");

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
    const accepted = await confirm({
      title: t("events.confirmCancel"),
      confirmLabel: t("common.confirm", { defaultValue: "Confirmer" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;

    try {
      await cancelEventRegistration(id, token);
      fetchRegistrations();
      notify({
        type: "success",
        title: t("common.success", { defaultValue: "Action confirmée" }),
        message: t("events.registrationCancelled", { defaultValue: "Inscription annulée." }),
      });
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("events.myRegistrations")} />;
  }

  if (error) {
    return <PageState type="error" title={t("common.error")} message={error} />;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t("events.myRegistrations")}</h1>

      <p className={styles.linkRow}>
        <Link to="/events" className={styles.linkGhost}>
          {"\u2190"} {t("events.backToEvents")}
        </Link>
      </p>

      {registrations.length === 0 ? (
        <PageState
          type="empty"
          title={t("events.noRegistrations")}
          message={t("reservation.emptyEventsHint")}
          action={<Link to="/events">{t("home.eventsCta", { defaultValue: "Découvrir les événements" })}</Link>}
        />
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
            {registrations.map((registration) => {
              const isPast = new Date(registration.eventStartDateTime) < new Date();
              const canCancel = !isPast && registration.status !== "CANCELLED";

              return (
                <tr key={registration.id}>
                  <td>{registration.eventTitle}</td>
                  <td>{registration.eventStartDateTime.replace("T", " ")}</td>
                  <td>{registration.numberOfParticipants}</td>
                  <td>
                    {registration.totalPrice > 0 ? `${registration.totalPrice} \u20ac` : t("events.free")}
                  </td>
                  <td>{t(`status.${registration.status.toLowerCase()}`)}</td>
                  <td>
                    {canCancel ? (
                      <button onClick={() => handleCancel(registration.id)} className={styles.cancelButton}>
                        {t("events.cancelRegistration")}
                      </button>
                    ) : (
                      <span className={styles.disabledText}>
                        {isPast ? t("events.eventPassed") : "-"}
                      </span>
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
