import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  adminGetEvents,
  adminDeleteEvent,
  adminGetPendingEvents,
  adminApproveEvent,
  adminGetAllEventRegistrations,
} from "../services/api";
import PageState from "../components/PageState";
import EventPlanningTimeline from "../components/EventPlanningTimeline";
import styles from "./AdminEventsPage.module.css";

export default function AdminEventsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  };

  const [activeTab, setActiveTab] = useState("events");
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [eventsData, pendingData, registrationsData] = await Promise.all([
        adminGetEvents(token),
        adminGetPendingEvents(token),
        adminGetAllEventRegistrations(token),
      ]);
      setEvents(eventsData);
      setPendingEvents(pendingData);
      setRegistrations(registrationsData);
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
    if (!window.confirm(t("admin.confirmDeleteEvent"))) return;
    try {
      await adminDeleteEvent(id, token);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setPendingEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApproveEvent = async (id) => {
    if (!window.confirm(t("admin.confirmApprove"))) return;
    try {
      await adminApproveEvent(id, true, null, token);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectEvent = async (id) => {
    if (!rejectionReason.trim()) {
      alert(t("admin.rejectionReasonRequired"));
      return;
    }
    try {
      await adminApproveEvent(id, false, rejectionReason, token);
      setRejectingId(null);
      setRejectionReason("");
      loadData();
    } catch (err) {
      alert(err.message);
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
          <EventPlanningTimeline
            events={events}
            title={t("planning.adminTitle")}
            subtitle={t("planning.adminSubtitle")}
          />

          <div className={styles.tableContainer}>
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
                <div key={e.id} className={styles.card}>
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

                  <div className={styles.cardInfo}>
                    <span>{e.capacity ? `${e.capacity} ${t("common.persons")}` : "-"}</span>
                    <span>{e.price ? `${e.price} €` : t("events.free")}</span>
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
