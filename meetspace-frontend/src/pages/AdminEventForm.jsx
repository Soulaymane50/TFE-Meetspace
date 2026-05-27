import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { adminCreateEvent, adminGetEvents, adminUpdateEvent, adminGetEspaces } from "../services/api";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import RoomSchedulePicker from "../components/RoomSchedulePicker";
import SelectDropdown from "../components/SelectDropdown";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import {
  MEETSPACE_TOTAL_PARKING_SPACES,
  getParkingQuotaLimit,
  getRecommendedParkingQuota,
  getRecommendedParkingRate,
  getRecommendedTicketPrice,
} from "../utils/businessRules";
import styles from "./AdminEventForm.module.css";

export default function AdminEventForm() {
  const { user, token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const parkingGridClassName = styles.parkingGrid;

  const isEdit = !!id;

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startDateTime: "",
    endDateTime: "",
    locationType: "EXISTING_SPACE",
    spaceId: "",
    location: "",
    capacity: "",
    price: "",
    parkingRequired: false,
    parkingPrice: "",
    parkingCapacity: "",
    status: "DRAFT",
  });

  const [espaces, setEspaces] = useState([]);
  const [error, setError] = useState("");
  const selectedSpace = espaces.find((space) => String(space.id) === String(eventForm.spaceId));
  const selectedCapacity = Number(selectedSpace?.capacity) || 0;
  const recommendedCapacity = selectedCapacity
    ? Math.min(selectedCapacity, Math.max(12, Math.round(selectedCapacity * 0.75)))
    : 0;
  const startDate = eventForm.startDateTime ? new Date(eventForm.startDateTime) : null;
  const endDate = eventForm.endDateTime ? new Date(eventForm.endDateTime) : null;
  const scheduleDurationHours =
    startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate > startDate
      ? Math.round(((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)) * 100) / 100
      : 0;
  const eventCapacityEstimate = Number(eventForm.capacity) || 0;
  const recommendedPrice = getRecommendedTicketPrice(selectedCapacity);
  const parkingQuotaLimit = getParkingQuotaLimit(eventCapacityEstimate || recommendedCapacity, selectedCapacity);
  const recommendedParkingCapacity = getRecommendedParkingQuota(recommendedCapacity, selectedCapacity);
  const recommendedParkingPrice = getRecommendedParkingRate(scheduleDurationHours, selectedCapacity);
  const locationTypeOptions = [
    { value: "EXISTING_SPACE", label: t("events.existingSpace") },
    { value: "EXTERNAL", label: t("events.externalAddress") },
  ];
  const roomOptions = [
    { value: "", label: t("common.select") },
    ...espaces.map((space) => ({
      value: String(space.id),
      label: `${space.name} - ${space.capacity} ${t("common.persons")} - ${formatMoney(space.basePrice, locale)} ${t("common.perHour")}`,
    })),
  ];
  const statusOptions = [
    { value: "DRAFT", label: t("status.draft") },
    { value: "PUBLISHED", label: t("status.published") },
    { value: "CANCELLED", label: t("status.cancelled") },
  ];

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      navigate("/login");
      return;
    }

    adminGetEspaces(token)
      .then(setEspaces)
      .catch(() => setEspaces([]));

    if (isEdit) {
      adminGetEvents(token)
        .then((events) => {
          const ev = events.find((e) => e.id === Number(id));
          if (ev) {
            setEventForm({
              title: ev.title,
              description: ev.description,
              startDateTime: ev.startDateTime,
              endDateTime: ev.endDateTime,
              locationType: ev.locationType || (ev.spaceId ? "EXISTING_SPACE" : "EXTERNAL"),
              spaceId: ev.spaceId ?? "",
              location: ev.externalAddress || ev.location || "",
              capacity: ev.capacity || "",
              price: ev.price || "",
              parkingRequired: ev.parkingRequired || false,
              parkingPrice: ev.parkingPrice ?? "",
              parkingCapacity: ev.parkingCapacity ?? "",
              status: ev.status,
            });
          }
        });
    }
  }, [id, isEdit, user, token, navigate]);

  const validateDates = () => {
    const now = new Date();
    const startDate = new Date(eventForm.startDateTime);
    const endDate = new Date(eventForm.endDateTime);

    if (!eventForm.startDateTime || !eventForm.endDateTime) {
      return t("reservation.dateError");
    }

    if (startDate < now) {
      return t("validation.startDatePast");
    }

    if (endDate < now) {
      return t("validation.endDatePast");
    }

    if (endDate <= startDate) {
      return t("validation.endBeforeStart");
    }

    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const dateError = validateDates();
    if (dateError) {
      setError(dateError);
      return;
    }

    if (eventForm.locationType === "EXISTING_SPACE" && !eventForm.spaceId) {
      setError(t("admin.spaceRequired"));
      return;
    }

    if (eventForm.locationType === "EXTERNAL" && !eventForm.location.trim()) {
      setError(t("admin.addressRequired"));
      return;
    }

    const capacity = Number(eventForm.capacity);
    if (!capacity || capacity < 1) {
      setError(t("validation.capacityRequired"));
      return;
    }

    if (selectedSpace && capacity > Number(selectedSpace.capacity)) {
      setError(t("organizer.capacityExceedsRoom", { capacity: selectedSpace.capacity }));
      return;
    }

    if (eventForm.parkingRequired) {
      const parkingCapacity = Number(eventForm.parkingCapacity);
      if (!parkingCapacity || parkingCapacity < 1) {
        setError(t("organizer.parkingCapacityRequired"));
        return;
      }
      if (parkingCapacity > capacity) {
        setError(t("organizer.parkingCapacityExceedsEvent", { capacity }));
        return;
      }
      if (parkingCapacity > parkingQuotaLimit) {
        setError(t("organizer.parkingCapacityExceedsQuota", { quota: parkingQuotaLimit }));
        return;
      }
    }

    const payload = {
      ...eventForm,
      spaceId: eventForm.spaceId ? Number(eventForm.spaceId) : null,
      capacity,
      price: eventForm.price ? Number(eventForm.price) : null,
      parkingPrice: eventForm.parkingRequired
        ? (eventForm.parkingPrice !== "" ? Number(eventForm.parkingPrice) : recommendedParkingPrice)
        : null,
      parkingCapacity: eventForm.parkingCapacity !== "" ? Number(eventForm.parkingCapacity) : null,
      externalAddress: eventForm.locationType === "EXTERNAL" ? eventForm.location : null,
    };

    try {
      if (isEdit) {
        await adminUpdateEvent(id, payload, token);
      } else {
        await adminCreateEvent(payload, token);
      }
      navigate("/admin/events");
    } catch (err) {
      setError(err.message || t("common.error"));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };

      if (name === "locationType") {
        next.spaceId = "";
        next.location = "";
        next.startDateTime = "";
        next.endDateTime = "";
      }

      if (name === "spaceId") {
        const room = espaces.find((space) => String(space.id) === String(value));
        next.location = room?.name || "";
        next.startDateTime = "";
        next.endDateTime = "";
        if (room && (!prev.capacity || Number(prev.capacity) > Number(room.capacity))) {
          next.capacity = String(room.capacity);
        }
        const maxParking = getParkingQuotaLimit(next.capacity, room?.capacity);
        if (next.parkingCapacity && Number(next.parkingCapacity) > maxParking) {
          next.parkingCapacity = String(maxParking);
        }
        if (next.parkingRequired) {
          next.parkingPrice = String(getRecommendedParkingRate(0, room?.capacity));
        }
      }

      if (name === "capacity") {
        const room = espaces.find((space) => String(space.id) === String(prev.spaceId));
        const numericValue = value === "" ? "" : Number(value);
        const clampedCapacity =
          room && numericValue !== "" ? Math.min(numericValue, Number(room.capacity)) : numericValue;
        next.capacity = clampedCapacity === "" ? "" : String(clampedCapacity);
        const maxParking = getParkingQuotaLimit(next.capacity, room?.capacity);
        if (next.parkingCapacity && Number(next.parkingCapacity) > maxParking) {
          next.parkingCapacity = String(maxParking);
        }
      }

      if (name === "parkingCapacity") {
        const room = espaces.find((space) => String(space.id) === String(prev.spaceId));
        const maxParking = getParkingQuotaLimit(prev.capacity, room?.capacity);
        const numericValue = value === "" ? "" : Number(value);
        const clampedParking =
          maxParking && numericValue !== "" ? Math.min(numericValue, maxParking) : numericValue;
        next.parkingCapacity = clampedParking === "" ? "" : String(clampedParking);
      }

      if (name === "parkingRequired") {
        if (checked) {
          const maxParking = getParkingQuotaLimit(prev.capacity || recommendedCapacity, selectedCapacity);
          const defaultQuota = recommendedParkingCapacity > 0
            ? Math.min(recommendedParkingCapacity, maxParking)
            : "";
          next.parkingPrice = prev.parkingPrice || String(recommendedParkingPrice);
          next.parkingCapacity = prev.parkingCapacity
            ? String(Math.min(Number(prev.parkingCapacity), maxParking))
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

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{isEdit ? t("admin.editEvent") : t("admin.createEvent")}</h1>

      <p>
        <Link to="/admin/events" className={styles.backLink}>
          ← {t("admin.backToList")}
        </Link>
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>{t("common.title")} *</label>
          <input
            name="title"
            value={eventForm.title}
            onChange={handleChange}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t("common.description")} *</label>
          <textarea
            name="description"
            value={eventForm.description}
            onChange={handleChange}
            className={styles.textarea}
            required
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t("events.locationType")} *</label>
            <SelectDropdown
              value={eventForm.locationType}
              onChange={(value) => handleChange({ target: { name: "locationType", value } })}
              options={locationTypeOptions}
              label={t("events.locationType")}
              className={styles.selectDropdown}
            />
          </div>

          {eventForm.locationType === "EXISTING_SPACE" ? (
            <div className={styles.field}>
              <label className={styles.label}>{t("spaces.space")}</label>
              <SelectDropdown
                value={String(eventForm.spaceId || "")}
                onChange={(value) => handleChange({ target: { name: "spaceId", value } })}
                options={roomOptions}
                label={t("spaces.space")}
                className={styles.selectDropdown}
              />
              {selectedSpace && (
                <span className={styles.hint}>
                  {t("organizer.roomCapacityHint", {
                    capacity: selectedSpace.capacity,
                    price: selectedSpace.basePrice,
                  })}
                </span>
              )}
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label}>{t("events.location")} *</label>
              <input
                name="location"
                value={eventForm.location}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </div>
          )}
        </div>

        {eventForm.locationType === "EXISTING_SPACE" && selectedSpace && (
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

        {eventForm.locationType === "EXISTING_SPACE" ? (
          <RoomSchedulePicker
            key={eventForm.spaceId || "admin-room-schedule"}
            spaceId={eventForm.spaceId}
            spaceName={selectedSpace?.name}
            startDateTime={eventForm.startDateTime}
            endDateTime={eventForm.endDateTime}
            onChange={handleScheduleChange}
            ignoreBlockId={isEdit ? id : undefined}
          />
        ) : (
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>{t("reservation.startDate")} *</label>
              <input
                type="datetime-local"
                name="startDateTime"
                value={eventForm.startDateTime}
                onChange={handleChange}
                min={getMinDateTime()}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t("reservation.endDate")} *</label>
              <input
                type="datetime-local"
                name="endDateTime"
                value={eventForm.endDateTime}
                onChange={handleChange}
                min={eventForm.startDateTime || getMinDateTime()}
                className={styles.input}
                required
              />
            </div>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t("common.capacity")}</label>
            <input
              type="number"
              name="capacity"
              value={eventForm.capacity}
              onChange={handleChange}
              min="1"
              max={selectedSpace?.capacity || undefined}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
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
          </div>
        </div>

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
            <div className={styles.field}>
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
            <div className={styles.field}>
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

        <div className={styles.field}>
          <label className={styles.label}>{t("common.status")} *</label>
          <SelectDropdown
            value={eventForm.status}
            onChange={(value) => handleChange({ target: { name: "status", value } })}
            options={statusOptions}
            label={t("common.status")}
            className={styles.selectDropdown}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={() => navigate("/admin/events")} className={styles.secondary}>
            {t("common.cancel")}
          </button>
          <button type="submit" className={styles.primary}>
            {isEdit ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
