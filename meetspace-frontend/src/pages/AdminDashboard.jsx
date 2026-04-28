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

export default function AdminDashboard() {
  const { user, token } = useAuth();
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

  const tabs = [
    { id: "overview", label: t("admin.overview") },
    { id: "users", label: t("admin.usersManagement") },
    { id: "audit", label: t("admin.auditLogs", "Logs d'audit") },
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
          ← {t("common.backToSite")}
        </Link>
      </div>

      {/* Alertes pour approbations en attente */}
      {pendingEvents.length > 0 && (
        <div className={styles.alertBanner}>
          <span className={styles.alertIcon}>⚠️</span>
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
          <span className={styles.alertIcon}>⚠️</span>
          <span>
            {pendingReservations.length} {t("admin.premiumRoomReservationsPending")}
          </span>
          <Link to="/admin/espaces" className={styles.alertButton}>
            {t("common.view")}
          </Link>
        </div>
      )}

      {/* Navigation principale vers les sections de gestion */}
      <div className={styles.navCards}>
        <Link to="/admin/espaces" className={styles.navCard}>
          <div className={styles.navCardIcon}>🏢</div>
          <div className={styles.navCardContent}>
            <h3>{t("admin.spacesManagement")}</h3>
            <p>{stats?.totalEspaces || 0} {t("nav.spaces").toLowerCase()}</p>
            {pendingReservations.length > 0 && (
              <span className={styles.navBadge}>{pendingReservations.length} {t("admin.pending")}</span>
            )}
          </div>
        </Link>

        <Link to="/admin/events" className={styles.navCard}>
          <div className={styles.navCardIcon}>🎉</div>
          <div className={styles.navCardContent}>
            <h3>{t("admin.eventsManagement")}</h3>
            <p>{stats?.totalEvents || 0} {t("nav.events").toLowerCase()}</p>
            {pendingEvents.length > 0 && (
              <span className={styles.navBadge}>{pendingEvents.length} {t("admin.pending")}</span>
            )}
          </div>
        </Link>

        <Link to="/admin/parking" className={styles.navCard}>
          <div className={styles.navCardIcon}>🅿️</div>
          <div className={styles.navCardContent}>
            <h3>{t("admin.parkingManagement")}</h3>
            <p>{totalParkingSlots} {t("admin.totalSessions").toLowerCase()}</p>
          </div>
        </Link>
      </div>

      {/* Tabs pour Overview et Users */}
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
          <h2 className={styles.sectionTitle}>{t("admin.overview")}</h2>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>{t("admin.totalUsers")}</p>
              <p className={styles.statNumber}>{stats.totalUsers}</p>
            </div>
            <div className={`${styles.statCard} ${styles.statBlue}`}>
              <p className={styles.statLabel}>{t("admin.totalSpaces")}</p>
              <p className={styles.statNumber}>{stats.totalEspaces}</p>
            </div>
            <div className={`${styles.statCard} ${styles.statGreen}`}>
              <p className={styles.statLabel}>{t("admin.totalEvents")}</p>
              <p className={styles.statNumber}>{stats.totalEvents}</p>
            </div>
            <div className={`${styles.statCard} ${styles.statOrange}`}>
              <p className={styles.statLabel}>{t("admin.pendingApprovals")}</p>
              <p className={styles.statNumber}>{totalPending}</p>
            </div>
          </div>

          <h3 className={styles.subsectionTitle}>{t("admin.reservationsOverview")}</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>{t("admin.confirmedSpaceRes")}</p>
              <p className={styles.statNumber}>{stats.confirmedSpaceReservations || 0}</p>
            </div>
            <div className={`${styles.statCard} ${styles.statBlue}`}>
              <p className={styles.statLabel}>{t("admin.confirmedEventRes")}</p>
              <p className={styles.statNumber}>{stats.confirmedEventRegistrations || 0}</p>
            </div>
            <div className={`${styles.statCard} ${styles.statGreen}`}>
              <p className={styles.statLabel}>{t("admin.confirmedParkingReservations")}</p>
              <p className={styles.statNumber}>{confirmedParkingReservations}</p>
            </div>
          </div>

          <h3 className={styles.subsectionTitle}>{t("admin.revenue")}</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>{t("admin.spaceRevenue")}</p>
              <p className={styles.statNumber}>
                {(stats.spaceRevenue || 0).toFixed(2)} €
              </p>
            </div>
            <div className={`${styles.statCard} ${styles.statBlue}`}>
              <p className={styles.statLabel}>{t("admin.eventRevenue")}</p>
              <p className={styles.statNumber}>
                {(stats.eventRevenue || 0).toFixed(2)} €
              </p>
            </div>
            <div className={`${styles.statCard} ${styles.statGreen}`}>
              <p className={styles.statLabel}>{t("admin.parkingRevenue")}</p>
              <p className={styles.statNumber}>
                {parkingRevenue.toFixed(2)} €
              </p>
            </div>
            <div className={`${styles.statCard} ${styles.statPurple}`}>
              <p className={styles.statLabel}>{t("admin.totalRevenue")}</p>
              <p className={styles.statNumber}>
                {(stats.totalRevenue || 0).toFixed(2)} €
              </p>
            </div>
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
                        👁️
                      </button>
                      {u.id !== user.id && (
                        <>
                          {u.status === "ACTIVE" ? (
                            <button
                              className={styles.banButton}
                              onClick={() => handleBanUser(u.id)}
                              title={t("admin.banUser")}
                            >
                              🚫
                            </button>
                          ) : (
                            <button
                              className={styles.reactivateButton}
                              onClick={() => handleReactivateUser(u.id)}
                              title={t("admin.reactivateUser")}
                            >
                              ✅
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

          {/* Modal détails utilisateur */}
          {selectedUser && userDetails && (
            <div className={styles.modalOverlay} onClick={closeUserDetails}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>{userDetails.firstName} {userDetails.lastName}</h3>
                  <button className={styles.closeButton} onClick={closeUserDetails}>×</button>
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
                          <span>{r.totalPrice?.toFixed(2)}€</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className={styles.noData}>{t("admin.noReservations")}</p>}

                  <h4>{t("admin.eventReservations")}</h4>
                  {userDetails.eventRegistrations?.length > 0 ? (
                    <ul className={styles.reservationList}>
                      {userDetails.eventRegistrations.map((r) => (
                        <li key={r.id} className={styles.reservationItem}>
                          <span>{r.eventTitle || "Événement"}</span>
                          <span>{r.numberOfParticipants} {t("common.participants")}</span>
                          <span className={`${styles.statusBadge} ${r.status === "CANCELLED" ? styles.statusBanned : styles.statusActive}`}>
                            {r.status}
                          </span>
                          <span>{r.totalPrice?.toFixed(2)}€</span>
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
                          <span>{r.totalPrice?.toFixed(2)}€</span>
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
