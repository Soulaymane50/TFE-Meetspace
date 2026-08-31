import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { organizerGetMyEvents, organizerCancelMyEvent, organizerGetFinanceSummary } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import EventPlanningTimeline from "../components/EventPlanningTimeline";
import { useFeedback } from "../context/FeedbackContext";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import WorkspaceNav from "../components/WorkspaceNav";
import FinanceLedger from "../components/FinanceLedger";
import styles from "./OrganizerEventsPage.module.css";

const ORGANIZER_STATUS_FILTERS = ["ALL", "PENDING_APPROVAL", "PUBLISHED", "REJECTED", "CANCELLED"];

function OrganizerIcon({ type }) {
  const icons = {
    events: (
      <>
        <path d="M7 3v3M17 3v3" />
        <path d="M4.5 8.5h15" />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" />
      </>
    ),
    pending: (
      <>
        <path d="M12 7v5l3 2" />
        <path d="M12 21a9 9 0 1 0-9-9" />
      </>
    ),
    published: (
      <>
        <path d="m5 12 4 4L19 6" />
        <path d="M20 12a8 8 0 1 1-4.5-7.2" />
      </>
    ),
    rejected: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    cancelled: (
      <>
        <path d="M18 6 6 18" />
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      </>
    ),
    location: (
      <>
        <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
        <path d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </>
    ),
    capacity: (
      <>
        <path d="M16 20a4 4 0 0 0-8 0" />
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M20 19a3.5 3.5 0 0 0-3-3.4" />
      </>
    ),
    price: (
      <>
        <path d="M12 3v18" />
        <path d="M17 7.5A4 4 0 0 0 13.5 6h-3A2.5 2.5 0 0 0 8 8.5c0 1.4 1.1 2.5 2.5 2.5h3a2.5 2.5 0 0 1 0 5h-3A4 4 0 0 1 7 14.5" />
      </>
    ),
  };

  return (
    <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
      {icons[type] || icons.events}
    </svg>
  );
}

export default function OrganizerEventsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { confirm, notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();

  const getDateLocale = () => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  };

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filter = ORGANIZER_STATUS_FILTERS.includes(searchParams.get("status"))
    ? searchParams.get("status")
    : "ALL";
  const setFilter = (status) => setSearchParams(
    status === "ALL" || !ORGANIZER_STATUS_FILTERS.includes(status) ? {} : { status },
    { replace: true },
  );
  const [financeSummary, setFinanceSummary] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [eventsResult, financeResult] = await Promise.allSettled([
        organizerGetMyEvents(token),
        organizerGetFinanceSummary(token),
      ]);

      if (eventsResult.status === "rejected") {
        throw eventsResult.reason;
      }

      setEvents(eventsResult.value);
      setFinanceSummary(financeResult.status === "fulfilled" ? financeResult.value : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) {
      navigate("/login");
      return;
    }

    const run = async () => {
      await fetchEvents();
    };
    run();
  }, [fetchEvents, navigate, user]);

  const handleCancel = async (id, title) => {
    const confirmed = await confirm({
      title: t("organizer.confirmCancelEvent", { title }),
      confirmLabel: t("organizer.cancelEvent"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await organizerCancelMyEvent(id, token);
      notify({ type: "success", title: t("organizer.cancelEvent"), message: t("organizer.eventCancelled", "Événement annulé.") });
      fetchEvents();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const statusClass = (status) => {
    const map = {
      PENDING_APPROVAL: styles.statusPending,
      PUBLISHED: styles.statusPublished,
      REJECTED: styles.statusRejected,
      CANCELLED: styles.statusCancelled,
    };
    return `${styles.statusBadge} ${map[status] || styles.statusCancelled}`;
  };

  const locale = normalizeLocale(i18n.language);
  const formatEuro = (value) => formatMoney(value, locale);
  const formatStat = (value) => formatNumber(value, locale);

  const stats = {
    total: events.length,
    pending: events.filter((e) => e.status === "PENDING_APPROVAL").length,
    published: events.filter((e) => e.status === "PUBLISHED").length,
    rejected: events.filter((e) => e.status === "REJECTED").length,
    cancelled: events.filter((e) => e.status === "CANCELLED").length,
  };
  const statusFilters = ORGANIZER_STATUS_FILTERS;
  const now = Date.now();
  const sortedEvents = [...events].sort((a, b) => {
    const aTime = new Date(a.startDateTime).getTime();
    const bTime = new Date(b.startDateTime).getTime();
    const aIsPast = aTime <= now;
    const bIsPast = bTime <= now;
    if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
    return aIsPast ? bTime - aTime : aTime - bTime;
  });
  const filteredEvents = filter === "ALL" ? sortedEvents : sortedEvents.filter((event) => event.status === filter);
  const upcomingEvents = sortedEvents.filter((event) => new Date(event.endDateTime) >= new Date());
  const nextEvent = upcomingEvents[0] || sortedEvents[0];
  const publicationRate = stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;
  const activeEvents = stats.published + stats.pending;
  const filteredCount = filteredEvents.length;
  const financeEvents = financeSummary?.events ?? [];
  const financeByEventId = new Map(financeEvents.map((item) => [item.eventId, item]));
  const getStatusCount = (status) => (status === "ALL" ? stats.total : events.filter((e) => e.status === status).length);
  const formatDateTime = (value) => new Date(value).toLocaleString(getDateLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const signalCards = [
    { icon: "published", label: t("organizer.publishedEvents"), value: stats.published, meta: `${publicationRate}%` },
    { icon: "pending", label: t("organizer.pendingApproval"), value: stats.pending, meta: t("organizer.approvalFlow") },
    { icon: "events", label: t("organizer.portfolio"), value: activeEvents, meta: t("organizer.eventsVisible") },
  ];

  if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) return null;
  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("organizer.manageYourEvents")} />;

  return (
    <div className={styles.container}>
      <WorkspaceNav scope="organizer" />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("organizer.myEvents")}</h1>
          <p className={styles.subtitle}>{t("organizer.manageYourEvents")}</p>
        </div>
        <Link to="/organizer/events/new" className={styles.createButton}>
          + {t("organizer.createEvent")}
        </Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.commandDeck}>
        <section className={styles.mainConsole}>
          <div className={styles.consoleHeader}>
            <div>
              <p className={styles.consoleEyebrow}>{t("organizer.consoleLabel")}</p>
              <h2>{t("organizer.eventPipeline")}</h2>
            </div>
            <span className={styles.livePill}>
              <span className={styles.liveDot} />
              {publicationRate}%
            </span>
          </div>

          <div className={styles.consoleBody}>
            <div className={styles.consoleMetric}>
              <span>{t("organizer.totalEvents")}</span>
              <strong>{formatStat(stats.total)}</strong>
              <small>{formatStat(filteredCount)} {t("organizer.eventsShown")}</small>
            </div>

            <div className={styles.nextEventPanel}>
              <span className={styles.nextLabel}>{t("organizer.nextEvent")}</span>
              {nextEvent ? (
                <>
                  <strong>{nextEvent.title}</strong>
                  <small>{formatDateTime(nextEvent.startDateTime)} · {nextEvent.location || t("common.toBeAnnounced")}</small>
                </>
              ) : (
                <>
                  <strong>{t("organizer.noUpcomingEvent")}</strong>
                  <small>{t("organizer.createFirstEvent")}</small>
                </>
              )}
            </div>
          </div>

          <div className={styles.signalGrid}>
            {signalCards.map((item) => (
              <button key={item.label} type="button" className={styles.signalCard} onClick={() => setFilter(item.icon === "pending" ? "PENDING_APPROVAL" : item.icon === "published" ? "PUBLISHED" : "ALL")}>
                <span className={styles.signalIcon}><OrganizerIcon type={item.icon} /></span>
                <span>
                  <small>{item.label}</small>
                  <strong>{formatStat(item.value)}</strong>
                  <em>{item.meta}</em>
                </span>
              </button>
            ))}
          </div>

          <FinanceLedger
            summary={financeSummary}
            variant="organizer"
            formatMoney={formatEuro}
            formatNumber={formatStat}
            onPeriodChange={async (period) => {
              setFinanceSummary(await organizerGetFinanceSummary(token, period));
            }}
          />
        </section>

        <aside className={styles.statusPanel}>
          <div className={styles.statusPanelHeader}>
            <span>{t("organizer.quickReview")}</span>
            <strong>{formatStat(stats.pending)}</strong>
          </div>
          <div className={styles.statusStack}>
            {statusFilters.slice(1).map((status) => (
              <button
                key={status}
                type="button"
                className={`${styles.statusRow} ${filter === status ? styles.statusRowActive : ""}`}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                <span className={statusClass(status)}>{t(`status.${status.toLowerCase()}`)}</span>
                <strong>{formatStat(getStatusCount(status))}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className={styles.filterTabs} role="group" aria-label={t("organizer.filterByStatus", { defaultValue: "Filtrer les événements par statut" })}>
        {statusFilters.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            aria-pressed={filter === status}
            className={`${styles.filterTab} ${filter === status ? styles.filterTabActive : ""}`}
          >
            {t(status === "ALL" ? "common.all" : `status.${status.toLowerCase()}`)}
            <span className={styles.filterCount}>
              {formatStat(getStatusCount(status))}
            </span>
          </button>
        ))}
      </div>

      {filteredEvents.length > 0 && (
        <EventPlanningTimeline
          events={filteredEvents}
          title={t("planning.organizerTitle")}
          subtitle={t("planning.organizerSubtitle")}
          getEventHref={(event) => `/organizer/events/edit/${event.id}`}
          maxDays={4}
        />
      )}

      {filteredEvents.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><OrganizerIcon type="events" /></div>
          <p>{t("organizer.noEventsFound")}</p>
          <Link to="/organizer/events/new" className={styles.createButtonSmall}>
            {t("organizer.createEvent")}
          </Link>
        </div>
      ) : (
        <div className={styles.eventsGrid}>
          {filteredEvents.map((e) => {
            const eventFinance = financeByEventId.get(e.id);
            return (
            <div key={e.id} className={styles.eventCard}>
              <div className={styles.eventHeader}>
                <h3 className={styles.eventTitle}>{e.title}</h3>
                <span className={statusClass(e.status)}>{t(`status.${e.status.toLowerCase()}`)}</span>
              </div>

              {e.rejectionReason && (
                <div className={styles.rejectionBox}>
                  {t("organizer.rejectionReason")}: {e.rejectionReason}
                </div>
              )}

              <div className={styles.eventDetails}>
                <div className={styles.eventDetail}>
                  <span className={styles.detailIcon}><OrganizerIcon type="events" /></span>
                  {new Date(e.startDateTime).toLocaleString(getDateLocale())} - {new Date(e.endDateTime).toLocaleTimeString(getDateLocale())}
                </div>
                <div className={styles.eventDetail}>
                  <span className={styles.detailIcon}><OrganizerIcon type="location" /></span>
                  {e.location || "-"}
                </div>
                <div className={styles.eventDetail}>
                  <span className={styles.detailIcon}><OrganizerIcon type="capacity" /></span>
                  {formatStat(e.capacity)} {t("common.persons")}
                </div>
                <div className={styles.eventDetail}>
                  <span className={styles.detailIcon}><OrganizerIcon type="price" /></span>
                  {e.price > 0 ? formatEuro(e.price) : t("events.free")}
                </div>
              </div>

              {e.parkingRequired && e.parkingCapacity ? (
                <div className={styles.parkingQuotaStrip}>
                  <span>{t("parking.currentAllocation", { defaultValue: "Parking partagé — allocation actuelle" })}</span>
                  <strong>
                    {t("parking.organizerAllocationSummary", {
                      defaultValue: "{{available}} places encore réservables sur {{allocated}} · {{price}} / véhicule",
                      available: formatStat(e.parkingAvailableSpaces ?? e.parkingCapacity),
                      allocated: formatStat(e.parkingCapacity),
                      price: formatEuro(e.parkingPrice || 0),
                    })}
                  </strong>
                </div>
              ) : null}

              {eventFinance && (
                <div className={styles.eventFinanceStrip}>
                  <span>
                    {t("finance.confirmedNetShort", { defaultValue: "Net confirmé" })}
                    <strong>{formatEuro(eventFinance.organizerNetEstimate)}</strong>
                  </span>
                  <span>
                    {t("finance.potentialNetShort", { defaultValue: "Net potentiel" })}
                    <strong>{formatEuro(eventFinance.organizerPotentialNet ?? eventFinance.organizerNetEstimate)}</strong>
                  </span>
                  <span>
                    {t("finance.occupancyShort", { defaultValue: "Remplissage" })}
                    <strong>{formatStat(eventFinance.occupancyRate || 0)}%</strong>
                  </span>
                  <span>
                    {t("finance.breakEvenShort", { defaultValue: "Seuil rentable" })}
                    <strong>
                      {eventFinance.breakEvenParticipants >= 0
                        ? `${formatStat(eventFinance.breakEvenParticipants)} ${t("common.persons")}`
                        : t("finance.notReachable", { defaultValue: "Non atteignable" })}
                    </strong>
                  </span>
                  <small>
                    {formatStat(eventFinance.confirmedParticipants || 0)} / {formatStat(eventFinance.eventCapacity || 0)} {t("common.participants")}
                  </small>
                </div>
              )}

              <div className={styles.eventActions}>
                <Link to={`/organizer/events/edit/${e.id}`} className={styles.editButton}>
                  {t("common.edit")}
                </Link>
                {e.status !== "CANCELLED" && e.status !== "REJECTED" && (
                  <button onClick={() => handleCancel(e.id, e.title)} className={styles.cancelButton}>
                    {t("organizer.cancelEvent")}
                  </button>
                )}
                {e.status === "PUBLISHED" ? (
                  <Link to={`/organizer/events/${e.id}/check-in`} className={styles.checkInButton}>
                    {t("checkIn.openConsole")}
                  </Link>
                ) : null}
                {e.status === "PUBLISHED" ? (
                  <Link to={`/events/${e.id}`} className={styles.viewButton}>
                    {t("detail.viewDetails", { defaultValue: "Voir la fiche" })}
                  </Link>
                ) : e.status === "PENDING_APPROVAL" ? (
                  <span className={styles.pendingNote}>{t("organizer.awaitingApproval")}</span>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
