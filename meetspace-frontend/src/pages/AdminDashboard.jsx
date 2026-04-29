import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  adminGetStats,
  adminGetPendingEvents,
  adminGetPendingReservations,
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

const EURO = "\u20ac";

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState(null);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        statsData,
        pendingData,
        pendingResData,
        usersData,
      ] = await Promise.all([
        adminGetStats(token),
        adminGetPendingEvents(token),
        adminGetPendingReservations(token),
        adminGetUsers(token),
      ]);

      setStats(statsData);
      setPendingEvents(pendingData);
      setPendingReservations(pendingResData);
      setUsers(usersData);
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
    if (!window.confirm(t("admin.confirmRoleChange"))) return;
    try {
      await adminUpdateUserRole(userId, newRole, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBanUser = async (userId) => {
    if (!window.confirm(t("admin.confirmBan"))) return;
    try {
      const updated = await adminBanUser(userId, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReactivateUser = async (userId) => {
    if (!window.confirm(t("admin.confirmReactivate"))) return;
    try {
      const updated = await adminReactivateUser(userId, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewUserDetails = async (userId) => {
    setLoadingDetails(true);
    try {
      const details = await adminGetUserDetails(userId, token);
      setUserDetails(details);
      setSelectedUser(userId);
    } catch (err) {
      alert(err.message);
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
  if (loading) return <div className={styles.loading}>{t("common.loading")}</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const totalPending = pendingEvents.length + pendingReservations.length;
  const totalParkingSlots = stats?.totalParkingSlots ?? 0;
  const confirmedParkingReservations = stats?.confirmedParkingReservations ?? 0;
  const parkingRevenue = stats?.parkingRevenue ?? 0;
  const userParkingReservations = userDetails?.parkingReservations ?? [];
  const formatEuro = (value) => `${(value || 0).toFixed(2)} ${EURO}`;

  const tabs = [
    { id: "overview", label: t("admin.overview") },
    { id: "users", label: t("admin.usersManagement") },
    { id: "audit", label: t("admin.auditLogs", "Logs d'audit") },
  ];

  const navCards = [
    {
      to: "/admin/espaces",
      icon: "spaces",
      title: t("admin.spacesManagement"),
      meta: `${stats?.totalEspaces || 0} ${t("nav.spaces").toLowerCase()}`,
      badge: pendingReservations.length > 0 ? `${pendingReservations.length} ${t("admin.pending")}` : "",
    },
    {
      to: "/admin/events",
      icon: "events",
      title: t("admin.eventsManagement"),
      meta: `${stats?.totalEvents || 0} ${t("nav.events").toLowerCase()}`,
      badge: pendingEvents.length > 0 ? `${pendingEvents.length} ${t("admin.pending")}` : "",
    },
    {
      to: "/admin/parking",
      icon: "parking",
      title: t("admin.parkingManagement"),
      meta: `${totalParkingSlots} ${t("admin.totalSessions").toLowerCase()}`,
      badge: "",
    },
  ];

  const platformStats = [
    { icon: "users", label: t("admin.totalUsers"), value: stats?.totalUsers ?? 0 },
    { icon: "spaces", label: t("admin.totalSpaces"), value: stats?.totalEspaces ?? 0, tone: styles.statBlue },
    { icon: "events", label: t("admin.totalEvents"), value: stats?.totalEvents ?? 0, tone: styles.statGreen },
    { icon: "pending", label: t("admin.pendingApprovals"), value: totalPending, tone: styles.statOrange },
  ];

  const reservationStats = [
    { icon: "spaces", label: t("admin.confirmedSpaceRes"), value: stats?.confirmedSpaceReservations || 0 },
    { icon: "events", label: t("admin.confirmedEventRes"), value: stats?.confirmedEventRegistrations || 0, tone: styles.statBlue },
    { icon: "parking", label: t("admin.confirmedParkingReservations"), value: confirmedParkingReservations, tone: styles.statGreen },
  ];

  const revenueStats = [
    { icon: "spaces", label: t("admin.spaceRevenue"), value: formatEuro(stats?.spaceRevenue) },
    { icon: "events", label: t("admin.eventRevenue"), value: formatEuro(stats?.eventRevenue), tone: styles.statBlue },
    { icon: "parking", label: t("admin.parkingRevenue"), value: formatEuro(parkingRevenue), tone: styles.statGreen },
    { icon: "revenue", label: t("admin.totalRevenue"), value: formatEuro(stats?.totalRevenue), tone: styles.statPurple },
  ];

  const dashboardSignals = [
    {
      icon: "spaces",
      label: t("admin.spacesManagement"),
      value: stats?.totalEspaces ?? 0,
      meta: pendingReservations.length > 0 ? `${pendingReservations.length} ${t("admin.pending")}` : t("common.status"),
    },
    {
      icon: "events",
      label: t("admin.eventsManagement"),
      value: stats?.totalEvents ?? 0,
      meta: pendingEvents.length > 0 ? `${pendingEvents.length} ${t("admin.pending")}` : t("status.published"),
    },
    {
      icon: "parking",
      label: t("admin.parkingManagement"),
      value: totalParkingSlots,
      meta: `${confirmedParkingReservations} ${t("admin.confirmedParkingReservations").toLowerCase()}`,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
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
            {pendingEvents.length} {t("admin.eventsPendingApproval")}
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
            {pendingReservations.length} {t("admin.premiumRoomReservationsPending")}
          </span>
          <Link to="/admin/espaces" className={styles.alertButton}>
            {t("common.view")}
          </Link>
        </div>
      )}

      <div className={styles.navCards}>
        {navCards.map((card) => (
          <Link key={card.to} to={card.to} className={styles.navCard}>
            <div className={styles.navCardIcon}>
              <AdminIcon type={card.icon} />
            </div>
            <div className={styles.navCardContent}>
              <h3>{card.title}</h3>
              <p>{card.meta}</p>
              {card.badge && <span className={styles.navBadge}>{card.badge}</span>}
            </div>
          </Link>
        ))}
      </div>

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
              <p className={styles.sectionEyebrow}>MeetSpace Admin</p>
              <h2 className={styles.sectionTitle}>{t("admin.overview")}</h2>
            </div>
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              {t("admin.pendingApprovals")}: {totalPending}
            </span>
          </div>

          <div className={styles.commandPanel}>
            <div className={styles.commandIcon}>
              <AdminIcon type="revenue" />
            </div>
            <div className={styles.commandContent}>
              <span>{t("admin.totalRevenue")}</span>
              <strong>{formatEuro(stats.totalRevenue)}</strong>
            </div>
            <div className={styles.commandChips}>
              <span>{t("admin.confirmedEventRes")}: {stats.confirmedEventRegistrations || 0}</span>
              <span>{t("admin.confirmedSpaceRes")}: {stats.confirmedSpaceReservations || 0}</span>
              <span>{t("admin.confirmedParkingReservations")}: {confirmedParkingReservations}</span>
            </div>
          </div>

          <div className={styles.signalGrid}>
            {dashboardSignals.map((signal) => (
              <div key={signal.label} className={styles.signalCard}>
                <div className={styles.signalIcon}>
                  <AdminIcon type={signal.icon} />
                </div>
                <div>
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.meta}</small>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.statsGrid}>
            {platformStats.map((item) => (
              <div key={item.label} className={`${styles.statCard} ${item.tone || ""}`}>
                <div className={styles.statIcon}>
                  <AdminIcon type={item.icon} />
                </div>
                <p className={styles.statLabel}>{item.label}</p>
                <p className={styles.statNumber}>{item.value}</p>
              </div>
            ))}
          </div>

          <h3 className={styles.subsectionTitle}>{t("admin.reservationsOverview")}</h3>
          <div className={styles.statsGrid}>
            {reservationStats.map((item) => (
              <div key={item.label} className={`${styles.statCard} ${item.tone || ""}`}>
                <div className={styles.statIcon}>
                  <AdminIcon type={item.icon} />
                </div>
                <p className={styles.statLabel}>{item.label}</p>
                <p className={styles.statNumber}>{item.value}</p>
              </div>
            ))}
          </div>

          <h3 className={styles.subsectionTitle}>{t("admin.revenue")}</h3>
          <div className={styles.statsGrid}>
            {revenueStats.map((item) => (
              <div key={item.label} className={`${styles.statCard} ${item.tone || ""}`}>
                <div className={styles.statIcon}>
                  <AdminIcon type={item.icon} />
                </div>
                <p className={styles.statLabel}>{item.label}</p>
                <p className={styles.statNumber}>{item.value}</p>
              </div>
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
                      <select
                        value={u.role}
                        onChange={(ev) => handleUpdateUserRole(u.id, ev.target.value)}
                        className={styles.select}
                        disabled={u.id === user.id || u.status !== "ACTIVE"}
                      >
                        <option value="MEMBER">{t("admin.roles.member")}</option>
                        <option value="ORGANIZER">{t("admin.roles.organizer")}</option>
                        <option value="ADMIN">{t("admin.roles.admin")}</option>
                      </select>
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
