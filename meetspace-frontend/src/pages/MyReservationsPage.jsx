import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getMyReservations,
  cancelReservation,
  payApprovedReservation,
  getMyEventRegistrations,
  cancelEventRegistration,
  getMyParkingReservations,
  cancelParkingReservation,
} from "../services/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PaymentForm from "../components/PaymentForm";
import PageState from "../components/PageState";
import { useFeedback } from "../context/FeedbackContext";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import { buildUserActivityItems, formatDate, formatTime, getDateKey, getStatusTone } from "../utils/userActivity";
import styles from "./MyReservationsPage.module.css";

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

export default function MyReservationsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { confirm, notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(initialTab || "spaces");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partialErrors, setPartialErrors] = useState({});

  const [spaceReservations, setSpaceReservations] = useState([]);
  const [payingReservation, setPayingReservation] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [eventRegistrations, setEventRegistrations] = useState([]);

  const [parkingReservations, setParkingReservations] = useState([]);
  const [selectedDay, setSelectedDay] = useState("");
  const locale = normalizeLocale(i18n.language);

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError("");
    setPartialErrors({});

    try {
      const [spacesResult, eventsResult, parkingResult] = await Promise.allSettled([
        getMyReservations(token),
        getMyEventRegistrations(token),
        getMyParkingReservations(token),
      ]);

      const nextErrors = {};

      if (spacesResult.status === "fulfilled") {
        setSpaceReservations(spacesResult.value);
      } else {
        setSpaceReservations([]);
        nextErrors.spaces =
          spacesResult.reason?.message ||
          t("reservation.loadSpacesError", { defaultValue: "Impossible de charger les réservations de salles." });
      }

      if (eventsResult.status === "fulfilled") {
        setEventRegistrations(eventsResult.value);
      } else {
        setEventRegistrations([]);
        nextErrors.events =
          eventsResult.reason?.message ||
          t("reservation.loadEventsError", { defaultValue: "Impossible de charger les inscriptions aux événements." });
      }

      if (parkingResult.status === "fulfilled") {
        setParkingReservations(parkingResult.value);
      } else {
        setParkingReservations([]);
        nextErrors.parking =
          parkingResult.reason?.message ||
          t("reservation.loadParkingError", { defaultValue: "Impossible de charger les réservations parking." });
      }

      setPartialErrors(nextErrors);

      if ([spacesResult, eventsResult, parkingResult].every((result) => result.status === "rejected")) {
        setError(t("reservation.loadAllError", { defaultValue: "Impossible de charger vos réservations." }));
      }
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }

    const run = async () => {
      await fetchAllData();
    };
    run();
  }, [fetchAllData, navigate, token, user]);

  const handleCancelSpace = async (id) => {
    const accepted = await confirm({
      title: t("reservation.confirmCancel"),
      confirmLabel: t("common.confirm", { defaultValue: "Confirmer" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;
    try {
      await cancelReservation(id, token);
      fetchAllData();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    setProcessingPayment(true);
    try {
      await payApprovedReservation(payingReservation.id, paymentIntentId, token);
      notify({
        type: "success",
        title: t("payment.successTitle", { defaultValue: "Paiement valide" }),
        message: t("payment.spaceSuccessMessage", { defaultValue: "Votre reservation de salle est confirmee." }),
      });
      setPayingReservation(null);
      fetchAllData();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCancelEvent = async (id) => {
    const accepted = await confirm({
      title: t("events.confirmCancel"),
      confirmLabel: t("common.confirm", { defaultValue: "Confirmer" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;
    try {
      await cancelEventRegistration(id, token);
      fetchAllData();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handleCancelParkingReservation = async (id) => {
    const accepted = await confirm({
      title: t("parking.confirmCancel"),
      confirmLabel: t("common.confirm", { defaultValue: "Confirmer" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;
    try {
      await cancelParkingReservation(id, token);
      fetchAllData();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const getStatusClass = (status) => {
    const map = {
      CONFIRMED: styles.statusConfirmed,
      PENDING_APPROVAL: styles.statusPending,
      APPROVED: styles.statusApproved,
      CANCELLED: styles.statusCancelled,
      REJECTED: styles.statusRejected,
    };
    return map[status] || styles.statusDefault;
  };

  const dayItems = useMemo(() => {
    const todayKey = getDateKey(new Date());
    return buildUserActivityItems({
      spaces: spaceReservations,
      events: eventRegistrations,
      parking: parkingReservations,
    }).filter((item) => item.dateKey >= todayKey);
  }, [eventRegistrations, parkingReservations, spaceReservations]);

  const groupedDays = useMemo(() => {
    const groups = new Map();
    dayItems.forEach((item) => {
      const current = groups.get(item.dateKey) || [];
      current.push(item);
      groups.set(item.dateKey, current);
    });

    return Array.from(groups.entries()).map(([dateKey, items]) => ({
      dateKey,
      date: items[0]?.start,
      items,
    }));
  }, [dayItems]);

  useEffect(() => {
    if (!selectedDay && groupedDays.length > 0) {
      setSelectedDay(groupedDays[0].dateKey);
    }
  }, [groupedDays, selectedDay]);

  const activeDay = groupedDays.find((day) => day.dateKey === selectedDay) || groupedDays[0];
  const approvedSpaceReservations = spaceReservations.filter((r) => r.status === "APPROVED");
  const otherSpaceReservations = spaceReservations.filter((r) => r.status !== "APPROVED");
  const totalReservations = spaceReservations.length + eventRegistrations.length + parkingReservations.length;
  const formattedTotalReservations = formatNumber(totalReservations, locale);
  const nextActivity = dayItems[0];
  const activeTabError = partialErrors[activeTab];

  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("nav.myReservations")} />;
  if (error) return <PageState type="error" title={t("common.error")} message={error} />;

  if (payingReservation) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>{t("reservation.payReservation")}</h1>
        <div className={styles.paymentCard}>
          <h3>{payingReservation.espace?.name}</h3>
          <p>
            <strong>{t("common.date")} :</strong> {payingReservation.startDateTime.replace("T", " ")} -{" "}
            {payingReservation.endDateTime.split("T")[1]}
          </p>
          <p>
            <strong>{t("reservation.totalPrice")} :</strong> {formatMoney(payingReservation.totalPrice, locale)}
          </p>
        </div>
        {processingPayment ? (
          <div className={styles.loadingBox}>
            <p>{t("payment.processing")}</p>
          </div>
        ) : (
          <PaymentForm
            stripePublicKey={STRIPE_PUBLIC_KEY}
            token={token}
            amount={payingReservation.totalPrice}
            description={`${t("reservation.payReservation")}: ${payingReservation.espace?.name}`}
            reservationType="SPACE"
            metadata={{ reservationId: payingReservation.id }}
            onSuccess={handlePaymentSuccess}
            onCancel={() => setPayingReservation(null)}
          />
        )}
      </div>
    );
  }

  const tabs = [
    { id: "day", label: t("nav.myDay", { defaultValue: "Ma journ\u00e9e" }), count: dayItems.length },
    { id: "spaces", label: t("nav.spaces"), count: spaceReservations.length },
    { id: "events", label: t("nav.events"), count: eventRegistrations.length },
    { id: "parking", label: t("nav.parking"), count: parkingReservations.length },
  ];

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{t("reservation.workspaceKicker")}</p>
          <h1 className={styles.title}>{t("nav.myReservations")}</h1>
          <p>{t("reservation.workspaceSubtitle")}</p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span>{t("reservation.totalItems")}</span>
            <strong>{formattedTotalReservations}</strong>
          </div>
          <div className={styles.heroStat}>
            <span>{t("reservation.pendingPayments")}</span>
            <strong>{formatNumber(approvedSpaceReservations.length, locale)}</strong>
          </div>
          <div className={styles.heroNext}>
            <span>{t("reservation.nextMarker")}</span>
            <strong>
              {nextActivity
                ? `${formatTime(nextActivity.start)} - ${nextActivity.title}`
                : t("notifications.emptyTitle", { defaultValue: "Tout est à jour" })}
            </strong>
          </div>
        </div>
      </section>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && <span className={styles.tabCount}>{formatNumber(tab.count, locale)}</span>}
          </button>
        ))}
      </div>

      {activeTabError && (
        <div className={styles.inlineWarning}>
          <strong>{t("common.warning", { defaultValue: "Attention" })}</strong>
          <span>{activeTabError}</span>
        </div>
      )}

      {activeTab === "day" && (
        <div className={styles.tabContent}>
          {groupedDays.length === 0 ? (
            <PageState
              type="empty"
              title={t("notifications.emptyTitle", { defaultValue: "Tout est à jour" })}
              message={t("notifications.emptyText", { defaultValue: "Aucune réservation à venir pour le moment." })}
            />
          ) : (
            <section className={styles.dayShell}>
              <div className={styles.dayHeader}>
                <div>
                  <p className={styles.dayKicker}>{t("notifications.myDay", { defaultValue: "Ma journée" })}</p>
                  <h2>{activeDay ? formatDate(activeDay.date, locale) : t("common.date")}</h2>
                  <span>
                    {formatNumber(activeDay?.items.length || 0, locale)}{" "}
                    {activeDay?.items.length > 1 ? t("reservation.markersPlanned") : t("reservation.markerPlanned")}
                  </span>
                </div>
                <div className={styles.daySelector}>
                  {groupedDays.slice(0, 5).map((day) => (
                    <button
                      key={day.dateKey}
                      type="button"
                      className={`${styles.dayButton} ${activeDay?.dateKey === day.dateKey ? styles.dayButtonActive : ""}`}
                      onClick={() => setSelectedDay(day.dateKey)}
                    >
                      <strong>{formatDate(day.date, locale, { weekday: "short" })}</strong>
                      <small>
                        {new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(day.date)}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.dayBoard}>
                <div className={styles.daySummary}>
                  <span>{t("notifications.next", { defaultValue: "Prochain repère" })}</span>
                  <strong>
                    {activeDay?.items[0] ? `${formatTime(activeDay.items[0].start)} - ${activeDay.items[0].title}` : "-"}
                  </strong>
                </div>

                <div className={styles.dayTimeline}>
                  {activeDay?.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.dayItem}
                      onClick={() => navigate(item.to)}
                    >
                      <span className={styles.dayTime}>
                        {formatTime(item.start)}
                        {item.end && <small>{formatTime(item.end)}</small>}
                      </span>
                      <span className={styles.dayMarker} />
                      <span className={styles.dayCard}>
                        <span className={styles.dayCardHeader}>
                          <strong>{item.title}</strong>
                          <em className={`${styles.dayStatus} ${styles[getStatusTone(item.status)] || ""}`}>
                            {t(`status.${String(item.status || "default").toLowerCase()}`, { defaultValue: item.status || "Planifié" })}
                          </em>
                        </span>
                        <small>{item.description}</small>
                        {Number(item.amount || 0) > 0 && <b>{formatMoney(item.amount, locale)}</b>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "spaces" && (
        <div className={styles.tabContent}>
          {approvedSpaceReservations.length > 0 && (
            <div className={styles.approvedSection}>
              <h2 className={styles.sectionTitle}>{t("reservation.awaitingPayment")}</h2>
              <p className={styles.sectionDesc}>{t("reservation.awaitingPaymentDesc")}</p>
              <div className={styles.approvedList}>
                {approvedSpaceReservations.map((r) => (
                  <div key={r.id} className={styles.approvedCard}>
                    <div className={styles.approvedHeader}>
                      <h3 className={styles.approvedEspace}>{r.espace?.name}</h3>
                      <span className={`${styles.badge} ${getStatusClass("APPROVED")}`}>{t("status.approved")}</span>
                    </div>
                    <div className={styles.approvedDetails}>
                      <p>
                        <strong>{t("common.date")} :</strong> {r.startDateTime.replace("T", " ")} -{" "}
                        {r.endDateTime.split("T")[1]}
                      </p>
                      <p>
                        <strong>{t("reservation.totalPrice")} :</strong> {formatMoney(r.totalPrice, locale)}
                      </p>
                    </div>
                    <div className={styles.approvedActions}>
                      <button onClick={() => setPayingReservation(r)} className={styles.payButton}>
                        {t("reservation.payNow")}
                      </button>
                      <button onClick={() => handleCancelSpace(r.id)} className={styles.cancelButtonSmall}>
                        {t("reservation.cancel")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherSpaceReservations.length === 0 && approvedSpaceReservations.length === 0 ? (
            <PageState
              type="empty"
              title={t("reservation.noReservations")}
              message={t("reservation.emptySpacesHint")}
              action={<Link to="/espace">{t("home.roomsCta", { defaultValue: "Réserver une salle" })}</Link>}
            />
          ) : (
            otherSpaceReservations.length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("spaces.space")}</th>
                    <th>{t("reservation.startDate")}</th>
                    <th>{t("reservation.endDate")}</th>
                    <th>{t("common.total")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {otherSpaceReservations.map((r) => {
                    const isPast = new Date(r.startDateTime) < new Date();
                    const canCancel = !isPast && r.status !== "CANCELLED" && r.status !== "REJECTED";
                    return (
                      <tr key={r.id}>
                        <td>{r.espace?.name || r.espaceName}</td>
                        <td>{r.startDateTime.replace("T", " ")}</td>
                        <td>{r.endDateTime.replace("T", " ")}</td>
                        <td>{formatMoney(r.totalPrice, locale)}</td>
                        <td>
                          <span className={`${styles.badge} ${getStatusClass(r.status)}`}>
                            {t(`status.${r.status.toLowerCase()}`)}
                          </span>
                        </td>
                        <td>
                          {canCancel ? (
                            <button onClick={() => handleCancelSpace(r.id)} className={styles.cancelButton}>
                              {t("reservation.cancel")}
                            </button>
                          ) : (
                            <span className={styles.disabledText}>{isPast ? t("reservation.passed") : "-"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {activeTab === "events" && (
        <div className={styles.tabContent}>
          {eventRegistrations.length === 0 ? (
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
                {eventRegistrations.map((r) => {
                  const isPast = new Date(r.eventStartDateTime) < new Date();
                  const canCancel = !isPast && r.status !== "CANCELLED";
                  return (
                    <tr key={r.id}>
                      <td>{r.eventTitle}</td>
                      <td>{r.eventStartDateTime.replace("T", " ")}</td>
                      <td>{r.numberOfParticipants}</td>
                      <td>{r.totalPrice > 0 ? formatMoney(r.totalPrice, locale) : t("events.free")}</td>
                      <td>
                        <span className={`${styles.badge} ${getStatusClass(r.status)}`}>
                          {t(`status.${r.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td>
                        {canCancel ? (
                          <button onClick={() => handleCancelEvent(r.id)} className={styles.cancelButton}>
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
      )}

      {activeTab === "parking" && (
        <div className={styles.tabContent}>
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
                {parkingReservations.map((r) => {
                  const isPast = new Date(r.slotDate) < new Date();
                  const canCancel = !isPast && r.status !== "CANCELLED";
                  return (
                    <tr key={r.id}>
                      <td>{r.parkingSlotTitle}</td>
                      <td>{r.slotDate}</td>
                      <td>
                        {r.startTime} - {r.endTime}
                      </td>
                      <td>{formatNumber(r.reservedSpaces, locale)}</td>
                      <td>{formatMoney(r.totalPrice, locale)}</td>
                      <td>
                        <span className={`${styles.badge} ${getStatusClass(r.status)}`}>
                          {t(`status.${r.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td>
                        {canCancel ? (
                          <button onClick={() => handleCancelParkingReservation(r.id)} className={styles.cancelButton}>
                            {t("parking.cancelReservation")}
                          </button>
                        ) : (
                          <span className={styles.disabledText}>{isPast ? t("parking.sessionPassed") : "-"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
