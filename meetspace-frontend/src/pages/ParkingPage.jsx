import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getParkingSlots } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import { formatMoney, formatNumber } from "../utils/formatters";
import { MEETSPACE_TOTAL_PARKING_SPACES } from "../utils/businessRules";
import { PARKING_IMAGE } from "../utils/mediaAssets";
import styles from "./ParkingPage.module.css";

const getDateLocale = (lang) => {
  const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
  return locales[lang] || "fr-BE";
};

export default function ParkingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parkingSlots, setParkingSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => searchParams.get("date") || "ALL");
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);

  const fetchParkingSlots = useCallback(() => {
    getParkingSlots()
      .then(setParkingSlots)
      .catch((err) => {
        if (err.code === "REQUEST_TIMEOUT" || err.message === "REQUEST_TIMEOUT") {
          setError(t("parking.fetchTimeout"));
          return;
        }
        if (err.message === "Failed to fetch") {
          setError(t("parking.fetchError"));
          return;
        }
        setError(err.message || t("parking.createError"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchParkingSlots();
  }, [fetchParkingSlots]);

  useEffect(() => {
    setSearchParams(selectedDate === "ALL" ? {} : { date: selectedDate }, { replace: true });
  }, [selectedDate, setSearchParams]);

  const retryParkingSlots = () => {
    setLoading(true);
    setError("");
    fetchParkingSlots();
  };

  const openSlotsCount = parkingSlots.filter((slot) => (slot.availableSpaces ?? 0) > 0).length;
  const averageRate = parkingSlots.length
    ? Math.round((parkingSlots.reduce((sum, slot) => sum + (Number(slot.parkingRate) || 0), 0) / parkingSlots.length) * 10) / 10
    : 0;

  const getRegisteredSpaces = (slot) => Math.max(0, (slot.parkingCapacity || 0) - (slot.availableSpaces || 0));
  const getOccupancyRate = (slot) => {
    if (!slot.parkingCapacity) return 0;
    return Math.min(100, Math.round((getRegisteredSpaces(slot) / slot.parkingCapacity) * 100));
  };

  const getStatus = (slot) => {
    const occupancy = getOccupancyRate(slot);
    if ((slot.availableSpaces || 0) <= 0) return { label: t("parking.full"), className: styles.statusFull };
    if (occupancy >= 80) return { label: t("parking.almostFull"), className: styles.statusAlmostFull };
    return { label: t("status.available"), className: styles.statusAvailable };
  };

  const groupedSlots = useMemo(() => {
    const groups = parkingSlots.reduce((acc, slot) => {
      const key = slot.slotDate;
      const existing = acc.find((group) => group.key === key);
      if (existing) {
        existing.slots.push(slot);
        return acc;
      }

      acc.push({
        key,
        label: new Date(`${slot.slotDate}T00:00:00`).toLocaleDateString(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        compactLabel: new Date(`${slot.slotDate}T00:00:00`).toLocaleDateString(locale, {
          day: "2-digit",
          month: "short",
        }),
        slots: [slot],
      });
      return acc;
    }, []);

    return groups.sort((a, b) => new Date(a.key) - new Date(b.key));
  }, [parkingSlots, locale]);

  const selectedGroup = groupedSlots.find((group) => group.key === selectedDate);
  const visibleSlots = [...(selectedDate === "ALL" ? parkingSlots : selectedGroup?.slots || [])].sort((a, b) => {
    const aDate = new Date(`${a.slotDate}T${a.startTime || "00:00:00"}`);
    const bDate = new Date(`${b.slotDate}T${b.startTime || "00:00:00"}`);
    return aDate - bDate;
  });

  const formatSlotDay = (slotDate) =>
    new Date(`${slotDate}T00:00:00`).toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("parking.capacityModelText")} />;
  }

  if (error) {
    return (
      <PageState
        type="error"
        title={t("common.error")}
        message={error}
        action={
          <button type="button" onClick={retryParkingSlots}>
            {t("common.retry")}
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page} style={{ "--parking-image": `url(${PARKING_IMAGE})` }}>
      <section className={styles.heroPanel}>
        <div className={styles.heroHeader}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("parking.kicker")}</p>
            <h1 className={styles.title}>{t("parking.title")}</h1>
            <p className={styles.subtitle}>{t("parking.workspaceLead")}</p>
          </div>

          {user && (
            <Link to="/my-reservations?tab=parking" className={styles.linkGhost}>
              {t("parking.viewMyReservations")}
            </Link>
          )}
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatNumber(parkingSlots.length, locale)}</span>
            <span className={styles.summaryLabel}>{t("nav.parking")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatNumber(openSlotsCount, locale)}</span>
            <span className={styles.summaryLabel}>{t("parking.operationsOpenSlots")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatNumber(MEETSPACE_TOTAL_PARKING_SPACES, locale)}</span>
            <span className={styles.summaryLabel}>{t("parking.physicalCapacityLabel")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatMoney(averageRate, locale)}</span>
            <span className={styles.summaryLabel}>{t("parking.rateLabel")}</span>
          </div>
        </div>
      </section>

      {parkingSlots.length === 0 ? (
        <PageState
          type="empty"
          title={t("parking.noSessions")}
          message={t("parking.capacityModelText")}
          action={<Link to="/events">{t("home.eventsCta", { defaultValue: "Découvrir les événements" })}</Link>}
        />
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <p className={styles.sidebarEyebrow}>{t("parking.operationsLabel")}</p>
              <h2 className={styles.sidebarTitle}>{t("parking.operationsTitle")}</h2>
              <p className={styles.sidebarText}>{t("parking.operationsText")}</p>
            </div>

            <div className={styles.sidebarStats}>
              <div className={styles.sidebarStat}>
                <span className={styles.sidebarStatValue}>{formatNumber(groupedSlots.length, locale)}</span>
                <span className={styles.sidebarStatLabel}>{t("parking.daysCovered")}</span>
              </div>
              <div className={styles.sidebarStat}>
                <span className={styles.sidebarStatValue}>{formatNumber(parkingSlots.length, locale)}</span>
                <span className={styles.sidebarStatLabel}>{t("parking.sessionPlural")}</span>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <p className={styles.sidebarListLabel}>{t("parking.selectDay")}</p>
              <div className={styles.dateSelector}>
                <button
                  type="button"
                  className={`${styles.dateChip} ${selectedDate === "ALL" ? styles.dateChipActive : ""}`}
                  onClick={() => setSelectedDate("ALL")}
                >
                  <strong>{t("parking.allDays")}</strong>
                  <span>{formatNumber(parkingSlots.length, locale)} {t("parking.sessionPlural")}</span>
                </button>
                {groupedSlots.map((group) => {
                  const isFull = group.slots.every((slot) => (slot.availableSpaces || 0) <= 0);
                  return (
                    <button
                      type="button"
                      key={group.key}
                      className={[
                        styles.dateChip,
                        selectedDate === group.key ? styles.dateChipActive : "",
                        isFull ? styles.dateChipFull : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedDate(group.key)}
                    >
                      <strong>{group.compactLabel}</strong>
                      <span>
                        {formatNumber(group.slots.length, locale)} {group.slots.length > 1 ? t("parking.sessionPlural") : t("parking.session")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.selectedDayCard}>
              <span>{t("parking.physicalCapacityLabel")}</span>
              <strong data-testid="parking-physical-capacity">{formatNumber(MEETSPACE_TOTAL_PARKING_SPACES, locale)}</strong>
              <p>{t("parking.sharedCapacitySummary")}</p>
            </div>

            <div className={styles.sidebarSection}>
              <p className={styles.sidebarListLabel}>{t("parking.capacityModelLabel")}</p>
              <div className={styles.sidebarNote}>
                <strong>{t("parking.capacityModelTitle")}</strong>
                <p>{t("parking.capacityModelText")}</p>
              </div>
            </div>
          </aside>

          <section className={styles.dayBoard}>
            <section className={styles.daySection}>
              <div className={styles.dayHeader}>
                <div>
                  <p className={styles.dayLabel}>{t("parking.dayOverviewLabel")}</p>
                  <h2 className={styles.dayTitle}>
                    {selectedDate === "ALL" ? t("parking.availableChoicesTitle") : selectedGroup?.label}
                  </h2>
                  <p className={styles.dayHint}>{t("parking.availableChoicesHint")}</p>
                </div>
                <div className={styles.dayStats}>
                  <span className={styles.dayStat}>
                    {formatNumber(visibleSlots.length, locale)} {visibleSlots.length > 1 ? t("parking.sessionPlural") : t("parking.session")}
                  </span>
                  <span className={styles.dayStat}>
                    {formatNumber(MEETSPACE_TOTAL_PARKING_SPACES, locale)} {t("parking.physicalCapacityLabel")}
                  </span>
                </div>
              </div>

              <div className={styles.slotGrid}>
                {visibleSlots.map((slot) => {
                  const occupancy = getOccupancyRate(slot);
                  const reserved = getRegisteredSpaces(slot);
                  const status = getStatus(slot);
                  const isFull = (slot.availableSpaces || 0) <= 0;

                  return (
                    <article key={slot.id} className={styles.slotCard}>
                      <div className={styles.slotMedia}>
                        <div className={styles.slotImage} aria-hidden="true" />
                        <span className={styles.slotDateBadge}>{formatSlotDay(slot.slotDate)}</span>
                      </div>

                      <div className={styles.slotContent}>
                        <div className={styles.slotTopline}>
                          <p className={styles.slotTime}>
                            {slot.startTime} - {slot.endTime}
                          </p>
                          <span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span>
                        </div>

                        <h3 className={styles.slotTitle}>{slot.title || t("nav.parking")}</h3>

                        <div className={styles.slotMetrics}>
                          <div className={styles.metricCard}>
                            <span className={styles.metricLabel}>{t("parking.remainingLabel")}</span>
                            <span className={styles.metricValue}>{formatNumber(slot.availableSpaces, locale)}</span>
                          </div>
                          <div className={styles.metricCard}>
                            <span className={styles.metricLabel}>{t("parking.reservedLabel")}</span>
                            <span className={styles.metricValue}>{formatNumber(reserved, locale)}</span>
                          </div>
                          <div className={styles.metricCard}>
                            <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                            <span className={styles.metricValue}>{formatMoney(slot.parkingRate, locale)}</span>
                          </div>
                        </div>

                        <div className={styles.progressCard}>
                          <div className={styles.progressHeader}>
                            <span className={styles.progressLabel}>{t("parking.occupancyLabel")}</span>
                            <span className={styles.progressValue}>{formatNumber(occupancy, locale)}%</span>
                          </div>
                          <div className={styles.progressTrack} aria-hidden="true">
                            <span className={styles.progressFill} style={{ width: `${occupancy}%` }} />
                          </div>
                          <p className={styles.progressCaption}>
                            {formatNumber(reserved, locale)} / {formatNumber(slot.parkingCapacity, locale)} {t("parking.places")}
                          </p>
                        </div>

                        <div className={styles.slotActions}>
                          <Link to={`/parking/${slot.id}`} className={styles.detailButton}>
                            {t("detail.viewDetails", { defaultValue: "Voir la fiche" })}
                          </Link>
                          {isFull ? (
                            <span className={styles.buttonDisabled}>{t("parking.full")}</span>
                          ) : (
                            <Link
                              to={`/parking/reserve/${slot.id}`}
                              className={user ? styles.primaryButton : styles.secondaryButton}
                            >
                              {user ? t("parking.reserve") : t("parking.loginToReserve")}
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      )}
    </div>
  );
}
