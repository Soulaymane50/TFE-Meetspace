import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import RoomSchedulePicker from "../components/RoomSchedulePicker";
import PageState from "../components/PageState";
import WorkspaceNav from "../components/WorkspaceNav";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { getMyReservation, rescheduleReservation } from "../services/api";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import styles from "./RescheduleReservationPage.module.css";

function durationHours(start, end) {
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
  return Math.max(1, Math.round(minutes / 60));
}

export default function RescheduleReservationPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const { notify } = useFeedback();
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);
  const [reservation, setReservation] = useState(null);
  const [schedule, setSchedule] = useState({ startDateTime: "", endDateTime: "", available: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMyReservation(id, token)
      .then((data) => {
        if (cancelled) return;
        setReservation(data);
        setSchedule({
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          available: true,
        });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, token]);

  const handleScheduleChange = useCallback((next) => setSchedule(next), []);
  const duration = useMemo(
    () => reservation ? durationHours(reservation.startDateTime, reservation.endDateTime) : 1,
    [reservation],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!schedule.available || !schedule.startDateTime || !schedule.endDateTime) return;
    setSaving(true);
    try {
      await rescheduleReservation(id, {
        startDateTime: schedule.startDateTime,
        endDateTime: schedule.endDateTime,
      }, token);
      notify({
        type: "success",
        title: t("reservation.rescheduleSuccessTitle", { defaultValue: "Créneau modifié" }),
        message: t("reservation.rescheduleSuccessMessage", { defaultValue: "La réservation et son calendrier ont été mis à jour." }),
      });
      navigate("/my-reservations?tab=spaces");
    } catch (err) {
      notify({ type: "error", title: t("common.error"), message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("reservation.reschedule", { defaultValue: "Modifier le créneau" })} />;
  if (error || !reservation) return <PageState type="error" title={t("common.error")} message={error || t("reservation.notFound", { defaultValue: "Réservation introuvable" })} action={<Link to="/my-reservations">{t("common.back", { defaultValue: "Retour" })}</Link>} />;

  return (
    <div className={styles.container}>
      <WorkspaceNav scope="account" />
      <header className={styles.header}>
        <div>
          <p>{t("reservation.adjustmentEyebrow", { defaultValue: "Ajustement de réservation" })}</p>
          <h1>{t("reservation.reschedule", { defaultValue: "Modifier le créneau" })}</h1>
          <span>{t("reservation.rescheduleHint", { defaultValue: "Le lieu, la durée et le montant restent inchangés. La modification ferme 24 heures avant le début." })}</span>
        </div>
        <dl>
          <div><dt>{t("nav.spaces")}</dt><dd>{reservation.espace?.name}</dd></div>
          <div><dt>{t("calendar.duration")}</dt><dd>{duration} h</dd></div>
          <div><dt>{t("common.amount", { defaultValue: "Montant" })}</dt><dd>{formatMoney(reservation.totalPrice, locale)}</dd></div>
        </dl>
      </header>

      <form onSubmit={submit} className={styles.form}>
        <RoomSchedulePicker
          spaceId={reservation.espace?.id}
          spaceName={reservation.espace?.name}
          startDateTime={schedule.startDateTime}
          endDateTime={schedule.endDateTime}
          onChange={handleScheduleChange}
          ignoreBlockId={reservation.id}
          lockedDuration={duration}
        />
        <footer className={styles.actions}>
          <Link to="/my-reservations?tab=spaces">{t("common.cancel")}</Link>
          <button type="submit" disabled={saving || !schedule.available}>
            {saving
              ? t("common.saving", { defaultValue: "Enregistrement…" })
              : t("reservation.confirmReschedule", { defaultValue: "Confirmer le nouveau créneau" })}
          </button>
        </footer>
      </form>
    </div>
  );
}
