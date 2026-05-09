import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminCreateParkingSlot,
  adminGetParkingSlot,
  adminUpdateParkingSlot,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import SelectDropdown from "../components/SelectDropdown";
import styles from "./AdminParkingForm.module.css";

export default function AdminParkingForm() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditingParkingSlot = !!id;
  const { t } = useTranslation();

  const [parkingSlotForm, setParkingSlotForm] = useState({
    title: "",
    description: "",
    slotDate: "",
    startTime: "",
    endTime: "",
    parkingCapacity: "",
    parkingRate: "",
    status: "OPEN",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const statusOptions = [
    { value: "OPEN", label: t("status.open") },
    { value: "CLOSED", label: t("status.closed") },
    { value: "CANCELLED", label: t("status.cancelled") },
  ];

  useEffect(() => {
    if (isEditingParkingSlot) {
      let cancelled = false;

      const loadParkingSlot = async () => {
        setLoading(true);
        setError("");

        try {
          const parkingSlot = await adminGetParkingSlot(id, token);
          if (!cancelled) {
            setParkingSlotForm({
              title: parkingSlot.title || "",
              description: parkingSlot.description || "",
              slotDate: parkingSlot.slotDate || "",
              startTime: parkingSlot.startTime || "",
              endTime: parkingSlot.endTime || "",
              parkingCapacity: parkingSlot.parkingCapacity || "",
              parkingRate: parkingSlot.parkingRate || "",
              status: parkingSlot.status || "OPEN",
            });
          }
        } catch (err) {
          if (!cancelled) {
            setError(err.message);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      loadParkingSlot();

      return () => {
        cancelled = true;
      };
    }
  }, [id, isEditingParkingSlot, token]);

  const handleChange = (e) => {
    setParkingSlotForm({ ...parkingSlotForm, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!parkingSlotForm.description || parkingSlotForm.description.trim().length < 10) {
      setError(t("validation.descriptionRequired") || "Description requise (10 caracteres minimum)");
      return;
    }

    const selectedDate = new Date(`${parkingSlotForm.slotDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError(t("validation.startDatePast"));
      return;
    }

    if (!parkingSlotForm.startTime || !parkingSlotForm.endTime || parkingSlotForm.endTime <= parkingSlotForm.startTime) {
      setError(t("validation.endBeforeStart"));
      return;
    }

    const capacity = Number(parkingSlotForm.parkingCapacity);
    if (!capacity || capacity < 1 || capacity > 150) {
      setError(t("parking.capacityExceeded", { count: 150 }));
      return;
    }

    const rate = Number(parkingSlotForm.parkingRate);
    if (!Number.isFinite(rate) || rate < 0) {
      setError(t("validation.pricePositive"));
      return;
    }

    const parkingSlotPayload = {
      ...parkingSlotForm,
      parkingCapacity: capacity,
      parkingRate: rate,
    };

    try {
      if (isEditingParkingSlot) {
        await adminUpdateParkingSlot(id, parkingSlotPayload, token);
      } else {
        await adminCreateParkingSlot(parkingSlotPayload, token);
      }
      navigate("/admin/parking");
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("admin.parkingManagement")} />;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {isEditingParkingSlot ? t("admin.editSession") : t("admin.newSession")}
      </h1>

      <p>
        <Link to="/admin/parking">{"\u2190"} {t("admin.backToList")}</Link>
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t("common.title")} :</label>
          <input
            type="text"
            name="title"
            value={parkingSlotForm.title}
            onChange={handleChange}
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t("common.description")} :</label>
          <textarea
            name="description"
            value={parkingSlotForm.description}
            onChange={handleChange}
            rows="3"
            minLength={10}
            required
            className={styles.textarea}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t("common.date")} :</label>
          <input
            type="date"
            name="slotDate"
            value={parkingSlotForm.slotDate}
            onChange={handleChange}
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("reservation.startTime")} :</label>
            <input
              type="time"
              name="startTime"
              value={parkingSlotForm.startTime}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("reservation.endTime")} :</label>
            <input
              type="time"
              name="endTime"
              value={parkingSlotForm.endTime}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("parking.places")} :</label>
            <input
              type="number"
              name="parkingCapacity"
              value={parkingSlotForm.parkingCapacity}
              onChange={handleChange}
              required
              min="1"
              max="150"
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("parking.rateLabel")} ({"\u20ac"}) :</label>
            <input
              type="number"
              name="parkingRate"
              value={parkingSlotForm.parkingRate}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t("common.status")} :</label>
          <SelectDropdown
            value={parkingSlotForm.status}
            onChange={(value) => setParkingSlotForm({ ...parkingSlotForm, status: value })}
            options={statusOptions}
            label={t("common.status")}
            className={styles.selectDropdown}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={() => navigate("/admin/parking")}
            className={styles.cancelButton}
          >
            {t("common.cancel")}
          </button>
          <button type="submit" className={styles.submitButton}>
            {isEditingParkingSlot ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
