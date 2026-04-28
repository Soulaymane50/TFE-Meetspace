import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminCreateParkingSlot,
  adminGetParkingSlot,
  adminUpdateParkingSlot,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
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

  useEffect(() => {
    if (isEditingParkingSlot) {
      let cancelled = false;

      const loadParkingSlot = async () => {
        setLoading(true);
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
      setError(t('validation.descriptionRequired') || "Description requise (10 caractères minimum)");
      return;
    }

    const parkingSlotPayload = {
      ...parkingSlotForm,
      parkingCapacity: Number(parkingSlotForm.parkingCapacity),
      parkingRate: Number(parkingSlotForm.parkingRate),
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

  if (loading) return <p className={styles.info}>{t('common.loading')}</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {isEditingParkingSlot ? t('admin.editSession') : t('admin.newSession')}
      </h1>

      <p>
        <Link to="/admin/parking">← {t('admin.backToList')}</Link>
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('common.title')} :</label>
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
            <label className={styles.label}>{t('common.description')} :</label>
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
          <label className={styles.label}>{t('common.date')} :</label>
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
              <label className={styles.label}>{t('reservation.startTime')} :</label>
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
              <label className={styles.label}>{t('reservation.endTime')} :</label>
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
              <label className={styles.label}>{t('parking.places')} :</label>
            <input
              type="number"
              name="parkingCapacity"
              value={parkingSlotForm.parkingCapacity}
              onChange={handleChange}
              required
              min="1"
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
              <label className={styles.label}>{t('parking.rateLabel')} (€) :</label>
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
          <label className={styles.label}>{t('common.status')} :</label>
          <select
            name="status"
            value={parkingSlotForm.status}
            onChange={handleChange}
            className={styles.select}
          >
            <option value="OPEN">{t('status.open')}</option>
            <option value="CLOSED">{t('status.closed')}</option>
            <option value="CANCELLED">{t('status.cancelled')}</option>
          </select>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={() => navigate("/admin/parking")}
            className={styles.cancelButton}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" className={styles.submitButton}>
            {isEditingParkingSlot ? t('common.save') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
