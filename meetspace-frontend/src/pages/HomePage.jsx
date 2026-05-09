import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPublicEvents } from "../services/api";
import { useAuth } from "../context/AuthContext";
import styles from "./HomePage.module.css";

function getLocale(language) {
  if (language?.startsWith("fr")) return "fr-BE";
  if (language?.startsWith("nl")) return "nl-BE";
  return "en-BE";
}

function getAvailabilityStatus(event) {
  const capacity = Math.max(Number(event?.capacity) || 0, 1);
  const availablePlaces =
    typeof event?.availablePlaces === "number" ? Math.max(0, event.availablePlaces) : capacity;
  const registeredCount =
    typeof event?.registeredCount === "number" ? event.registeredCount : Math.max(0, capacity - availablePlaces);

  if (availablePlaces <= 0) return "full";
  if (registeredCount / capacity >= 0.8) return "almost";
  return "available";
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
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

  const organizerTarget = user?.role === "ORGANIZER" || user?.role === "ADMIN" ? "/organizer/events/new" : "/register";

  const actions = [
    {
      to: "/espace",
      title: t("home.useSpacesTitle"),
      text: t("home.useSpacesText"),
      cta: t("home.useSpacesCta"),
      icon: "S",
    },
    {
      to: "/events",
      title: t("home.useEventsTitle"),
      text: t("home.useEventsText"),
      cta: t("home.useEventsCta"),
      icon: "E",
    },
    {
      to: "/parking",
      title: t("home.useParkingTitle"),
      text: t("home.useParkingText"),
      cta: t("home.useParkingCta"),
      icon: "P",
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1>{t("home.heroTitle")}</h1>
          <p>{t("home.heroText")}</p>

          <div className={styles.heroActions}>
            <Link to="/espace" className={styles.primaryCta}>
              {t("home.secondaryCta")}
            </Link>
            <Link to="/events" className={styles.secondaryCta}>
              {t("home.primaryCta")}
            </Link>
          </div>
        </div>

        <aside className={styles.heroImage} aria-label={t("home.heroPanelTitle")}>
          <div className={styles.heroImageCard}>
            <span>{t("home.heroPanelBadge")}</span>
            <strong>{t("home.heroPanelMetric")}</strong>
          </div>
        </aside>
      </section>

      <section className={styles.actionSection} aria-labelledby="home-actions-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{t("home.usesLabel")}</p>
          <h2 id="home-actions-title">{t("home.usesTitle")}</h2>
        </div>

        <div className={styles.actionGrid}>
          {actions.map((action) => (
            <Link key={action.to} to={action.to} className={styles.actionCard}>
              <span className={styles.actionIcon}>{action.icon}</span>
              <strong>{action.title}</strong>
              <p>{action.text}</p>
              <small>{action.cta}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.eventsSection} aria-labelledby="home-events-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{t("home.previewLabel")}</p>
          <h2 id="home-events-title">{t("home.previewTitle")}</h2>
        </div>

        {loading ? (
          <div className={styles.simpleState}>{t("common.loading")}</div>
        ) : loadError ? (
          <div className={styles.simpleState}>{t("common.error")}</div>
        ) : upcomingEvents.length === 0 ? (
          <div className={styles.simpleState}>
            <strong>{t("home.noUpcomingEventsTitle")}</strong>
            <span>{t("home.noUpcomingEventsText")}</span>
          </div>
        ) : (
          <div className={styles.eventList}>
            {upcomingEvents.map((event) => {
              const availability = getAvailabilityStatus(event);
              const availabilityLabel =
                availability === "full"
                  ? t("events.badgeFull")
                  : availability === "almost"
                    ? t("events.badgeAlmostFull")
                    : t("events.badgeAvailable");

              return (
                <Link key={event.id} to="/events" className={styles.eventCard}>
                  <span className={styles.eventDate}>
                    {dateFormatter.format(new Date(event.startDateTime))}
                  </span>
                  <strong>{event.title}</strong>
                  <small>
                    {timeFormatter.format(new Date(event.startDateTime))} -{" "}
                    {timeFormatter.format(new Date(event.endDateTime))}
                  </small>
                  <em className={styles[availability]}>{availabilityLabel}</em>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.organizerStrip}>
        <div>
          <p className={styles.eyebrow}>{t("home.organizerTitle")}</p>
          <h2>{t("home.organizerText")}</h2>
        </div>
        <Link to={organizerTarget} className={styles.organizerCta}>
          {t("home.organizerCta")}
        </Link>
      </section>
    </div>
  );
}
