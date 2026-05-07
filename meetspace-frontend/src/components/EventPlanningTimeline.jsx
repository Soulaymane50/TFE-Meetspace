import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./EventPlanningTimeline.module.css";

const getDateLocale = (lang) => {
  const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
  return locales[lang] || "fr-BE";
};

const getResourceKey = (event) =>
  String(event.spaceId || event.espaceId || event.location || event.externalAddress || "unknown").toLowerCase();

const getDayKey = (value) => {
  if (!value) return "unknown";
  return value.slice(0, 10);
};

const rangesOverlap = (a, b) => {
  const aStart = new Date(a.startDateTime).getTime();
  const aEnd = new Date(a.endDateTime).getTime();
  const bStart = new Date(b.startDateTime).getTime();
  const bEnd = new Date(b.endDateTime).getTime();
  return Number.isFinite(aStart) && Number.isFinite(aEnd) && Number.isFinite(bStart) && Number.isFinite(bEnd)
    ? aStart < bEnd && bStart < aEnd
    : false;
};

export default function EventPlanningTimeline({ events = [], title, subtitle, getEventHref, maxDays }) {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const locale = getDateLocale(i18n.language);

  const groups = useMemo(() => {
    const sortedEvents = [...events].sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
    const byDay = sortedEvents.reduce((acc, event) => {
      const key = getDayKey(event.startDateTime);
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {});

    return Object.entries(byDay).map(([key, dayEvents]) => {
      const conflicts = dayEvents.filter((event) =>
        dayEvents.some(
          (other) =>
            other.id !== event.id && getResourceKey(other) === getResourceKey(event) && rangesOverlap(event, other),
        ),
      );

      return {
        key,
        label:
          key === "unknown"
            ? t("planning.unscheduled")
            : new Date(`${key}T12:00:00`).toLocaleDateString(locale, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }),
        events: dayEvents,
        roomCount: new Set(dayEvents.map(getResourceKey)).size,
        conflictCount: conflicts.length,
      };
    });
  }, [events, locale, t]);

  const formatTime = (value) =>
    value
      ? new Date(value).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

  const hasDayLimit = Number.isFinite(maxDays) && maxDays > 0 && groups.length > maxDays;
  const visibleGroups = hasDayLimit && !showAll ? groups.slice(0, maxDays) : groups;
  const hiddenDaysCount = hasDayLimit ? groups.length - maxDays : 0;

  if (events.length === 0) {
    return (
      <section className={styles.timeline}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>{t("planning.kicker")}</p>
            <h2>{title || t("planning.title")}</h2>
            <p>{subtitle || t("planning.subtitle")}</p>
          </div>
        </div>
        <div className={styles.empty}>{t("planning.empty")}</div>
      </section>
    );
  }

  return (
    <section className={styles.timeline}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{t("planning.kicker")}</p>
          <h2>{title || t("planning.title")}</h2>
          <p>{subtitle || t("planning.subtitle")}</p>
        </div>
        <div className={styles.headerStats}>
          <span>
            <strong>{events.length}</strong>
            {t("planning.events")}
          </span>
          <span>
            <strong>{groups.length}</strong>
            {t("planning.days")}
          </span>
        </div>
      </div>

      <div className={styles.days}>
        {visibleGroups.map((group) => (
          <article key={group.key} className={styles.dayCard}>
            <div className={styles.dayHeader}>
              <div>
                <span className={styles.dayLabel}>{t("planning.day")}</span>
                <h3>{group.label}</h3>
              </div>
              <div className={styles.dayBadges}>
                <span>{group.events.length} {t("planning.events")}</span>
                <span>{group.roomCount} {t("planning.rooms")}</span>
                <span className={group.conflictCount ? styles.conflictBadge : styles.safeBadge}>
                  {group.conflictCount ? t("planning.conflict", { count: group.conflictCount }) : t("planning.noConflict")}
                </span>
              </div>
            </div>

            <div className={styles.eventStack}>
              {group.events.map((event) => {
                const hasConflict = group.events.some(
                  (other) =>
                    other.id !== event.id && getResourceKey(other) === getResourceKey(event) && rangesOverlap(event, other),
                );
                const occupancy = event.capacity
                  ? Math.min(100, Math.round(((event.registeredCount || 0) / event.capacity) * 100))
                  : 0;

                const eventHref = typeof getEventHref === "function" ? getEventHref(event) : null;
                const RowTag = eventHref ? Link : "div";
                const rowProps = eventHref ? { to: eventHref } : {};

                return (
                  <RowTag
                    key={event.id}
                    {...rowProps}
                    className={`${styles.eventRow} ${eventHref ? styles.eventRowLink : ""} ${hasConflict ? styles.eventConflict : ""}`}
                  >
                    <div className={styles.timeCell}>
                      <strong>{formatTime(event.startDateTime)}</strong>
                      <span>{formatTime(event.endDateTime)}</span>
                    </div>
                    <div className={styles.eventBody}>
                      <div className={styles.eventTopline}>
                        <h4>{event.title}</h4>
                        {hasConflict && <span className={styles.conflictPill}>{t("planning.conflictDetected")}</span>}
                      </div>
                      <p>{event.location || t("common.toBeAnnounced")}</p>
                      <div className={styles.eventMeta}>
                        <span>{event.capacity || 0} {t("common.persons")}</span>
                        <span>{occupancy}% {t("planning.occupancy")}</span>
                        {event.status && <span>{t(`status.${String(event.status).toLowerCase()}`, { defaultValue: event.status })}</span>}
                      </div>
                    </div>
                  </RowTag>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {hasDayLimit && (
        <button type="button" className={styles.expandButton} onClick={() => setShowAll((value) => !value)}>
          {showAll ? t("planning.showLess", "Réduire le planning") : t("planning.showMore", { count: hiddenDaysCount, defaultValue: `Voir ${hiddenDaysCount} jour(s) de plus` })}
        </button>
      )}
    </section>
  );
}
