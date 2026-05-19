import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelParkingReservation, getMyParkingReservations } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import { useFeedback } from "../context/FeedbackContext";
import styles from "./MyParkingReservationsPage.module.css";

export default function MyParkingReservationsPage() {
  const { token } = useAuth();
  const [parkingReservations, setParkingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const { confirm, notify } = useFeedback();

  const loadParkingReservations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getMyParkingReservations(token);
      setParkingReservations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const run = async () => {
      await loadParkingReservations();
    };
    run();
  }, [loadParkingReservations]);

  const handleCancel = async (id) => {
    const accepted = await confirm({
      title: t("parking.confirmCancel"),
      confirmLabel: t("common.confirm", { defaultValue: "Confirmer" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;

    try {
      await cancelParkingReservation(id, token);
      loadParkingReservations();
      notify({
        type: "success",
        title: t("common.success", { defaultValue: "Action confirmée" }),
        message: t("parking.reservationCancelled", { defaultValue: "Réservation parking annulée." }),
      });
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("parking.myReservations")} />;
  }

  if (error) {
    return <PageState type="error" title={t("common.error")} message={error} />;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t("parking.myReservations")}</h1>

      <p className={styles.linkRow}>
        <Link to="/parking" className={styles.linkGhost}>
          {"\u2190"} {t("parking.backToSessions")}
        </Link>
      </p>

      {parkingReservations.length === 0 ? (
        <PageState
          type="empty"
          title={t("parking.noReservations")}
          message={t("reservation.emptyParkingHint")}
          action={<Link to="/parking">{t("home.parkingCta", { defaultValue: "Voir le parking" })}</Link>}
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("parking.session")}</th>
              <th>{t("common.date")}</th>
              <th>{t("common.time")}</th>
              <th>{t("parking.places")}</th>
              <th>{t("common.total")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {parkingReservations.map((parkingReservation) => {
              const isPast = new Date(parkingReservation.slotDate) < new Date();
              const canCancel = !isPast && parkingReservation.status !== "CANCELLED";

              return (
                <tr key={parkingReservation.id}>
                  <td>{parkingReservation.parkingSlotTitle || t("nav.parking")}</td>
                  <td>{parkingReservation.slotDate}</td>
                  <td>
                    {parkingReservation.startTime} - {parkingReservation.endTime}
                  </td>
                  <td>{parkingReservation.reservedSpaces}</td>
                  <td>{parkingReservation.totalPrice} {"\u20ac"}</td>
                  <td>{t(`status.${parkingReservation.status.toLowerCase()}`)}</td>
                  <td>
                    {canCancel ? (
                      <button onClick={() => handleCancel(parkingReservation.id)} className={styles.cancelButton}>
                        {t("parking.cancelReservation")}
                      </button>
                    ) : (
                      <span className={styles.disabledText}>
                        {isPast ? t("parking.sessionPassed") : "-"}
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
