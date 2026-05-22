import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getEspaces, getParkingSlots, getPublicEvents } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getSpaceImage } from "../utils/mediaAssets";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import styles from "./HomePage.module.css";

function getLocale(language) {
  if (language?.startsWith("fr")) return "fr-BE";
  if (language?.startsWith("nl")) return "nl-BE";
  return "en-BE";
}

function getSpaceUse(space, t) {
  const capacity = Number(space?.capacity) || 0;
  if (capacity >= 250) return t("home.roomUseConference");
  if (capacity >= 80) return t("home.roomUseSeminar");
  if (capacity >= 40) return t("home.roomUseWorkshop");
  return t("home.roomUseMeeting");
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [parkingSlots, setParkingSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      setLoading(true);
      const [nextEvents, nextSpaces, nextParking] = await Promise.allSettled([
        getPublicEvents(),
        getEspaces(),
        getParkingSlots(),
      ]);

      if (!active) return;

      setEvents(nextEvents.status === "fulfilled" ? nextEvents.value : []);
      setSpaces(nextSpaces.status === "fulfilled" ? nextSpaces.value : []);
      setParkingSlots(nextParking.status === "fulfilled" ? nextParking.value : []);
      setLoading(false);
    }

    loadHome();
    return () => {
      active = false;
    };
  }, []);

  const locale = getLocale(i18n.language);
  const numberLocale = normalizeLocale(i18n.language);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const role = user?.role;
  const isOrganizer = role === "ORGANIZER" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const rolePrimary = useMemo(() => {
    if (isAdmin) return { to: "/admin", label: t("home.roleAdminCta") };
    if (isOrganizer) return { to: "/organizer/events", label: t("home.roleOrganizerCta") };
    if (user) return { to: "/my-reservations", label: t("home.roleClientCta") };
    return { to: "/register", label: t("home.finalPrimary") };
  }, [isAdmin, isOrganizer, t, user]);

  const upcomingEvents = [...events]
    .filter((event) => new Date(event.startDateTime) >= new Date())
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 3);

  const featuredSpaces = [...spaces]
    .sort((a, b) => (Number(b.capacity) || 0) - (Number(a.capacity) || 0))
    .slice(0, 3);

  const totalParkingAvailable = parkingSlots.reduce((sum, slot) => sum + (Number(slot.availableSpaces) || 0), 0);

  const actionCards = [
    {
      to: "/espace",
      icon: "01",
      title: t("home.useSpacesTitle"),
      text: t("home.useSpacesText"),
      cta: t("home.useSpacesCta"),
    },
    {
      to: "/events",
      icon: "02",
      title: t("home.useEventsTitle"),
      text: t("home.useEventsText"),
      cta: t("home.useEventsCta"),
    },
    {
      to: "/parking",
      icon: "03",
      title: t("home.useParkingTitle"),
      text: t("home.useParkingText"),
      cta: t("home.useParkingCta"),
    },
    {
      to: isOrganizer ? "/organizer/events/new" : "/register",
      icon: "04",
      title: t("home.useOrganizerTitle"),
      text: t("home.useOrganizerText"),
      cta: isOrganizer ? t("home.useOrganizerCtaActive") : t("home.useOrganizerCta"),
      muted: !isOrganizer && Boolean(user),
    },
  ];

  const steps = [
    { title: t("home.stepChooseTitle"), text: t("home.stepChooseText") },
    { title: t("home.stepSlotTitle"), text: t("home.stepSlotText") },
    { title: t("home.stepConfirmTitle"), text: t("home.stepConfirmText") },
    { title: t("home.stepEmailTitle"), text: t("home.stepEmailText") },
  ];

  const faqs = [
    ["faqBookRoomQ", "faqBookRoomA"],
    ["faqCreateEventQ", "faqCreateEventA"],
    ["faqParkingQ", "faqParkingA"],
    ["faqPaymentQ", "faqPaymentA"],
    ["faqCancelQ", "faqCancelA"],
    ["faqSupportQ", "faqSupportA"],
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1>{t("home.phase4HeroTitle")}</h1>
          <p>{t("home.phase4HeroText")}</p>
          <div className={styles.heroActions}>
            <Link to="/espace" className={styles.primaryCta}>{t("home.secondaryCta")}</Link>
            <Link to="/events" className={styles.secondaryCta}>{t("home.primaryCta")}</Link>
          </div>
        </div>

        <aside className={styles.heroPanel} aria-label={t("home.heroPanelTitle")}>
          <div className={styles.heroPanelImage} />
          <div className={styles.heroPanelCard}>
            <span>{t("home.heroPanelBadge")}</span>
            <strong>{t("home.heroPanelMetric")}</strong>
            <p>{t("home.heroPanelText")}</p>
          </div>
        </aside>
      </section>

      <section className={styles.quickStats} aria-label={t("home.platformStatusLabel")}>
        <div>
          <strong>{formatNumber(spaces.length, numberLocale)}</strong>
          <span>{t("home.statsRooms")}</span>
        </div>
        <div>
          <strong>{formatNumber(upcomingEvents.length || events.length, numberLocale)}</strong>
          <span>{t("home.statsEvents")}</span>
        </div>
        <div>
          <strong>{formatNumber(totalParkingAvailable, numberLocale)}</strong>
          <span>{t("home.statsParking")}</span>
        </div>
        <div>
          <strong>{t("home.statsEmailValue")}</strong>
          <span>{t("home.statsEmail")}</span>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{t("home.usesLabel")}</p>
          <h2>{t("home.usesTitle")}</h2>
          <p>{t("home.usesText")}</p>
        </div>
        <div className={styles.actionGrid}>
          {actionCards.map((action) => (
            <Link key={action.title} to={action.to} className={`${styles.actionCard} ${action.muted ? styles.actionMuted : ""}`}>
              <span>{action.icon}</span>
              <strong>{action.title}</strong>
              <p>{action.text}</p>
              <small>{action.cta}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{t("home.workflowLabel")}</p>
          <h2>{t("home.phase4WorkflowTitle")}</h2>
          <p>{t("home.phase4WorkflowText")}</p>
        </div>
        <div className={styles.stepGrid}>
          {steps.map((step, index) => (
            <article key={step.title} className={styles.stepCard}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.splitSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{t("home.roomsPreviewLabel")}</p>
          <h2>{t("home.roomsPreviewTitle")}</h2>
          <p>{t("home.roomsPreviewText")}</p>
          <Link to="/espace" className={styles.textCta}>{t("home.roomsPreviewCta")}</Link>
        </div>

        <div className={styles.roomGrid}>
          {loading ? (
            <div className={styles.simpleState}>{t("common.loading")}</div>
          ) : featuredSpaces.length === 0 ? (
            <div className={styles.simpleState}>{t("spaces.noSpaces")}</div>
          ) : featuredSpaces.map((space) => (
            <article key={space.id} className={styles.roomCard}>
              <div className={styles.roomImage} style={{ backgroundImage: `url(${getSpaceImage(space)})` }} />
              <div className={styles.roomBody}>
                <strong>{space.name}</strong>
                <p>{getSpaceUse(space, t)}</p>
                <div className={styles.roomMeta}>
                  <span>{formatNumber(space.capacity, numberLocale)} {t("common.persons")}</span>
                  <span>{formatMoney(space.basePrice, numberLocale)} {t("common.perHour")}</span>
                </div>
                <Link to={user ? `/reservations/new/${space.id}` : "/login"}>{user ? t("spaces.reserve") : t("spaces.loginToReserve")}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.splitSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{t("home.previewLabel")}</p>
          <h2>{t("home.previewTitle")}</h2>
          <p>{t("home.eventsPreviewText")}</p>
          <Link to="/events" className={styles.textCta}>{t("home.eventsPreviewCta")}</Link>
        </div>

        <div className={styles.eventList}>
          {loading ? (
            <div className={styles.simpleState}>{t("common.loading")}</div>
          ) : upcomingEvents.length === 0 ? (
            <div className={styles.simpleState}>{t("home.noUpcomingEventsTitle")}</div>
          ) : upcomingEvents.map((event) => (
            <article key={event.id} className={styles.eventCard}>
              <span>{dateFormatter.format(new Date(event.startDateTime))}</span>
              <strong>{event.title}</strong>
              <p>{event.location || t("common.toBeAnnounced")}</p>
              <Link to={user ? `/events/register/${event.id}` : "/login"}>
                {user ? t("events.register") : t("events.loginToRegister")}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.organizerSection}>
        <div>
          <p className={styles.eyebrow}>{t("home.organizerLabel")}</p>
          <h2>{t("home.organizerBlockTitle")}</h2>
          <p>{t("home.organizerBlockText")}</p>
          <ul>
            <li>{t("home.organizerBenefitRoom")}</li>
            <li>{t("home.organizerBenefitRegistrations")}</li>
            <li>{t("home.organizerBenefitFinance")}</li>
          </ul>
        </div>
        <Link to={isOrganizer ? "/organizer/events/new" : "/register"} className={styles.organizerCta}>
          {isOrganizer ? t("home.useOrganizerCtaActive") : t("home.useOrganizerCta")}
        </Link>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{t("home.faqLabel")}</p>
          <h2>{t("home.faqTitle")}</h2>
          <p>{t("home.faqText")}</p>
        </div>
        <div className={styles.faqGrid}>
          {faqs.map(([question, answer]) => (
            <article key={question} className={styles.faqItem}>
              <h3>{t(`home.${question}`)}</h3>
              <p>{t(`home.${answer}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <p className={styles.eyebrow}>{t("home.finalLabel")}</p>
          <h2>{t("home.finalTitle")}</h2>
          <p>{t("home.finalText")}</p>
        </div>
        <div className={styles.finalActions}>
          <Link to={rolePrimary.to} className={styles.primaryCta}>{rolePrimary.label}</Link>
          <Link to="/contact" className={styles.secondaryCta}>{t("nav.contact")}</Link>
        </div>
      </section>
    </div>
  );
}
