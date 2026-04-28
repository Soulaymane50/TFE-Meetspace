import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { adminCreateEvent, adminGetEvents, adminUpdateEvent, adminGetEspaces } from "../services/api";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./AdminEventForm.module.css";

export default function AdminEventForm() {
  const { user, token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const parkingGridClassName = styles.parkingGrid;

  const isEdit = !!id;

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startDateTime: "",
    endDateTime: "",
    locationType: "EXTERNAL",
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

    const payload = {
      ...eventForm,
      spaceId: eventForm.spaceId ? Number(eventForm.spaceId) : null,
      capacity: eventForm.capacity ? Number(eventForm.capacity) : null,
      price: eventForm.price ? Number(eventForm.price) : null,
      parkingPrice: eventForm.parkingPrice !== "" ? Number(eventForm.parkingPrice) : null,
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
    setEventForm({ ...eventForm, [name]: type === "checkbox" ? checked : value });
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
            <select
              name="locationType"
              value={eventForm.locationType}
              onChange={handleChange}
              className={styles.select}
            >
              <option value="EXTERNAL">{t("events.externalAddress")}</option>
              <option value="EXISTING_SPACE">{t("events.existingSpace")}</option>
            </select>
          </div>

          {eventForm.locationType === "EXISTING_SPACE" ? (
            <div className={styles.field}>
              <label className={styles.label}>{t("spaces.space")}</label>
              <select
                name="spaceId"
                value={eventForm.spaceId}
                onChange={handleChange}
                className={styles.select}
              >
                <option value="">{t("common.select")}</option>
                {espaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t("common.capacity")}</label>
            <input
              type="number"
              name="capacity"
              value={eventForm.capacity}
              onChange={handleChange}
              min="1"
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
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t("organizer.parkingCapacity")}</label>
              <input
                type="number"
                name="parkingCapacity"
                value={eventForm.parkingCapacity}
                onChange={handleChange}
                min="1"
                className={styles.input}
              />
            </div>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>{t("common.status")} *</label>
          <select
            name="status"
            value={eventForm.status}
            onChange={handleChange}
            className={styles.select}
          >
            <option value="DRAFT">{t("status.draft")}</option>
            <option value="PUBLISHED">{t("status.published")}</option>
            <option value="CANCELLED">{t("status.cancelled")}</option>
          </select>
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
