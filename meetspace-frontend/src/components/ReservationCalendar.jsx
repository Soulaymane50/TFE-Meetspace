import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getEspaceReservationsForCalendar } from "../services/api";
import styles from "./ReservationCalendar.module.css";

export default function ReservationCalendar({ espaceId, onSelectDate, selectedDate }) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    if (!espaceId) return;

    setLoading(true);
    getEspaceReservationsForCalendar(espaceId, year, month)
      .then(setReservations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [espaceId, year, month]);

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month - 1, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const OPENING_HOUR = 7;
  const CLOSING_HOUR = 22;

  const getDayStatus = (day) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayStart = new Date(`${dateStr}T${String(OPENING_HOUR).padStart(2, "0")}:00:00`);
    const dayEnd = new Date(`${dateStr}T${String(CLOSING_HOUR).padStart(2, "0")}:00:00`);

    const dayReservations = reservations.filter((r) => {
      const start = new Date(r.startDateTime);
      const end = new Date(r.endDateTime);
      return start < dayEnd && end > dayStart;
    });

    const totalHours = CLOSING_HOUR - OPENING_HOUR;
    let reservedHours = 0;

    for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour++) {
      const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`);
      const slotEnd = new Date(`${dateStr}T${String(hour + 1).padStart(2, "0")}:00:00`);
      const isHourReserved = dayReservations.some((r) => {
        const start = new Date(r.startDateTime);
        const end = new Date(r.endDateTime);
        return start < slotEnd && end > slotStart;
      });
      if (isHourReserved) reservedHours += 1;
    }

    if (reservedHours === 0) return "available";
    if (reservedHours >= totalHours) return "full";
    return "partial";
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month, 1));

  const handleDayClick = (day) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onSelectDate(dateStr);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const weekDays = [
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
    t("calendar.sun"),
  ];

  const monthNames = [
    t("calendar.january"),
    t("calendar.february"),
    t("calendar.march"),
    t("calendar.april"),
    t("calendar.may"),
    t("calendar.june"),
    t("calendar.july"),
    t("calendar.august"),
    t("calendar.september"),
    t("calendar.october"),
    t("calendar.november"),
    t("calendar.december"),
  ];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = getDayStatus(day);
    const isSelected = selectedDate === dateStr;
    const isToday = dateStr === todayStr;
    const isPast = new Date(dateStr) < new Date(todayStr);

    const dayClass = [
      styles.day,
      status === "partial" ? styles.dayPartial : "",
      status === "full" ? styles.dayFull : styles.dayAvailable,
      isSelected ? styles.daySelected : "",
      isToday ? styles.dayToday : "",
      isPast ? styles.dayPast : "",
    ]
      .filter(Boolean)
      .join(" ");

    days.push(
      <div key={day} onClick={() => !isPast && handleDayClick(day)} className={dayClass} aria-disabled={isPast}>
        {day}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" onClick={handlePrevMonth} className={styles.navButton} aria-label="Mois précédent">
          ←
        </button>
        <span className={styles.monthYear}>
          {monthNames[month - 1]} {year}
        </span>
        <button type="button" onClick={handleNextMonth} className={styles.navButton} aria-label="Mois suivant">
          →
        </button>
      </div>

      {loading && <p className={styles.loading}>{t("common.loading")}</p>}

      <div className={styles.weekDays}>
        {weekDays.map((d) => (
          <div key={d} className={styles.weekDay}>
            {d}
          </div>
        ))}
      </div>

      <div className={styles.daysGrid}>{days}</div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendAvailable}`}></span>
          {t("calendar.available")}
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendPartial}`}></span>
          {t("calendar.partial")}
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendFull}`}></span>
          {t("calendar.full")}
        </div>
      </div>
    </div>
  );
}
