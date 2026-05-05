import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getEspaces } from "../services/api";
import AvailabilityFinder from "../components/AvailabilityFinder";
import PageState from "../components/PageState";
import { getSpaceImage } from "../utils/mediaAssets";
import styles from "./EspacesPage.module.css";

const EURO = "€";

function getCapacityClass(space) {
  const capacity = Number(space?.capacity) || 0;

  if (capacity >= 500) return styles.capacityHuge;
  if (capacity >= 250) return styles.capacityLarge;
  if (capacity >= 80) return styles.capacityMedium;
  if (capacity >= 40) return styles.capacitySmall;
  return styles.capacityBoardroom;
}

function getSpaceProfileKey(space) {
  const name = `${space?.name || ""}`.toLowerCase();
  const capacity = Number(space?.capacity) || 0;

  if (name.includes("orion")) return "orion";
  if (name.includes("executive") && capacity >= 250) return "executive";
  if (name.includes("atlas")) return "atlas";
  if (name.includes("horizon")) return "horizon";
  if (name.includes("conseil")) return "boardroom";
  return capacity >= 250 ? "executive" : capacity >= 80 ? "atlas" : capacity >= 40 ? "horizon" : "boardroom";
}

function getSpaceDescription(space, t) {
  return t(`spaces.profiles.${getSpaceProfileKey(space)}.description`);
}

function getSpaceBestFor(space, t) {
  return t(`spaces.profiles.${getSpaceProfileKey(space)}.bestFor`);
}

function getSpaceDisplayType(space, t) {
  return t(`spaces.profiles.${getSpaceProfileKey(space)}.label`);
}

export default function EspacesPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [espaces, setEspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const getSpaceTypeLabel = (type) => t(`spaceType.${type}`, { defaultValue: type });

  const fetchSpaces = useCallback(() => {
    getEspaces()
      .then(setEspaces)
      .catch((error) => {
        console.error(error);
        setEspaces([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const retrySpaces = () => {
    setLoading(true);
    setLoadError(false);
    fetchSpaces();
  };

  const premiumRooms = espaces.filter((space) => space.type === "PREMIUM_ROOM");
  const standardRooms = espaces.filter((space) => space.type !== "PREMIUM_ROOM");
  const premiumRoomsCount = premiumRooms.length;
  const standardRoomsCount = standardRooms.length;
  const fromPrice = espaces.length ? Math.min(...espaces.map((space) => Number(space.basePrice) || 0)) : 0;
  const maxCapacity = espaces.length ? Math.max(...espaces.map((space) => Number(space.capacity) || 0)) : 0;

  const renderCta = (space) =>
    user ? (
      <Link to={`/reservations/new/${space.id}`} className={styles.primaryButton}>
        {t("spaces.reserve")}
      </Link>
    ) : (
      <Link to="/login" className={styles.secondaryButton}>
        {t("spaces.loginToReserve")}
      </Link>
    );

  if (loading) {
    return <PageState type="loading" title={t("common.loading")} message={t("spaces.catalogText")} />;
  }

  if (loadError) {
    return (
      <PageState
        type="error"
        title={t("common.error")}
        message={t("spaces.noSpaces")}
        action={
          <button type="button" onClick={retrySpaces}>
            {t("common.retry")}
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroPanel}>
        <div className={styles.heroHeader}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("spaces.kicker")}</p>
            <h1 className={styles.title}>{t("spaces.title")}</h1>
            <p className={styles.subtitle}>
              {user ? `${t("spaces.welcome")} ${user.firstName}. ` : ""}
              {t("spaces.subtitle")}
            </p>
          </div>
          {user && (
            <Link to="/my-reservations?tab=spaces" className={styles.linkGhost}>
              ← {t("reservation.myReservations")}
            </Link>
          )}
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{espaces.length}</span>
            <span className={styles.summaryLabel}>{t("nav.spaces")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{premiumRoomsCount}</span>
            <span className={styles.summaryLabel}>{getSpaceTypeLabel("PREMIUM_ROOM")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{standardRoomsCount}</span>
            <span className={styles.summaryLabel}>{getSpaceTypeLabel("SALLE")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{fromPrice} {EURO}</span>
            <span className={styles.summaryLabel}>{t("common.perHour")}</span>
          </div>
        </div>
      </section>

      {espaces.length > 0 && <AvailabilityFinder spaces={espaces} />}

      {espaces.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t("spaces.noSpaces")}</p>
        </div>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <p className={styles.sidebarEyebrow}>{t("spaces.catalogLabel")}</p>
              <h2 className={styles.sidebarTitle}>{t("spaces.catalogTitle")}</h2>
              <p className={styles.sidebarText}>{t("spaces.catalogText")}</p>
            </div>

            <div className={styles.sidebarStats}>
              <div className={styles.sidebarStat}>
                <span className={styles.sidebarStatValue}>{maxCapacity}</span>
                <span className={styles.sidebarStatLabel}>{t("spaces.maxCapacityLabel")}</span>
              </div>
              <div className={styles.sidebarStat}>
                <span className={styles.sidebarStatValue}>{premiumRoomsCount}</span>
                <span className={styles.sidebarStatLabel}>{t("spaces.premiumClusterLabel")}</span>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <p className={styles.sidebarListLabel}>{t("spaces.catalogMixLabel")}</p>
              <div className={styles.catalogList}>
                {espaces.map((space) => (
                  <div key={space.id} className={styles.catalogItem}>
                    <div>
                      <strong className={styles.catalogItemTitle}>{space.name}</strong>
                      <p className={styles.catalogItemMeta}>
                        {getSpaceDisplayType(space, t)} · {space.capacity} {t("common.persons")}
                      </p>
                    </div>
                    <span className={styles.catalogItemPrice}>
                      {space.basePrice} {EURO}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className={styles.content}>
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionKicker}>{t("spaces.premiumClusterLabel")}</p>
                <h2 className={styles.sectionTitle}>{t("spaces.premiumClusterTitle")}</h2>
                <p className={styles.sectionText}>{t("spaces.premiumClusterText")}</p>
              </div>

              <div className={styles.premiumStage}>
                {premiumRooms.map((space) => (
                  <article key={space.id} className={`${styles.premiumPanel} ${getCapacityClass(space)}`}>
                    <div className={styles.panelTopline}>
                      <span className={styles.panelBadge}>{getSpaceDisplayType(space, t)}</span>
                      <span className={styles.panelPrice}>
                        {space.basePrice} {EURO}
                        <span className={styles.panelPriceUnit}>{t("common.perHour")}</span>
                      </span>
                    </div>

                    <div
                      className={styles.panelImage}
                      style={{ backgroundImage: `url(${getSpaceImage(space)})` }}
                      aria-hidden="true"
                    />

                    <div className={styles.panelBody}>
                      <div className={styles.panelMain}>
                        <h3 className={styles.panelTitle}>{space.name}</h3>
                        <p className={styles.panelDescription}>{getSpaceDescription(space, t)}</p>
                      </div>

                      <div className={styles.panelMetrics}>
                        <div className={styles.metricCard}>
                          <span className={styles.metricLabel}>{t("common.capacity")}</span>
                          <span className={styles.metricValue}>
                            {space.capacity} {t("common.persons")}
                          </span>
                        </div>
                        <div className={styles.metricCard}>
                          <span className={styles.metricLabel}>{t("spaces.bestForLabel")}</span>
                          <span className={styles.metricValue}>{getSpaceBestFor(space, t)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.panelActions}>{renderCta(space)}</div>
                  </article>
                ))}
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionKicker}>{t("spaces.standardClusterLabel")}</p>
                <h2 className={styles.sectionTitle}>{t("spaces.standardClusterTitle")}</h2>
                <p className={styles.sectionText}>{t("spaces.standardClusterText")}</p>
              </div>

              <div className={styles.studioLane}>
                {standardRooms.map((space) => (
                  <article key={space.id} className={`${styles.studioCard} ${getCapacityClass(space)}`}>
                    <div className={styles.studioHeader}>
                      <div>
                        <h3 className={styles.studioTitle}>{space.name}</h3>
                        <p className={styles.studioType}>{getSpaceDisplayType(space, t)}</p>
                      </div>
                      <span className={styles.studioPrice}>
                        {space.basePrice} {EURO}
                      </span>
                    </div>

                    <div
                      className={styles.studioImage}
                      style={{ backgroundImage: `url(${getSpaceImage(space)})` }}
                      aria-hidden="true"
                    />

                    <div className={styles.studioMeta}>
                      <div className={styles.studioMetaBlock}>
                        <span className={styles.metricLabel}>{t("common.capacity")}</span>
                        <span className={styles.metricValue}>
                          {space.capacity} {t("common.persons")}
                        </span>
                      </div>
                      <div className={styles.studioMetaBlock}>
                        <span className={styles.metricLabel}>{t("spaces.bestForLabel")}</span>
                        <span className={styles.metricValue}>{getSpaceBestFor(space, t)}</span>
                      </div>
                    </div>

                    <div className={styles.studioActions}>{renderCta(space)}</div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
