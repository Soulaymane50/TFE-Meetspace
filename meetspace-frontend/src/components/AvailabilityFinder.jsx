import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getEspaces, getEspaceReservationsForCalendar } from "../services/api";
import { getSpaceImage } from "../utils/mediaAssets";
import styles from "./AvailabilityFinder.module.css";

const OPENING_HOUR = 7;
const CLOSING_HOUR = 22;
const DURATIONS = [2, 4, 8];

function pad(value) {
  return String(value).padStart(2, "0");
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getFirstAvailableSlot(dateKey, duration, reservations) {
  for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR - duration; hour += 1) {
    const slotStart = new Date(`${dateKey}T${pad(hour)}:00:00`);
    const slotEnd = new Date(`${dateKey}T${pad(hour + duration)}:00:00`);
    if (slotEnd <= new Date()) continue;

    const blocked = reservations.some((reservation) =>
      rangesOverlap(
        slotStart,
        slotEnd,
        new Date(reservation.startDateTime),
        new Date(reservation.endDateTime),
      ),
    );

    if (!blocked) return `${pad(hour)}:00`;
  }

  return null;
}

function getAvailableHours(dateKey, reservations) {
  let availableHours = 0;

  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += 1) {
    const slotStart = new Date(`${dateKey}T${pad(hour)}:00:00`);
    const slotEnd = new Date(`${dateKey}T${pad(hour + 1)}:00:00`);
    if (slotEnd <= new Date()) continue;

    const blocked = reservations.some((reservation) =>
      rangesOverlap(
        slotStart,
        slotEnd,
        new Date(reservation.startDateTime),
        new Date(reservation.endDateTime),
      ),
    );

    if (!blocked) availableHours += 1;
  }

  return availableHours;
}

export default function AvailabilityFinder({ spaces: providedSpaces, compact = false }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [fetchedSpaces, setFetchedSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(!providedSpaces);
  const [loadError, setLoadError] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [duration, setDuration] = useState(2);
  const [capacity, setCapacity] = useState(20);
  const [availabilityMap, setAvailabilityMap] = useState({});
  const spaces = providedSpaces || fetchedSpaces;

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
  }, [providedSpaces]);

  const matchingSpaces = useMemo(
    () =>
      spaces
        .filter((space) => Number(space.capacity) >= Number(capacity || 0))
        .sort((a, b) => Number(a.capacity || 0) - Number(b.capacity || 0)),
    [spaces, capacity],
  );

  useEffect(() => {
    if (!selectedDate || matchingSpaces.length === 0) {
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
          const items = Array.isArray(reservations) ? reservations : [];
          const firstSlot = getFirstAvailableSlot(selectedDate, duration, items);
          const dayBlocks = items.filter((reservation) =>
            rangesOverlap(
              new Date(`${selectedDate}T${pad(OPENING_HOUR)}:00:00`),
              new Date(`${selectedDate}T${pad(CLOSING_HOUR)}:00:00`),
              new Date(reservation.startDateTime),
              new Date(reservation.endDateTime),
            ),
          );

          return [
            space.id,
            {
              firstSlot,
              available: Boolean(firstSlot),
              availableHours: getAvailableHours(selectedDate, items),
              dayBlocks: dayBlocks.length,
            },
          ];
        } catch {
          return [space.id, { firstSlot: null, available: false, availableHours: 0, dayBlocks: 0 }];
        }
      }),
    ).then((entries) => {
      if (!cancelled) setAvailabilityMap(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [matchingSpaces, selectedDate, duration]);

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

  const availableCount = rooms.filter((room) => room.availability?.available).length;
  const maxCapacity = spaces.length ? Math.max(...spaces.map((space) => Number(space.capacity) || 0)) : 500;

  return (
    <section className={`${styles.finder} ${compact ? styles.finderCompact : ""}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{t("availabilityFinder.kicker")}</p>
          <h2>{t("availabilityFinder.title")}</h2>
          <p>{t("availabilityFinder.text")}</p>
        </div>
        <div className={styles.signal}>
          <strong>{availableCount}</strong>
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
            onChange={(event) => setCapacity(event.target.value)}
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

      {loadingSpaces ? (
        <div className={styles.state}>{t("common.loading")}</div>
      ) : loadError ? (
        <div className={styles.state}>{t("availabilityFinder.error")}</div>
      ) : matchingSpaces.length === 0 ? (
        <div className={styles.state}>{t("availabilityFinder.noCapacityMatch")}</div>
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
                    <span>{room.basePrice} € / h</span>
                  </div>
                  <p>
                    {room.capacity} {t("common.persons")} ·{" "}
                    {availability
                      ? isAvailable
                        ? t("availabilityFinder.firstSlot", { time: availability.firstSlot })
                        : t("availabilityFinder.full")
                      : t("availabilityFinder.checking")}
                  </p>
                  <div className={styles.roomMeta}>
                    <span>{availability?.availableHours ?? 0}h {t("availabilityFinder.free")}</span>
                    <span>{availability?.dayBlocks ?? 0} {t("availabilityFinder.blocks")}</span>
                  </div>
                  {isAvailable && (
                    <Link to={user ? `/reservations/new/${room.id}` : "/login"} className={styles.roomCta}>
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
