import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  adminGetEvents,
  adminDeleteEvent,
  adminGetPendingEvents,
  adminApproveEvent,
  adminGetAllEventRegistrations,
  adminGetEspaces,
} from "../services/api";
import PageState from "../components/PageState";
import EventPlanningTimeline from "../components/EventPlanningTimeline";
import { useFeedback } from "../context/FeedbackContext";
import styles from "./AdminEventsPage.module.css";

const getEventStart = (event) => new Date(event.startDateTime);
const getEventEnd = (event) => new Date(event.endDateTime);

const getDateKey = (date) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

const formatTime = (date, locale) =>
  new Date(date).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

const eventsOverlap = (event, others) => {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  return others.some((other) => {
    if (other.id === event.id) return false;
    return start < getEventEnd(other) && end > getEventStart(other);
  });
};

export default function AdminEventsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { confirm, notify } = useFeedback();

  const getDateLocale = () => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  };

  const [activeTab, setActiveTab] = useState("events");
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedPlanningDay, setSelectedPlanningDay] = useState("");

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const resolveRoomKey = useCallback(
    (event) => {
      if (event.spaceId) return String(event.spaceId);
      const matchedSpace = spaces.find((space) => space.name === event.location);
      if (matchedSpace) return String(matchedSpace.id);
      return event.location || "unassigned";
    },
    [spaces],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [eventsData, pendingData, registrationsData, spacesData] = await Promise.all([
        adminGetEvents(token),
        adminGetPendingEvents(token),
        adminGetAllEventRegistrations(token),
        adminGetEspaces(token),
      ]);
      setEvents(eventsData);
      setPendingEvents(pendingData);
      setRegistrations(registrationsData);
      setSpaces(Array.isArray(spacesData) ? spacesData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      navigate("/login");
      return;
    }

    const run = async () => {
      await loadData();
    };

    run();
  }, [loadData, navigate, user]);

  const handleDeleteEvent = async (id) => {
    const confirmed = await confirm({
      title: t("admin.confirmDeleteEvent"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await adminDeleteEvent(id, token);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setPendingEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handleApproveEvent = async (id) => {
    const confirmed = await confirm({
      title: t("admin.confirmApprove"),
      confirmLabel: t("admin.approve"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    try {
      await adminApproveEvent(id, true, null, token);
      notify({ type: "success", title: t("admin.approve"), message: t("admin.eventApproved", "Événement approuvé.") });
      loadData();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handleRejectEvent = async (id) => {
    if (!rejectionReason.trim()) {
      notify({ type: "error", title: t("common.error"), message: t("admin.rejectionReasonRequired") });
      return;
    }
    try {
      await adminApproveEvent(id, false, rejectionReason, token);
      setRejectingId(null);
      setRejectionReason("");
      notify({ type: "success", title: t("admin.reject"), message: t("admin.eventRejected", "Événement refusé.") });
      loadData();
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const filteredRegistrations = registrations.filter((r) => {
    if (filterStatus === "ALL") return true;
    return r.status === filterStatus;
  });

  const getStatusClass = (status) => {
    const map = {
      PUBLISHED: styles.statusPublished,
      PENDING_APPROVAL: styles.statusPending,
      REJECTED: styles.statusRejected,
      CANCELLED: styles.statusCancelled,
    };
    return map[status] || "";
  };

  const planningRooms = useMemo(() => {
    const roomMap = new Map();

    spaces
      .filter((space) => space.status !== "UNAVAILABLE")
      .forEach((space) => {
        roomMap.set(String(space.id), {
          id: String(space.id),
          name: space.name,
          capacity: space.capacity,
        });
      });

    events.forEach((event) => {
      const roomKey = resolveRoomKey(event);
      if (!roomMap.has(roomKey)) {
        roomMap.set(roomKey, {
          id: roomKey,
          name: event.location || t("common.toBeAnnounced"),
          capacity: event.capacity,
        });
      }
    });

    return Array.from(roomMap.values()).sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
  }, [events, resolveRoomKey, spaces, t]);

  const planningDays = useMemo(() => {
    const dayMap = new Map();
    events.forEach((event) => {
      const start = getEventStart(event);
      if (Number.isNaN(start.getTime())) return;
      const key = getDateKey(start);
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          key,
          date: start,
          events: [],
        });
      }
      dayMap.get(key).events.push(event);
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.date - b.date)
      .slice(0, 6);
  }, [events]);

  useEffect(() => {
    if (!selectedPlanningDay && planningDays.length > 0) {
      setSelectedPlanningDay(planningDays[0].key);
    }
  }, [planningDays, selectedPlanningDay]);

  const activePlanningDay = planningDays.find((day) => day.key === selectedPlanningDay) || planningDays[0];

  const getEventsForRoom = (room) =>
    (activePlanningDay?.events || [])
      .filter((event) => {
        const roomKey = resolveRoomKey(event);
        return roomKey === room.id;
      })
      .sort((a, b) => getEventStart(a) - getEventStart(b));

  if (!user || user.role !== "ADMIN") return null;
  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("admin.eventsManagement")} />;
  if (error) return <PageState type="error" title={t("common.error")} message={error} />;

  const tabs = [
    { id: "events", label: t("admin.eventsManagement") },
    { id: "pending", label: t("admin.pendingEvents"), badge: pendingEvents.length },
    { id: "registrations", label: t("admin.eventReservations") },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1 className={styles.title}>{t("admin.eventsManagement")}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link to="/admin" className={styles.backLink}>
            {t("admin.backToDashboard")}
          </Link>
          <Link to="/admin/events/new" className={styles.btnPrimary}>
            + {t("admin.createEvent")}
          </Link>
        </div>
      </div>

      {pendingEvents.length > 0 && activeTab !== "pending" && (
        <div className={styles.alertBanner}>
          <span className={styles.alertIcon}>!</span>
          <span>{pendingEvents.length} {t("admin.eventsPendingApproval")}</span>
          <button className={styles.alertButton} onClick={() => setActiveTab("pending")}>
            {t("common.view")}
          </button>
        </div>
      )}

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge ? <span className={styles.tabBadge}>{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Onglet: Liste des événements */}
      {activeTab === "events" && (
        <section className={styles.section}>
          {planningDays.length > 0 ? (
            <div className={styles.roomPlanner}>
              <div className={styles.roomPlannerHeader}>
                <div>
                  <p className={styles.roomPlannerKicker}>{t("admin.roomPlanningKicker")}</p>
                  <h2>{t("admin.roomPlanningTitle")}</h2>
                  <span>{t("admin.roomPlanningSubtitle")}</span>
                </div>
                <div className={styles.daySwitch}>
                  {planningDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      className={`${styles.dayButton} ${activePlanningDay?.key === day.key ? styles.dayButtonActive : ""}`}
                      onClick={() => setSelectedPlanningDay(day.key)}
                    >
                      <strong>{day.date.toLocaleDateString(getDateLocale(), { weekday: "short" })}</strong>
                      <small>{day.date.toLocaleDateString(getDateLocale(), { day: "2-digit", month: "2-digit" })}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.roomColumns}>
                {planningRooms.map((room) => {
                  const roomEvents = getEventsForRoom(room);

                  return (
                    <article key={room.id} className={styles.roomColumn}>
                      <div className={styles.roomColumnHeader}>
                        <div>
                          <h3>{room.name}</h3>
                          <span>{room.capacity ? `${room.capacity} ${t("common.persons")}` : t("common.toBeAnnounced")}</span>
                        </div>
                        <strong>{roomEvents.length}</strong>
                      </div>

                      <div className={styles.roomSchedule}>
                        {roomEvents.length === 0 ? (
                          <div className={styles.roomEmpty}>
                            <span>{t("admin.roomAvailable")}</span>
                            <small>{t("admin.roomNoEvent")}</small>
                          </div>
                        ) : (
                          roomEvents.map((event) => {
                            const conflict = eventsOverlap(event, roomEvents);
                            const occupancy =
                              event.capacity && event.availablePlaces !== undefined
                                ? Math.round(((event.capacity - event.availablePlaces) / event.capacity) * 100)
                                : 0;

                            return (
                              <Link
                                key={event.id}
                                to={`/admin/events/${event.id}/edit`}
                                className={`${styles.roomBlock} ${conflict ? styles.roomBlockConflict : ""}`}
                              >
                                <span className={styles.roomTime}>
                                  {formatTime(event.startDateTime, getDateLocale())} - {formatTime(event.endDateTime, getDateLocale())}
                                </span>
                                <strong>{event.title}</strong>
                                <small>
                                  {event.capacity || "-"} {t("common.persons")} · {t("admin.roomOccupancy", { occupancy })}
                                </small>
                                {conflict && <em>{t("admin.roomTimeConflict")}</em>}
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <PageState
              type="empty"
              title={t("admin.noEvents")}
              message={t("admin.roomPlanningEmptyMessage")}
              action={
                <Link to="/admin/events/new" className={styles.btnPrimary}>
                  {t("admin.createEvent")}
                </Link>
              }
            />
          )}

          <EventPlanningTimeline
            events={events}
            title={t("planning.adminTitle")}
            subtitle={t("planning.adminSubtitle")}
            getEventHref={(event) => `/admin/events/${event.id}/edit`}
            maxDays={4}
          />

          <div className={`${styles.tableContainer} ${styles.compactTable}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("common.title")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.capacity")}</th>
                  <th>{t("common.price")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.noData}>{t("admin.noEvents")}</td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr key={e.id}>
                      <td className={styles.nameCell}>{e.title}</td>
                      <td>{new Date(e.startDateTime).toLocaleString(getDateLocale())}</td>
                      <td>{e.capacity || "-"}</td>
                      <td>{e.price ? `${e.price} €` : t("events.free")}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(e.status)}`}>
                          {t(`status.${e.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/admin/events/${e.id}/edit`} className={styles.btnGhost}>
                            {t("common.edit")}
                          </Link>
                          <button onClick={() => handleDeleteEvent(e.id)} className={styles.btnDanger}>
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Onglet: Événements en attente */}
      {activeTab === "pending" && (
        <section className={styles.section}>
          {pendingEvents.length === 0 ? (
            <p className={styles.info}>{t("admin.noPendingEvents")}</p>
          ) : (
            <div className={styles.cardsGrid}>
              {pendingEvents.map((e) => (
                <div key={e.id} className={`${styles.card} ${styles.pendingReviewCard}`}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3 className={styles.cardTitle}>{e.title}</h3>
                      <p className={styles.cardMeta}>{t("organizer.createdBy")}: {e.createdByName}</p>
                      <p className={styles.cardDate}>
                        {new Date(e.startDateTime).toLocaleString(getDateLocale())}
                      </p>
                    </div>
                    <span className={styles.badgePending}>{t("status.pending_approval")}</span>
                  </div>

                  {e.description && (
                    <p className={styles.cardDesc}>{e.description}</p>
                  )}

                  <div className={styles.pendingDetails}>
                    <span>
                      <small>{t("events.location")}</small>
                      <strong>{e.location || t("common.toBeAnnounced")}</strong>
                    </span>
                    <span>
                      <small>{t("common.capacity")}</small>
                      <strong>{e.capacity ? `${e.capacity} ${t("common.persons")}` : "-"}</strong>
                    </span>
                    <span>
                      <small>{t("common.price")}</small>
                      <strong>{e.price ? `${e.price} €` : t("events.free")}</strong>
                    </span>
                  </div>

                  <div className={styles.cardFooter}>
                    {rejectingId === e.id ? (
                      <div className={styles.rejectBox}>
                        <textarea
                          placeholder={t("admin.rejectionReasonPlaceholder")}
                          value={rejectionReason}
                          onChange={(ev) => setRejectionReason(ev.target.value)}
                          className={styles.textarea}
                        />
                        <div className={styles.rejectActions}>
                          <button onClick={() => setRejectingId(null)} className={styles.btnGhost}>
                            {t("common.cancel")}
                          </button>
                          <button onClick={() => handleRejectEvent(e.id)} className={styles.btnDanger}>
                            {t("admin.confirmReject")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.cardActions}>
                        <Link to={`/admin/events/${e.id}/edit`} className={styles.btnGhost}>
                          {t("common.edit")}
                        </Link>
                        <button onClick={() => handleApproveEvent(e.id)} className={styles.btnSuccess}>
                          {t("admin.approve")}
                        </button>
                        <button onClick={() => setRejectingId(e.id)} className={styles.btnDanger}>
                          {t("admin.reject")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Onglet: Inscriptions */}
      {activeTab === "registrations" && (
        <section className={styles.section}>
          <div className={styles.filterBar}>
            <label>{t("admin.filterByStatus")}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={styles.select}
            >
              <option value="ALL">{t("common.all")}</option>
              <option value="CONFIRMED">{t("status.confirmed")}</option>
              <option value="CANCELLED">{t("status.cancelled")}</option>
            </select>
            <span className={styles.resultCount}>
              {filteredRegistrations.length} {t("admin.reservationsShown")}
            </span>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("events.event")}</th>
                  <th>{t("admin.user")}</th>
                  <th>{t("events.participants")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.noData}>{t("admin.noReservations")}</td>
                  </tr>
                ) : (
                  filteredRegistrations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.eventTitle}</td>
                      <td>
                        <div>
                          <div>{r.userFullName || r.userEmail}</div>
                          {r.userFullName && <small className={styles.emailSmall}>{r.userEmail}</small>}
                        </div>
                      </td>
                      <td>{r.numberOfParticipants || 1}</td>
                      <td>{new Date(r.eventDate).toLocaleString(getDateLocale())}</td>
                      <td>{r.totalPrice ? `${r.totalPrice} €` : t("events.free")}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`status${r.status}`]}`}>
                          {t(`status.${r.status.toLowerCase()}`)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
