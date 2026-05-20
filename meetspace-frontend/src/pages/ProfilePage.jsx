import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyProfile, updateMyProfile, changeMyPassword, deleteMyAccount } from "../services/api";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isStrongPassword } from "../utils/passwordPolicy";
import PageState from "../components/PageState";
import styles from "./ProfilePage.module.css";

function profileFromUser(user) {
  return {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  };
}

export default function ProfilePage() {
  const { user, token, login, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => profileFromUser(user));
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
            firstName: data.firstName || user?.firstName || "",
            lastName: data.lastName || user?.lastName || "",
            email: data.email || user?.email || "",
          });
        })
        .catch(() => {
          if (user) setProfile(profileFromUser(user));
        });
    }
  }, [token, user]);

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
    return <PageState type="empty" title={t("profile.title")} message={t("profile.notLoggedIn")} />;
  }

  const displayName = `${profile.firstName || user.firstName || ""} ${profile.lastName || user.lastName || ""}`.trim();
  const initials = `${profile.firstName || user.firstName || "M"}`.slice(0, 1).toUpperCase();

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{t("profile.accountKicker")}</p>
          <h1 className={styles.title}>{t("profile.title")}</h1>
          <p className={styles.subtitle}>{t("profile.accountSubtitle")}</p>
        </div>

        <aside className={styles.accountCard}>
          <span className={styles.avatar}>{initials}</span>
          <div className={styles.accountMeta}>
            <strong>{displayName || user.email}</strong>
            <span>{profile.email || user.email}</span>
          </div>
          <span className={styles.roleChip}>{user.role || t("profile.accountStatus")}</span>
        </aside>
      </section>

      <div className={styles.formGrid}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>{t("profile.identity")}</p>
              <h2 className={styles.sectionTitle}>{t("profile.personalInfo")}</h2>
            </div>
            <p>{t("profile.personalInfoHint")}</p>
          </div>

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
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>{t("profile.security")}</p>
              <h2 className={styles.sectionTitle}>{t("profile.changePassword")}</h2>
            </div>
            <p>{t("profile.passwordHint")}</p>
          </div>

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
        </section>
      </div>

      <section className={`${styles.section} ${styles.dangerZone}`}>
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
      </section>
    </div>
  );
}
