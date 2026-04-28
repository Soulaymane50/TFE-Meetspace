import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getEspaces, requestPremiumRoomReservation, createReservation } from "../services/api";
import { useTranslation } from "react-i18next";
import PaymentForm from "../components/PaymentForm";
import ReservationCalendar from "../components/ReservationCalendar";
import DayTimeSlots from "../components/DayTimeSlots";
import { getSpaceImage } from "../utils/mediaAssets";
import styles from "./CreateReservationPage.module.css";

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

export default function CreateReservationPage() {
  const { espaceId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { t } = useTranslation();

  const [espace, setEspace] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [justification, setJustification] = useState("");

  const getSpaceTypeLabel = (type) => t(`spaceType.${type}`, { defaultValue: type });
  const isPremiumRoom = espace?.type === "PREMIUM_ROOM";

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }

    getEspaces()
      .then((list) => {
        const found = list.find((entry) => String(entry.id) === String(espaceId));
        setEspace(found || null);
        if (!found) setError(t("spaces.notFound"));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, token, espaceId, navigate, t]);

  const calculateHours = () => {
    if (!selectedDate || !startTime || !endTime) return 1;
    const start = new Date(`${selectedDate}T${startTime}`);
    const end = new Date(`${selectedDate}T${endTime}`);
    return Math.max(1, (end - start) / (1000 * 60 * 60));
  };

  const durationHours = calculateHours();
  const totalPrice = espace ? espace.basePrice * durationHours : 0;

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setStartTime("");
    setEndTime("");
  };

  const handleTimeSlotClick = (time) => {
    if (!startTime) {
      setStartTime(time);
      setEndTime("");
      return;
    }

    if (!endTime) {
      const startHour = parseInt(startTime.split(":")[0], 10);
      const clickedHour = parseInt(time.split(":")[0], 10);
      if (clickedHour > startHour) {
        setEndTime(time);
      } else {
        setStartTime(time);
        setEndTime("");
      }
      return;
    }

    setStartTime(time);
    setEndTime("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedDate) {
      setError(t("calendar.selectDayFirst"));
      return;
    }

    if (!startTime || !endTime) {
      setError(t("calendar.selectTimeSlots"));
      return;
    }

    const start = new Date(`${selectedDate}T${startTime}`);
    const end = new Date(`${selectedDate}T${endTime}`);

    if (end <= start) {
      setError(t("reservation.dateOrderError"));
      return;
    }

    if (isPremiumRoom && !justification.trim()) {
      setError(t("reservation.justificationRequired"));
      return;
    }

    if (isPremiumRoom) {
      await handlePremiumRoomRequest();
    } else {
      setShowPayment(true);
    }
  };

  const handlePremiumRoomRequest = async () => {
    setCreatingReservation(true);
    setError("");

    const startDateTime = `${selectedDate}T${startTime}:00`;
    const endDateTime = `${selectedDate}T${endTime}:00`;

    try {
      await requestPremiumRoomReservation(
        {
          espaceId: Number(espaceId),
          startDateTime,
          endDateTime,
          totalPrice,
          justification,
        },
        token,
      );

      alert(t("reservation.pendingApprovalMessage"));
      navigate("/my-reservations?tab=spaces");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingReservation(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    setCreatingReservation(true);
    setError("");

    const startDateTime = `${selectedDate}T${startTime}:00`;
    const endDateTime = `${selectedDate}T${endTime}:00`;

    try {
      await createReservation(
        {
          espaceId: Number(espaceId),
          startDateTime,
          endDateTime,
          totalPrice,
          paymentIntentId,
        },
        token,
      );

      alert(t("payment.success"));
      navigate("/my-reservations?tab=spaces");
    } catch (err) {
      setError(err.message);
      setShowPayment(false);
    } finally {
      setCreatingReservation(false);
    }
  };

  const handleReset = () => {
    setStartTime("");
    setEndTime("");
  };

  if (!user || !token) return null;
  if (loading) return <p className={styles.info}>{t("common.loading")}</p>;
  if (error && !espace) return <p className={styles.error}>{error}</p>;

  const selectedRange = selectedDate && startTime && endTime ? `${selectedDate} · ${startTime} - ${endTime}` : t("calendar.selectTime");
  const spaceImage = espace ? getSpaceImage(espace) : "/images/room-atlas-100.webp";

  if (showPayment) {
    return (
      <div className={styles.page}>
        <section className={styles.heroPanel} style={{ "--hero-image": `url(${spaceImage})` }}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("payment.secure")}</p>
            <h1 className={styles.title}>{t("payment.title")}</h1>
            <p className={styles.subtitle}>{t("reservation.newReservation")}</p>
          </div>
        </section>

        <div className={styles.workspace}>
          <aside className={styles.summaryRail}>
            <div className={styles.summaryPanel}>
              <h2 className={styles.panelTitle}>{espace?.name}</h2>
              <div className={styles.summaryImage} style={{ backgroundImage: `url(${spaceImage})` }} aria-hidden="true" />
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("spaces.type")}</span>
                  <span className={styles.metricValue}>{getSpaceTypeLabel(espace?.type)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("calendar.reservationSummary")}</span>
                  <span className={styles.metricValue}>{selectedRange}</span>
                </div>
              </div>
              <div className={styles.totalPanel}>
                <span>{t("reservation.totalPrice")}</span>
                <strong>{totalPrice.toFixed(2)} €</strong>
              </div>
            </div>
          </aside>

          <section className={styles.mainColumn}>
            {creatingReservation ? (
              <div className={styles.loadingBox}>
                <p>{t("reservation.creating")}</p>
              </div>
            ) : (
              <PaymentForm
                stripePublicKey={STRIPE_PUBLIC_KEY}
                token={token}
                amount={totalPrice}
                description={`${t("reservation.newReservation")}: ${espace.name} - ${selectedDate} ${startTime} ${t("common.to").toLowerCase()} ${endTime}`}
                reservationType="SPACE"
                metadata={{
                  espaceId: Number(espaceId),
                  hours: durationHours,
                }}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
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
      <section className={styles.heroPanel} style={{ "--hero-image": `url(${spaceImage})` }}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>{t("reservation.newReservation")}</p>
          <h1 className={styles.title}>{espace?.name || t("spaces.space")}</h1>
          <p className={styles.subtitle}>{t("spaces.subtitle")}</p>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.summaryRail}>
          {espace && (
            <div className={styles.summaryPanel}>
              <div className={styles.spaceHeader}>
                <span className={styles.spaceBadge}>{getSpaceTypeLabel(espace.type)}</span>
                <h2 className={styles.panelTitle}>{espace.name}</h2>
              </div>

              <div className={styles.summaryImage} style={{ backgroundImage: `url(${spaceImage})` }} aria-hidden="true" />

              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.capacity")}</span>
                  <span className={styles.metricValue}>
                    {espace.capacity} {t("common.persons")}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("spaces.basePrice")}</span>
                  <span className={styles.metricValue}>{espace.basePrice} €</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("calendar.reservationSummary")}</span>
                  <span className={styles.metricValue}>{selectedRange}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("reservation.totalPrice")}</span>
                  <span className={styles.metricValue}>{totalPrice.toFixed(2)} €</span>
                </div>
              </div>

              {isPremiumRoom && <div className={styles.warningBox}>{t("reservation.premiumRoomWarning")}</div>}
            </div>
          )}
        </aside>

        <section className={styles.mainColumn}>
          <div className={styles.flowPanel}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t("calendar.selectDate")}</h3>
            </div>
            <ReservationCalendar espaceId={Number(espaceId)} onSelectDate={handleDateSelect} selectedDate={selectedDate} />
          </div>

          {selectedDate && (
            <div className={styles.flowPanel}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{t("calendar.selectTime")}</h3>
              </div>
              <DayTimeSlots
                espaceId={Number(espaceId)}
                selectedDate={selectedDate}
                onSelectTimeSlot={handleTimeSlotClick}
                selectedStartTime={startTime}
                selectedEndTime={endTime}
              />
            </div>
          )}

          {startTime && endTime && (
            <form onSubmit={handleSubmit} className={styles.flowPanel}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{t("calendar.reservationSummary")}</h3>
              </div>

              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.date")}</span>
                  <span className={styles.metricValue}>{selectedDate}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.time")}</span>
                  <span className={styles.metricValue}>
                    {startTime} - {endTime}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.hours")}</span>
                  <span className={styles.metricValue}>{durationHours}</span>
                </div>
              </div>

              {isPremiumRoom && (
                <div className={styles.justificationSection}>
                  <label className={styles.justificationLabel}>
                    {t("reservation.justificationLabel")} <span className={styles.required}>*</span>
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder={t("reservation.justificationPlaceholder")}
                    className={styles.justificationTextarea}
                    rows={4}
                    required
                  />
                </div>
              )}

              <div className={styles.totalPanel}>
                <span>{t("reservation.totalPrice")}</span>
                <strong>{totalPrice.toFixed(2)} €</strong>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.buttonGroup}>
                <button type="button" onClick={handleReset} className={styles.secondaryAction} disabled={creatingReservation}>
                  {t("calendar.resetSelection")}
                </button>
                <button
                  type="submit"
                  className={isPremiumRoom ? styles.premiumAction : styles.primaryAction}
                  disabled={creatingReservation}
                >
                  {creatingReservation ? t("common.loading") : isPremiumRoom ? t("reservation.submitRequest") : t("reservation.proceedPayment")}
                </button>
              </div>
            </form>
          )}

          {error && !startTime && <p className={styles.error}>{error}</p>}

          <button type="button" onClick={() => navigate("/espace")} className={styles.backButton}>
            {t("common.back")}
          </button>
        </section>
      </div>
    </div>
  );
}
