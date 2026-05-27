import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getEspaces, organizerCreateEvent, organizerGetMyEvent, organizerUpdateMyEvent } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import RoomSchedulePicker from "../components/RoomSchedulePicker";
import SelectDropdown from "../components/SelectDropdown";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import {
  MEETSPACE_COMMISSION_RATE,
  MEETSPACE_TOTAL_PARKING_SPACES,
  getParkingQuotaLimit,
  getRecommendedParkingQuota,
  getRecommendedParkingRate,
  getRecommendedTicketPrice,
} from "../utils/businessRules";
import styles from "./OrganizerEventForm.module.css";

export default function OrganizerEventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const parkingGridClassName = styles.parkingGrid;

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startDateTime: "",
    endDateTime: "",
    spaceId: "",
    location: "",
    capacity: "",
    price: "",
    parkingRequired: false,
    parkingPrice: "",
    parkingCapacity: "",
  });
  const [originalEvent, setOriginalEvent] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(isEdit);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const availableSpaces = spaces
    .filter((space) => space.status !== "UNAVAILABLE")
    .sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
  const roomOptions = [
    {
      value: "",
      label: loadingSpaces ? t("common.loading") : t("organizer.selectLocation"),
    },
    ...availableSpaces.map((space) => ({
      value: String(space.id),
      label: `${space.name} - ${space.capacity} ${t("common.persons")} - ${formatMoney(space.basePrice, locale)} ${t("common.perHour")}`,
    })),
  ];

  const selectedSpace = availableSpaces.find(
    (space) => String(space.id) === String(eventForm.spaceId) || space.name === eventForm.location,
  );
  const selectedCapacity = Number(selectedSpace?.capacity) || 0;
  const previewStart = eventForm.startDateTime ? new Date(eventForm.startDateTime) : null;
  const previewEnd = eventForm.endDateTime ? new Date(eventForm.endDateTime) : null;
  const previewDate =
    previewStart && !Number.isNaN(previewStart.getTime())
      ? previewStart.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long" })
      : t("organizer.previewDateFallback", { defaultValue: "Date à définir" });
  const previewTime =
    previewStart && previewEnd && !Number.isNaN(previewStart.getTime()) && !Number.isNaN(previewEnd.getTime())
      ? `${previewStart.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} - ${previewEnd.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
      : t("organizer.previewTimeFallback", { defaultValue: "Horaire à définir" });
  const eventCapacityEstimate = Number(eventForm.capacity) || 0;
  const ticketPriceEstimate = Number(eventForm.price) || 0;
  const roomHourlyRate = Number(selectedSpace?.basePrice) || 0;
  const scheduleDurationMs =
    previewStart &&
    previewEnd &&
    !Number.isNaN(previewStart.getTime()) &&
    !Number.isNaN(previewEnd.getTime())
      ? previewEnd.getTime() - previewStart.getTime()
      : 0;
  const scheduleDurationHours =
    scheduleDurationMs > 0 ? Math.round((scheduleDurationMs / (1000 * 60 * 60)) * 100) / 100 : 0;
  const recommendedCapacity = selectedCapacity
    ? Math.min(selectedCapacity, Math.max(12, Math.round(selectedCapacity * 0.75)))
    : 0;
  const recommendedPrice = getRecommendedTicketPrice(selectedCapacity);
  const parkingQuotaLimit = getParkingQuotaLimit(eventCapacityEstimate || recommendedCapacity, selectedCapacity);
  const recommendedParkingCapacity = getRecommendedParkingQuota(recommendedCapacity, selectedCapacity);
  const recommendedParkingPrice = getRecommendedParkingRate(scheduleDurationHours, selectedCapacity);
  const grossRevenueEstimate = eventCapacityEstimate * ticketPriceEstimate;
  const roomCostEstimate = roomHourlyRate * scheduleDurationHours;
  const commissionEstimate = grossRevenueEstimate * MEETSPACE_COMMISSION_RATE;
  const organizerNetEstimate = grossRevenueEstimate - commissionEstimate - roomCostEstimate;
  const showFinancePreview = selectedSpace && eventCapacityEstimate > 0;

  useEffect(() => {
    if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) {
      navigate("/login");
      return;
    }

    setLoadingSpaces(true);
    getEspaces()
      .then((data) => setSpaces(Array.isArray(data) ? data : []))
      .catch(() => setSpaces([]))
      .finally(() => setLoadingSpaces(false));

    if (isEdit) {
      setLoadingEvent(true);
      organizerGetMyEvent(id, token)
        .then((event) => {
          setOriginalEvent(event);
          setEventForm({
            title: event.title,
            description: event.description || "",
            startDateTime: event.startDateTime.slice(0, 16),
            endDateTime: event.endDateTime.slice(0, 16),
            spaceId: event.spaceId ?? "",
            location: event.location || "",
            capacity: event.capacity,
            price: event.price || "",
            parkingRequired: event.parkingRequired || false,
            parkingPrice: event.parkingPrice ?? "",
            parkingCapacity: event.parkingCapacity ?? "",
          });
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingEvent(false));
    }
  }, [id, isEdit, user, token, navigate]);

  useEffect(() => {
    if (eventForm.spaceId || !eventForm.location || spaces.length === 0) return;

    const room = spaces.find((space) => space.status !== "UNAVAILABLE" && space.name === eventForm.location);
    if (room) {
      setEventForm((prev) => ({ ...prev, spaceId: String(room.id) }));
    }
  }, [spaces, eventForm.location, eventForm.spaceId]);

  const clampNumber = (value, min, max) => {
    if (value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.min(Math.max(number, min), max));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };

      if (name === "capacity") {
        const maxCapacity = selectedSpace?.capacity ? Number(selectedSpace.capacity) : Number.MAX_SAFE_INTEGER;
        next.capacity = clampNumber(value, 1, maxCapacity);
        const maxParking = getParkingQuotaLimit(next.capacity, selectedCapacity);
        if (next.parkingCapacity && Number(next.parkingCapacity) > maxParking) {
          next.parkingCapacity = String(maxParking);
        }
      }

      if (name === "parkingCapacity") {
        const maxParking = getParkingQuotaLimit(prev.capacity, selectedCapacity);
        next.parkingCapacity = clampNumber(value, 1, maxParking);
      }

      if (name === "parkingRequired") {
        if (checked) {
          const maxParking = getParkingQuotaLimit(prev.capacity || recommendedCapacity, selectedCapacity);
          const defaultQuota = recommendedParkingCapacity > 0
            ? Math.min(recommendedParkingCapacity, maxParking)
            : "";
          next.parkingPrice = prev.parkingPrice || String(recommendedParkingPrice);
          next.parkingCapacity = prev.parkingCapacity
            ? clampNumber(prev.parkingCapacity, 1, maxParking)
            : (defaultQuota ? String(defaultQuota) : "");
        } else {
          next.parkingPrice = "";
          next.parkingCapacity = "";
        }
      }

      return next;
    });
    setError("");
  };

  const handleLocationChange = (e) => {
    const value = e.target.value;
    const room = availableSpaces.find((space) => String(space.id) === String(value));

    setEventForm((prev) => {
      const nextCapacity =
        room && (!prev.capacity || Number(prev.capacity) > Number(room.capacity))
          ? String(room.capacity)
          : prev.capacity;
      const nextQuotaLimit = getParkingQuotaLimit(nextCapacity, room?.capacity);
      return {
        ...prev,
        spaceId: value,
        location: room?.name || "",
        capacity: nextCapacity,
        parkingPrice: prev.parkingRequired ? String(getRecommendedParkingRate(0, room?.capacity)) : prev.parkingPrice,
        parkingCapacity:
          prev.parkingCapacity && Number(prev.parkingCapacity) > nextQuotaLimit
            ? String(nextQuotaLimit)
            : prev.parkingCapacity,
        startDateTime: "",
        endDateTime: "",
      };
    });
    setError("");
  };

  const handleScheduleChange = ({ startDateTime, endDateTime }) => {
    const start = startDateTime ? new Date(startDateTime) : null;
    const end = endDateTime ? new Date(endDateTime) : null;
    const durationHours =
      start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start
        ? Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100
        : 0;
    setEventForm((prev) => ({
      ...prev,
      startDateTime,
      endDateTime,
      parkingPrice: prev.parkingRequired
        ? String(getRecommendedParkingRate(durationHours, selectedCapacity))
        : prev.parkingPrice,
    }));
    setError("");
  };

  const applyRoomCapacity = () => {
    if (!selectedSpace) return;
    setEventForm((prev) => ({
      ...prev,
      capacity: String(selectedSpace.capacity),
      parkingCapacity:
        prev.parkingCapacity && Number(prev.parkingCapacity) > getParkingQuotaLimit(selectedSpace.capacity, selectedCapacity)
          ? String(getParkingQuotaLimit(selectedSpace.capacity, selectedCapacity))
          : prev.parkingCapacity,
    }));
    setError("");
  };

  const applySmartRecommendation = () => {
    if (!selectedSpace) return;
    setEventForm((prev) => ({
      ...prev,
      capacity: String(recommendedCapacity),
      price: String(recommendedPrice),
      parkingRequired: true,
      parkingPrice: String(recommendedParkingPrice),
      parkingCapacity: String(Math.min(recommendedParkingCapacity, recommendedCapacity)),
    }));
    setError("");
  };

  const validateForm = () => {
    if (!eventForm.title.trim()) {
      setError(t("validation.titleRequired"));
      return false;
    }
    if (!eventForm.startDateTime) {
      setError(t("validation.startDateRequired"));
      return false;
    }
    if (!eventForm.endDateTime) {
      setError(t("validation.endDateRequired"));
      return false;
    }
    if (new Date(eventForm.startDateTime) < new Date()) {
      setError(t("validation.startDatePast"));
      return false;
    }
    if (new Date(eventForm.endDateTime) <= new Date(eventForm.startDateTime)) {
      setError(t("validation.endBeforeStart"));
      return false;
    }
    if (!selectedSpace) {
      setError(t("organizer.locationRequired"));
      return false;
    }
    if (!eventForm.capacity || parseInt(eventForm.capacity) < 1) {
      setError(t("validation.capacityRequired"));
      return false;
    }
    if (selectedSpace && parseInt(eventForm.capacity) > Number(selectedSpace.capacity)) {
      setError(t("organizer.capacityExceedsRoom", { capacity: selectedSpace.capacity }));
      return false;
    }
    if (eventForm.parkingRequired) {
      const parkingCapacity = parseInt(eventForm.parkingCapacity, 10);
      if (!parkingCapacity || parkingCapacity < 1) {
        setError(t("organizer.parkingCapacityRequired"));
        return false;
      }
      if (parkingCapacity > parseInt(eventForm.capacity, 10)) {
        setError(t("organizer.parkingCapacityExceedsEvent", { capacity: eventForm.capacity }));
        return false;
      }
      if (parkingCapacity > parkingQuotaLimit) {
        setError(t("organizer.parkingCapacityExceedsQuota", { quota: parkingQuotaLimit }));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      ...eventForm,
      locationType: "EXISTING_SPACE",
      spaceId: Number(selectedSpace.id),
      externalAddress: null,
      location: selectedSpace.name,
      capacity: parseInt(eventForm.capacity),
      price: eventForm.price ? parseFloat(eventForm.price) : 0,
      parkingPrice: eventForm.parkingRequired
        ? (eventForm.parkingPrice !== "" ? parseFloat(eventForm.parkingPrice) : recommendedParkingPrice)
        : null,
      parkingCapacity: eventForm.parkingCapacity !== "" ? parseInt(eventForm.parkingCapacity) : null,
    };

    try {
      if (isEdit) {
        await organizerUpdateMyEvent(id, payload, token);
        setSuccess(t("organizer.eventUpdated"));
      } else {
        await organizerCreateEvent(payload, token);
        setSuccess(t("organizer.eventCreated"));
      }
      setTimeout(() => navigate("/organizer/events"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) return null;
  if (loadingEvent) {
    return <PageState type="loading" title={t("common.loading")} message={t("organizer.manageYourEvents")} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.breadcrumb}>
        <Link to="/organizer/events" className={styles.breadcrumbLink}>
          ← {t("organizer.backToMyEvents")}
        </Link>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>{isEdit ? t("organizer.editEvent") : t("organizer.createEvent")}</h1>
          {!isEdit && <p className={styles.subtitle}>{t("organizer.createEventDesc")}</p>}
        </div>

        {!isEdit && (
          <div className={styles.infoBox}>
            <div className={styles.infoIcon}>i</div>
            <div>
              <strong>{t("organizer.note")}:</strong>
              <p className={styles.infoText}>{t("organizer.pendingApprovalNote")}</p>
            </div>
          </div>
        )}

        {isEdit && originalEvent?.status === "REJECTED" && originalEvent?.rejectionReason && (
          <div className={styles.rejectionBox}>
            <div className={styles.rejectionIcon}>!</div>
            <div>
              <strong>{t("organizer.eventRejected")}</strong>
              <p className={styles.rejectionText}>{originalEvent.rejectionReason}</p>
              <p className={styles.rejectionHint}>{t("organizer.modifyAndResubmit")}</p>
            </div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              {t("common.title")} <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="title"
              value={eventForm.title}
              onChange={handleChange}
              placeholder={t("organizer.titlePlaceholder")}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("common.description")}</label>
            <textarea
              name="description"
              value={eventForm.description}
              onChange={handleChange}
              placeholder={t("organizer.descriptionPlaceholder")}
              rows={4}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              {t("events.location")} <span className={styles.required}>*</span>
            </label>
            <SelectDropdown
              value={String(eventForm.spaceId || "")}
              onChange={(value) => handleLocationChange({ target: { value } })}
              options={roomOptions}
              label={t("events.location")}
              className={styles.selectDropdown}
              disabled={loadingSpaces}
            />
            <span className={styles.hint}>
              {selectedSpace
                ? t("organizer.roomCapacityHint", {
                    capacity: selectedSpace.capacity,
                    price: selectedSpace.basePrice,
                  })
                : t("organizer.locationHint")}
            </span>
          </div>

          {selectedSpace && (
            <div className={styles.advisorCard}>
              <div>
                <p className={styles.advisorKicker}>{t("organizer.advisorKicker")}</p>
                <h3>{t("organizer.advisorTitle")}</h3>
                <p>{t("organizer.advisorText")}</p>
              </div>
              <div className={styles.advisorMetrics}>
                <span>
                  <strong>{recommendedCapacity}</strong>
                  {t("organizer.advisorCapacity")}
                </span>
                <span>
                  <strong>{formatMoney(recommendedPrice, locale)}</strong>
                  {t("organizer.advisorPrice")}
                </span>
                <span>
                  <strong>{recommendedParkingCapacity}</strong>
                  {t("organizer.advisorParking")}
                </span>
              </div>
              <div className={styles.advisorActions}>
                <button type="button" onClick={applyRoomCapacity} className={styles.advisorGhost}>
                  {t("organizer.applyCapacity")}
                </button>
                <button type="button" onClick={applySmartRecommendation} className={styles.advisorPrimary}>
                  {t("organizer.applyRecommendation")}
                </button>
              </div>
            </div>
          )}

          <RoomSchedulePicker
            key={eventForm.spaceId || "organizer-room-schedule"}
            spaceId={eventForm.spaceId}
            spaceName={selectedSpace?.name}
            startDateTime={eventForm.startDateTime}
            endDateTime={eventForm.endDateTime}
            onChange={handleScheduleChange}
            ignoreBlockId={isEdit ? id : undefined}
          />

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t("common.capacity")} <span className={styles.required}>*</span>
              </label>
              <input
                type="number"
                name="capacity"
                value={eventForm.capacity}
                onChange={handleChange}
                min="1"
                max={selectedSpace?.capacity || undefined}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t("common.price")} (€)</label>
              <input
                type="number"
                name="price"
                value={eventForm.price}
                onChange={handleChange}
                min="0"
                step="0.01"
                className={styles.input}
              />
              <span className={styles.hint}>{t("organizer.priceHint")}</span>
            </div>
          </div>

          <div className={styles.divider} />

          {showFinancePreview && (
            <section className={styles.financePreview} aria-label={t("organizer.financePreviewTitle")}>
              <div className={styles.financePreviewHeader}>
                <div>
                  <p className={styles.advisorKicker}>{t("finance.indicativeEstimate")}</p>
                  <h3>{t("organizer.financePreviewTitle")}</h3>
                </div>
                <span>{t("finance.commissionRate", { rate: Math.round(MEETSPACE_COMMISSION_RATE * 100) })}</span>
              </div>
              <div className={styles.financePreviewGrid}>
                <span>
                  {t("finance.grossRevenue")}
                  <strong>{formatMoney(grossRevenueEstimate, locale)}</strong>
                </span>
                <span>
                  {t("finance.meetSpaceCommission")}
                  <strong>{formatMoney(commissionEstimate, locale)}</strong>
                </span>
                <span>
                  {t("finance.roomCost")}
                  <strong>{formatMoney(roomCostEstimate, locale)}</strong>
                </span>
                <span>
                  {t("finance.organizerNetEstimate")}
                  <strong>{formatMoney(organizerNetEstimate, locale)}</strong>
                </span>
              </div>
              <p className={styles.financePreviewNote}>
                {t(
                  scheduleDurationHours > 0
                    ? "organizer.financePreviewFormula"
                    : "organizer.financePreviewScheduleHint",
                )}
              </p>
            </section>
          )}

          <div className={styles.checkboxRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="parkingRequired"
                checked={eventForm.parkingRequired}
                onChange={handleChange}
              />
              <span>{t("organizer.parkingRequired")}</span>
            </label>
          </div>

          {eventForm.parkingRequired && (
            <div className={parkingGridClassName}>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t("organizer.parkingRate")}</label>
                <input
                  type="number"
                  name="parkingPrice"
                  value={eventForm.parkingPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  readOnly
                  className={styles.input}
                />
                <span className={styles.hint}>{t("organizer.parkingRateHint")}</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{t("organizer.parkingCapacity")}</label>
                <input
                  type="number"
                  name="parkingCapacity"
                  value={eventForm.parkingCapacity}
                  onChange={handleChange}
                  min="1"
                  max={parkingQuotaLimit || undefined}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  {t("organizer.parkingQuotaHint", {
                    quota: parkingQuotaLimit,
                    total: MEETSPACE_TOTAL_PARKING_SPACES,
                  })}
                </span>
              </div>
            </div>
          )}

          <section className={styles.previewPanel} aria-label={t("organizer.previewAria")}>
            <div className={styles.previewIntro}>
              <p className={styles.previewKicker}>{t("organizer.previewKicker")}</p>
              <h2>{t("organizer.previewTitle")}</h2>
              <span>{t("organizer.previewIntro")}</span>
            </div>

            <article className={styles.previewCard}>
              <div className={styles.previewTopline}>
                <span>{previewDate}</span>
                <strong>{previewTime}</strong>
              </div>
              <h3>{eventForm.title || t("organizer.previewTitleFallback")}</h3>
              <p>
                {eventForm.description ||
                  t("organizer.previewDescriptionFallback")}
              </p>
              <div className={styles.previewTags}>
                <span>{selectedSpace?.name || t("organizer.previewRoomFallback")}</span>
                <span>{eventForm.capacity || 0} {t("common.persons")}</span>
                <span>{eventForm.price ? formatMoney(eventForm.price, locale) : t("events.free")}</span>
                <span>
                  {eventForm.parkingRequired
                    ? t("organizer.previewParkingQuota", {
                        count: eventForm.parkingCapacity || 0,
                        price: formatMoney(eventForm.parkingPrice || recommendedParkingPrice, locale),
                      })
                    : t("organizer.previewParkingExcluded")}
                </span>
              </div>
              <div className={styles.previewFooter}>
                <span>{t("organizer.previewStatus")}</span>
                <strong>
                  {eventForm.capacity && selectedSpace
                    ? t("organizer.previewRoomUsage", {
                        usage: Math.min(100, Math.round((Number(eventForm.capacity) / Number(selectedSpace.capacity)) * 100)),
                      })
                    : t("organizer.previewCapacityFallback")}
                </strong>
              </div>
            </article>
          </section>

          <div className={styles.actions}>
            <button type="button" onClick={() => navigate("/organizer/events")} className={styles.cancelBtn}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${styles.submitBtn} ${loading ? styles.submitBtnDisabled : ""}`}
            >
              {loading
                ? t("common.loading")
                : isEdit
                ? t("organizer.saveChanges")
                : t("organizer.submitForApproval")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
