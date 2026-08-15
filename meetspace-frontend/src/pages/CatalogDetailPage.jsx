import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { getEspaces, getParkingSlot, getPublicEvents } from "../services/api";
import PageState from "../components/PageState";
import { getEventImage, getSpaceImage, PARKING_IMAGE } from "../utils/mediaAssets";
import { downloadCalendarEvent } from "../utils/calendar";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import styles from "./CatalogDetailPage.module.css";

const CONFIG = {
  space: { back: "/espace", collectionKey: "nav.spaces" },
  event: { back: "/events", collectionKey: "nav.events" },
  parking: { back: "/parking", collectionKey: "nav.parking" },
};

const dateTime = (date, time = "00:00") => `${date}T${time.length === 5 ? `${time}:00` : time}`;

export default function CatalogDetailPage({ type }) {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { notify } = useFeedback();
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const config = CONFIG[type];

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const numericId = Number(id);
      let result;
      if (type === "space") {
        result = (await getEspaces()).find((entry) => entry.id === numericId);
      } else if (type === "event") {
        result = (await getPublicEvents()).find((entry) => entry.id === numericId);
      } else {
        result = await getParkingSlot(numericId);
      }
      if (!result) throw new Error(t("detail.notFound", { defaultValue: "Cette offre n’est plus disponible." }));
      setItem(result);
    } catch (loadError) {
      setError(loadError.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, t, type]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const model = useMemo(() => {
    if (!item) return null;

    if (type === "space") {
      return {
        title: item.name,
        eyebrow: item.type === "PREMIUM_ROOM" ? t("spaceType.PREMIUM_ROOM") : t("spaceType.SALLE"),
        description: t("detail.spaceDescription", {
          defaultValue: "Un espace professionnel prêt à accueillir votre réunion, votre atelier ou votre événement à Bruxelles.",
        }),
        image: getSpaceImage(item),
        price: `${formatMoney(item.basePrice, locale)} ${t("common.perHour")}`,
        status: t("status.available"),
        available: true,
        cta: `/reservations/new/${item.id}`,
        ctaLabel: user ? t("spaces.reserve") : t("spaces.loginToReserve"),
        facts: [
          [t("common.capacity"), `${formatNumber(item.capacity, locale)} ${t("common.persons")}`],
          [t("common.price"), `${formatMoney(item.basePrice, locale)} ${t("common.perHour")}`],
          [t("detail.bookingMode", { defaultValue: "Réservation" }), item.type === "PREMIUM_ROOM"
            ? t("detail.onRequest", { defaultValue: "Validation sous 24 h" })
            : t("detail.instant", { defaultValue: "Confirmation immédiate" })],
        ],
      };
    }

    if (type === "event") {
      const available = item.availablePlaces == null ? Number(item.capacity) : Math.max(0, Number(item.availablePlaces));
      const start = new Date(item.startDateTime);
      const end = new Date(item.endDateTime);
      return {
        title: item.title,
        eyebrow: t("detail.publicEvent", { defaultValue: "Événement public" }),
        description: item.description,
        image: getEventImage(item),
        price: Number(item.price) > 0 ? formatMoney(item.price, locale) : t("events.free"),
        status: available > 0
          ? t("detail.placesAvailable", { count: available, defaultValue: `${available} places disponibles` })
          : t("events.full"),
        available: available > 0,
        cta: `/events/register/${item.id}`,
        ctaLabel: user ? t("events.register") : t("events.loginToRegister"),
        start,
        end,
        location: item.location || t("common.toBeAnnounced"),
        facts: [
          [t("common.date"), start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
          [t("common.time"), `${start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`],
          [t("common.location"), item.location || t("common.toBeAnnounced")],
          [t("events.remainingPlaces"), `${formatNumber(available, locale)} / ${formatNumber(item.capacity, locale)}`],
          [t("detail.parking", { defaultValue: "Parking" }), item.parkingSlotId
            ? t("detail.availableOption", { defaultValue: "Disponible en option" })
            : t("detail.notIncluded", { defaultValue: "Non inclus" })],
        ],
      };
    }

    const available = Math.max(0, Number(item.availableSpaces) || 0);
    const start = new Date(dateTime(item.slotDate, item.startTime));
    const end = new Date(dateTime(item.slotDate, item.endTime));
    return {
      title: item.title || t("nav.parking"),
      eyebrow: t("detail.parkingSession", { defaultValue: "Session parking" }),
      description: t("detail.parkingDescription", {
        defaultValue: "Réservez votre arrivée au parking MeetSpace à l’avance et rejoignez votre rendez-vous sans détour.",
      }),
      image: PARKING_IMAGE,
      price: formatMoney(item.parkingRate, locale),
      status: available > 0
        ? t("detail.placesAvailable", { count: available, defaultValue: `${available} places disponibles` })
        : t("parking.full"),
      available: available > 0,
      cta: `/parking/reserve/${item.id}`,
      ctaLabel: user ? t("parking.reserve") : t("parking.loginToReserve"),
      start,
      end,
      location: "MeetSpace Brussels",
      facts: [
        [t("common.date"), start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
        [t("common.time"), `${item.startTime} – ${item.endTime}`],
        [t("parking.remainingLabel"), `${formatNumber(available, locale)} / ${formatNumber(item.parkingCapacity, locale)}`],
        [t("common.price"), formatMoney(item.parkingRate, locale)],
      ],
    };
  }, [item, locale, t, type, user]);

  useEffect(() => {
    if (!model) return undefined;
    const previousTitle = document.title;
    document.title = `${model.title} · MeetSpace`;
    return () => {
      document.title = previousTitle;
    };
  }, [model]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: model.title, text: model.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        notify({
          type: "success",
          title: t("detail.linkCopied", { defaultValue: "Lien copié" }),
          message: t("detail.linkCopiedHint", { defaultValue: "Vous pouvez maintenant partager cette fiche." }),
        });
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        notify({
          type: "error",
          title: t("common.error"),
          message: t("detail.shareError", { defaultValue: "Le lien n’a pas pu être partagé." }),
        });
      }
    }
  };

  const handleCalendar = () => {
    downloadCalendarEvent({
      title: model.title,
      description: model.description,
      location: model.location,
      start: model.start,
      end: model.end,
      filename: `meetspace-${model.title}`,
    });
  };

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("detail.loading", { defaultValue: "Préparation de la fiche…" })} />;
  }

  if (error || !model) {
    return (
      <PageState
        type="error"
        title={t("detail.notFoundTitle", { defaultValue: "Offre introuvable" })}
        message={error}
        action={<Link to={config.back}>{t("detail.backToCatalog", { defaultValue: "Retour au catalogue" })}</Link>}
      />
    );
  }

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t("detail.breadcrumb", { defaultValue: "Fil d’Ariane" })}>
        <Link to={config.back}>← {t(config.collectionKey)}</Link>
        <span aria-hidden="true">/</span>
        <span>{model.title}</span>
      </nav>

      <section className={styles.hero}>
        <div className={styles.media}>
          <img src={model.image} alt="" />
          <span className={`${styles.availability} ${!model.available ? styles.unavailable : ""}`}>{model.status}</span>
        </div>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>{model.eyebrow}</p>
          <h1>{model.title}</h1>
          <p className={styles.description}>{model.description}</p>
          <div className={styles.priceLine}>
            <span>{t("detail.priceLabel", { defaultValue: "Tarif" })}</span>
            <strong>{model.price}</strong>
          </div>
        </div>

        <aside className={styles.actionRail}>
          <p className={styles.actionLabel}>{t("detail.nextStep", { defaultValue: "Prochaine étape" })}</p>
          <h2>{model.available
            ? t("detail.bookTitle", { defaultValue: "Planifiez votre venue" })
            : t("detail.fullTitle", { defaultValue: "Cette session est complète" })}</h2>
          <p>{model.available
            ? t("detail.bookHint", { defaultValue: "Les disponibilités et le montant final seront confirmés avant le paiement." })
            : t("detail.fullHint", { defaultValue: "Revenez au catalogue pour choisir une autre disponibilité." })}</p>
          {model.available ? (
            <Link to={model.cta} state={{ from: location.pathname }} className={styles.primaryAction}>{model.ctaLabel}</Link>
          ) : (
            <Link to={config.back} className={styles.primaryAction}>{t("detail.seeAlternatives", { defaultValue: "Voir les alternatives" })}</Link>
          )}
          <button type="button" className={styles.secondaryAction} onClick={handleShare}>
            {t("detail.share", { defaultValue: "Partager cette fiche" })}
          </button>
          {model.start && model.end && (
            <button type="button" className={styles.textAction} onClick={handleCalendar}>
              {t("detail.addToCalendar", { defaultValue: "Ajouter au calendrier" })}
            </button>
          )}
        </aside>
      </section>

      <section className={styles.details} aria-labelledby="detail-facts-title">
        <div className={styles.detailIntro}>
          <p className={styles.eyebrow}>{t("detail.essential", { defaultValue: "L’essentiel" })}</p>
          <h2 id="detail-facts-title">{t("detail.beforeBooking", { defaultValue: "Avant de réserver" })}</h2>
          <p>{t("detail.transparentHint", { defaultValue: "Les informations utiles sont regroupées ici, sans frais cachés ni étape surprise." })}</p>
        </div>
        <dl className={styles.factList}>
          {model.facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.process} aria-label={t("detail.processTitle", { defaultValue: "Parcours de réservation" })}>
        {[
          [t("detail.stepOne", { defaultValue: "Choisir" }), t("detail.stepOneHint", { defaultValue: "Vérifiez la date, la capacité et le tarif." })],
          [t("detail.stepTwo", { defaultValue: "Confirmer" }), t("detail.stepTwoHint", { defaultValue: "Renseignez uniquement les informations nécessaires." })],
          [t("detail.stepThree", { defaultValue: "Venir" }), t("detail.stepThreeHint", { defaultValue: "Retrouvez tout dans votre espace personnel." })],
        ].map(([title, hint], index) => (
          <div key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{title}</strong>
            <p>{hint}</p>
          </div>
        ))}
      </section>
    </main>
  );
}