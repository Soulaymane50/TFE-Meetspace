import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPublicEvents } from "../services/api";
import styles from "./HomePage.module.css";

function getLocale(language) {
  if (language?.startsWith("fr")) return "fr-BE";
  if (language?.startsWith("nl")) return "nl-BE";
  return "en-BE";
}

function getAvailabilityStatus(event) {
  if ((event?.availablePlaces ?? 0) <= 0) return "full";
  if ((event?.registeredCount ?? 0) / Math.max(event?.capacity ?? 1, 1) >= 0.8) return "almost";
  return "available";
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      setLoading(true);
      setLoadError(false);

      try {
        const nextEvents = await getPublicEvents();
        if (!active) return;
        setEvents(nextEvents);
      } catch {
        if (!active) return;
        setEvents([]);
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHome();
    return () => {
      active = false;
    };
  }, []);

  const locale = getLocale(i18n.language);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const upcomingEvents = [...events]
    .filter((event) => new Date(event.startDateTime) >= new Date())
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 3);

  const uses = [
    {
      to: "/espace",
      title: t("home.useSpacesTitle"),
      text: t("home.useSpacesText"),
      cta: t("home.useSpacesCta"),
    },
    {
      to: "/events",
      title: t("home.useEventsTitle"),
      text: t("home.useEventsText"),
      cta: t("home.useEventsCta"),
    },
    {
      to: "/parking",
      title: t("home.useParkingTitle"),
      text: t("home.useParkingText"),
      cta: t("home.useParkingCta"),
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.introSection}>
        <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
        <h1 className={styles.title}>{t("home.heroTitle")}</h1>
        <p className={styles.subtitle}>{t("home.heroText")}</p>

        <div className={styles.heroActions}>
          <Link to="/events" className={styles.primaryCta}>
            {t("home.primaryCta")}
          </Link>
          <Link to="/espace" className={styles.secondaryCta}>
            {t("home.secondaryCta")}
          </Link>
        </div>
      </section>

      <section className={styles.usesSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{t("home.usesLabel")}</p>
          <h2 className={styles.sectionTitle}>{t("home.usesTitle")}</h2>
        </div>

        <div className={styles.usesGrid}>
          {uses.map((use) => (
            <article key={use.title} className={styles.useCard}>
              <h3 className={styles.useTitle}>{use.title}</h3>
              <p className={styles.useText}>{use.text}</p>
              <Link to={use.to} className={styles.useLink}>
                {use.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.previewSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{t("home.previewLabel")}</p>
          <h2 className={styles.sectionTitle}>{t("home.previewTitle")}</h2>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyText}>{t("common.loading")}</span>
          </div>
        ) : loadError ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyText}>{t("common.error")}</span>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className={styles.emptyState}>
            <strong className={styles.emptyTitle}>{t("home.noUpcomingEventsTitle")}</strong>
            <span className={styles.emptyText}>{t("home.noUpcomingEventsText")}</span>
          </div>
        ) : (
          <div className={styles.previewList}>
            {upcomingEvents.map((event) => {
              const availability = getAvailabilityStatus(event);
              const availabilityLabel =
                availability === "full"
                  ? t("events.badgeFull")
                  : availability === "almost"
                    ? t("events.badgeAlmostFull")
                    : t("events.badgeAvailable");

              return (
                <article key={event.id} className={styles.eventCard}>
                  <div className={styles.eventTopline}>
                    <span className={styles.eventDate}>
                      {dateFormatter.format(new Date(event.startDateTime))}
                    </span>
                    <span
                      className={`${styles.eventStatus} ${
                        availability === "full"
                          ? styles.statusFull
                          : availability === "almost"
                            ? styles.statusAlmost
                            : styles.statusAvailable
                      }`}
                    >
                      {availabilityLabel}
                    </span>
                  </div>

                  <h3 className={styles.eventTitle}>{event.title}</h3>
                  <p className={styles.eventMeta}>
                    {timeFormatter.format(new Date(event.startDateTime))} -{" "}
                    {timeFormatter.format(new Date(event.endDateTime))}
                    {" · "}
                    {event.location || t("common.toBeAnnounced")}
                  </p>

                  <Link to="/events" className={styles.eventLink}>
                    {t("home.previewCta")}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
