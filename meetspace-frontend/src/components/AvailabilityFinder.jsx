import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getEspaces, getEspaceReservationsForCalendar } from "../services/api";
import { getSpaceImage } from "../utils/mediaAssets";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import styles from "./AvailabilityFinder.module.css";

import { getAvailability, validateCalendar } from "../utils/availability";
const DURATIONS = [2, 4, 8];
const CAPACITY_PRESETS = [20, 50, 100, 300];

function pad(value) {
  return String(value).padStart(2, "0");
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function AvailabilityFinder({ spaces: providedSpaces, compact = false }) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const { user } = useAuth();
  const [fetchedSpaces, setFetchedSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(!providedSpaces);
  const [loadError, setLoadError] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [duration, setDuration] = useState(2);
  const [capacity, setCapacity] = useState(20);
  const [availabilityState, setAvailabilityState] = useState({ key: "", map: {} });
  const [now, setNow] = useState(() => new Date());
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = () => setRetryVersion((value) => value + 1);
  const spaces = providedSpaces || fetchedSpaces;

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    if (providedSpaces) return undefined;

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoadingSpaces(true);
        setLoadError(false);
        return getEspaces();
      })
      .then((data) => {
        if (!cancelled && data) setFetchedSpaces(data);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedSpaces([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSpaces(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providedSpaces, retryVersion]);

  const maxCapacity = spaces.length ? Math.max(...spaces.map((space) => Number(space.capacity) || 0)) : 500;
  const normalizedCapacity = Math.min(Math.max(Number(capacity) || 1, 1), maxCapacity);

  const matchingSpaces = useMemo(
    () =>
      spaces
        .filter((space) => Number(space.capacity) >= normalizedCapacity)
        .sort((a, b) => Number(a.capacity || 0) - Number(b.capacity || 0)),
    [spaces, normalizedCapacity],
  );
  const matchingSpaceIds = useMemo(() => matchingSpaces.map((space) => space.id).join(","), [matchingSpaces]);
  const availabilityKey = `${selectedDate}|${matchingSpaceIds}|${retryVersion}`;
  const availabilityMap = useMemo(() => {
    if (availabilityState.key !== availabilityKey) return {};
    return Object.fromEntries(Object.entries(availabilityState.map).map(([id, items]) => {
      try { return [id, getAvailability(selectedDate, duration, items, now)]; }
      catch { return [id, { error: true }]; }
    }));
  }, [availabilityKey, availabilityState, selectedDate, duration, now]);
  const checkingAvailability = Boolean(
    selectedDate && matchingSpaces.length > 0 && availabilityState.key !== availabilityKey,
  );

  useEffect(() => {
    if (!selectedDate || !Number.isFinite(Date.parse(`${selectedDate}T12:00:00`)) || matchingSpaces.length === 0) {
      return undefined;
    }

    const date = new Date(`${selectedDate}T12:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let cancelled = false;

    Promise.all(
      matchingSpaces.map(async (space) => {
        try {
          const reservations = await getEspaceReservationsForCalendar(space.id, year, month);
          return [space.id, validateCalendar(reservations)];
        } catch {
          return [space.id, null];
        }
      }),
    )
      .then((entries) => {
        if (!cancelled) setAvailabilityState({ key: availabilityKey, map: Object.fromEntries(entries) });
      });

    return () => {
      cancelled = true;
    };
  }, [availabilityKey, matchingSpaces, selectedDate]);

  const rooms = useMemo(
    () =>
      matchingSpaces
        .map((space) => ({ ...space, availability: availabilityMap[space.id] }))
        .sort((a, b) => {
          const aAvailable = a.availability?.available ? 0 : 1;
          const bAvailable = b.availability?.available ? 0 : 1;
          return aAvailable - bAvailable || Number(a.capacity || 0) - Number(b.capacity || 0);
        })
        .slice(0, compact ? 3 : 6),
    [matchingSpaces, availabilityMap, compact],
  );

  const availableCount = Object.values(availabilityMap).filter((availability) => availability.available).length;
  const unknownAvailability = Object.values(availabilityMap).some((availability) => availability.error);

  const handleCapacityChange = (nextCapacity) => {
    const value = Math.min(Math.max(Number(nextCapacity) || 1, 1), maxCapacity);
    setCapacity(value);
  };

  const resetFilters = () => {
    setSelectedDate(getTodayKey());
    setDuration(2);
    setCapacity(20);
  };

  return (
    <section className={`${styles.finder} ${compact ? styles.finderCompact : ""}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{t("availabilityFinder.kicker")}</p>
          <h2>{t("availabilityFinder.title")}</h2>
          <p>{t("availabilityFinder.text")}</p>
        </div>
        <div className={styles.signal}>
          <strong>{checkingAvailability ? "..." : unknownAvailability ? "—" : formatNumber(availableCount, locale)}</strong>
          <span>{t("availabilityFinder.availableRooms")}</span>
        </div>
      </div>

      <div className={styles.controls}>
        <label>
          {t("availabilityFinder.date")}
          <input
            type="date"
            min={getTodayKey()}
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>

        <label>
          {t("availabilityFinder.capacity")}
          <input
            type="number"
            min="1"
            max={maxCapacity}
            value={capacity}
            onChange={(event) => handleCapacityChange(event.target.value)}
          />
        </label>

        <div className={styles.durationGroup}>
          <span>{t("availabilityFinder.duration")}</span>
          <div>
            {DURATIONS.map((item) => (
              <button
                type="button"
                key={item}
                className={item === duration ? styles.durationActive : ""}
                onClick={() => setDuration(item)}
              >
                {item}h
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.presets} aria-label={t("availabilityFinder.capacityPresets")}>
        <span>{t("availabilityFinder.capacityPresets")}</span>
        {CAPACITY_PRESETS.filter((preset) => preset <= maxCapacity).map((preset) => (
          <button
            type="button"
            key={preset}
            className={Number(capacity) === preset ? styles.presetActive : ""}
            onClick={() => handleCapacityChange(preset)}
          >
            {formatNumber(preset, locale)} {t("common.persons")}
          </button>
        ))}
        <button type="button" className={styles.resetButton} onClick={resetFilters}>
          {t("availabilityFinder.reset")}
        </button>
      </div>

      {loadingSpaces ? (
        <div className={styles.state}>{t("common.loading")}</div>
      ) : loadError ? (
        <div className={styles.state} role="alert">{t("availabilityFinder.error")} <button type="button" onClick={retry}>{t("common.retry")}</button></div>
      ) : !selectedDate ? (
        <div className={styles.state}>{t("availabilityFinder.invalidDate")}</div>
      ) : matchingSpaces.length === 0 ? (
        <div className={styles.state}>
          <strong>{t("availabilityFinder.noCapacityMatch")}</strong>
          <Link to="/espace">{t("availabilityFinder.viewAllRooms")}</Link>
        </div>
      ) : (
        <div className={styles.results}>
          {rooms.map((room) => {
            const availability = room.availability;
            const isAvailable = availability?.available;

            return (
              <article key={room.id} className={`${styles.roomCard} ${isAvailable ? styles.roomAvailable : ""}`}>
                <div
                  className={styles.roomImage}
                  style={{ backgroundImage: `url(${getSpaceImage(room)})` }}
                  aria-hidden="true"
                />
                <div className={styles.roomBody}>
                  <div className={styles.roomTopline}>
                    <strong>{room.name}</strong>
                    <span>{formatMoney(room.basePrice, locale)} / h</span>
                  </div>
                  <p>
                    {formatNumber(room.capacity, locale)} {t("common.persons")} ·{" "}
                    {availability
                      ? availability.error ? t("availabilityFinder.unknown") : isAvailable
                        ? t("availabilityFinder.firstSlot", { time: availability.firstSlot })
                        : t("availabilityFinder.full")
                      : t("availabilityFinder.checking")}
                  </p>
                  {availability?.error && <button type="button" onClick={retry}>{t("common.retry")}</button>}
                  {!availability?.error && <div className={styles.roomMeta}>
                    <span>{formatNumber(availability?.availableHours ?? 0, locale)}h {t("availabilityFinder.free")}</span>
                    <span>{formatNumber(availability?.dayBlocks ?? 0, locale)} {t("availabilityFinder.blocks")}</span>
                  </div>}
                  {isAvailable && (
                    <Link
                      to={`/reservations/new/${room.id}?date=${encodeURIComponent(selectedDate)}&start=${encodeURIComponent(availability.firstSlot)}&duration=${duration}`}
                      className={styles.roomCta}
                    >
                      {user ? t("availabilityFinder.reserve") : t("availabilityFinder.loginToReserve")}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
