import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  adminGetEspaces,
  adminDeleteEspace,
  adminGetAllSpaceReservations,
  adminGetPendingReservations,
  adminApproveReservation,
} from "../services/api";
import PageState from "../components/PageState";
import styles from "./AdminEspacesPage.module.css";

export default function AdminEspacesPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  };

  const [activeTab, setActiveTab] = useState("spaces");
  const [espaces, setEspaces] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const getSpaceTypeLabel = (type) => t(`spaceType.${type}`, { defaultValue: type });
  const isPremiumRoom = (type) => type === "PREMIUM_ROOM";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [espacesData, reservationsData, pendingData] = await Promise.all([
        adminGetEspaces(token),
        adminGetAllSpaceReservations(token),
        adminGetPendingReservations(token),
      ]);
      setEspaces(espacesData);
      setReservations(reservationsData);
      setPendingReservations(pendingData);
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

  const handleDeleteEspace = async (id) => {
    if (!window.confirm(t("admin.confirmDeleteSpace"))) return;
    try {
      await adminDeleteEspace(id, token);
      setEspaces((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApproveReservation = async (id) => {
    if (!window.confirm(t("admin.confirmApproveRoomRequest"))) return;
    try {
      await adminApproveReservation(id, true, null, token);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectReservation = async (id) => {
    if (!rejectionReason.trim()) {
      alert(t("admin.rejectionReasonRequired"));
      return;
    }
    try {
      await adminApproveReservation(id, false, rejectionReason, token);
      setRejectingId(null);
      setRejectionReason("");
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (filterStatus === "ALL") return true;
    return r.status === filterStatus;
  });

  if (!user || user.role !== "ADMIN") return null;
  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("admin.spacesManagement")} />;
  if (error) return <PageState type="error" title={t("common.error")} message={error} />;

  const tabs = [
    { id: "spaces", label: t("admin.spacesManagement") },
    { id: "pending", label: t("admin.pendingReservations"), badge: pendingReservations.length },
    { id: "reservations", label: t("admin.spaceReservations") },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1 className={styles.title}>{t("admin.spacesManagement")}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link to="/admin" className={styles.backLink}>
            {t("admin.backToDashboard")}
          </Link>
          <Link to="/admin/espaces/new" className={styles.btnPrimary}>
            + {t("admin.createSpace")}
          </Link>
        </div>
      </div>

      {pendingReservations.length > 0 && activeTab !== "pending" && (
        <div className={styles.alertBanner}>
          <span className={styles.alertIcon}>!</span>
          <span>{pendingReservations.length} {t("admin.premiumRoomReservationsPending")}</span>
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

      {/* Onglet: Liste des espaces */}
      {activeTab === "spaces" && (
        <section className={styles.section}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("common.type")}</th>
                  <th>{t("common.capacity")}</th>
                  <th>{t("spaces.basePrice")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {espaces.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles.noData}>{t("admin.noSpaces")}</td>
                  </tr>
                ) : (
                  espaces.map((e) => (
                    <tr key={e.id}>
                      <td className={styles.nameCell}>{e.name}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${isPremiumRoom(e.type) ? styles.typePremiumRoom : styles.typeSalle}`}>
                          {getSpaceTypeLabel(e.type)}
                        </span>
                      </td>
                      <td>{e.capacity} {t("common.persons")}</td>
                      <td>{e.basePrice} € {t("common.perHour")}</td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/admin/espaces/${e.id}/edit`} className={styles.btnGhost}>
                            {t("common.edit")}
                          </Link>
                          <button onClick={() => handleDeleteEspace(e.id)} className={styles.btnDanger}>
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

      {/* Onglet: Réservations en attente */}
      {activeTab === "pending" && (
        <section className={styles.section}>
          {pendingReservations.length === 0 ? (
            <p className={styles.info}>{t("admin.noPendingReservations")}</p>
          ) : (
            <div className={styles.cardsGrid}>
              {pendingReservations.map((r) => (
                <div key={r.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3 className={styles.cardTitle}>{r.espace?.name || t("spaces.space")}</h3>
                      <p className={styles.cardMeta}>{r.user?.email}</p>
                      <p className={styles.cardDate}>
                        {new Date(r.startDateTime).toLocaleString(getDateLocale())} - {new Date(r.endDateTime).toLocaleString(getDateLocale())}
                      </p>
                    </div>
                    <span className={styles.badgePending}>{t("status.pending_approval")}</span>
                  </div>

                  {r.justification && (
                    <div className={styles.justification}>
                      <strong>{t("reservation.justification")}:</strong>
                      <p>{r.justification}</p>
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    <span className={styles.price}>{r.totalPrice} €</span>

                    {rejectingId === r.id ? (
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
                          <button onClick={() => handleRejectReservation(r.id)} className={styles.btnDanger}>
                            {t("admin.confirmReject")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.cardActions}>
                        <button onClick={() => handleApproveReservation(r.id)} className={styles.btnSuccess}>
                          {t("admin.approve")}
                        </button>
                        <button onClick={() => setRejectingId(r.id)} className={styles.btnDanger}>
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

      {/* Onglet: Toutes les réservations */}
      {activeTab === "reservations" && (
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
              <option value="PENDING_APPROVAL">{t("status.pending_approval")}</option>
              <option value="CANCELLED">{t("status.cancelled")}</option>
            </select>
            <span className={styles.resultCount}>
              {filteredReservations.length} {t("admin.reservationsShown")}
            </span>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("spaces.space")}</th>
                  <th>{t("admin.user")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles.noData}>{t("admin.noReservations")}</td>
                  </tr>
                ) : (
                  filteredReservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.espaceName}</td>
                      <td>
                        <div>
                          <div>{r.userFullName || r.userEmail}</div>
                          {r.userFullName && <small className={styles.emailSmall}>{r.userEmail}</small>}
                        </div>
                      </td>
                      <td>{new Date(r.startDateTime).toLocaleString(getDateLocale())}</td>
                      <td>{r.totalPrice} €</td>
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
