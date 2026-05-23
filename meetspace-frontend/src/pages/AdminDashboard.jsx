import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  adminGetStats,
  adminGetFinanceSummary,
  adminGetPendingEvents,
  adminGetPendingReservations,
  adminGetEvents,
  adminGetAllSpaceReservations,
  adminGetParkingSlots,
  adminGetUsers,
  adminUpdateUserRole,
  adminBanUser,
  adminReactivateUser,
  adminGetUserDetails,
} from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./AdminDashboard.module.css";
import AuditLogs from "../components/AuditLogs";
import PageState from "../components/PageState";
import SelectDropdown from "../components/SelectDropdown";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import { useFeedback } from "../context/FeedbackContext";

function AdminIcon({ type }) {
  const icons = {
    spaces: (
      <>
        <path d="M4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V20" />
        <path d="M8 20v-6h8v6" />
        <path d="M8 8h.01M12 8h.01M16 8h.01M8 11h.01M12 11h.01M16 11h.01" />
      </>
    ),
    events: (
      <>
        <path d="M7 3v3M17 3v3" />
        <path d="M4.5 8.5h15" />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" />
        <path d="m8 13 2.2 2.2L16 11" />
      </>
    ),
    parking: (
      <>
        <path d="M6 20V4h7a5 5 0 0 1 0 10H9" />
        <path d="M9 14v6" />
      </>
    ),
    users: (
      <>
        <path d="M16 20a4 4 0 0 0-8 0" />
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M19 19a3.5 3.5 0 0 0-3-3.45" />
        <path d="M16.5 4.5a3 3 0 0 1 0 5.8" />
      </>
    ),
    pending: (
      <>
        <path d="M12 7v5l3 2" />
        <path d="M12 21a9 9 0 1 0-9-9" />
        <path d="M3 21v-5h5" />
      </>
    ),
    reservations: (
      <>
        <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2Z" />
        <path d="M9 9h6M9 13h6" />
      </>
    ),
    revenue: (
      <>
        <path d="M12 3v18" />
        <path d="M17 7.5A4 4 0 0 0 13.5 6h-3A2.5 2.5 0 0 0 8 8.5v0A2.5 2.5 0 0 0 10.5 11h3A2.5 2.5 0 0 1 16 13.5v0A2.5 2.5 0 0 1 13.5 16h-3A4 4 0 0 1 7 14.5" />
      </>
    ),
    view: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </>
    ),
    ban: (
      <>
        <path d="M18 6 6 18" />
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      </>
    ),
    reactivate: (
      <>
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18.5 10A7 7 0 0 0 6.2 6.2L4 8.4" />
        <path d="M5.5 14A7 7 0 0 0 17.8 17.8L20 15.6" />
      </>
    ),
  };

  return (
    <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
      {icons[type] || icons.revenue}
    </svg>
  );
}

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { confirm, notify } = useFeedback();

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState(null);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [events, setEvents] = useState([]);
  const [spaceReservations, setSpaceReservations] = useState([]);
  const [parkingSlots, setParkingSlots] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        statsResult,
        financeResult,
        pendingEventsResult,
        pendingReservationsResult,
        eventsResult,
        spaceReservationsResult,
        parkingSlotsResult,
        usersResult,
      ] = await Promise.allSettled([
        adminGetStats(token),
        adminGetFinanceSummary(token),
        adminGetPendingEvents(token),
        adminGetPendingReservations(token),
        adminGetEvents(token),
        adminGetAllSpaceReservations(token),
        adminGetParkingSlots(token),
        adminGetUsers(token),
      ]);

      const criticalError =
        statsResult.status === "rejected"
          ? statsResult.reason
          : usersResult.status === "rejected"
            ? usersResult.reason
            : null;

      if (criticalError) {
        if (criticalError.status === 401 || criticalError.status === 403) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setError(criticalError.message);
        return;
      }

      setStats(statsResult.value);
      setFinanceSummary(financeResult.status === "fulfilled" ? financeResult.value : null);
      setUsers(usersResult.value);
      setPendingEvents(pendingEventsResult.status === "fulfilled" ? pendingEventsResult.value : []);
      setPendingReservations(pendingReservationsResult.status === "fulfilled" ? pendingReservationsResult.value : []);
      setEvents(eventsResult.status === "fulfilled" ? eventsResult.value : []);
      setSpaceReservations(spaceReservationsResult.status === "fulfilled" ? spaceReservationsResult.value : []);
      setParkingSlots(parkingSlotsResult.status === "fulfilled" ? parkingSlotsResult.value : []);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [logout, navigate, token]);

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

  const handleUpdateUserRole = async (userId, newRole) => {
    const accepted = await confirm({
      title: t("admin.confirmRoleChange"),
      confirmLabel: t("common.confirm", { defaultValue: "Confirmer" }),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    try {
      await adminUpdateUserRole(userId, newRole, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      notify({
        type: "success",
        title: t("common.success", { defaultValue: "Action confirmée" }),
        message: t("admin.roleUpdated", { defaultValue: "Rôle utilisateur mis à jour." }),
      });
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handleBanUser = async (userId) => {
    const accepted = await confirm({
      title: t("admin.confirmBan"),
      confirmLabel: t("admin.ban", { defaultValue: "Suspendre" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;
    try {
      const updated = await adminBanUser(userId, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)));
      notify({
        type: "success",
        title: t("common.success", { defaultValue: "Action confirmée" }),
        message: t("admin.userSuspended", { defaultValue: "Utilisateur suspendu." }),
      });
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handleReactivateUser = async (userId) => {
    const accepted = await confirm({
      title: t("admin.confirmReactivate"),
      confirmLabel: t("admin.reactivate", { defaultValue: "Réactiver" }),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    try {
      const updated = await adminReactivateUser(userId, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)));
      notify({
        type: "success",
        title: t("common.success", { defaultValue: "Action confirmée" }),
        message: t("admin.userReactivated", { defaultValue: "Utilisateur réactivé." }),
      });
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const handleViewUserDetails = async (userId) => {
    setLoadingDetails(true);
    try {
      const details = await adminGetUserDetails(userId, token);
      setUserDetails(details);
      setSelectedUser(userId);
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setUserDetails(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "ACTIVE": return styles.statusActive;
      case "BANNED": return styles.statusBanned;
      case "DELETED": return styles.statusDeleted;
      case "INACTIVE": return styles.statusInactive;
      default: return "";
    }
  };

  if (!user || user.role !== "ADMIN") return null;
  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("admin.dashboardSubtitle")} />;
  if (error) return <PageState type="error" title={t("common.error")} message={error} />;

  const totalPending = pendingEvents.length + pendingReservations.length;
  const totalParkingSlots = stats?.totalParkingSlots ?? 0;
  const confirmedParkingReservations = stats?.confirmedParkingReservations ?? 0;
  const parkingRevenue = stats?.parkingRevenue ?? 0;
  const userParkingReservations = userDetails?.parkingReservations ?? [];
  const locale = normalizeLocale(i18n.language);
  const formatEuro = (value) => formatMoney(value, locale);
  const formatStat = (value) => formatNumber(value, locale);
  const totalRevenue = stats?.totalRevenue || 0;
  const financeTotal = financeSummary?.meetSpaceEstimatedRevenue ?? totalRevenue;
  const eventGrossRevenue = financeSummary?.eventGrossRevenue ?? stats?.eventRevenue ?? 0;
  const eventCommissionRevenue = financeSummary?.eventCommissionRevenue ?? 0;
  const directRoomRevenue = financeSummary?.directRoomRevenue ?? stats?.spaceRevenue ?? 0;
  const organizerRoomCost = financeSummary?.roomCostChargedToOrganizers ?? 0;
  const parkingFinanceRevenue = financeSummary?.parkingRevenue ?? parkingRevenue;
  const getShare = (value, total = financeTotal) => (total > 0 ? Math.max(4, Math.round(((value || 0) / total) * 100)) : 0);
  const totalReservations =
    (stats?.confirmedSpaceReservations || 0) +
    (stats?.confirmedEventRegistrations || 0) +
    confirmedParkingReservations;
  const activeUsers = users.filter((u) => u.status === "ACTIVE").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  };
  const isFutureOrToday = (value) => {
    const date = toDate(value);
    return Boolean(date && date >= today);
  };
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });
  const formatDateTime = (value) => {
    const date = toDate(value);
    return date ? dateTimeFormatter.format(date) : "-";
  };
  const formatDate = (value) => {
    const date = toDate(value);
    return date ? dateFormatter.format(date) : "-";
  };

  const upcomingEvents = events
    .filter((event) => isFutureOrToday(event.startDateTime) && event.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 4);
  const upcomingSpaceReservations = spaceReservations
    .filter((reservation) => (
      isFutureOrToday(reservation.startDateTime) &&
      reservation.status !== "CANCELLED" &&
      reservation.status !== "REJECTED"
    ))
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 4);
  const futureParkingSlots = parkingSlots
    .filter((slot) => isFutureOrToday(slot.slotDate) && slot.status !== "CANCELLED")
    .sort((a, b) => new Date(a.slotDate) - new Date(b.slotDate));
  const upcomingParkingSlots = futureParkingSlots.slice(0, 4);
  const futureParkingCapacity = futureParkingSlots.reduce((sum, slot) => sum + (slot.parkingCapacity || 0), 0);
  const futureParkingAvailable = futureParkingSlots.reduce((sum, slot) => sum + (slot.availableSpaces || 0), 0);
  const futureParkingReserved = Math.max(0, futureParkingCapacity - futureParkingAvailable);
  const parkingOccupancy = futureParkingCapacity
    ? Math.round((futureParkingReserved / futureParkingCapacity) * 100)
    : 0;

  const tabs = [
    { id: "overview", label: t("admin.overview") },
    { id: "users", label: t("admin.usersManagement") },
    { id: "audit", label: t("admin.auditLogs", "Logs d'audit") },
  ];

  const roleOptions = [
    { value: "MEMBER", label: t("admin.roles.member") },
    { value: "ORGANIZER", label: t("admin.roles.organizer") },
    { value: "ADMIN", label: t("admin.roles.admin") },
  ];

  const activityStats = [
    {
      icon: "reservations",
      label: t("admin.totalReservations"),
      value: totalReservations,
      helper: t("admin.confirmedReservationsHelp"),
    },
    {
      icon: "events",
      label: t("admin.confirmedEventRes"),
      value: stats?.confirmedEventRegistrations || 0,
      helper: t("admin.eventRegistrationsHelp"),
      tone: styles.statBlue,
    },
    {
      icon: "spaces",
      label: t("admin.confirmedSpaceRes"),
      value: stats?.confirmedSpaceReservations || 0,
      helper: t("admin.roomReservationsHelp"),
      tone: styles.statOrange,
    },
    {
      icon: "parking",
      label: t("admin.confirmedParkingReservations"),
      value: confirmedParkingReservations,
      helper: t("admin.parkingReservationsHelp"),
      tone: styles.statGreen,
    },
    {
      icon: "users",
      label: t("admin.activeUsers"),
      value: activeUsers,
      helper: t("admin.activeUsersHelp"),
      tone: styles.statPurple,
    },
  ];

  const revenueItems = [
    {
      label: t("finance.directRoomRevenue"),
      value: directRoomRevenue,
      share: getShare(directRoomRevenue),
      tone: styles.barGold,
    },
    {
      label: t("finance.parkingRevenue"),
      value: parkingFinanceRevenue,
      share: getShare(parkingFinanceRevenue),
      tone: styles.barGreen,
    },
    {
      label: t("finance.eventCommissions"),
      value: eventCommissionRevenue,
      share: getShare(eventCommissionRevenue),
      tone: styles.barBlue,
    },
    {
      label: t("finance.roomCostChargedToOrganizers"),
      value: organizerRoomCost,
      share: getShare(organizerRoomCost),
      tone: styles.barViolet,
    },
  ];

  const priorityItems = [
    {
      icon: "pending",
      label: t("admin.eventsPendingShort"),
      value: pendingEvents.length,
      meta: pendingEvents.length > 0 ? t("admin.requiresReview") : t("admin.noImmediateAction"),
      to: "/admin/events",
    },
    {
      icon: "spaces",
      label: t("admin.roomRequestsPendingShort"),
      value: pendingReservations.length,
      meta: pendingReservations.length > 0 ? t("admin.requiresReview") : t("admin.noImmediateAction"),
      to: "/admin/espaces",
    },
    {
      icon: "parking",
      label: t("admin.parkingOccupancy"),
      value: `${formatStat(parkingOccupancy)}%`,
      meta: t("admin.futureParkingHelp", {
        reserved: formatStat(futureParkingReserved),
        capacity: formatStat(futureParkingCapacity),
      }),
      to: "/admin/parking",
    },
  ];

  const moduleCards = [
    {
      to: "/admin/espaces",
      icon: "spaces",
      label: t("admin.spacesManagement"),
      value: stats?.totalEspaces ?? 0,
      meta: pendingReservations.length > 0 ? `${pendingReservations.length} ${t("admin.pending")}` : t("admin.totalSpaces"),
      tone: styles.moduleBlue,
    },
    {
      to: "/admin/events",
      icon: "events",
      label: t("admin.eventsManagement"),
      value: stats?.totalEvents ?? 0,
      meta: pendingEvents.length > 0 ? `${pendingEvents.length} ${t("admin.pending")}` : t("status.published"),
      tone: styles.moduleGreen,
    },
    {
      to: "/admin/parking",
      icon: "parking",
      label: t("admin.parkingManagement"),
      value: totalParkingSlots,
      meta: `${confirmedParkingReservations} ${t("admin.confirmedParkingReservations").toLowerCase()}`,
      tone: styles.moduleGold,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{t("admin.dashboardKicker")}</p>
          <h1 className={styles.title}>{t("admin.dashboard")}</h1>
          <p className={styles.subtitle}>{t("admin.dashboardSubtitle")}</p>
        </div>
        <Link to="/" className={styles.backLink}>
          {t("common.backToSite")}
        </Link>
      </div>

      {pendingEvents.length > 0 && (
        <div className={styles.alertBanner}>
          <span className={styles.alertIcon}>!</span>
          <span>
            {formatStat(pendingEvents.length)} {t("admin.eventsPendingApproval")}
          </span>
          <Link to="/admin/events" className={styles.alertButton}>
            {t("common.view")}
          </Link>
        </div>
      )}

      {pendingReservations.length > 0 && (
        <div className={styles.alertBanner}>
          <span className={styles.alertIcon}>!</span>
          <span>
            {formatStat(pendingReservations.length)} {t("admin.premiumRoomReservationsPending")}
          </span>
          <Link to="/admin/espaces" className={styles.alertButton}>
            {t("common.view")}
          </Link>
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
          </button>
        ))}
      </div>

      {activeTab === "overview" && stats && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{t("admin.activityGlobal")}</p>
              <h2 className={styles.sectionTitle}>{t("admin.overviewTitle")}</h2>
              <p className={styles.sectionIntro}>{t("admin.overviewHint")}</p>
            </div>
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              {t("admin.pendingApprovals")}: {formatStat(totalPending)}
            </span>
          </div>

          <div className={styles.activityGrid}>
            {activityStats.map((item) => (
              <div key={item.label} className={`${styles.activityCard} ${item.tone || ""}`}>
                <div className={styles.activityIcon}>
                  <AdminIcon type={item.icon} />
                </div>
                <div>
                  <span>{item.label}</span>
                  <strong>{formatStat(item.value)}</strong>
                  <small>{item.helper}</small>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.adminOverviewGrid}>
            <div className={styles.financeOverviewPanel}>
              <div className={styles.financeOverviewHeader}>
                <div>
                  <p className={styles.financeEyebrow}>{t("finance.indicativeEstimate")}</p>
                  <h3>{t("admin.estimatedRevenueTitle")}</h3>
                  <span>{t("finance.adminHint")}</span>
                </div>
                <div className={styles.financeTotalCard}>
                  <span>{t("finance.meetSpaceEstimatedRevenue")}</span>
                  <strong>{formatEuro(financeTotal)}</strong>
                  <small>{t("admin.estimatedDisclaimer")}</small>
                </div>
              </div>

              <div className={styles.financeBreakdownPanel}>
                {revenueItems.map((item) => (
                  <div key={item.label} className={styles.revenueRow}>
                    <div className={styles.revenueRowHeader}>
                      <span>{item.label}</span>
                      <strong>{formatEuro(item.value)}</strong>
                    </div>
                    <div className={styles.revenueTrack}>
                      <span className={item.tone} style={{ width: `${item.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.financeContext}>
                <span>{t("admin.grossEventVolume")}</span>
                <strong>{formatEuro(eventGrossRevenue)}</strong>
                <small>{t("admin.grossEventVolumeHelp")}</small>
              </div>
            </div>

            <aside className={styles.statusConsole}>
              <div className={styles.statusHeader}>
                <span>{t("admin.priorities")}</span>
                <strong>{t("admin.adminPrioritiesTitle")}</strong>
              </div>
              <p className={styles.panelText}>{t("admin.adminPrioritiesHint")}</p>

              <div className={styles.cockpitStack}>
                {priorityItems.map((item) => (
                  <Link key={item.label} to={item.to} className={styles.cockpitItem}>
                    <div className={styles.cockpitIcon}>
                      <AdminIcon type={item.icon} />
                    </div>
                    <div>
                      <span>{item.label}</span>
                      <strong>{typeof item.value === "number" ? formatStat(item.value) : item.value}</strong>
                      <small>{item.meta}</small>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>

          <div className={styles.planningGrid}>
            <div className={styles.planningPanel}>
              <div className={styles.panelHeader}>
                <span>{t("admin.upcomingPlanningTitle")}</span>
                <strong>{t("admin.upcomingEvents")}</strong>
              </div>
              <p className={styles.panelText}>{t("admin.upcomingPlanningHint")}</p>
              <div className={styles.timelineList}>
                {upcomingEvents.length > 0 ? upcomingEvents.map((event) => (
                  <Link key={event.id} to="/admin/events" className={styles.timelineItem}>
                    <div>
                      <span className={styles.timelineMeta}>{formatDateTime(event.startDateTime)}</span>
                      <strong>{event.title}</strong>
                      <small>{event.location || t("nav.events")}</small>
                    </div>
                    <span className={styles.statusPill}>
                      {formatStat(event.registeredCount || 0)} / {formatStat(event.capacity || 0)}
                    </span>
                  </Link>
                )) : (
                  <p className={styles.emptyLine}>{t("admin.noUpcomingEvents")}</p>
                )}
              </div>
            </div>

            <div className={styles.planningPanel}>
              <div className={styles.panelHeader}>
                <span>{t("admin.upcomingPlanningTitle")}</span>
                <strong>{t("admin.upcomingRooms")}</strong>
              </div>
              <p className={styles.panelText}>{t("admin.upcomingRoomsHint")}</p>
              <div className={styles.timelineList}>
                {upcomingSpaceReservations.length > 0 ? upcomingSpaceReservations.map((reservation) => (
                  <Link key={reservation.id} to="/admin/espaces" className={styles.timelineItem}>
                    <div>
                      <span className={styles.timelineMeta}>{formatDateTime(reservation.startDateTime)}</span>
                      <strong>{reservation.espaceName || t("nav.spaces")}</strong>
                      <small>{reservation.userName}</small>
                    </div>
                    <span className={styles.statusPill}>
                      {t(`status.${String(reservation.status).toLowerCase()}`, reservation.status)}
                    </span>
                  </Link>
                )) : (
                  <p className={styles.emptyLine}>{t("admin.noUpcomingRooms")}</p>
                )}
              </div>
            </div>

            <div className={styles.planningPanel}>
              <div className={styles.panelHeader}>
                <span>{t("admin.upcomingPlanningTitle")}</span>
                <strong>{t("admin.parkingFocus")}</strong>
              </div>
              <p className={styles.panelText}>{t("admin.parkingFocusHint")}</p>
              <div className={styles.timelineList}>
                {upcomingParkingSlots.length > 0 ? upcomingParkingSlots.map((slot) => (
                  <Link key={slot.id} to="/admin/parking" className={styles.timelineItem}>
                    <div>
                      <span className={styles.timelineMeta}>{formatDate(slot.slotDate)}</span>
                      <strong>{slot.title}</strong>
                      <small>
                        {formatStat((slot.parkingCapacity || 0) - (slot.availableSpaces || 0))} / {formatStat(slot.parkingCapacity || 0)} {t("parking.places").toLowerCase()}
                      </small>
                    </div>
                    <span className={styles.statusPill}>
                      {formatStat(slot.availableSpaces || 0)} {t("admin.availableShort")}
                    </span>
                  </Link>
                )) : (
                  <p className={styles.emptyLine}>{t("admin.noUpcomingParking")}</p>
                )}
              </div>
            </div>
          </div>

          <div className={styles.moduleGrid}>
            {moduleCards.map((module) => (
              <Link key={module.to} to={module.to} className={`${styles.moduleCard} ${module.tone}`}>
                <div className={styles.moduleIcon}>
                  <AdminIcon type={module.icon} />
                </div>
                <div>
                  <span>{module.label}</span>
                  <strong>{formatStat(module.value)}</strong>
                  <small>{module.meta}</small>
                </div>
                <span className={styles.moduleArrow}>{"\u2192"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("admin.usersManagement")}</h2>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("common.email")}</th>
                  <th>{t("admin.role")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.status !== "ACTIVE" ? styles.inactiveRow : ""}>
                    <td>{u.firstName} {u.lastName}</td>
                    <td>{u.email}</td>
                    <td>
                      <SelectDropdown
                        value={u.role}
                        onChange={(value) => handleUpdateUserRole(u.id, value)}
                        options={roleOptions}
                        label={t("admin.role")}
                        className={styles.selectDropdown}
                        disabled={u.id === user.id || u.status !== "ACTIVE"}
                      />
                      {u.id === user.id && <span className={styles.currentUserBadge}>{t("admin.currentUser")}</span>}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(u.status)}`}>
                        {t(`admin.userStatus.${u.status?.toLowerCase()}`, u.status)}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        className={styles.viewButton}
                        onClick={() => handleViewUserDetails(u.id)}
                        title={t("admin.viewDetails")}
                      >
                        <AdminIcon type="view" />
                        <span>{t("common.view")}</span>
                      </button>
                      {u.id !== user.id && (
                        <>
                          {u.status === "ACTIVE" ? (
                            <button
                              className={styles.banButton}
                              onClick={() => handleBanUser(u.id)}
                              title={t("admin.banUser")}
                            >
                              <AdminIcon type="ban" />
                              <span>{t("admin.banUser")}</span>
                            </button>
                          ) : (
                            <button
                              className={styles.reactivateButton}
                              onClick={() => handleReactivateUser(u.id)}
                              title={t("admin.reactivateUser")}
                            >
                              <AdminIcon type="reactivate" />
                              <span>{t("admin.reactivateUser")}</span>
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedUser && userDetails && (
            <div className={styles.modalOverlay} onClick={closeUserDetails}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>{userDetails.firstName} {userDetails.lastName}</h3>
                  <button className={styles.closeButton} onClick={closeUserDetails} aria-label={t("common.close", "Fermer")}>{"\u00d7"}</button>
                </div>
                <div className={styles.modalContent}>
                  <div className={styles.userInfo}>
                    <p><strong>Email:</strong> {userDetails.email}</p>
                    <p><strong>{t("admin.role")}:</strong> {t(`admin.roles.${userDetails.role?.toLowerCase()}`, userDetails.role)}</p>
                    <p><strong>{t("common.status")}:</strong>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(userDetails.status)}`}>
                        {t(`admin.userStatus.${userDetails.status?.toLowerCase()}`, userDetails.status)}
                      </span>
                    </p>
                    <p><strong>{t("admin.createdAt")}:</strong> {new Date(userDetails.createdAt).toLocaleDateString()}</p>
                  </div>

                  <h4>{t("admin.spaceReservations")}</h4>
                  {userDetails.spaceReservations?.length > 0 ? (
                    <ul className={styles.reservationList}>
                      {userDetails.spaceReservations.map((r) => (
                        <li key={r.id} className={styles.reservationItem}>
                          <span>{r.espaceName || "Espace"}</span>
                          <span>{new Date(r.startDateTime).toLocaleDateString()}</span>
                          <span className={`${styles.statusBadge} ${r.status === "CANCELLED" ? styles.statusBanned : styles.statusActive}`}>
                            {r.status}
                          </span>
                          <span>{formatEuro(r.totalPrice)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className={styles.noData}>{t("admin.noReservations")}</p>}

                  <h4>{t("admin.eventReservations")}</h4>
                  {userDetails.eventRegistrations?.length > 0 ? (
                    <ul className={styles.reservationList}>
                      {userDetails.eventRegistrations.map((r) => (
                        <li key={r.id} className={styles.reservationItem}>
                          <span>{r.eventTitle || t("nav.events")}</span>
                          <span>{r.numberOfParticipants} {t("common.participants")}</span>
                          <span className={`${styles.statusBadge} ${r.status === "CANCELLED" ? styles.statusBanned : styles.statusActive}`}>
                            {r.status}
                          </span>
                          <span>{formatEuro(r.totalPrice)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className={styles.noData}>{t("admin.noReservations")}</p>}

                  <h4>{t("admin.parkingReservations")}</h4>
                  {userParkingReservations.length > 0 ? (
                    <ul className={styles.reservationList}>
                      {userParkingReservations.map((r) => (
                        <li key={r.id} className={styles.reservationItem}>
                          <span>{r.parkingSlotTitle || t("parking.session")}</span>
                          <span>{r.reservedSpaces} {t("parking.places").toLowerCase()}</span>
                          <span className={`${styles.statusBadge} ${r.status === "CANCELLED" ? styles.statusBanned : styles.statusActive}`}>
                            {r.status}
                          </span>
                          <span>{formatEuro(r.totalPrice)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className={styles.noData}>{t("admin.noReservations")}</p>}
                </div>
              </div>
            </div>
          )}
          {loadingDetails && <div className={styles.loadingOverlay}>{t("common.loading")}</div>}
        </section>
      )}

      {activeTab === "audit" && <AuditLogs />}
    </div>
  );
}
