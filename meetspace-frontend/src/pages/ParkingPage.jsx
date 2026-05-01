import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getParkingSlots } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import styles from "./ParkingPage.module.css";

const getDateLocale = (lang) => {
  const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
  return locales[lang] || "fr-BE";
};

export default function ParkingPage() {
  const [parkingSlots, setParkingSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);

  const fetchParkingSlots = useCallback(() => {
    getParkingSlots()
      .then(setParkingSlots)
      .catch((err) => {
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

  const retryParkingSlots = () => {
    setLoading(true);
    setError("");
    fetchParkingSlots();
  };

  const openSlotsCount = parkingSlots.filter((slot) => (slot.availableSpaces ?? 0) > 0).length;
  const totalAvailableSpaces = parkingSlots.reduce((sum, slot) => sum + (slot.availableSpaces || 0), 0);
  const totalCapacity = parkingSlots.reduce((sum, slot) => sum + (slot.parkingCapacity || 0), 0);
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

  const groupedSlots = parkingSlots.reduce((groups, slot) => {
    const key = slot.slotDate;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.slots.push(slot);
      return groups;
    }

    groups.push({
      key,
      label: new Date(`${slot.slotDate}T00:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      slots: [slot],
    });
    return groups;
  }, []);

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
    <div className={styles.page}>
      <section className={styles.heroPanel}>
        <div className={styles.heroHeader}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("parking.kicker")}</p>
            <h1 className={styles.title}>{t("parking.title")}</h1>
            <p className={styles.subtitle}>{t("parking.workspaceLead")}</p>
          </div>

          {user && (
            <Link to="/my-parking-reservations" className={styles.linkGhost}>
              ← {t("parking.viewMyReservations")}
            </Link>
          )}
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{parkingSlots.length}</span>
            <span className={styles.summaryLabel}>{t("nav.parking")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{openSlotsCount}</span>
            <span className={styles.summaryLabel}>{t("parking.operationsOpenSlots")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{totalAvailableSpaces}</span>
            <span className={styles.summaryLabel}>{t("parking.placesAvailable")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{averageRate} €</span>
            <span className={styles.summaryLabel}>{t("parking.rateLabel")}</span>
          </div>
        </div>
      </section>

      {parkingSlots.length === 0 ? (
        <PageState type="empty" title={t("parking.noSessions")} message={t("parking.capacityModelText")} />
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
                <span className={styles.sidebarStatValue}>{groupedSlots.length}</span>
                <span className={styles.sidebarStatLabel}>{t("parking.daysCovered")}</span>
              </div>
              <div className={styles.sidebarStat}>
                <span className={styles.sidebarStatValue}>{totalCapacity}</span>
                <span className={styles.sidebarStatLabel}>{t("parking.totalCapacityLabel")}</span>
              </div>
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
            {groupedSlots.map((group) => (
              <section key={group.key} className={styles.daySection}>
                <div className={styles.dayHeader}>
                  <div>
                    <p className={styles.dayLabel}>{t("parking.dayOverviewLabel")}</p>
                    <h2 className={styles.dayTitle}>{group.label}</h2>
                  </div>
                  <div className={styles.dayStats}>
                    <span className={styles.dayStat}>
                      {group.slots.length} {group.slots.length > 1 ? t("parking.sessionPlural") : t("parking.session")}
                    </span>
                    <span className={styles.dayStat}>
                      {group.slots.reduce((sum, slot) => sum + (slot.availableSpaces || 0), 0)} {t("parking.placesAvailable")}
                    </span>
                  </div>
                </div>

                <div className={styles.slotGrid}>
                  {group.slots.map((slot) => {
                    const occupancy = getOccupancyRate(slot);
                    const reserved = getRegisteredSpaces(slot);
                    const status = getStatus(slot);
                    const isFull = (slot.availableSpaces || 0) <= 0;

                    return (
                      <article key={slot.id} className={styles.slotCard}>
                        <div className={styles.slotImage} aria-hidden="true" />

                        <div className={styles.slotTopline}>
                          <p className={styles.slotTime}>
                            {slot.startTime} - {slot.endTime}
                          </p>
                          <span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span>
                        </div>

                        <h3 className={styles.slotTitle}>{slot.title || t("nav.parking")}</h3>

                        <div className={styles.slotMetrics}>
                          <div className={styles.metricCard}>
                            <span className={styles.metricLabel}>{t("parking.reservedLabel")}</span>
                            <span className={styles.metricValue}>{reserved}</span>
                          </div>
                          <div className={styles.metricCard}>
                            <span className={styles.metricLabel}>{t("parking.remainingLabel")}</span>
                            <span className={styles.metricValue}>{slot.availableSpaces}</span>
                          </div>
                          <div className={styles.metricCard}>
                            <span className={styles.metricLabel}>{t("parking.rateLabel")}</span>
                            <span className={styles.metricValue}>{slot.parkingRate} €</span>
                          </div>
                        </div>

                        <div className={styles.progressCard}>
                          <div className={styles.progressHeader}>
                            <span className={styles.progressLabel}>{t("parking.occupancyLabel")}</span>
                            <span className={styles.progressValue}>{occupancy}%</span>
                          </div>
                          <div className={styles.progressTrack} aria-hidden="true">
                            <span className={styles.progressFill} style={{ width: `${occupancy}%` }} />
                          </div>
                          <p className={styles.progressCaption}>
                            {reserved} / {slot.parkingCapacity} {t("parking.places")}
                          </p>
                        </div>

                        <div className={styles.slotActions}>
                          {user ? (
                            isFull ? (
                              <span className={styles.buttonDisabled}>{t("parking.full")}</span>
                            ) : (
                              <Link to={`/parking/reserve/${slot.id}`} className={styles.primaryButton}>
                                {t("parking.reserve")}
                              </Link>
                            )
                          ) : (
                            <Link to="/login" className={styles.secondaryButton}>
                              {t("parking.loginToReserve")}
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
