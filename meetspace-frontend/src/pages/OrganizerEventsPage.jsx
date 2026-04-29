import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { organizerGetMyEvents, organizerCancelMyEvent } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import styles from "./OrganizerEventsPage.module.css";

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

const EURO = "\u20ac";

export default function OrganizerEventsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  };

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await organizerGetMyEvents(token);
      setEvents(data);
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
    if (!window.confirm(t("organizer.confirmCancelEvent", { title }))) return;

    try {
      await organizerCancelMyEvent(id, token);
      fetchEvents();
    } catch (err) {
      alert(err.message);
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

  const filteredEvents = filter === "ALL" ? events : events.filter((e) => e.status === filter);
  const formatEuro = (value) => `${(value || 0).toFixed(2)} ${EURO}`;

  const stats = {
    total: events.length,
    pending: events.filter((e) => e.status === "PENDING_APPROVAL").length,
    published: events.filter((e) => e.status === "PUBLISHED").length,
    rejected: events.filter((e) => e.status === "REJECTED").length,
    cancelled: events.filter((e) => e.status === "CANCELLED").length,
  };

  if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) return null;
  if (loading) return <div className={styles.info}>{t("common.loading")}</div>;

  return (
    <div className={styles.container}>
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

      <div className={styles.statsGrid}>
        <div className={styles.statCard} onClick={() => setFilter("ALL")}>
          <span className={styles.statIcon}><OrganizerIcon type="events" /></span>
          <span className={styles.statNumber}>{stats.total}</span>
          <span className={styles.statLabel}>{t("organizer.totalEvents")}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statPending}`} onClick={() => setFilter("PENDING_APPROVAL")}>
          <span className={styles.statIcon}><OrganizerIcon type="pending" /></span>
          <span className={styles.statNumber}>{stats.pending}</span>
          <span className={styles.statLabel}>{t("organizer.pendingApproval")}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statPublished}`} onClick={() => setFilter("PUBLISHED")}>
          <span className={styles.statIcon}><OrganizerIcon type="published" /></span>
          <span className={styles.statNumber}>{stats.published}</span>
          <span className={styles.statLabel}>{t("organizer.publishedEvents")}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statRejected}`} onClick={() => setFilter("REJECTED")}>
          <span className={styles.statIcon}><OrganizerIcon type="rejected" /></span>
          <span className={styles.statNumber}>{stats.rejected}</span>
          <span className={styles.statLabel}>{t("organizer.rejectedEvents")}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCancelled}`} onClick={() => setFilter("CANCELLED")}>
          <span className={styles.statIcon}><OrganizerIcon type="cancelled" /></span>
          <span className={styles.statNumber}>{stats.cancelled}</span>
          <span className={styles.statLabel}>{t("status.cancelled")}</span>
        </div>
      </div>

      <div className={styles.filterTabs}>
        {["ALL", "PENDING_APPROVAL", "PUBLISHED", "REJECTED", "CANCELLED"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`${styles.filterTab} ${filter === status ? styles.filterTabActive : ""}`}
          >
            {t(status === "ALL" ? "common.all" : `status.${status.toLowerCase()}`)}
            <span className={styles.filterCount}>
              {status === "ALL" ? stats.total : events.filter((e) => e.status === status).length}
            </span>
          </button>
        ))}
      </div>

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
          {filteredEvents.map((e) => (
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
                  {e.capacity} {t("common.persons")}
                </div>
                <div className={styles.eventDetail}>
                  <span className={styles.detailIcon}><OrganizerIcon type="price" /></span>
                  {e.price > 0 ? formatEuro(e.price) : t("events.free")}
                </div>
              </div>

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
                  <Link to={`/events/register/${e.id}`} className={styles.viewButton}>
                    {t("common.view")}
                  </Link>
                ) : e.status === "PENDING_APPROVAL" ? (
                  <span className={styles.pendingNote}>{t("organizer.awaitingApproval")}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.legend}>
        <h4 className={styles.legendTitle}>{t("common.legend")}</h4>
        <div className={styles.legendGrid}>
          <div className={styles.legendItem}>
            <span className={`${styles.statusBadge} ${styles.statusPending}`}></span>
            {t("organizer.pendingApproval")}
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.statusBadge} ${styles.statusPublished}`}></span>
            {t("organizer.publishedEvents")}
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.statusBadge} ${styles.statusRejected}`}></span>
            {t("organizer.rejectedEvents")}
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.statusBadge} ${styles.statusCancelled}`}></span>
            {t("status.cancelled")}
          </div>
        </div>
      </div>
    </div>
  );
}
