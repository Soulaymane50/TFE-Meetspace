import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getEspaces } from "../services/api";
import AvailabilityFinder from "../components/AvailabilityFinder";
import PageState from "../components/PageState";
import { getSpaceImage } from "../utils/mediaAssets";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import styles from "./EspacesPage.module.css";

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
  if (name.includes("auditorium") || name.includes("europe")) return "auditorium";
  if (name.includes("atlas")) return "atlas";
  if (name.includes("atelier") || name.includes("canal")) return "atelier";
  if (name.includes("horizon")) return "horizon";
  if (name.includes("studio") || name.includes("sablon")) return "studio";
  if (name.includes("conseil")) return "boardroom";
  return capacity >= 280 ? "executive" : capacity >= 180 ? "auditorium" : capacity >= 80 ? "atlas" : capacity >= 55 ? "atelier" : capacity >= 40 ? "horizon" : capacity >= 25 ? "studio" : "boardroom";
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
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const [espaces, setEspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState(() => searchParams.get("q") || "");
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("type") || "all");
  const [sortBy, setSortBy] = useState(() => searchParams.get("sort") || "recommended");
  const [comparisonIds, setComparisonIds] = useState([]);
  const comparisonPanelRef = useRef(null);

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

  useEffect(() => {
    const next = {};
    if (catalogQuery.trim()) next.q = catalogQuery.trim();
    if (typeFilter !== "all") next.type = typeFilter;
    if (sortBy !== "recommended") next.sort = sortBy;
    setSearchParams(next, { replace: true });
  }, [catalogQuery, setSearchParams, sortBy, typeFilter]);

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
  const filteredSpaces = useMemo(() => {
    const query = catalogQuery.trim().toLocaleLowerCase(locale);
    const matches = espaces.filter((space) => {
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "premium" && space.type === "PREMIUM_ROOM") ||
        (typeFilter === "standard" && space.type !== "PREMIUM_ROOM");
      if (!matchesType) return false;
      if (!query) return true;
      return `${space.name} ${getSpaceDisplayType(space, t)} ${getSpaceBestFor(space, t)}`
        .toLocaleLowerCase(locale)
        .includes(query);
    });

    return [...matches].sort((a, b) => {
      if (sortBy === "price") return Number(a.basePrice) - Number(b.basePrice);
      if (sortBy === "capacity") return Number(b.capacity) - Number(a.capacity);
      if (sortBy === "name") return String(a.name).localeCompare(String(b.name), locale);
      return Number(b.capacity) - Number(a.capacity);
    });
  }, [catalogQuery, espaces, locale, sortBy, t, typeFilter]);
  const displayedPremiumRooms = filteredSpaces.filter((space) => space.type === "PREMIUM_ROOM");
  const displayedStandardRooms = filteredSpaces.filter((space) => space.type !== "PREMIUM_ROOM");
  const comparisonSpaces = comparisonIds
    .map((spaceId) => espaces.find((space) => space.id === spaceId))
    .filter(Boolean);

  const toggleComparison = (spaceId) => {
    setComparisonIds((current) => {
      if (current.includes(spaceId)) return current.filter((id) => id !== spaceId);
      if (current.length >= 3) return current;
      return [...current, spaceId];
    });
  };

  const resetCatalog = () => {
    setCatalogQuery("");
    setTypeFilter("all");
    setSortBy("recommended");
  };

  const renderCta = (space) => (
    <>
      <Link to={`/espace/${space.id}`} className={styles.detailButton}>
        {t("detail.viewDetails", { defaultValue: "Voir la fiche" })}
      </Link>
      {user ? (
        <Link to={`/reservations/new/${space.id}`} className={styles.primaryButton}>
          {t("spaces.reserve")}
        </Link>
      ) : (
        <Link to={`/reservations/new/${space.id}`} className={styles.secondaryButton}>
          {t("spaces.loginToReserve")}
        </Link>
      )}
    </>
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
              {t("reservation.myReservations")}
            </Link>
          )}
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatNumber(espaces.length, locale)}</span>
            <span className={styles.summaryLabel}>{t("nav.spaces")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatNumber(premiumRoomsCount, locale)}</span>
            <span className={styles.summaryLabel}>{getSpaceTypeLabel("PREMIUM_ROOM")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatNumber(standardRoomsCount, locale)}</span>
            <span className={styles.summaryLabel}>{getSpaceTypeLabel("SALLE")}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{formatMoney(fromPrice, locale)}</span>
            <span className={styles.summaryLabel}>{t("common.perHour")}</span>
          </div>
        </div>
      </section>

      {espaces.length > 0 && <AvailabilityFinder spaces={espaces} />}

      {espaces.length > 0 && (
        <section className={styles.catalogTools} aria-labelledby="room-catalog-tools-title" data-testid="room-catalog-tools">
          <div className={styles.catalogToolsIntro}>
            <p className={styles.toolKicker}>{t("spaces.exploreLabel")}</p>
            <h2 id="room-catalog-tools-title">{t("spaces.exploreTitle")}</h2>
            <p>{t("spaces.resultCount", { count: filteredSpaces.length })}</p>
          </div>
          <div className={styles.catalogControls}>
            <label className={styles.searchControl}>
              <span>{t("spaces.searchLabel")}</span>
              <input
                type="search"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder={t("spaces.searchPlaceholder")}
              />
            </label>
            <div className={styles.typeControl} role="group" aria-label={t("spaces.typeFilterLabel")}>
              {[
                ["all", t("spaces.filterAll")],
                ["premium", t("spaces.filterPremium")],
                ["standard", t("spaces.filterStandard")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={typeFilter === value ? styles.typeControlActive : ""}
                  aria-pressed={typeFilter === value}
                  onClick={() => setTypeFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className={styles.sortControl}>
              <span>{t("spaces.sortLabel")}</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="recommended">{t("spaces.sortRecommended")}</option>
                <option value="price">{t("spaces.sortPrice")}</option>
                <option value="capacity">{t("spaces.sortCapacity")}</option>
                <option value="name">{t("spaces.sortName")}</option>
              </select>
            </label>
            {(catalogQuery || typeFilter !== "all" || sortBy !== "recommended") && (
              <button type="button" className={styles.resetCatalog} onClick={resetCatalog}>
                {t("spaces.resetFilters")}
              </button>
            )}
          </div>
        </section>
      )}

      {comparisonSpaces.length > 0 && (
        <section
          ref={comparisonPanelRef}
          className={styles.comparisonPanel}
          aria-labelledby="comparison-title"
          data-testid="room-comparison"
        >
          <div className={styles.comparisonHeader}>
            <div>
              <p className={styles.toolKicker}>{t("spaces.compareLabel")}</p>
              <h2 id="comparison-title">{t("spaces.compareTitle")}</h2>
              <p>{t("spaces.compareHint")}</p>
            </div>
            <button type="button" className={styles.clearComparison} onClick={() => setComparisonIds([])}>
              {t("spaces.compareClear")}
            </button>
          </div>
          <div className={styles.comparisonGrid}>
            {comparisonSpaces.map((space) => (
              <article key={space.id} className={styles.comparisonColumn}>
                <div className={styles.comparisonName}>
                  <div>
                    <span>{getSpaceDisplayType(space, t)}</span>
                    <h3>{space.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleComparison(space.id)}
                    aria-label={t("spaces.compareRemove", { name: space.name })}
                  >
                    ×
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>{t("common.capacity")}</dt>
                    <dd>{formatNumber(space.capacity, locale)} {t("common.persons")}</dd>
                  </div>
                  <div>
                    <dt>{t("common.price")}</dt>
                    <dd>{formatMoney(space.basePrice, locale)} {t("common.perHour")}</dd>
                  </div>
                  <div>
                    <dt>{t("spaces.bestForLabel")}</dt>
                    <dd>{getSpaceBestFor(space, t)}</dd>
                  </div>
                </dl>
                {renderCta(space)}
              </article>
            ))}
            {Array.from({ length: 3 - comparisonSpaces.length }, (_, index) => (
              <div key={`comparison-empty-${index}`} className={styles.comparisonEmpty}>
                <span>{String(comparisonSpaces.length + index + 1).padStart(2, "0")}</span>
                <p>{t("spaces.compareEmptySlot")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

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
                <span className={styles.sidebarStatValue}>{formatNumber(maxCapacity, locale)}</span>
                <span className={styles.sidebarStatLabel}>{t("spaces.maxCapacityLabel")}</span>
              </div>
              <div className={styles.sidebarStat}>
                <span className={styles.sidebarStatValue}>{formatNumber(premiumRoomsCount, locale)}</span>
                <span className={styles.sidebarStatLabel}>{t("spaces.premiumClusterLabel")}</span>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <p className={styles.sidebarListLabel}>{t("spaces.catalogMixLabel")}</p>
              <div className={styles.catalogList}>
                {filteredSpaces.map((space) => (
                  <div key={space.id} className={styles.catalogItem}>
                    <div>
                      <strong className={styles.catalogItemTitle}>{space.name}</strong>
                      <p className={styles.catalogItemMeta}>
                        {getSpaceDisplayType(space, t)} · {formatNumber(space.capacity, locale)} {t("common.persons")}
                      </p>
                    </div>
                    <span className={styles.catalogItemPrice}>
                      {formatMoney(space.basePrice, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className={styles.content} data-testid="room-results">
            {filteredSpaces.length === 0 && (
              <div className={styles.noCatalogResults} role="status">
                <strong>{t("spaces.noFilterResults")}</strong>
                <p>{t("spaces.noFilterResultsText")}</p>
                <button type="button" onClick={resetCatalog}>{t("spaces.resetFilters")}</button>
              </div>
            )}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionKicker}>{t("spaces.premiumClusterLabel")}</p>
                <h2 className={styles.sectionTitle}>{t("spaces.premiumClusterTitle")}</h2>
                <p className={styles.sectionText}>{t("spaces.premiumClusterText")}</p>
              </div>

              <div className={styles.premiumStage}>
                {displayedPremiumRooms.map((space) => (
                  <article key={space.id} className={`${styles.premiumPanel} ${getCapacityClass(space)}`}>
                    <div className={styles.panelTopline}>
                      <span className={styles.panelBadge}>{getSpaceDisplayType(space, t)}</span>
                      <span className={styles.panelPrice}>
                        {formatMoney(space.basePrice, locale)}
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
                            {formatNumber(space.capacity, locale)} {t("common.persons")}
                          </span>
                        </div>
                        <div className={styles.metricCard}>
                          <span className={styles.metricLabel}>{t("spaces.bestForLabel")}</span>
                          <span className={styles.metricValue}>{getSpaceBestFor(space, t)}</span>
                        </div>
                      </div>
                    </div>

                                        <div className={styles.panelActions}>
                      <button
                        type="button"
                        data-testid="room-compare-toggle"
                        className={`${styles.compareButton} ${comparisonIds.includes(space.id) ? styles.compareButtonActive : ""}`}
                        aria-pressed={comparisonIds.includes(space.id)}
                        disabled={comparisonIds.length >= 3 && !comparisonIds.includes(space.id)}
                        onClick={() => toggleComparison(space.id)}
                      >
                        {comparisonIds.includes(space.id) ? t("spaces.compareAdded") : t("spaces.compareAdd")}
                      </button>
                      {renderCta(space)}
                    </div>
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
                {displayedStandardRooms.map((space) => (
                  <article key={space.id} className={`${styles.studioCard} ${getCapacityClass(space)}`}>
                    <div className={styles.studioHeader}>
                      <div>
                        <h3 className={styles.studioTitle}>{space.name}</h3>
                        <p className={styles.studioType}>{getSpaceDisplayType(space, t)}</p>
                      </div>
                      <span className={styles.studioPrice}>
                        {formatMoney(space.basePrice, locale)}
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
                          {formatNumber(space.capacity, locale)} {t("common.persons")}
                        </span>
                      </div>
                      <div className={styles.studioMetaBlock}>
                        <span className={styles.metricLabel}>{t("spaces.bestForLabel")}</span>
                        <span className={styles.metricValue}>{getSpaceBestFor(space, t)}</span>
                      </div>
                    </div>

                                        <div className={styles.studioActions}>
                      <button
                        type="button"
                        data-testid="room-compare-toggle"
                        className={`${styles.compareButton} ${comparisonIds.includes(space.id) ? styles.compareButtonActive : ""}`}
                        aria-pressed={comparisonIds.includes(space.id)}
                        disabled={comparisonIds.length >= 3 && !comparisonIds.includes(space.id)}
                        onClick={() => toggleComparison(space.id)}
                      >
                        {comparisonIds.includes(space.id) ? t("spaces.compareAdded") : t("spaces.compareAdd")}
                      </button>
                      {renderCta(space)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {comparisonSpaces.length > 0 && (
        <button
          type="button"
          className={styles.comparisonTrigger}
          onClick={() => comparisonPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
        >
          {t("spaces.compareOpen", { count: comparisonSpaces.length })}
        </button>
      )}
    </div>
  );
}
