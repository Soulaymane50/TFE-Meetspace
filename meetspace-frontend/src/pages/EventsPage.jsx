import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicEvents } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import SelectDropdown from "../components/SelectDropdown";
import PageState from "../components/PageState";
import { getEventImage } from "../utils/mediaAssets";
import styles from "./EventsPage.module.css";

const EURO = "€";

const getDateLocale = (lang) => {
  const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
  return locales[lang] || "fr-BE";
};

const formatRange = (startIso, endIso, t, locale) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  const timeOptions = { hour: "2-digit", minute: "2-digit" };

  const day = start.toLocaleDateString(locale, dateOptions);
  const startTime = start.toLocaleTimeString(locale, timeOptions);
  const endTime = end.toLocaleTimeString(locale, timeOptions);

  if (sameDay) {
    return `${day} ${t("common.from").toLowerCase()} ${startTime} ${t("common.to").toLowerCase()} ${endTime}`;
  }
  const endDay = end.toLocaleDateString(locale, dateOptions);
  return `${t("common.from")} ${day} ${startTime} ${t("common.to").toLowerCase()} ${endDay} ${endTime}`;
};

const getDayKey = (isoDate) => {
  const value = new Date(isoDate);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [priceFilter, setPriceFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [parkingFilter, setParkingFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [viewMode, setViewMode] = useState("cards");
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const sortOptions = [
    { value: "date", label: t("events.sortByDateAsc") },
    { value: "dateDesc", label: t("events.sortByDateDesc") },
    { value: "priceAsc", label: t("events.sortByPriceAsc") },
    { value: "priceDesc", label: t("events.sortByPriceDesc") },
    { value: "capacityAsc", label: t("events.sortByCapacityAsc") },
    { value: "capacityDesc", label: t("events.sortByCapacityDesc") },
  ];

  const fetchEvents = useCallback(() => {
    getPublicEvents()
      .then(setEvents)
      .catch((error) => {
        console.error(error);
        setEvents([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const retryEvents = () => {
    setLoading(true);
    setLoadError(false);
    fetchEvents();
  };

  const availableEventsCount = events.filter((ev) => (ev.availablePlaces ?? 0) > 0).length;
  const paidEventsCount = events.filter((ev) => (ev.price || 0) > 0).length;
  const parkingEnabledEventsCount = events.filter((ev) => Boolean(ev.parkingSlotId)).length;

  const hasActiveFilters =
    priceFilter !== "all" ||
    availabilityFilter !== "all" ||
    parkingFilter !== "all" ||
    searchQuery !== "";

  const activeFiltersCount = [
    priceFilter !== "all",
    availabilityFilter !== "all",
    parkingFilter !== "all",
    searchQuery !== "",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setPriceFilter("all");
    setAvailabilityFilter("all");
    setParkingFilter("all");
    setSearchQuery("");
    setSortBy("date");
  };

  const filteredAndSortedEvents = events
    .filter((ev) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = ev.title?.toLowerCase().includes(query);
        const matchesDescription = ev.description?.toLowerCase().includes(query);
        const matchesLocation = ev.location?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesLocation) return false;
      }

      if (priceFilter === "free" && (ev.price && ev.price > 0)) return false;
      if (priceFilter === "paid" && (!ev.price || ev.price === 0)) return false;

      const isFull = ev.availablePlaces !== null && ev.availablePlaces !== undefined && ev.availablePlaces <= 0;
      if (availabilityFilter === "available" && isFull) return false;
      if (availabilityFilter === "full" && !isFull) return false;

      if (parkingFilter === "with" && !ev.parkingSlotId) return false;
      if (parkingFilter === "without" && ev.parkingSlotId) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(a.startDateTime) - new Date(b.startDateTime);
      if (sortBy === "dateDesc") return new Date(b.startDateTime) - new Date(a.startDateTime);
      if (sortBy === "priceAsc") return (a.price || 0) - (b.price || 0);
      if (sortBy === "priceDesc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "capacityAsc") return a.capacity - b.capacity;
      if (sortBy === "capacityDesc") return b.capacity - a.capacity;
      return 0;
    });

  const getRegisteredCount = (event) => {
    const availablePlaces = typeof event.availablePlaces === "number" ? event.availablePlaces : event.capacity;
    return Math.max(0, event.capacity - availablePlaces);
  };

  const getOccupancyRate = (event) => {
    if (!event.capacity) return 0;
    return Math.min(100, Math.round((getRegisteredCount(event) / event.capacity) * 100));
  };

  const getEventStatus = (event) => {
    const isFull = event.availablePlaces !== null && event.availablePlaces !== undefined && event.availablePlaces <= 0;
    const occupancyRate = getOccupancyRate(event);

    if (isFull) {
      return { label: t("events.badgeFull"), className: styles.statusFull };
    }
    if (occupancyRate >= 80) {
      return { label: t("events.badgeAlmostFull"), className: styles.statusAlmostFull };
    }
    return { label: t("events.badgeAvailable"), className: styles.statusAvailable };
  };

  const groupedEvents = filteredAndSortedEvents.reduce((groups, event) => {
    const key = getDayKey(event.startDateTime);
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.events.push(event);
      return groups;
    }

    groups.push({
      key,
      label: new Date(event.startDateTime).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      events: [event],
    });

    return groups;
  }, []);

  const renderEventCta = (event) => {
    const isFull = event.availablePlaces !== null && event.availablePlaces !== undefined && event.availablePlaces <= 0;

    if (isFull) {
      return <span className={styles.buttonDisabled}>{user ? t("events.ctaWaitlist") : t("events.full")}</span>;
    }

    if (user) {
      return (
        <Link to={`/events/register/${event.id}`} className={styles.button}>
          {t("events.register")}
        </Link>
      );
    }

    return (
      <Link to="/login" className={styles.buttonSecondary}>
        {t("events.loginToRegister")}
      </Link>
    );
  };

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("events.workspaceLead")} />;
  }

  if (loadError) {
    return (
      <PageState
        type="error"
        title={t("common.error")}
        message={t("events.resultsHint")}
        action={
          <button type="button" onClick={retryEvents}>
            {t("common.retry")}
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroPanel}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{t("events.kicker")}</p>
            <h1 className={styles.title}>{t("events.title")}</h1>
            <p className={styles.heroLead}>{t("events.workspaceLead")}</p>
          </div>
          <div className={styles.heroActions}>
            {user ? (
              <Link to="/my-reservations?tab=events" className={styles.linkGhost}>
                ← {t("events.viewMyRegistrations")}
              </Link>
            ) : (
              <Link to="/login" className={styles.linkGhost}>
                {t("events.loginToRegister")}
              </Link>
            )}
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{events.length}</span>
            <span className={styles.summaryLabel}>{t("nav.events")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{availableEventsCount}</span>
            <span className={styles.summaryLabel}>{t("events.availableOnly")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{parkingEnabledEventsCount}</span>
            <span className={styles.summaryLabel}>{t("events.withParking")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{paidEventsCount}</span>
            <span className={styles.summaryLabel}>{t("events.paid")}</span>
          </div>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarEyebrow}>{t("events.filtersPanelLabel")}</p>
            <h2 className={styles.sidebarTitle}>{t("events.filtersPanelTitle")}</h2>
            <p className={styles.sidebarText}>{t("events.filtersPanelText")}</p>
          </div>

          <div className={styles.sidebarSection}>
            <label className={styles.filterLabel}>{t("events.searchPlaceholder")}</label>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("events.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.sidebarSection}>
            <label className={styles.filterLabel}>{t("events.sortBy")}</label>
            <SelectDropdown
              className={styles.sortSelect}
              label={t("events.sortBy")}
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
            />
          </div>

          <div className={styles.sidebarSection}>
            <label className={styles.filterLabel}>{t("events.filterByPrice")}</label>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={`${styles.filterButton} ${priceFilter === "all" ? styles.active : ""}`}
                onClick={() => setPriceFilter("all")}
              >
                {t("common.all")}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${priceFilter === "free" ? styles.active : ""}`}
                onClick={() => setPriceFilter("free")}
              >
                {t("events.free")}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${priceFilter === "paid" ? styles.active : ""}`}
                onClick={() => setPriceFilter("paid")}
              >
                {t("events.paid")}
              </button>
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <label className={styles.filterLabel}>{t("events.filterByAvailability")}</label>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={`${styles.filterButton} ${availabilityFilter === "all" ? styles.active : ""}`}
                onClick={() => setAvailabilityFilter("all")}
              >
                {t("common.all")}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${availabilityFilter === "available" ? styles.active : ""}`}
                onClick={() => setAvailabilityFilter("available")}
              >
                {t("events.availableOnly")}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${availabilityFilter === "full" ? styles.active : ""}`}
                onClick={() => setAvailabilityFilter("full")}
              >
                {t("events.fullOnly")}
              </button>
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <label className={styles.filterLabel}>{t("events.filterByParking")}</label>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={`${styles.filterButton} ${parkingFilter === "all" ? styles.active : ""}`}
                onClick={() => setParkingFilter("all")}
              >
                {t("common.all")}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${parkingFilter === "with" ? styles.active : ""}`}
                onClick={() => setParkingFilter("with")}
              >
                {t("events.withParking")}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${parkingFilter === "without" ? styles.active : ""}`}
                onClick={() => setParkingFilter("without")}
              >
                {t("events.withoutParking")}
              </button>
            </div>
          </div>

          <div className={styles.sidebarFoot}>
            <div className={styles.sidebarMetric}>
              <span className={styles.sidebarMetricValue}>{activeFiltersCount}</span>
              <span className={styles.sidebarMetricLabel}>{t("events.activeFilters")}</span>
            </div>
            {hasActiveFilters && (
              <button type="button" className={styles.resetButton} onClick={resetFilters}>
                {t("events.resetFilters")}
              </button>
            )}
          </div>
        </aside>

        <section className={styles.content}>
          <div className={styles.contentHeader}>
            <div>
              <p className={styles.contentKicker}>{t("events.dashboardLabel")}</p>
              <h2 className={styles.contentTitle}>{t("events.dashboardTitle")}</h2>
            </div>
            <div className={styles.viewToggle} role="tablist" aria-label={t("events.viewMode")}>
              <button
                type="button"
                className={`${styles.viewButton} ${viewMode === "cards" ? styles.viewButtonActive : ""}`}
                onClick={() => setViewMode("cards")}
              >
                {t("events.viewCards")}
              </button>
              <button
                type="button"
                className={`${styles.viewButton} ${viewMode === "planning" ? styles.viewButtonActive : ""}`}
                onClick={() => setViewMode("planning")}
              >
                {t("events.viewPlanning")}
              </button>
            </div>
          </div>

          <div className={styles.contentMeta}>
            <span className={styles.resultsCount}>
              {filteredAndSortedEvents.length} {filteredAndSortedEvents.length === 1 ? t("events.eventFound") : t("events.eventsFound")}
            </span>
            <span className={styles.resultsHint}>{t("events.resultsHint")}</span>
          </div>

          {filteredAndSortedEvents.length === 0 && (
            <PageState
              type="empty"
              title={t("events.noEvents")}
              message={hasActiveFilters ? t("events.resultsHint") : t("events.workspaceLead")}
              action={
                hasActiveFilters ? (
                  <button type="button" onClick={resetFilters}>
                    {t("events.resetFilters")}
                  </button>
                ) : (
                  <Link to="/espace">{t("home.roomsCta", { defaultValue: "Réserver une salle" })}</Link>
                )
              }
            />
          )}

          {filteredAndSortedEvents.length > 0 && viewMode === "cards" && (
            <div className={styles.eventStream}>
              {filteredAndSortedEvents.map((event) => {
                const registeredCount = getRegisteredCount(event);
                const occupancyRate = getOccupancyRate(event);
                const status = getEventStatus(event);
                const isPaid = event.price && event.price > 0;
                const isFull = event.availablePlaces !== null && event.availablePlaces !== undefined && event.availablePlaces <= 0;

                return (
                  <article key={event.id} className={`${styles.eventBlock} ${isFull ? styles.eventBlockFull : ""}`}>
                    <div className={styles.eventTopline}>
                      <p className={styles.date}>{formatRange(event.startDateTime, event.endDateTime, t, locale)}</p>
                      <span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span>
                    </div>

                    <div className={styles.eventBody}>
                      <div
                        className={styles.eventMedia}
                        style={{ backgroundImage: `url(${getEventImage(event)})` }}
                        aria-hidden="true"
                      />

                      <div className={styles.eventCopy}>
                        <div className={styles.eventHeading}>
                          <h3 className={styles.cardTitle}>{event.title}</h3>
                          <div className={styles.inlineTags}>
                            <span className={`${styles.priceTag} ${isPaid ? styles.priceTagPaid : styles.priceTagFree}`}>
                              {isPaid ? `${event.price} ${EURO}` : t("events.free")}
                            </span>
                            <span className={`${styles.parkingTag} ${event.parkingSlotId ? styles.parkingTagOn : styles.parkingTagOff}`}>
                              {event.parkingSlotId ? t("events.statusParkingIncluded") : t("events.statusParkingUnavailable")}
                            </span>
                          </div>
                        </div>

                        <p className={styles.desc}>{event.description}</p>

                        <div className={styles.metaGrid}>
                          <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>{t("common.location")}</span>
                            <span className={styles.metaValue}>{event.location || t("common.toBeAnnounced")}</span>
                          </div>
                          <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>{t("events.registeredParticipants")}</span>
                            <span className={styles.metaValue}>
                              {registeredCount} / {event.capacity} {t("common.persons")}
                            </span>
                          </div>
                          <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>{t("events.remainingPlaces")}</span>
                            <span className={styles.metaValue}>{Math.max(0, event.availablePlaces ?? 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.eventAside}>
                        <div className={styles.progressCard}>
                          <div className={styles.progressHeader}>
                            <span className={styles.progressLabel}>{t("events.occupancy")}</span>
                            <span className={styles.progressValue}>{occupancyRate}%</span>
                          </div>
                          <div className={styles.progressTrack} aria-hidden="true">
                            <span className={styles.progressFill} style={{ width: `${occupancyRate}%` }} />
                          </div>
                          <p className={styles.progressCaption}>
                            {registeredCount} {t("events.participants")} · {Math.max(0, event.availablePlaces ?? 0)} {t("events.remainingPlaces")}
                          </p>
                        </div>

                        <div className={styles.actions}>{renderEventCta(event)}</div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredAndSortedEvents.length > 0 && viewMode === "planning" && (
            <div className={styles.planningBoard}>
              {groupedEvents.map((group) => (
                <section key={group.key} className={styles.planningDay}>
                  <div className={styles.planningDateColumn}>
                    <p className={styles.planningLabel}>{t("events.dailyAgenda")}</p>
                    <h3 className={styles.planningDate}>{group.label}</h3>
                    <span className={styles.planningCount}>
                      {group.events.length} {group.events.length === 1 ? t("events.eventFound") : t("events.eventsFound")}
                    </span>
                  </div>

                  <div className={styles.planningEvents}>
                    {group.events.map((event) => {
                      const registeredCount = getRegisteredCount(event);
                      const occupancyRate = getOccupancyRate(event);
                      const status = getEventStatus(event);

                      return (
                        <article key={event.id} className={styles.timelineItem}>
                          <div className={styles.timelineMarker} aria-hidden="true" />
                          <div className={styles.timelineCard}>
                            <div className={styles.timelineHeader}>
                              <div>
                                <p className={styles.timelineTime}>
                                  {new Date(event.startDateTime).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} -{" "}
                                  {new Date(event.endDateTime).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <h4 className={styles.timelineTitle}>{event.title}</h4>
                              </div>
                              <span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span>
                            </div>

                            <div className={styles.timelineMeta}>
                              <span>{event.location || t("common.toBeAnnounced")}</span>
                              <span>{event.price && event.price > 0 ? `${event.price} ${EURO}` : t("events.free")}</span>
                              <span>{event.parkingSlotId ? t("events.statusParkingIncluded") : t("events.statusParkingUnavailable")}</span>
                            </div>

                            <div className={styles.timelineProgress}>
                              <div className={styles.progressTrack} aria-hidden="true">
                                <span className={styles.progressFill} style={{ width: `${occupancyRate}%` }} />
                              </div>
                              <p className={styles.progressCaption}>
                                {registeredCount} / {event.capacity} {t("common.persons")} · {Math.max(0, event.availablePlaces ?? 0)} {t("events.remainingPlaces")}
                              </p>
                            </div>

                            <div className={styles.timelineActions}>{renderEventCta(event)}</div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
