import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEspaceReservationsForCalendar } from "../services/api";
import styles from "./RoomSchedulePicker.module.css";

const OPENING_HOUR = 7;
const CLOSING_HOUR = 22;
const DURATIONS = [1, 2, 3, 4, 6, 8];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalDateTime(dateKey, hour) {
  return `${dateKey}T${pad(hour)}:00`;
}

function getHourFromDateTime(value) {
  if (!value || value.length < 13) return null;
  const hour = Number(value.slice(11, 13));
  return Number.isFinite(hour) ? hour : null;
}

function getDuration(startDateTime, endDateTime) {
  if (!startDateTime || !endDateTime) return 2;
  const diffMs = new Date(endDateTime).getTime() - new Date(startDateTime).getTime();
  const diffHours = Math.max(1, Math.round(diffMs / 36e5));
  return DURATIONS.includes(diffHours) ? diffHours : Math.min(Math.max(diffHours, 1), 8);
}

export default function RoomSchedulePicker({
  spaceId,
  spaceName,
  startDateTime,
  endDateTime,
  onChange,
  ignoreBlockId,
}) {
  const { t, i18n } = useTranslation();
  const initialDate = startDateTime ? new Date(startDateTime) : new Date();
  const [currentDate, setCurrentDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [reservationBucket, setReservationBucket] = useState({ key: "", items: [] });
  const [manualSelectedDate, setManualSelectedDate] = useState("");
  const [durationOverride, setDurationOverride] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const selectedStartHour = getHourFromDateTime(startDateTime);
  const selectedEndHour = getHourFromDateTime(endDateTime);
  const selectedDate = startDateTime?.slice(0, 10) || manualSelectedDate;
  const duration = durationOverride ?? getDuration(startDateTime, endDateTime);
  const reservationKey = `${spaceId || "none"}-${year}-${month}`;
  const reservations = reservationBucket.key === reservationKey ? reservationBucket.items : [];

  const locale = useMemo(() => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  }, [i18n.language]);

  useEffect(() => {
    if (!spaceId) return;

    let cancelled = false;
    getEspaceReservationsForCalendar(spaceId, year, month)
      .then((data) => {
        if (!cancelled) {
          setReservationBucket({
            key: reservationKey,
            items: Array.isArray(data) ? data : [],
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [spaceId, year, month, reservationKey]);

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const selectedDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "2-digit", month: "long" }),
    [locale],
  );

  const getBlocksForDate = (dateKey) => {
    const dayStart = new Date(`${dateKey}T${pad(OPENING_HOUR)}:00:00`);
    const dayEnd = new Date(`${dateKey}T${pad(CLOSING_HOUR)}:00:00`);

    return reservations
      .filter((reservation) => {
        if (ignoreBlockId && Number(reservation.id) === Number(ignoreBlockId)) return false;
        const start = new Date(reservation.startDateTime);
        const end = new Date(reservation.endDateTime);
        return start < dayEnd && end > dayStart;
      })
      .map((reservation) => ({
        start: new Date(reservation.startDateTime),
        end: new Date(reservation.endDateTime),
      }));
  };

  const isRangeBlocked = (dateKey, hour, slotDuration) => {
    const slotStart = new Date(`${dateKey}T${pad(hour)}:00:00`);
    const slotEnd = new Date(`${dateKey}T${pad(hour + slotDuration)}:00:00`);
    return getBlocksForDate(dateKey).some((block) => block.start < slotEnd && block.end > slotStart);
  };

  const isPastRange = (dateKey, hour, slotDuration) => {
    const slotEnd = new Date(`${dateKey}T${pad(hour + slotDuration)}:00:00`);
    return slotEnd <= new Date();
  };

  const isSlotAvailable = (dateKey, hour, slotDuration = duration) => {
    if (!dateKey || hour < OPENING_HOUR || hour + slotDuration > CLOSING_HOUR) return false;
    return !isPastRange(dateKey, hour, slotDuration) && !isRangeBlocked(dateKey, hour, slotDuration);
  };

  const getFirstAvailableStart = (dateKey, slotDuration = duration) => {
    for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR - slotDuration; hour += 1) {
      if (isSlotAvailable(dateKey, hour, slotDuration)) return hour;
    }
    return null;
  };

  const getDayStatus = (dateKey) => {
    let availableHours = 0;
    let blockedHours = 0;

    for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += 1) {
      if (isSlotAvailable(dateKey, hour, 1)) {
        availableHours += 1;
      } else {
        blockedHours += 1;
      }
    }

    if (availableHours === 0) return "full";
    if (blockedHours === 0) return "available";
    return "partial";
  };

  const applySlot = (dateKey, hour, slotDuration = duration) => {
    if (!isSlotAvailable(dateKey, hour, slotDuration)) return;
    setManualSelectedDate(dateKey);
    setDurationOverride(slotDuration);
    onChange({
      startDateTime: toLocalDateTime(dateKey, hour),
      endDateTime: toLocalDateTime(dateKey, hour + slotDuration),
    });
  };

  const handleDaySelect = (dateKey) => {
    const preferredHour =
      selectedStartHour !== null && isSlotAvailable(dateKey, selectedStartHour, duration)
        ? selectedStartHour
        : getFirstAvailableStart(dateKey, duration);

    setManualSelectedDate(dateKey);
    if (preferredHour !== null) {
      applySlot(dateKey, preferredHour, duration);
    }
  };

  const handleDurationChange = (nextDuration) => {
    setDurationOverride(nextDuration);
    if (!selectedDate) return;

    const preferredHour =
      selectedStartHour !== null && isSlotAvailable(selectedDate, selectedStartHour, nextDuration)
        ? selectedStartHour
        : getFirstAvailableStart(selectedDate, nextDuration);

    if (preferredHour !== null) {
      applySlot(selectedDate, preferredHour, nextDuration);
    } else {
      onChange({
        startDateTime: "",
        endDateTime: "",
      });
    }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const weekDays = [
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
    t("calendar.sun"),
  ];

  const selectedBlocks = selectedDate ? getBlocksForDate(selectedDate) : [];
  const selectedAvailableCount = selectedDate
    ? Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, index) => OPENING_HOUR + index).filter((hour) =>
        isSlotAvailable(selectedDate, hour, 1),
      ).length
    : 0;

  if (!spaceId) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⌁</span>
        <div>
          <strong>{t("calendar.roomFirstTitle")}</strong>
          <p>{t("calendar.roomFirstText")}</p>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.scheduler}>
      <div className={styles.schedulerHeader}>
        <div>
          <span className={styles.kicker}>{t("calendar.roomSchedule")}</span>
          <h3>{t("calendar.scheduleTitle")}</h3>
          <p>
            {spaceName ? t("calendar.scheduleSubtitleWithRoom", { room: spaceName }) : t("calendar.scheduleSubtitle")}
          </p>
        </div>
        <div className={styles.monthControls}>
          <button type="button" onClick={() => setCurrentDate(new Date(year, month - 2, 1))}>
            ←
          </button>
          <strong>{monthFormatter.format(currentDate)}</strong>
          <button type="button" onClick={() => setCurrentDate(new Date(year, month, 1))}>
            →
          </button>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.calendarPanel}>
          <div className={styles.weekGrid}>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={styles.daysGrid}>
            {Array.from({ length: mondayOffset }, (_, index) => (
              <span key={`empty-${index}`} className={styles.emptyDay} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const dateKey = `${year}-${pad(month)}-${pad(day)}`;
              const status = getDayStatus(dateKey);
              const isSelected = selectedDate === dateKey;
              const dayClass = [
                styles.dayButton,
                styles[`day${status[0].toUpperCase()}${status.slice(1)}`],
                isSelected ? styles.daySelected : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={dayClass}
                  onClick={() => status !== "full" && handleDaySelect(dateKey)}
                  disabled={status === "full"}
                >
                  <span>{day}</span>
                  <small>{t(`calendar.${status}`)}</small>
                </button>
              );
            })}
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.dotAvailable} /> {t("calendar.available")}
            </span>
            <span>
              <i className={styles.dotPartial} /> {t("calendar.partial")}
            </span>
            <span>
              <i className={styles.dotFull} /> {t("calendar.full")}
            </span>
          </div>
        </div>

        <aside className={styles.slotPanel}>
          <div className={styles.slotPanelHeader}>
            <span>{t("calendar.selectedDay")}</span>
            <strong>
              {selectedDate
                ? selectedDateFormatter.format(new Date(`${selectedDate}T12:00:00`))
                : t("calendar.chooseDay")}
            </strong>
          </div>

          <div className={styles.statsRow}>
            <div>
              <strong>{selectedAvailableCount}</strong>
              <span>{t("calendar.availableHours")}</span>
            </div>
            <div>
              <strong>{selectedBlocks.length}</strong>
              <span>{t("calendar.occupiedBlocks")}</span>
            </div>
          </div>

          <div className={styles.durationGroup}>
            <span>{t("calendar.duration")}</span>
            <div>
              {DURATIONS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={item === duration ? styles.durationActive : ""}
                  onClick={() => handleDurationChange(item)}
                >
                  {item}h
                </button>
              ))}
            </div>
          </div>

          <div className={styles.hoursGrid}>
            {Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, index) => OPENING_HOUR + index).map((hour) => {
              const available = selectedDate ? isSlotAvailable(selectedDate, hour, duration) : false;
              const selected =
                selectedDate &&
                selectedStartHour === hour &&
                selectedEndHour === hour + duration &&
                startDateTime?.slice(0, 10) === selectedDate;

              return (
                <button
                  type="button"
                  key={hour}
                  disabled={!selectedDate || !available}
                  className={selected ? styles.hourSelected : ""}
                  onClick={() => applySlot(selectedDate, hour, duration)}
                >
                  {pad(hour)}:00
                </button>
              );
            })}
          </div>

          <div className={styles.selectionSummary}>
            <span>{t("calendar.selectedSlot")}</span>
            <strong>
              {startDateTime && endDateTime
                ? `${startDateTime.replace("T", " ")} → ${endDateTime.slice(11, 16)}`
                : t("calendar.noSlotSelected")}
            </strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
