import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  adminDeleteParkingSlot,
  adminGetAllParkingReservations,
  adminGetParkingSlots,
} from "../services/api";
import PageState from "../components/PageState";
import WorkspaceNav from "../components/WorkspaceNav";
import SelectDropdown from "../components/SelectDropdown";
import { useFeedback } from "../context/FeedbackContext";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import styles from "./AdminParkingPage.module.css";

export default function AdminParkingPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { confirm, notify } = useFeedback();
  const locale = normalizeLocale(i18n.language);

  const [activeTab, setActiveTab] = useState("parkingSlots");
  const [parkingSlots, setParkingSlots] = useState([]);
  const [parkingReservations, setParkingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const requestVersion = useRef(0);

  const loadData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const data = activeTab === "parkingSlots"
        ? await adminGetParkingSlots(token)
        : await adminGetAllParkingReservations(token);
      if (version !== requestVersion.current) return;
      if (activeTab === "parkingSlots") setParkingSlots(data);
      else setParkingReservations(data);
    } catch (err) {
      if (version === requestVersion.current) setError(err.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      navigate("/login");
      return;
    }

    const run = async () => {
      await loadData();
    };

    run();
    return () => { requestVersion.current += 1; };
  }, [loadData, navigate, user]);

  const handleDeleteParkingSlot = async (id) => {
    const accepted = await confirm({
      title: t("admin.confirmDeleteSession"),
      confirmLabel: t("common.delete", { defaultValue: "Supprimer" }),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!accepted) return;
    try {
      await adminDeleteParkingSlot(id, token);
      setParkingSlots((previousSlots) => previousSlots.filter((parkingSlot) => parkingSlot.id !== id));
      notify({
        type: "success",
        title: t("common.success", { defaultValue: "Action confirmée" }),
        message: t("admin.parkingSlotDeleted", { defaultValue: "Créneau parking supprimé." }),
      });
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    }
  };

  const filteredParkingReservations = parkingReservations.filter((parkingReservation) => {
    if (filterStatus === "ALL") return true;
    return parkingReservation.status === filterStatus;
  });

  if (!user || user.role !== "ADMIN") return null;

  const tabs = [
    { id: "parkingSlots", label: t("admin.parkingManagement") },
    { id: "parkingReservations", label: t("admin.parkingReservations") },
  ];

  const parkingReservationStatusOptions = [
    { value: "ALL", label: t("common.all") },
    { value: "CONFIRMED", label: t("status.confirmed") },
    { value: "CANCELLED", label: t("status.cancelled") },
  ];

  return (
    <div className={styles.container}>
      <WorkspaceNav scope="admin" />
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1 className={styles.title}>{t("admin.parkingManagement")}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link to="/admin/parking/check-in" className={styles.btnPrimary}>
            {t("parking.scanAccess", { defaultValue: "Scanner un accès" })}
          </Link>
          <Link to="/admin/parking/new" className={styles.btnPrimary}>
            + {t("admin.createSession")}
          </Link>
        </div>
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

      {loading && <PageState type="loading" title={t("common.loading")} message={t(activeTab === "parkingSlots" ? "admin.parkingManagement" : "admin.parkingReservations")} />}
      {!loading && error && <PageState type="error" title={t("common.error")} message={error} actionLabel={t("common.retry")} onAction={loadData} />}

      {/* Onglet: Liste des sessions */}
      {!loading && !error && activeTab === "parkingSlots" && (
        <section className={styles.section}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("common.title")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.time")}</th>
                  <th>{t("parking.placesAvailable")}</th>
                  <th>{t("parking.rateLabel")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {parkingSlots.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={styles.noData}>{t("admin.noSessions")}</td>
                  </tr>
                ) : (
                  parkingSlots.map((parkingSlot) => (
                    <tr key={parkingSlot.id}>
                      <td className={styles.nameCell}>{parkingSlot.title || t("nav.parking")}</td>
                      <td>{new Date(`${parkingSlot.slotDate}T00:00:00`).toLocaleDateString(locale, { dateStyle: "medium" })}</td>
                      <td>{parkingSlot.startTime.slice(0, 5)} – {parkingSlot.endTime.slice(0, 5)}</td>
                      <td>
                        <span className={styles.capacityBadge}>
                          {formatNumber(parkingSlot.availableSpaces, locale)} / {formatNumber(parkingSlot.parkingCapacity, locale)}
                        </span>
                        <small className={styles.emailSmall}>
                          {t("parking.sharedCapacity", { defaultValue: "sur 150 places physiques partagées" })}
                        </small>
                      </td>
                      <td>{formatMoney(parkingSlot.parkingRate, locale)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`status${parkingSlot.status}`]}`}>
                          {t(`status.${parkingSlot.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/admin/parking/edit/${parkingSlot.id}`} className={styles.btnGhost}>
                            {t("common.edit")}
                          </Link>
                          <button onClick={() => handleDeleteParkingSlot(parkingSlot.id)} className={styles.btnDanger}>
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

      {/* Onglet: Réservations */}
      {!loading && !error && activeTab === "parkingReservations" && (
        <section className={styles.section}>
          <div className={styles.filterBar}>
            <label>{t("admin.filterByStatus")}</label>
            <SelectDropdown
              value={filterStatus}
              onChange={setFilterStatus}
              options={parkingReservationStatusOptions}
              label={t("admin.filterByStatus")}
              className={styles.selectDropdown}
            />
            <span className={styles.resultCount}>
              {filteredParkingReservations.length} {t("admin.reservationsShown")}
            </span>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("parking.session")}</th>
                  <th>{t("admin.user")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("parking.places")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredParkingReservations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.noData}>{t("admin.noReservations")}</td>
                  </tr>
                ) : (
                  filteredParkingReservations.map((parkingReservation) => (
                    <tr key={parkingReservation.id}>
                      <td>{parkingReservation.parkingSlotTitle || t("nav.parking")}</td>
                      <td>
                        <div>
                          <div>{parkingReservation.userFullName || parkingReservation.userEmail}</div>
                          {parkingReservation.userFullName && <small className={styles.emailSmall}>{parkingReservation.userEmail}</small>}
                        </div>
                      </td>
                      <td>{new Date(`${parkingReservation.slotDate}T00:00:00`).toLocaleDateString(locale, { dateStyle: "medium" })}</td>
                      <td>{formatNumber(parkingReservation.reservedSpaces, locale)}</td>
                      <td>{formatMoney(parkingReservation.totalPrice, locale)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`status${parkingReservation.status}`]}`}>
                          {t(`status.${parkingReservation.status.toLowerCase()}`)}
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
