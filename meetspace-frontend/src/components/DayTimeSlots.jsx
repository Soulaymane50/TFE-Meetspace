import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getEspaceReservationsForCalendar } from "../services/api";
import styles from "./DayTimeSlots.module.css";

const OPENING_HOUR = 7;
const CLOSING_HOUR = 22;

export default function DayTimeSlots({
  espaceId,
  selectedDate,
  onSelectTimeSlot,
  selectedStartTime,
  selectedEndTime,
}) {
  const { t, i18n } = useTranslation();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);

  const getDateLocale = () => {
    const locales = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };
    return locales[i18n.language] || "fr-BE";
  };

  useEffect(() => {
    if (!espaceId || !selectedDate) return;

    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let cancelled = false;

    const loadReservations = async () => {
      setLoading(true);
      try {
        const data = await getEspaceReservationsForCalendar(espaceId, year, month);
        if (!cancelled) {
          setReservations(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReservations();

    return () => {
      cancelled = true;
    };
  }, [espaceId, selectedDate]);

  const getHourStatus = (hour) => {
    const hourStart = new Date(`${selectedDate}T${String(hour).padStart(2, "0")}:00:00`);
    const hourEnd = new Date(`${selectedDate}T${String(hour + 1).padStart(2, "0")}:00:00`);

    const isReserved = reservations.some((r) => {
      const start = new Date(r.startDateTime);
      const end = new Date(r.endDateTime);
      return start < hourEnd && end > hourStart;
    });

    return isReserved ? "reserved" : "available";
  };

  const isPastHour = (hour) => {
    if (!selectedDate) return false;
    const now = new Date();
    const slotEnd = new Date(`${selectedDate}T${String(hour + 1).padStart(2, "0")}:00:00`);
    const isSameDay = slotEnd.toDateString() === now.toDateString();
    return isSameDay && slotEnd <= now;
  };

  const canBeUsedAsEndTime = (hour) => {
    // Vérifie si ce créneau peut être utilisé comme heure de fin
    // Condition: aucune réservation ne chevauche la période entre selectedStartTime et cette heure
    if (!selectedStartTime) return false;

    const hourTime = new Date(`${selectedDate}T${String(hour).padStart(2, "0")}:00:00`);
    const selectedStart = new Date(`${selectedDate}T${selectedStartTime}:00`);

    // Vérifie qu'aucune réservation ne bloque la période [selectedStart, hourTime]
    return !reservations.some((r) => {
      const start = new Date(r.startDateTime);
      const end = new Date(r.endDateTime);
      // Bloque si la réservation chevauche notre période souhaitée
      // (start < hourTime) signifie que la réservation commence avant notre fin
      // (end > selectedStart) signifie que la réservation finit après notre début
      return start.getTime() < hourTime.getTime() && end.getTime() > selectedStart.getTime();
    });
  };

  const canBeUsedAsStartTime = (hour) => {
    // Vérifie si ce créneau "réservé" peut être utilisé comme heure de début
    // C'est le cas si une réservation se termine exactement à cette heure
    // et qu'aucune réservation ne chevauche le créneau hour à hour+1
    const hourTime = new Date(`${selectedDate}T${String(hour).padStart(2, "0")}:00:00`);
    const hourEnd = new Date(`${selectedDate}T${String(hour + 1).padStart(2, "0")}:00:00`);

    // Vérifie qu'une réservation se termine exactement à cette heure
    const hasReservationEndingHere = reservations.some((r) => {
      const end = new Date(r.endDateTime);
      return end.getTime() === hourTime.getTime();
    });

    if (!hasReservationEndingHere) return false;

    // Vérifie qu'aucune réservation ne chevauche le créneau [hour, hour+1]
    return !reservations.some((r) => {
      const start = new Date(r.startDateTime);
      const end = new Date(r.endDateTime);
      return start.getTime() < hourEnd.getTime() && end.getTime() > hourTime.getTime();
    });
  };

  const handleHourClick = (hour) => {
    const status = getHourStatus(hour);
    const past = isPastHour(hour);
    const isClosingHour = hour === CLOSING_HOUR;

    if (past) return;

    // 22h ne peut jamais être une heure de début
    if (isClosingHour && !selectedStartTime) return;

    // 22h peut être sélectionné comme heure de fin si une heure de début est choisie
    if (isClosingHour && selectedStartTime) {
      const startHour = parseInt(selectedStartTime.split(":")[0]);
      if (hour > startHour && canBeUsedAsEndTime(hour)) {
        const timeStr = `${String(hour).padStart(2, "0")}:00`;
        onSelectTimeSlot(timeStr);
      }
      return;
    }

    // Si on a déjà sélectionné une heure de début et qu'on clique sur un créneau "réservé"
    // Vérifier si on peut l'utiliser comme heure de fin
    if (selectedStartTime && status === "reserved") {
      const startHour = parseInt(selectedStartTime.split(":")[0]);
      if (hour > startHour && canBeUsedAsEndTime(hour)) {
        const timeStr = `${String(hour).padStart(2, "0")}:00`;
        onSelectTimeSlot(timeStr);
        return;
      }
      // Créneau réservé et ne peut pas être utilisé comme fin
      return;
    }

    // Si on n'a pas encore sélectionné d'heure de début et qu'on clique sur un créneau "réservé"
    // Vérifier si on peut l'utiliser comme heure de début (une réservation se termine exactement ici)
    if (!selectedStartTime && status === "reserved") {
      if (canBeUsedAsStartTime(hour)) {
        const timeStr = `${String(hour).padStart(2, "0")}:00`;
        onSelectTimeSlot(timeStr);
        return;
      }
      return;
    }

    if (status === "reserved") return;

    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    onSelectTimeSlot(timeStr);
  };

  const isStartSelected = (hour) => {
    if (!selectedStartTime) return false;
    const startHour = parseInt(selectedStartTime.split(":")[0]);
    return hour === startHour;
  };

  const isEndSelected = (hour) => {
    if (!selectedEndTime) return false;
    const endHour = parseInt(selectedEndTime.split(":")[0]);
    return hour === endHour;
  };

  const isInSelectedRange = (hour) => {
    if (!selectedStartTime || !selectedEndTime) return false;

    const startHour = parseInt(selectedStartTime.split(":")[0]);
    const endHour = parseInt(selectedEndTime.split(":")[0]);

    return hour > startHour && hour < endHour;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(getDateLocale(), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!selectedDate) {
    return (
      <div className={styles.container}>
        <p className={styles.placeholder}>{t("calendar.selectDayFirst")}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{formatDate(selectedDate)}</h3>
      <p className={styles.openingHours}>{t("calendar.openingHours")}</p>

      {loading && <p className={styles.loading}>{t("common.loading")}</p>}

      <div className={styles.slotsContainer}>
        {Array.from({ length: CLOSING_HOUR - OPENING_HOUR + 1 }, (_, i) => OPENING_HOUR + i).map((hour) => {
          const isClosingHour = hour === CLOSING_HOUR;
          const status = getHourStatus(hour);
          const isSelected = isStartSelected(hour) || isEndSelected(hour);
          const past = isPastHour(hour);

          // Pour 22h: vérifier si une réservation se termine à 22h (donc couvre 21h-22h)
          const isClosingHourReserved = isClosingHour && reservations.some((r) => {
            const end = new Date(r.endDateTime);
            const closingTime = new Date(`${selectedDate}T${CLOSING_HOUR}:00:00`);
            return end.getTime() === closingTime.getTime();
          });

          // Vérifie si ce créneau peut être utilisé comme heure de début (même s'il apparaît "réservé")
          const canStartHere = !isClosingHour && canBeUsedAsStartTime(hour);

          // Le créneau est vraiment bloqué seulement s'il est réservé ET qu'on ne peut pas commencer ici
          const isActuallyReserved = (status === "reserved" && !canStartHere) || isClosingHourReserved;

          const slotClass = [
            styles.slot,
            isActuallyReserved ? styles.reserved : styles.available,
            isSelected ? styles.selected : "",
            isInSelectedRange(hour) ? styles.inRange : "",
            past ? styles.past : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={hour} className={slotClass} onClick={() => handleHourClick(hour)} aria-disabled={past}>
              <span className={styles.hourLabel}>{String(hour).padStart(2, "0")}:00</span>
              {past && <span className={styles.reservedLabel}>{t("status.unavailable")}</span>}
              {isActuallyReserved && <span className={styles.reservedLabel}>{t("calendar.reserved")}</span>}
              {isStartSelected(hour) && <span className={styles.selectionLabel}>{t("calendar.start")}</span>}
              {isEndSelected(hour) && <span className={styles.selectionLabel}>{t("calendar.end")}</span>}
            </div>
          );
        })}
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendAvailable}`}></span>
          <span>{t("calendar.available")}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendReserved}`}></span>
          <span>{t("calendar.reserved")}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendSelected}`}></span>
          <span>{t("calendar.selected")}</span>
        </div>
      </div>
    </div>
  );
}
