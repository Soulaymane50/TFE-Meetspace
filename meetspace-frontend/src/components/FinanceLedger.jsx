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

export default function FinanceLedger({ summary, variant = "admin", formatMoney, formatNumber, onPeriodChange }) {
  const { t } = useTranslation();
  const [activePeriod, setActivePeriod] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const changePeriod = async (period) => {
    setActivePeriod(period);
    setRefreshError(false);
    if (!onPeriodChange) return;
    setRefreshing(true);
    try { await onPeriodChange(getPeriodRange(period)); }
    catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };

  if (!summary) return null;

  const isAdmin = variant === "admin";
  const confirmedPrimary = isAdmin ? safe(summary.meetSpaceEstimatedRevenue) : safe(summary.organizerNetEstimate);
  const potentialPrimary = isAdmin
    ? safe(summary.meetSpacePotentialRevenue ?? summary.meetSpaceEstimatedRevenue)
    : safe(summary.organizerPotentialNet ?? summary.organizerNetEstimate);

  const rows = isAdmin
    ? [
        {
          label: t("finance.directRoomRevenue"),
          confirmed: safe(summary.directRoomRevenue),
          potential: safe(summary.directRoomRevenue),
        },
        {
          label: t("finance.parkingRevenue"),
          confirmed: safe(summary.parkingRevenue),
          potential: safe(summary.parkingRevenue),
        },
        {
          label: t("finance.eventCommissions"),
          confirmed: safe(summary.eventCommissionRevenue),
          potential: safe(summary.eventPotentialCommissionRevenue ?? summary.eventCommissionRevenue),
        },
        {
          label: t("finance.roomCostChargedToOrganizers"),
          confirmed: safe(summary.roomCostChargedToOrganizers),
          potential: safe(summary.roomCostChargedToOrganizers),
        },
      ]
    : [
        {
          label: t("finance.ticketSales", { defaultValue: "Billetterie" }),
          confirmed: safe(summary.eventGrossRevenue),
          potential: safe(summary.eventPotentialGrossRevenue ?? summary.eventGrossRevenue),
        },
        {
          label: t("finance.meetSpaceCommission"),
          confirmed: -safe(summary.eventCommissionRevenue),
          potential: -safe(summary.eventPotentialCommissionRevenue ?? summary.eventCommissionRevenue),
        },
        {
          label: t("finance.roomCost"),
          confirmed: -safe(summary.roomCostChargedToOrganizers),
          potential: -safe(summary.roomCostChargedToOrganizers),
        },
      ];

  const totalCapacity = (summary.events || []).reduce((total, event) => total + safe(event.eventCapacity), 0);
  const occupancy = totalCapacity > 0 ? Math.round((safe(summary.confirmedParticipants) / totalCapacity) * 100) : 0;
  const signedMoney = (value) => `${value < 0 ? "−" : ""}${formatMoney(Math.abs(value))}`;

  return (
    <section className={styles.ledger} aria-labelledby={`finance-${variant}-title`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("finance.readingKey", { defaultValue: "Lecture financière" })}</p>
          <h2 id={`finance-${variant}-title`}>
            {isAdmin
              ? t("finance.adminLedgerTitle", { defaultValue: "Revenus MeetSpace" })
              : t("finance.organizerLedgerTitle", { defaultValue: "Projection organisateur" })}
          </h2>
        </div>
        <div className={styles.headerTools}>
          <span className={styles.commission}>
            {t("finance.commissionRate", { rate: Math.round(safe(summary.commissionRate) * 100) })}
          </span>
          <div className={styles.periods} role="group" aria-label={t("finance.periodLabel")}>
            {["all", "year", "30d"].map((period) => (
              <button
                key={period}
                type="button"
                className={activePeriod === period ? styles.periodActive : ""}
                onClick={() => changePeriod(period)}
                disabled={refreshing}
              >
                {t(`finance.period.${period}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {refreshError && <p className={styles.refreshError}>{t("finance.refreshError")}</p>}
      <div className={styles.cashMetrics}>
        <div>
          <span>{t("finance.grossCollected")}</span>
          <strong>{formatMoney(safe(summary.grossCollected))}</strong>
          <small>{t("finance.transactions", { count: safe(summary.transactionCount) })}</small>
        </div>
        <div>
          <span>{t("finance.refundedAmount")}</span>
          <strong>{formatMoney(safe(summary.refundedAmount))}</strong>
        </div>
        <div>
          <span>{t("finance.processingFees")}</span>
          <strong>{formatMoney(safe(summary.estimatedProcessingFees))}</strong>
        </div>
        <div>
          <span>{t("finance.netCashFlow")}</span>
          <strong>{formatMoney(safe(summary.netCashFlow))}</strong>
          <small>{t("finance.netCashFlowHint")}</small>
        </div>
        <div>
          <span>{t("finance.receivables")}</span>
          <strong>{formatMoney(safe(summary.outstandingReceivables))}</strong>
        </div>
      </div>

      <div className={styles.primaryFigures}>
        <div className={styles.primaryFigure}>
          <span>{t("finance.confirmedToday", { defaultValue: "Confirmé à ce jour" })}</span>
          <strong>{formatMoney(confirmedPrimary)}</strong>
          <small>
            {isAdmin
              ? t("finance.adminConfirmedHelp", { defaultValue: "Réservations et inscriptions confirmées" })
              : t("finance.organizerConfirmedHelp", { defaultValue: "Net calculé sur les participants confirmés" })}
          </small>
        </div>
        <div className={`${styles.primaryFigure} ${styles.potentialFigure}`}>
          <span>{t("finance.potentialAtCapacity", { defaultValue: "Potentiel à capacité" })}</span>
          <strong>{formatMoney(potentialPrimary)}</strong>
          <small>{t("finance.potentialHelp", { defaultValue: "Projection si les événements atteignent leur capacité" })}</small>
        </div>
      </div>

      <div className={styles.table} role="table" aria-label={t("finance.breakdown", { defaultValue: "Détail financier" })}>
        <div className={`${styles.row} ${styles.tableHead}`} role="row">
          <span role="columnheader">{t("finance.source", { defaultValue: "Source" })}</span>
          <span role="columnheader">{t("finance.confirmedShort", { defaultValue: "Confirmé" })}</span>
          <span role="columnheader">{t("finance.potentialShort", { defaultValue: "Potentiel" })}</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className={styles.row} role="row">
            <span role="cell">{row.label}</span>
            <strong role="cell">{signedMoney(row.confirmed)}</strong>
            <strong role="cell">{signedMoney(row.potential)}</strong>
          </div>
        ))}
        {!isAdmin && (
          <div className={`${styles.row} ${styles.netRow}`} role="row">
            <span role="cell">{t("finance.organizerNet", { defaultValue: "Net organisateur" })}</span>
            <strong role="cell">{formatMoney(confirmedPrimary)}</strong>
            <strong role="cell">{formatMoney(potentialPrimary)}</strong>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <div>
          <span>{t("finance.confirmedParticipants")}</span>
          <strong>{formatNumber(safe(summary.confirmedParticipants))}</strong>
        </div>
        <div>
          <span>{t("finance.portfolioOccupancy", { defaultValue: "Remplissage du portefeuille" })}</span>
          <strong>{formatNumber(occupancy)}%</strong>
        </div>
        <div>
          <span>{t("finance.vatIncluded", { rate: Math.round(safe(summary.vatRate) * 100) })}</span>
          <strong>{formatMoney(safe(summary.vatIncluded))}</strong>
          <small>{t("finance.excludingVat")}: {formatMoney(safe(summary.revenueExcludingVat))}</small>
        </div>
        <p>
          {isAdmin
            ? t("finance.adminFormula", { defaultValue: "Confirmé = salles + parking + 10 % de la billetterie confirmée + location des salles événementielles." })
            : t("finance.organizerFormula", { defaultValue: "Net = billetterie − commission MeetSpace (10 %) − coût de la salle." })}
        </p>
      </footer>
    </section>
  );
}
