import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createParkingReservation, getParkingSlot } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "react-i18next";
import PaymentForm from "../components/PaymentForm";
import PageState from "../components/PageState";
import { PARKING_IMAGE } from "../utils/mediaAssets";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import styles from "./ParkingReservePage.module.css";

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

export default function ParkingReservePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const { notify } = useFeedback();

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

  const maxReservableSpaces = Math.max(0, parkingSlot?.availableSpaces ?? parkingSlot?.parkingCapacity ?? 0);
  const totalAmount = parkingSlot ? parkingSlot.parkingRate * reservedSpaces : 0;
  const occupiedSpaces = parkingSlot ? Math.max(0, parkingSlot.parkingCapacity - maxReservableSpaces) : 0;
  const selectedOccupiedSpaces = occupiedSpaces + reservedSpaces;
  const selectedOccupancyPercent = parkingSlot?.parkingCapacity
    ? Math.min(100, Math.round((selectedOccupiedSpaces / parkingSlot.parkingCapacity) * 100))
    : 0;
  const locale = normalizeLocale(i18n.language);
  const formattedTotalAmount = formatMoney(totalAmount, locale);
  const remainingAfterSelection = Math.max(0, maxReservableSpaces - reservedSpaces);
  const quickSpaceOptions = [1, 2, 3, 4, 5].filter((option) => option <= Math.max(maxReservableSpaces, 1));

  const handleReservedSpacesChange = (value) => {
    const number = parseInt(value, 10);
    const safeNumber = Number.isFinite(number) ? number : 1;
    setReservedSpaces(Math.min(Math.max(safeNumber, 1), maxReservableSpaces || 1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (maxReservableSpaces <= 0) {
      setError(t("parking.full"));
      return;
    }
    if (reservedSpaces > maxReservableSpaces) {
      setError(t("parking.capacityExceeded", { count: maxReservableSpaces }));
      return;
    }
    setIsPaymentStepVisible(true);
  };

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
      notify({
        type: "success",
        title: t("payment.successTitle", { defaultValue: "Paiement validé" }),
        message: t("payment.parkingSuccessMessage", {
          defaultValue: "Votre réservation parking est confirmée.",
        }),
      });
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
                  <span className={styles.metricValue}>{formatNumber(reservedSpaces, locale)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                  <span className={styles.metricValue}>{formatMoney(parkingSlot?.parkingRate, locale)}</span>
                </div>
              </div>
              <div className={styles.totalPanel}>
                <span>{t("reservation.totalPrice")}</span>
                <strong>{formattedTotalAmount}</strong>
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
                    {formatNumber(parkingSlot.availableSpaces, locale)} / {formatNumber(parkingSlot.parkingCapacity, locale)}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                  <span className={styles.metricValue}>{formatMoney(parkingSlot.parkingRate, locale)}</span>
                </div>
              </div>

              <div className={styles.infoBox}>
                <span className={styles.infoIcon}>i</span>
                <span>{t("parking.capacityNotice")}</span>
              </div>
            </div>
          )}
        </aside>

        <form onSubmit={handleSubmit} className={styles.mainColumn}>
          <div className={styles.flowPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.kicker}>{t("parking.capacityStatus")}</span>
                <h3 className={styles.sectionTitle}>{t("parking.reservedSpacesLabel")}</h3>
              </div>
              <strong className={styles.availableBadge}>
                {maxReservableSpaces > 0 ? t("parking.remainingPlacesCount", { count: maxReservableSpaces }) : t("parking.full")}
              </strong>
            </div>

            <div className={styles.capacityPanel}>
              <div className={styles.capacityHeader}>
                <span>
                  {formatNumber(selectedOccupiedSpaces, locale)} / {formatNumber(parkingSlot?.parkingCapacity || 0, locale)}
                </span>
                <strong>{selectedOccupancyPercent}%</strong>
              </div>
              <div className={styles.capacityTrack} aria-hidden="true">
                <span style={{ width: `${selectedOccupancyPercent}%` }} />
              </div>
              <p className={styles.helperText}>
                {t("parking.remainingAfterSelection", { count: remainingAfterSelection })}
              </p>
            </div>

            <div className={styles.quantityPanel}>
              <button
                type="button"
                className={styles.quantityButton}
                onClick={() => handleReservedSpacesChange(reservedSpaces - 1)}
                disabled={reservedSpaces <= 1 || maxReservableSpaces <= 0}
                aria-label={t("parking.decreaseSpaces")}
              >
                -
              </button>
              <div className={styles.quantityValue}>
                <strong>{formatNumber(reservedSpaces, locale)}</strong>
                <span>{t("parking.places")}</span>
              </div>
              <button
                type="button"
                className={styles.quantityButton}
                onClick={() => handleReservedSpacesChange(reservedSpaces + 1)}
                disabled={reservedSpaces >= maxReservableSpaces || maxReservableSpaces <= 0}
                aria-label={t("parking.increaseSpaces")}
              >
                +
              </button>
            </div>

            <div className={styles.quickSelection} aria-label={t("parking.quickSelection")}>
              {quickSpaceOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={reservedSpaces === option ? styles.quickSelectionActive : ""}
                  onClick={() => handleReservedSpacesChange(option)}
                  disabled={maxReservableSpaces <= 0}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.flowPanel}>
            <h3 className={styles.sectionTitle}>{t("calendar.reservationSummary")}</h3>
            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t("parking.reservedSpacesLabel")}</span>
                <span className={styles.metricValue}>{formatNumber(reservedSpaces, locale)}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                <span className={styles.metricValue}>{formatMoney(parkingSlot?.parkingRate, locale)}</span>
              </div>
            </div>

            <div className={styles.totalPanel}>
              <span>{t("reservation.totalPrice")}</span>
              <strong>{formattedTotalAmount}</strong>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => navigate("/parking")} className={styles.secondaryAction}>
                {t("common.cancel")}
              </button>
              <button type="submit" className={styles.primaryAction} disabled={maxReservableSpaces <= 0}>
                {t("reservation.proceedPayment")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
