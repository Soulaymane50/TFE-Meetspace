import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  adminGetAuditLogs,
  adminGetAuditLogsFiltered,
  adminGetAuditActions,
  adminGetAuditEntityTypes,
  adminGetUsers,
} from "../services/api";
import { useTranslation } from "react-i18next";
import styles from "./AuditLogs.module.css";

const ACTION_LABELS = {
  LOGIN_SUCCESS: { label: "Connexion réussie", icon: "OK", color: "green" },
  LOGIN_FAILURE: { label: "Échec de connexion", icon: "KO", color: "red" },
  LOGOUT: { label: "Déconnexion", icon: "OUT", color: "gray" },
  PASSWORD_CHANGE: { label: "Changement de mot de passe", icon: "PWD", color: "orange" },
  PASSWORD_RESET_REQUEST: { label: "Demande de réinitialisation", icon: "REQ", color: "blue" },
  PASSWORD_RESET_COMPLETE: { label: "Réinitialisation terminée", icon: "RST", color: "green" },
  USER_CREATE: { label: "Utilisateur créé", icon: "USR", color: "green" },
  USER_UPDATE: { label: "Utilisateur modifié", icon: "USR", color: "blue" },
  USER_DELETE: { label: "Utilisateur supprimé", icon: "USR", color: "red" },
  USER_ROLE_CHANGE: { label: "Changement de rôle", icon: "ROL", color: "purple" },
  USER_STATUS_CHANGE: { label: "Changement de statut", icon: "STA", color: "orange" },
  EVENT_CREATE: { label: "Événement créé", icon: "EV", color: "green" },
  EVENT_UPDATE: { label: "Événement modifié", icon: "EV", color: "blue" },
  EVENT_DELETE: { label: "Événement supprimé", icon: "EV", color: "red" },
  EVENT_APPROVE: { label: "Événement approuvé", icon: "EV", color: "green" },
  EVENT_REJECT: { label: "Événement rejeté", icon: "EV", color: "red" },
  EVENT_CANCEL: { label: "Événement annulé", icon: "EV", color: "orange" },
  RESERVATION_CREATE: { label: "Réservation créée", icon: "RS", color: "green" },
  RESERVATION_UPDATE: { label: "Réservation modifiée", icon: "RS", color: "blue" },
  RESERVATION_CANCEL: { label: "Réservation annulée", icon: "RS", color: "orange" },
  RESERVATION_APPROVE: { label: "Réservation approuvée", icon: "RS", color: "green" },
  RESERVATION_REJECT: { label: "Réservation rejetée", icon: "RS", color: "red" },
  SPACE_CREATE: { label: "Salle créée", icon: "SP", color: "green" },
  SPACE_UPDATE: { label: "Salle modifiée", icon: "SP", color: "blue" },
  SPACE_DELETE: { label: "Salle supprimée", icon: "SP", color: "red" },
  PARKING_SESSION_CREATE: { label: "Créneau parking créé", icon: "PK", color: "green" },
  PARKING_SESSION_UPDATE: { label: "Créneau parking modifié", icon: "PK", color: "blue" },
  PARKING_SESSION_DELETE: { label: "Créneau parking supprimé", icon: "PK", color: "red" },
  PARKING_RESERVATION_CREATE: { label: "Réservation parking créée", icon: "PK", color: "green" },
  PARKING_RESERVATION_CANCEL: { label: "Réservation parking annulée", icon: "PK", color: "orange" },
  PARKING_RESERVATION_APPROVE: { label: "Réservation parking approuvée", icon: "PK", color: "green" },
  PARKING_RESERVATION_REJECT: { label: "Réservation parking rejetée", icon: "PK", color: "red" },
  PAYMENT_INITIATED: { label: "Paiement initié", icon: "PM", color: "blue" },
  PAYMENT_SUCCESS: { label: "Paiement réussi", icon: "PM", color: "green" },
  PAYMENT_FAILURE: { label: "Paiement échoué", icon: "PM", color: "red" },
  EVENT_REGISTRATION_CREATE: { label: "Inscription événement", icon: "EV", color: "green" },
  EVENT_REGISTRATION_CANCEL: { label: "Désinscription événement", icon: "EV", color: "orange" },
};

export default function AuditLogs() {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actions, setActions] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [users, setUsers] = useState([]);

  const [filters, setFilters] = useState({
    userId: "",
    action: "",
    entityType: "",
    startDate: "",
    endDate: "",
  });

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const loadInitialData = useCallback(async () => {
    try {
      const [actionsData, entityTypesData, usersData] = await Promise.all([
        adminGetAuditActions(token),
        adminGetAuditEntityTypes(token),
        adminGetUsers(token),
      ]);
      setActions(actionsData);
      setEntityTypes(entityTypesData);
      setUsers(usersData);
    } catch (err) {
      console.error("Erreur chargement donnees initiales:", err);
    }
  }, [token]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const hasFilters = Object.values(filters).some((v) => v !== "");
      const data = hasFilters
        ? await adminGetAuditLogsFiltered(token, filters, page, 15)
        : await adminGetAuditLogs(token, page, 15);

      setLogs(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, token]);

  useEffect(() => {
    const run = async () => {
      await loadInitialData();
    };
    run();
  }, [loadInitialData]);

  useEffect(() => {
    const run = async () => {
      await loadLogs();
    };
    run();
  }, [loadLogs]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      userId: "",
      action: "",
      entityType: "",
      startDate: "",
      endDate: "",
    });
    setPage(0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionInfo = (action) => ACTION_LABELS[action] || { label: action, icon: "LOG", color: "gray" };

  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("admin.auditLogs", "Logs d'audit")}</h2>
        <span className={styles.count}>{totalElements} {t("admin.entries", "entrees")}</span>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>{t("admin.user", "Utilisateur")}</label>
          <select
            value={filters.userId}
            onChange={(e) => handleFilterChange("userId", e.target.value)}
            className={styles.select}
          >
            <option value="">{t("common.all", "Tous")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>{t("admin.action", "Action")}</label>
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            className={styles.select}
          >
            <option value="">{t("common.all", "Toutes")}</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {getActionInfo(action).label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>{t("admin.entityType", "Type")}</label>
          <select
            value={filters.entityType}
            onChange={(e) => handleFilterChange("entityType", e.target.value)}
            className={styles.select}
          >
            <option value="">{t("common.all", "Tous")}</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>{t("admin.startDate", "Debut")}</label>
          <input
            type="datetime-local"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>{t("admin.endDate", "Fin")}</label>
          <input
            type="datetime-local"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className={styles.input}
          />
        </div>

        <button onClick={clearFilters} className={styles.btnClear}>
          {t("common.clear", "Effacer")}
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>{t("common.loading", "Chargement...")}</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("admin.date", "Date")}</th>
                  <th>{t("admin.user", "Utilisateur")}</th>
                  <th>{t("admin.action", "Action")}</th>
                  <th>{t("admin.details", "Details")}</th>
                  <th>{t("admin.ip", "IP")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles.noData}>
                      {t("admin.noLogs", "Aucun log trouve")}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionInfo = getActionInfo(log.action);
                    return (
                      <tr key={log.id}>
                        <td className={styles.dateCell}>{formatDate(log.timestamp)}</td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>{log.userName || "Anonyme"}</span>
                            {log.userEmail && <span className={styles.userEmail}>{log.userEmail}</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.actionBadge} ${styles[actionInfo.color]}`}>
                            <span className={styles.actionIcon}>{actionInfo.icon}</span>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className={styles.detailsCell}>
                          <span className={styles.details}>{log.details}</span>
                          {log.oldValue && log.newValue && (
                            <div className={styles.changes}>
                              <span className={styles.oldValue}>{log.oldValue}</span>
                              <span className={styles.arrow}>{">"}</span>
                              <span className={styles.newValue}>{log.newValue}</span>
                            </div>
                          )}
                        </td>
                        <td className={styles.ipCell}>{log.ipAddress || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setPage((previousPage) => Math.max(0, previousPage - 1))}
                disabled={page === 0}
                className={styles.pageBtn}
              >
                {"<"} {t("common.previous", "Precedent")}
              </button>
              <span className={styles.pageInfo}>
                {t("common.page", "Page")} {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((previousPage) => Math.min(totalPages - 1, previousPage + 1))}
                disabled={page >= totalPages - 1}
                className={styles.pageBtn}
              >
                {t("common.next", "Suivant")} {">"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
