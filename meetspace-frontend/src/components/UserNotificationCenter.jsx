import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMyEventRegistrations, getMyParkingReservations, getMyReservations } from "../services/api";
import { buildUserActivityItems, buildUserNotifications, formatDate, formatTime } from "../utils/userActivity";
import styles from "./UserNotificationCenter.module.css";

const READ_STORAGE_KEY = "meetspace-read-notifications";

export default function UserNotificationCenter({ token }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState({ spaces: [], events: [], parking: [] });
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const containerRef = useRef(null);

  const locale = i18n.language === "en" ? "en-GB" : i18n.language === "nl" ? "nl-BE" : "fr-BE";

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    const loadNotifications = async () => {
      setLoading(true);
      setError("");

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
  }, [t, token]);

  useEffect(() => {
    if (!open) return;

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

  const notifications = useMemo(() => {
    const items = buildUserActivityItems(activity);
    return buildUserNotifications(items);
  }, [activity]);

  const urgentUnread = useMemo(
    () => notifications.filter((notification) => notification.badge && !readIds.includes(notification.id)),
    [notifications, readIds]
  );

  useEffect(() => {
    if (!open || urgentUnread.length === 0) return undefined;

    const timer = window.setTimeout(() => {
      setReadIds((current) => {
        const next = Array.from(new Set([...current, ...urgentUnread.map((notification) => notification.id)])).slice(-80);
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [open, urgentUnread]);

  const visibleNotifications = notifications.slice(0, 4);
  const nextNotification = visibleNotifications[0];

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerActive : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={t("notifications.title", { defaultValue: "Notifications" })}
      >
        <span className={styles.bellIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 22a2.8 2.8 0 0 0 2.7-2h-5.4A2.8 2.8 0 0 0 12 22Zm7-6.2V11a7 7 0 0 0-5.2-6.77V3a1.8 1.8 0 0 0-3.6 0v1.23A7 7 0 0 0 5 11v4.8l-1.4 1.4a1 1 0 0 0 .7 1.7h15.4a1 1 0 0 0 .7-1.7L19 15.8Z" />
          </svg>
        </span>
        {urgentUnread.length > 0 && <span className={styles.count}>{urgentUnread.length}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>{t("notifications.kicker", { defaultValue: "Centre utilisateur" })}</p>
              <h2>{t("notifications.title", { defaultValue: "Notifications" })}</h2>
            </div>
            <Link to="/my-reservations?tab=day" className={styles.dayLink} onClick={() => setOpen(false)}>
              {t("notifications.openReservations", { defaultValue: "Voir mes réservations" })}
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
              <span>{t("notifications.emptyText", { defaultValue: "Aucune alerte active sur vos réservations." })}</span>
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
