import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./FinanceLedger.module.css";

function safe(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodRange(period) {
  const today = new Date();
  if (period === "year") {
    return { from: `${today.getFullYear()}-01-01`, to: dateValue(today) };
  }
  if (period === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: dateValue(from), to: dateValue(today) };
  }
  return {};
}

function EventPerformanceTable({ events, isAdmin, formatMoney, formatNumber, t }) {
  if (!events.length) {
    return <p className={styles.emptyEvents}>{t("finance.noFinancialEvents")}</p>;
  }

  return (
    <div
      className={styles.eventTable}
      role="table"
      aria-label={t(isAdmin ? "finance.adminEventPerformance" : "finance.organizerEventPerformance")}
    >
      <div className={`${styles.eventRow} ${styles.eventHeaderRow}`} role="row">
        <span role="columnheader">{t("finance.eventColumn")}</span>
        <span role="columnheader">{t("finance.fillColumn")}</span>
        <span role="columnheader">{t(isAdmin ? "finance.platformContribution" : "finance.currentNet")}</span>
        <span role="columnheader">{t("finance.capacityNet")}</span>
      </div>
      {events.map((event) => {
        const current = isAdmin
          ? safe(event.meetSpaceCommission) + safe(event.roomCost)
          : safe(event.organizerNetEstimate);
        const capacity = isAdmin
          ? safe(event.potentialMeetSpaceCommission) + safe(event.roomCost)
          : safe(event.organizerPotentialNet ?? event.organizerNetEstimate);
        const occupancy = Math.max(0, Math.min(100, Math.round(safe(event.occupancyRate))));
        const identityMeta = [
          isAdmin ? event.organizerName : null,
          event.roomName || t("finance.roomNotAssigned"),
        ].filter(Boolean).join(" · ");

        return (
          <div className={styles.eventRow} role="row" key={event.eventId}>
            <span className={styles.eventIdentity} role="cell">
              <strong>{event.eventTitle}</strong>
              <small>{identityMeta}</small>
            </span>
            <span className={styles.eventMetric} role="cell">
              <i className={styles.mobileLabel}>{t("finance.fillColumn")}</i>
              <strong>{formatNumber(occupancy)}%</strong>
              <small>
                {formatNumber(safe(event.confirmedParticipants))}/{formatNumber(safe(event.eventCapacity))} {t("common.participants")}
              </small>
            </span>
            <span className={styles.eventMetric} role="cell">
              <i className={styles.mobileLabel}>{t(isAdmin ? "finance.platformContribution" : "finance.currentNet")}</i>
              <strong>{formatMoney(current)}</strong>
            </span>
            <span className={`${styles.eventMetric} ${styles.eventPotential}`} role="cell">
              <i className={styles.mobileLabel}>{t("finance.capacityNet")}</i>
              <strong>{formatMoney(capacity)}</strong>
              <small>+ {formatMoney(Math.max(0, capacity - current))}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FinanceLedger({ summary, variant = "admin", formatMoney, formatNumber, onPeriodChange }) {
  const { t, i18n } = useTranslation();
  const [activePeriod, setActivePeriod] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const changePeriod = async (period) => {
    if (period === activePeriod || refreshing) return;
    const previousPeriod = activePeriod;
    setActivePeriod(period);
    setRefreshError(false);
    if (!onPeriodChange) return;
    setRefreshing(true);
    try {
      await onPeriodChange(getPeriodRange(period));
    } catch {
      setActivePeriod(previousPeriod);
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (!summary) return null;

  const isAdmin = variant === "admin";
  const confirmedPrimary = isAdmin ? safe(summary.meetSpaceEstimatedRevenue) : safe(summary.organizerNetEstimate);
  const potentialPrimary = isAdmin
    ? safe(summary.meetSpacePotentialRevenue ?? summary.meetSpaceEstimatedRevenue)
    : safe(summary.organizerPotentialNet ?? summary.organizerNetEstimate);
  const remainingPotential = Math.max(0, potentialPrimary - confirmedPrimary);
  const totalCapacity = (summary.events || []).reduce((total, event) => total + safe(event.eventCapacity), 0);
  const occupancy = totalCapacity > 0
    ? Math.max(0, Math.min(100, Math.round((safe(summary.confirmedParticipants) / totalCapacity) * 100)))
    : 0;
  const signedMoney = (value) => `${value < 0 ? "−" : ""}${formatMoney(Math.abs(value))}`;
  const adminRows = [
    { label: t("finance.directRoomRevenue"), value: safe(summary.directRoomRevenue) },
    { label: t("finance.parkingRevenue"), value: safe(summary.parkingRevenue) },
    { label: t("finance.eventCommissions"), value: safe(summary.eventCommissionRevenue) },
    { label: t("finance.roomCostChargedToOrganizers"), value: safe(summary.roomCostChargedToOrganizers) },
  ];
  const organizerRows = [
    {
      label: t("finance.ticketSales"),
      current: safe(summary.eventGrossRevenue),
      capacity: safe(summary.eventPotentialGrossRevenue ?? summary.eventGrossRevenue),
    },
    {
      label: t("finance.meetSpaceCommission"),
      current: -safe(summary.eventCommissionRevenue),
      capacity: -safe(summary.eventPotentialCommissionRevenue ?? summary.eventCommissionRevenue),
    },
    {
      label: t("finance.roomCost"),
      current: -safe(summary.roomCostChargedToOrganizers),
      capacity: -safe(summary.roomCostChargedToOrganizers),
    },
  ];
  const language = i18n.resolvedLanguage || i18n.language || "fr";
  const locale = language.startsWith("nl") ? "nl-BE" : language.startsWith("en") ? "en-GB" : "fr-BE";
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  const periodScope = summary.periodStart && summary.periodEnd
    ? t("finance.periodRange", {
        from: dateFormatter.format(new Date(`${summary.periodStart}T00:00:00`)),
        to: dateFormatter.format(new Date(`${summary.periodEnd}T00:00:00`)),
      })
    : t("finance.allHistory");

  return (
    <section
      className={`${styles.ledger} ${isAdmin ? styles.adminLedger : styles.organizerLedger}`}
      aria-labelledby={`finance-${variant}-title`}
      aria-busy={refreshing}
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{t(isAdmin ? "finance.adminEyebrow" : "finance.organizerEyebrow")}</p>
          <h2 id={`finance-${variant}-title`}>{t(isAdmin ? "finance.adminLedgerTitle" : "finance.organizerLedgerTitle")}</h2>
          <p className={styles.intro}>{t(isAdmin ? "finance.adminLedgerIntro" : "finance.organizerLedgerIntro")}</p>
        </div>
        <div className={styles.headerTools}>
          {!isAdmin && (
            <span className={styles.commission}>
              {t("finance.commissionRate", { rate: Math.round(safe(summary.commissionRate) * 100) })}
            </span>
          )}
          <div className={styles.periods} role="group" aria-label={t("finance.periodLabel") }>
            {["all", "year", "30d"].map((period) => (
              <button
                key={period}
                type="button"
                className={activePeriod === period ? styles.periodActive : ""}
                onClick={() => changePeriod(period)}
                disabled={refreshing}
                aria-pressed={activePeriod === period}
              >
                {t(`finance.period.${period}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {refreshError && <p className={styles.refreshError}>{t("finance.refreshError")}</p>}
      <div className={styles.periodStatus} aria-live="polite">
        <span className={styles.periodDot} aria-hidden="true" />
        <strong>{periodScope}</strong>
        <span>{t("finance.transactions", { count: safe(summary.transactionCount) })}</span>
        {refreshing && <span>{t("finance.updating")}</span>}
      </div>

      <div className={`${styles.roleSummary} ${refreshing ? styles.refreshing : ""}`}>
        <div className={`${styles.roleMetric} ${styles.roleMetricFeatured}`}>
          <span>{t(isAdmin ? "finance.adminRevenueConfirmed" : "finance.organizerNetConfirmed")}</span>
          <strong>{formatMoney(confirmedPrimary)}</strong>
          <small>{t("finance.potentialAtCapacity")}: {formatMoney(potentialPrimary)}</small>
        </div>
        <div className={styles.roleMetric}>
          <span>{t(isAdmin ? "finance.netCashFlow" : "finance.collectedFromAttendees")}</span>
          <strong>{formatMoney(isAdmin ? safe(summary.netCashFlow) : safe(summary.grossCollected))}</strong>
          <small>
            {isAdmin
              ? `${t("finance.grossCollected")}: ${formatMoney(safe(summary.grossCollected))}`
              : t("finance.transactions", { count: safe(summary.transactionCount) })}
          </small>
        </div>
        <div className={`${styles.roleMetric} ${isAdmin && safe(summary.outstandingReceivables) > 0 ? styles.roleMetricAttention : ""}`}>
          <span>{t(isAdmin ? "finance.receivables" : "finance.portfolioOccupancy")}</span>
          <strong>{isAdmin ? formatMoney(safe(summary.outstandingReceivables)) : `${formatNumber(occupancy)}%`}</strong>
          <small>
            {isAdmin
              ? t("finance.transactions", { count: safe(summary.transactionCount) })
              : `${formatNumber(safe(summary.confirmedParticipants))}/${formatNumber(totalCapacity)} ${t("common.participants")} · +${formatMoney(remainingPotential)}`}
          </small>
        </div>
      </div>

      {isAdmin && (
        <section className={styles.compactSection} aria-labelledby="admin-cash-title">
          <div className={styles.sectionHeading}>
            <div>
              <p>{t("finance.adminCashEyebrow")}</p>
              <h3 id="admin-cash-title">{t("finance.adminCashTitle")}</h3>
            </div>
            <span>{t("finance.adminCashHelp")}</span>
          </div>
          <div className={styles.cashEquation}>
            <div className={styles.cashTerm}><span>{t("finance.grossCollected")}</span><strong>{formatMoney(safe(summary.grossCollected))}</strong></div>
            <i aria-hidden="true">−</i>
            <div className={styles.cashTerm}><span>{t("finance.refundedAmount")}</span><strong>{formatMoney(safe(summary.refundedAmount))}</strong></div>
            <i aria-hidden="true">−</i>
            <div className={styles.cashTerm}><span>{t("finance.processingFees")}</span><strong>{formatMoney(safe(summary.estimatedProcessingFees))}</strong></div>
            <i aria-hidden="true">=</i>
            <div className={`${styles.cashTerm} ${styles.cashTermTotal}`}><span>{t("finance.netCashFlow")}</span><strong>{formatMoney(safe(summary.netCashFlow))}</strong></div>
          </div>
        </section>
      )}

      <section className={styles.compactSection} aria-labelledby={`finance-${variant}-breakdown`}>
        <div className={styles.detailHeader}>
          <div>
            <h3 id={`finance-${variant}-breakdown`}>
              {t(isAdmin ? "finance.adminSourceTitle" : "finance.organizerFlowTitle")}
            </h3>
            <p>{t(isAdmin ? "finance.adminSourceHelp" : "finance.organizerFlowHelp")}</p>
          </div>
        </div>

        {isAdmin ? (
          <div className={`${styles.simpleTable} ${styles.adminBreakdown}`} role="table" aria-label={t("finance.adminSourceTitle")}>
            <div className={`${styles.simpleRow} ${styles.simpleHead}`} role="row">
              <span role="columnheader">{t("finance.source")}</span>
              <span role="columnheader">{t("finance.confirmedShort")}</span>
            </div>
            {adminRows.map((row) => (
              <div key={row.label} className={styles.simpleRow} role="row">
                <span role="cell">{row.label}</span>
                <strong role="cell">{formatMoney(row.value)}</strong>
              </div>
            ))}
            <div className={`${styles.simpleRow} ${styles.netRow}`} role="row">
              <span role="cell">{t("finance.adminRevenueConfirmed")}</span>
              <strong role="cell">{formatMoney(confirmedPrimary)}</strong>
            </div>
          </div>
        ) : (
          <div className={styles.simpleTable} role="table" aria-label={t("finance.organizerFlowTitle")}>
            <div className={`${styles.simpleRow} ${styles.simpleHead}`} role="row">
              <span role="columnheader">{t("finance.calculationLine")}</span>
              <span role="columnheader">{t("finance.confirmedShort")}</span>
              <span role="columnheader">{t("finance.potentialShort")}</span>
            </div>
            {organizerRows.map((row) => (
              <div key={row.label} className={styles.simpleRow} role="row">
                <span role="cell">{row.label}</span>
                <strong role="cell">{signedMoney(row.current)}</strong>
                <strong role="cell">{signedMoney(row.capacity)}</strong>
              </div>
            ))}
            <div className={`${styles.simpleRow} ${styles.netRow}`} role="row">
              <span role="cell">{t("finance.organizerNet")}</span>
              <strong role="cell">{formatMoney(confirmedPrimary)}</strong>
              <strong role="cell">{formatMoney(potentialPrimary)}</strong>
            </div>
          </div>
        )}
      </section>

      <section className={styles.eventSection} aria-labelledby={`finance-${variant}-events`}>
        <div className={styles.sectionHeading}>
          <div>
            <p>{t(isAdmin ? "finance.adminEventsEyebrow" : "finance.organizerEventsEyebrow")}</p>
            <h3 id={`finance-${variant}-events`}>
              {t(isAdmin ? "finance.adminEventPerformance" : "finance.organizerEventPerformance")}
            </h3>
          </div>
          <span>{t(isAdmin ? "finance.adminEventPerformanceHelp" : "finance.organizerEventPerformanceHelp")}</span>
        </div>
        <EventPerformanceTable
          events={summary.events || []}
          isAdmin={isAdmin}
          formatMoney={formatMoney}
          formatNumber={formatNumber}
          t={t}
        />
      </section>

      <footer className={styles.ledgerNote}>
        <strong>{t("finance.readingKey")}</strong>
        <p>{t(isAdmin ? "finance.adminFormula" : "finance.organizerFormula")}</p>
        <span>{t(isAdmin ? "finance.cashVsRevenueNotice" : "finance.organizerPaymentNotice")}</span>
        {isAdmin && (
          <small>
            {t("finance.vatIncluded", { rate: Math.round(safe(summary.vatRate) * 100) })}: {formatMoney(safe(summary.vatIncluded))}
            {" · "}{t("finance.excludingVat")}: {formatMoney(safe(summary.revenueExcludingVat))}
          </small>
        )}
      </footer>
    </section>
  );
}
