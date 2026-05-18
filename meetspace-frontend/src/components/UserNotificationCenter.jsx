import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  adminGetPendingEvents,
  adminGetPendingReservations,
  getMyEventRegistrations,
  getMyParkingReservations,
  getMyReservations,
  organizerGetMyEvents,
} from "../services/api";
import { buildUserActivityItems, buildUserNotifications, formatDate, formatTime } from "../utils/userActivity";
import styles from "./UserNotificationCenter.module.css";

const READ_STORAGE_KEY = "meetspace-read-notifications";

function normalizeLocale(language) {
  const key = String(language || "fr").split("-")[0];
  if (key === "en") return "en-GB";
  if (key === "nl") return "nl-BE";
  return "fr-BE";
}

function normalizeRole(role) {
  return String(role || "")
    .replace(/^ROLE_/i, "")
    .toUpperCase();
}

function formatCount(value, locale) {
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}

function readStoredReadIds(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function getItemDate(item) {
  return item?.startDateTime || item?.date || item?.createdAt || new Date().toISOString();
}

function buildRoleNotifications({ role, pendingEvents, pendingReservations, organizerEvents, t }) {
  const notifications = [];

  if (role === "ADMIN") {
    if (pendingEvents.length > 0) {
      notifications.push({
        id: `admin-pending-events-${pendingEvents.length}`,
        title: t("notifications.adminPendingEventsTitle", { defaultValue: "Événements à valider" }),
        message: t("notifications.adminPendingEventsText", {
          count: pendingEvents.length,
          defaultValue: `${pendingEvents.length} événement(s) attendent une décision.`,
        }),
        date: getItemDate(pendingEvents[0]),
        to: "/admin/events",
        tone: "warning",
        badge: true,
      });
    }

    if (pendingReservations.length > 0) {
      notifications.push({
        id: `admin-pending-reservations-${pendingReservations.length}`,
        title: t("notifications.adminPendingReservationsTitle", { defaultValue: "Réservations à valider" }),
        message: t("notifications.adminPendingReservationsText", {
          count: pendingReservations.length,
          defaultValue: `${pendingReservations.length} demande(s) de salle attendent une validation.`,
        }),
        date: getItemDate(pendingReservations[0]),
        to: "/admin/espaces",
        tone: "warning",
        badge: true,
      });
    }
  }

  if (role === "ORGANIZER") {
    const pending = organizerEvents.filter((event) => event.status === "PENDING");
    const nextEvent = organizerEvents
      .filter((event) => event.status !== "CANCELLED" && new Date(event.startDateTime) >= new Date())
      .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))[0];

    if (pending.length > 0) {
      notifications.push({
        id: `organizer-pending-events-${pending.length}`,
        title: t("notifications.organizerPendingTitle", { defaultValue: "Validation en attente" }),
        message: t("notifications.organizerPendingText", {
          count: pending.length,
          defaultValue: `${pending.length} événement(s) attendent la validation admin.`,
        }),
        date: getItemDate(pending[0]),
        to: "/organizer/events",
        tone: "warning",
        badge: true,
      });
    }

    if (nextEvent) {
      notifications.push({
        id: `organizer-next-${nextEvent.id}`,
        title: t("notifications.organizerNextTitle", { defaultValue: "Prochain événement" }),
        message: nextEvent.title,
        date: getItemDate(nextEvent),
        to: "/organizer/events",
        tone: "info",
        badge: false,
      });
    }
  }

  return notifications;
}

export default function UserNotificationCenter({ token, user }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState({ spaces: [], events: [], parking: [] });
  const [roleNotifications, setRoleNotifications] = useState([]);
  const [readIdsByKey, setReadIdsByKey] = useState({});
  const containerRef = useRef(null);

  const locale = normalizeLocale(i18n.language);
  const role = normalizeRole(user?.role);
  const storageKey = `${READ_STORAGE_KEY}:${user?.email || user?.id || role || "user"}`;
  const readIds = useMemo(() => readIdsByKey[storageKey] || readStoredReadIds(storageKey), [readIdsByKey, storageKey]);

  const setReadIds = useCallback(
    (updater) => {
      setReadIdsByKey((currentByKey) => {
        const current = currentByKey[storageKey] || readStoredReadIds(storageKey);
        const next = typeof updater === "function" ? updater(current) : updater;
        localStorage.setItem(storageKey, JSON.stringify(next));
        return { ...currentByKey, [storageKey]: next };
      });
    },
    [storageKey],
  );

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    const loadNotifications = async () => {
      setLoading(true);
      setError("");
      setRoleNotifications([]);
      setActivity({ spaces: [], events: [], parking: [] });

      if (role === "ADMIN") {
        const [pendingEventsResult, pendingReservationsResult] = await Promise.allSettled([
          adminGetPendingEvents(token),
          adminGetPendingReservations(token),
        ]);

        if (cancelled) return;

        if (pendingEventsResult.status === "rejected" && pendingReservationsResult.status === "rejected") {
          setError(t("notifications.error", { defaultValue: "Impossible de charger les notifications." }));
        } else {
          setRoleNotifications(
            buildRoleNotifications({
              role,
              pendingEvents: pendingEventsResult.status === "fulfilled" ? pendingEventsResult.value : [],
              pendingReservations:
                pendingReservationsResult.status === "fulfilled" ? pendingReservationsResult.value : [],
              organizerEvents: [],
              t,
            }),
          );
        }

        setLoading(false);
        return;
      }

      if (role === "ORGANIZER") {
        const organizerResult = await Promise.allSettled([organizerGetMyEvents(token)]);

        if (cancelled) return;

        if (organizerResult[0].status === "rejected") {
          setError(t("notifications.error", { defaultValue: "Impossible de charger les notifications." }));
        } else {
          setRoleNotifications(
            buildRoleNotifications({
              role,
              pendingEvents: [],
              pendingReservations: [],
              organizerEvents: organizerResult[0].value,
              t,
            }),
          );
        }

        setLoading(false);
        return;
      }

      const [spacesResult, eventsResult, parkingResult] = await Promise.allSettled([
        getMyReservations(token),
        getMyEventRegistrations(token),
        getMyParkingReservations(token),
      ]);

      if (cancelled) return;

      setActivity({
        spaces: spacesResult.status === "fulfilled" ? spacesResult.value : [],
        events: eventsResult.status === "fulfilled" ? eventsResult.value : [],
        parking: parkingResult.status === "fulfilled" ? parkingResult.value : [],
      });

      if ([spacesResult, eventsResult, parkingResult].every((result) => result.status === "rejected")) {
        setError(t("notifications.error", { defaultValue: "Impossible de charger les notifications." }));
      }

      setLoading(false);
    };

    const timer = window.setTimeout(loadNotifications, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [role, t, token]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const clientNotifications = useMemo(() => {
    const items = buildUserActivityItems(activity);
    return buildUserNotifications(items);
  }, [activity]);

  const notifications = role === "CLIENT" || role === "USER" || !role ? clientNotifications : roleNotifications;

  const urgentUnread = useMemo(
    () => notifications.filter((notification) => notification.badge && !readIds.includes(notification.id)),
    [notifications, readIds],
  );

  useEffect(() => {
    if (!open || urgentUnread.length === 0) return undefined;

    const timer = window.setTimeout(() => {
      setReadIds((current) => {
        return Array.from(new Set([...current, ...urgentUnread.map((notification) => notification.id)])).slice(-80);
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [open, setReadIds, urgentUnread]);

  const visibleNotifications = notifications.slice(0, 4);
  const nextNotification = visibleNotifications[0];
  const footerLink = role === "ADMIN" ? "/admin" : role === "ORGANIZER" ? "/organizer/events" : "/my-reservations?tab=day";
  const footerLabel =
    role === "ADMIN"
      ? t("notifications.openAdmin", { defaultValue: "Ouvrir l'admin" })
      : role === "ORGANIZER"
        ? t("notifications.openOrganizer", { defaultValue: "Gérer mes événements" })
        : t("notifications.openReservations", { defaultValue: "Voir mes réservations" });

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerActive : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("notifications.title", { defaultValue: "Notifications" })}
      >
        <span className={styles.bellIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 22a2.8 2.8 0 0 0 2.7-2h-5.4A2.8 2.8 0 0 0 12 22Zm7-6.2V11a7 7 0 0 0-5.2-6.77V3a1.8 1.8 0 0 0-3.6 0v1.23A7 7 0 0 0 5 11v4.8l-1.4 1.4a1 1 0 0 0 .7 1.7h15.4a1 1 0 0 0 .7-1.7L19 15.8Z" />
          </svg>
        </span>
        {urgentUnread.length > 0 && (
          <span className={styles.count}>{urgentUnread.length > 99 ? "99+" : formatCount(urgentUnread.length, locale)}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>{t("notifications.kicker", { defaultValue: "Centre utilisateur" })}</p>
              <h2>{t("notifications.title", { defaultValue: "Notifications" })}</h2>
            </div>
            <Link to={footerLink} className={styles.dayLink} onClick={() => setOpen(false)}>
              {footerLabel}
            </Link>
          </div>

          {loading && (
            <div className={styles.state}>
              <span className={styles.pulse} />
              {t("common.loading")}
            </div>
          )}

          {!loading && error && (
            <div className={`${styles.state} ${styles.error}`}>
              {t("notifications.error", { defaultValue: "Impossible de charger les notifications." })}
            </div>
          )}

          {!loading && !error && visibleNotifications.length === 0 && (
            <div className={styles.emptyState}>
              <strong>{t("notifications.emptyTitle", { defaultValue: "Tout est à jour" })}</strong>
              <span>
                {t("notifications.emptyText", { defaultValue: "Aucune alerte active pour votre profil." })}
              </span>
            </div>
          )}

          {!loading && !error && visibleNotifications.length > 0 && (
            <div className={styles.list}>
              {visibleNotifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.to}
                  className={`${styles.item} ${styles[notification.tone] || ""}`}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.itemDot} />
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.message}</small>
                    <em>
                      {formatDate(notification.date, locale)} - {formatTime(notification.date)}
                    </em>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {nextNotification && (
            <div className={styles.nextBox}>
              <span>{t("notifications.next", { defaultValue: "Prochain repère" })}</span>
              <strong>
                {formatTime(nextNotification.date)} - {nextNotification.title}
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
