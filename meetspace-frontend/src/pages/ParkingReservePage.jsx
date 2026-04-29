import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createParkingReservation, getParkingSlot } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PaymentForm from "../components/PaymentForm";
import PageState from "../components/PageState";
import { PARKING_IMAGE } from "../utils/mediaAssets";
import styles from "./ParkingReservePage.module.css";

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

export default function ParkingReservePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [parkingSlot, setParkingSlot] = useState(null);
  const [reservedSpaces, setReservedSpaces] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPaymentStepVisible, setIsPaymentStepVisible] = useState(false);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);

  useEffect(() => {
    getParkingSlot(id)
      .then((parkingSlotData) => {
        if (parkingSlotData) {
          setParkingSlot(parkingSlotData);
        } else {
          setError(t("parking.notFound"));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, t]);

  const totalAmount = parkingSlot ? parkingSlot.parkingRate * reservedSpaces : 0;

  const handlePaymentSuccess = async (paymentIntentId) => {
    setIsCreatingReservation(true);
    setError("");

    try {
      await createParkingReservation(
        {
          parkingSlotId: parseInt(id, 10),
          reservedSpaces,
          paymentIntentId,
        },
        token,
      );
      alert(t("payment.success"));
      navigate("/my-parking-reservations");
    } catch (err) {
      setError(err.message);
      setIsPaymentStepVisible(false);
    } finally {
      setIsCreatingReservation(false);
    }
  };

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("parking.reservePlace")} />;
  }

  if (error && !parkingSlot) {
    return <PageState type="error" title={t("common.error")} message={error} />;
  }

  if (isPaymentStepVisible) {
    return (
      <div className={styles.page}>
        <section className={styles.heroPanel} style={{ "--hero-image": `url(${PARKING_IMAGE})` }}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("payment.secure")}</p>
            <h1 className={styles.title}>{t("payment.title")}</h1>
            <p className={styles.subtitle}>{parkingSlot?.title || t("nav.parking")}</p>
          </div>
        </section>

        <div className={styles.workspace}>
          <aside className={styles.summaryRail}>
            <div className={styles.summaryPanel}>
              <h2 className={styles.panelTitle}>{parkingSlot?.title || t("nav.parking")}</h2>
              <div className={styles.summaryImage} style={{ backgroundImage: `url(${PARKING_IMAGE})` }} aria-hidden="true" />
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("parking.reservedSpacesLabel")}</span>
                  <span className={styles.metricValue}>{reservedSpaces}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                  <span className={styles.metricValue}>{parkingSlot?.parkingRate} €</span>
                </div>
              </div>
              <div className={styles.totalPanel}>
                <span>{t("reservation.totalPrice")}</span>
                <strong>{totalAmount.toFixed(2)} €</strong>
              </div>
            </div>
          </aside>

          <section className={styles.mainColumn}>
            {isCreatingReservation ? (
              <div className={styles.loadingBox}>
                <p>{t("reservation.creating")}</p>
              </div>
            ) : (
              <PaymentForm
                stripePublicKey={STRIPE_PUBLIC_KEY}
                token={token}
                amount={totalAmount}
                description={`${t("parking.session")}: ${parkingSlot.title} - ${reservedSpaces} ${t("parking.places")}`}
                reservationType="PARKING"
                metadata={{
                  parkingSlotId: parseInt(id, 10),
                  reservedSpaces,
                }}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setIsPaymentStepVisible(false)}
              />
            )}

            {error && <p className={styles.error}>{error}</p>}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroPanel} style={{ "--hero-image": `url(${PARKING_IMAGE})` }}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>{t("parking.reservePlace")}</p>
          <h1 className={styles.title}>{parkingSlot?.title || t("nav.parking")}</h1>
          <p className={styles.subtitle}>{parkingSlot?.description || t("parking.available")}</p>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.summaryRail}>
          {parkingSlot && (
            <div className={styles.summaryPanel}>
              <h2 className={styles.panelTitle}>{parkingSlot.title}</h2>
              <div className={styles.summaryImage} style={{ backgroundImage: `url(${PARKING_IMAGE})` }} aria-hidden="true" />
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.date")}</span>
                  <span className={styles.metricValue}>{parkingSlot.slotDate}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.time")}</span>
                  <span className={styles.metricValue}>
                    {parkingSlot.startTime} - {parkingSlot.endTime}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("parking.placesAvailable")}</span>
                  <span className={styles.metricValue}>
                    {parkingSlot.availableSpaces} / {parkingSlot.parkingCapacity}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                  <span className={styles.metricValue}>{parkingSlot.parkingRate} €</span>
                </div>
              </div>

              <div className={styles.infoBox}>
                <span className={styles.infoIcon}>i</span>
                <span>{t("parking.capacityNotice")}</span>
              </div>
            </div>
          )}
        </aside>

        <form onSubmit={(e) => { e.preventDefault(); setIsPaymentStepVisible(true); }} className={styles.mainColumn}>
          <div className={styles.flowPanel}>
            <h3 className={styles.sectionTitle}>{t("parking.reservedSpacesLabel")}</h3>
            <div className={styles.inputRow}>
              <label className={styles.label}>{t("parking.reservedSpacesLabel")}</label>
              <input
                type="number"
                min="1"
                max={parkingSlot?.availableSpaces ?? parkingSlot?.parkingCapacity ?? undefined}
                value={reservedSpaces}
                onChange={(e) => setReservedSpaces(parseInt(e.target.value, 10) || 1)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.flowPanel}>
            <h3 className={styles.sectionTitle}>{t("calendar.reservationSummary")}</h3>
            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t("parking.reservedSpacesLabel")}</span>
                <span className={styles.metricValue}>{reservedSpaces}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                <span className={styles.metricValue}>{parkingSlot?.parkingRate} €</span>
              </div>
            </div>

            <div className={styles.totalPanel}>
              <span>{t("reservation.totalPrice")}</span>
              <strong>{totalAmount.toFixed(2)} €</strong>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => navigate("/parking")} className={styles.secondaryAction}>
                {t("common.cancel")}
              </button>
              <button type="submit" className={styles.primaryAction}>
                {t("reservation.proceedPayment")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
