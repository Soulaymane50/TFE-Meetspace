import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelParkingReservation, getMyParkingReservations } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import styles from "./MyParkingReservationsPage.module.css";

export default function MyParkingReservationsPage() {
  const { token } = useAuth();
  const [parkingReservations, setParkingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const loadParkingReservations = useCallback(async () => {
    setLoading(true);
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
    if (!window.confirm(t("parking.confirmCancel"))) return;

    try {
      await cancelParkingReservation(id, token);
      loadParkingReservations();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p className={styles.info}>{t("common.loading")}</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t("parking.myReservations")}</h1>

      <p className={styles.linkRow}>
        <Link to="/parking" className={styles.linkGhost}>
          ← {t("parking.backToSessions")}
        </Link>
      </p>

      {parkingReservations.length === 0 ? (
        <p className={styles.info}>{t("parking.noReservations")}</p>
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
                  <td>{parkingReservation.totalPrice} €</td>
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
