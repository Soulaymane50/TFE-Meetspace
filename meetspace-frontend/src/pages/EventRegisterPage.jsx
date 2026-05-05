import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPublicEvents, registerToEvent } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PaymentForm from "../components/PaymentForm";
import PageState from "../components/PageState";
import { getEventImage } from "../utils/mediaAssets";
import styles from "./EventRegisterPage.module.css";

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

export default function EventRegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { t } = useTranslation();

  const [event, setEvent] = useState(null);
  const [numberOfParticipants, setNumberOfParticipants] = useState(1);
  const [addParking, setAddParking] = useState(false);
  const [reservedSpaces, setReservedSpaces] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPaymentStepVisible, setIsPaymentStepVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }

    getPublicEvents()
      .then((events) => {
        const found = events.find((entry) => entry.id === parseInt(id, 10));
        if (found) {
          setEvent(found);
        } else {
          setError(t("events.notFound"));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id, user, token, navigate, t]);

  const hasParking = !!event?.parkingSlotId;
  const eventPrice = event?.price || 0;
  const parkingUnit = event?.parkingPrice || 0;
  const availableParticipantPlaces = Math.max(0, event?.availablePlaces ?? event?.capacity ?? 0);
  const maxParticipants = event ? Math.max(0, Math.min(event.capacity ?? availableParticipantPlaces, availableParticipantPlaces)) : 1;
  const maxParkingSpaces = Math.max(0, event?.parkingAvailableSpaces ?? event?.parkingCapacity ?? 0);
  const eventTotal = eventPrice * numberOfParticipants;
  const parkingTotal = hasParking && addParking ? parkingUnit * reservedSpaces : 0;
  const totalAmount = eventTotal + parkingTotal;
  const requiresPayment = totalAmount > 0;

  const clampNumber = (value, min, max) => {
    const number = parseInt(value, 10);
    if (!Number.isFinite(number)) return min;
    return Math.min(Math.max(number, min), Math.max(min, max));
  };

  const handleParticipantsChange = (value) => {
    setNumberOfParticipants(clampNumber(value, 1, maxParticipants || 1));
  };

  const handleParkingSpacesChange = (value) => {
    setReservedSpaces(clampNumber(value, 1, maxParkingSpaces || 1));
  };

  const completeRegistration = async (paymentIntentId) => {
    setIsRegistering(true);
    setError("");

    try {
      await registerToEvent(
        {
          eventId: parseInt(id, 10),
          numberOfParticipants,
          paymentIntentId,
          addParking: hasParking && addParking,
          reservedSpaces: hasParking && addParking ? reservedSpaces : null,
        },
        token,
      );

      alert(requiresPayment ? t("payment.success") : t("events.registrationSuccess"));
      navigate("/my-reservations?tab=events");
    } catch (err) {
      setError(err.message);
      setIsPaymentStepVisible(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (maxParticipants <= 0) {
      setError(t("events.full"));
      return;
    }
    if (numberOfParticipants > maxParticipants) {
      setError(t("events.capacityExceeded", { count: maxParticipants }));
      return;
    }
    if (hasParking && addParking && maxParkingSpaces <= 0) {
      setError(t("parking.full"));
      return;
    }
    if (hasParking && addParking && reservedSpaces > maxParkingSpaces) {
      setError(t("parking.capacityExceeded", { count: maxParkingSpaces }));
      return;
    }
    if (requiresPayment) {
      setIsPaymentStepVisible(true);
      return;
    }
    await completeRegistration(null);
  };

  if (!user || !token) return null;
  if (isLoading) {
    return <PageState type="loading" title={t("common.loading")} message={t("events.registerFor")} />;
  }

  if (error && !event) {
    return <PageState type="error" title={t("common.error")} message={error} />;
  }

  const eventImage = event ? getEventImage(event) : "/images/room-premium-orion-500.webp";

  if (isPaymentStepVisible && requiresPayment) {
    return (
      <div className={styles.page}>
        <section className={styles.heroPanel} style={{ "--hero-image": `url(${eventImage})` }}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("payment.secure")}</p>
            <h1 className={styles.title}>{t("payment.title")}</h1>
            <p className={styles.subtitle}>{event?.title}</p>
          </div>
        </section>

        <div className={styles.workspace}>
          <aside className={styles.summaryRail}>
            <div className={styles.summaryPanel}>
              <h2 className={styles.panelTitle}>{event?.title}</h2>
              <div className={styles.summaryImage} style={{ backgroundImage: `url(${eventImage})` }} aria-hidden="true" />
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("events.numberOfParticipants")}</span>
                  <span className={styles.metricValue}>{numberOfParticipants}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("events.parkingOption")}</span>
                  <span className={styles.metricValue}>{hasParking && addParking ? t("events.withParking") : t("events.withoutParking")}</span>
                </div>
              </div>
              <div className={styles.totalPanel}>
                <span>{t("reservation.totalPrice")}</span>
                <strong>{totalAmount.toFixed(2)} €</strong>
              </div>
            </div>
          </aside>

          <section className={styles.mainColumn}>
            {isRegistering ? (
              <div className={styles.loadingBox}>
                <p>{t("events.registering")}</p>
              </div>
            ) : (
              <PaymentForm
                stripePublicKey={STRIPE_PUBLIC_KEY}
                token={token}
                amount={totalAmount}
                description={`${t("events.registration")}: ${event.title} - ${numberOfParticipants} ${t("events.participant", { count: numberOfParticipants })}`}
                reservationType="EVENT"
                metadata={{
                  eventId: parseInt(id, 10),
                  numberOfParticipants,
                  parkingSlotId: hasParking && addParking ? event.parkingSlotId : undefined,
                  reservedSpaces: hasParking && addParking ? reservedSpaces : undefined,
                }}
                onSuccess={completeRegistration}
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
      <section className={styles.heroPanel} style={{ "--hero-image": `url(${eventImage})` }}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>{t("events.registerFor")}</p>
          <h1 className={styles.title}>{event?.title}</h1>
          <p className={styles.subtitle}>{event?.description}</p>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.summaryRail}>
          {event && (
            <div className={styles.summaryPanel}>
              <h2 className={styles.panelTitle}>{event.title}</h2>
              <div className={styles.summaryImage} style={{ backgroundImage: `url(${eventImage})` }} aria-hidden="true" />
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.date")}</span>
                  <span className={styles.metricValue}>{event.startDateTime.replace("T", " ")}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.capacity")}</span>
                  <span className={styles.metricValue}>
                    {event.capacity} {t("common.persons")}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t("common.price")}</span>
                  <span className={styles.metricValue}>
                    {eventPrice > 0 ? `${eventPrice} € / ${t("events.participant", { count: 1 })}` : t("events.free")}
                  </span>
                </div>
                {hasParking && (
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>{t("events.parkingOption")}</span>
                    <span className={styles.metricValue}>
                      {parkingUnit > 0 ? `${parkingUnit} € / ${t("parking.perSpace")}` : t("events.free")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        <form onSubmit={handleSubmit} className={styles.mainColumn}>
          <div className={styles.flowPanel}>
            <h3 className={styles.sectionTitle}>{t("events.numberOfParticipants")}</h3>
            <div className={styles.inputRow}>
              <label className={styles.label}>{t("events.numberOfParticipants")}</label>
              <input
                type="number"
                min="1"
                max={maxParticipants || 1}
                value={numberOfParticipants}
                onChange={(e) => handleParticipantsChange(e.target.value)}
                disabled={maxParticipants <= 0}
                className={styles.input}
              />
              <span className={styles.helperText}>
                {maxParticipants > 0
                  ? t("events.remainingPlacesCount", { count: maxParticipants })
                  : t("events.full")}
              </span>
            </div>
          </div>

          {hasParking && (
            <div className={styles.flowPanel}>
              <div className={styles.serviceHeader}>
                <span className={styles.serviceIcon}>P</span>
                <div>
                  <h3 className={styles.sectionTitle}>{t("parking.available")}</h3>
                  <p className={styles.helperText}>{t("parking.addToRegistration")}</p>
                </div>
              </div>

              <label className={`${styles.serviceToggle} ${addParking ? styles.serviceToggleActive : ""}`}>
                <input
                  type="checkbox"
                  checked={addParking}
                  onChange={(e) => setAddParking(maxParkingSpaces > 0 && e.target.checked)}
                  disabled={maxParkingSpaces <= 0}
                  className={styles.serviceCheckbox}
                />
                <div className={styles.serviceCopy}>
                  <span className={styles.serviceLabel}>{t("parking.addToRegistration")}</span>
                  <span className={styles.servicePrice}>
                    {parkingUnit > 0 ? `${parkingUnit} € / ${t("parking.perSpace")}` : t("events.free")}
                  </span>
                </div>
              </label>

              {addParking && (
                <div className={styles.inputRow}>
                  <label className={styles.label}>{t("parking.reservedSpacesLabel")}</label>
                  <input
                    type="number"
                    min="1"
                    max={maxParkingSpaces || 1}
                    value={reservedSpaces}
                    onChange={(e) => handleParkingSpacesChange(e.target.value)}
                    disabled={maxParkingSpaces <= 0}
                    className={styles.input}
                  />
                  <span className={styles.helperText}>
                    {maxParkingSpaces > 0
                      ? t("parking.remainingPlacesCount", { count: maxParkingSpaces })
                      : t("parking.full")}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className={styles.flowPanel}>
            <h3 className={styles.sectionTitle}>{t("calendar.reservationSummary")}</h3>
            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t("events.numberOfParticipants")}</span>
                <span className={styles.metricValue}>{numberOfParticipants}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t("events.parkingOption")}</span>
                <span className={styles.metricValue}>{hasParking && addParking ? `${reservedSpaces}` : t("events.withoutParking")}</span>
              </div>
            </div>

            {requiresPayment && (
              <div className={styles.totalPanel}>
                <span>{t("reservation.totalPrice")}</span>
                <strong>{totalAmount.toFixed(2)} €</strong>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => navigate("/events")} className={styles.secondaryAction}>
                {t("common.cancel")}
              </button>
              <button type="submit" className={styles.primaryAction} disabled={isRegistering}>
                {isRegistering ? t("common.loading") : requiresPayment ? t("reservation.proceedPayment") : t("events.confirmRegistration")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
