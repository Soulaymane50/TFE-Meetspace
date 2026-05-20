import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyProfile, updateMyProfile, changeMyPassword, deleteMyAccount } from "../services/api";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isStrongPassword } from "../utils/passwordPolicy";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  const { user, token, login, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    if (token) {
      getMyProfile(token)
        .then((data) => {
          setProfile({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
          });
        })
        .catch(console.error);
    }
  }, [token]);

  const submitProfile = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    try {
      const updated = await updateMyProfile(profile, token);
      setMsg(t("profile.updateSuccess"));

      if (user) {
        login(
          {
            ...user,
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
          },
          token
        );
      }
    } catch (err) {
      if (err?.message === "EMAIL_ALREADY_EXISTS") {
        setError(t("profile.emailAlreadyExists"));
      } else {
        setError(t("profile.updateFailed"));
      }
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwdMsg("");
    setPwdError("");

    if (newPassword !== newPassword2) {
      setPwdError(t("profile.passwordMismatch"));
      return;
    }

    if (!isStrongPassword(newPassword)) {
      setPwdError(t("profile.passwordWeak"));
      return;
    }

    try {
      await changeMyPassword(
        {
          currentPassword,
          newPassword,
        },
        token
      );
      setPwdMsg(t("profile.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (err) {
      if (err?.message === "PASSWORD_WEAK") {
        setPwdError(t("profile.passwordWeak"));
      } else {
        setPwdError(t("profile.passwordUpdateFailed"));
      }
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    try {
      await deleteMyAccount(token);
      logout();
      navigate("/");
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  if (!user) {
    return <p className={styles.notice}>{t("profile.notLoggedIn")}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t("profile.title")}</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("profile.personalInfo")}</h2>
        <form onSubmit={submitProfile}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("auth.firstName")} :</label>
            <input
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("auth.lastName")} :</label>
            <input
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("auth.email")} :</label>
            <input
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.button}>
            {t("common.save")}
          </button>
        </form>
        {msg && <p className={styles.success}>{msg}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("profile.changePassword")}</h2>
        <form onSubmit={submitPassword}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("profile.currentPassword")} :</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("profile.newPassword")} :</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("profile.confirmPassword")} :</label>
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.button}>
            {t("common.save")}
          </button>
        </form>
        {pwdMsg && <p className={styles.success}>{pwdMsg}</p>}
        {pwdError && <p className={styles.error}>{pwdError}</p>}
      </div>

      <div className={`${styles.section} ${styles.dangerZone}`}>
        <h2 className={styles.sectionTitle}>{t("profile.dangerZone")}</h2>
        <p className={styles.dangerText}>{t("profile.deleteAccountWarning")}</p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setShowDeleteConfirm(true)}
          >
            {t("profile.deleteAccount")}
          </button>
        ) : (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>{t("profile.confirmDeleteAccount")}</p>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleDeleteAccount}
              >
                {t("common.confirm")}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
        {deleteError && <p className={styles.error}>{deleteError}</p>}
      </div>
    </div>
  );
}
