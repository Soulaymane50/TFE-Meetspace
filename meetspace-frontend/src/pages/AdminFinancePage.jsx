import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { adminGetFinanceSummary, adminGetFinanceTrend } from "../services/api";
import { formatMoney, formatNumber, normalizeLocale } from "../utils/formatters";
import PageState from "../components/PageState";
import WorkspaceNav from "../components/WorkspaceNav";
import styles from "./AdminFinancePage.module.css";

const PERIODS = ["30d", "90d", "year"];

function safe(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodRange(period) {
  const to = new Date();
  const from = new Date(to);
  if (period === "year") {
    from.setMonth(0, 1);
  } else {
    from.setDate(from.getDate() - (period === "30d" ? 29 : 89));
  }
  return { from: dateValue(from), to: dateValue(to) };
}

function LineChart({ points, metric, title, description, formatAxis, formatDate, tone = "brand", compact = false }) {
  const width = compact ? 480 : 860;
  const height = compact ? 220 : 320;
  const margin = { top: 18, right: 18, bottom: 40, left: compact ? 54 : 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = points.map((point) => safe(point[metric]));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const x = (index) => margin.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => margin.top + ((maxValue - value) / range) * plotHeight;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => maxValue - (range * index) / 4);
  const labelIndexes = [...new Set([0, Math.round((points.length - 1) * 0.25), Math.round((points.length - 1) * 0.5), Math.round((points.length - 1) * 0.75), points.length - 1])]
    .filter((index) => index >= 0);
  const latest = values.at(-1) || 0;

  return (
    <section className={`${styles.chartCard} ${compact ? styles.compactChart : styles.mainChart}`}>
      <header className={styles.chartHeader}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <strong>{formatAxis(latest, false)}</strong>
      </header>
      {points.length ? (
        <svg
          className={`${styles.lineChart} ${styles[tone]}`}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}. ${description}`}
        >
          <title>{title}</title>
          <desc>{description}</desc>
          {yTicks.map((tick, index) => {
            const tickY = margin.top + (index / 4) * plotHeight;
            return (
              <g key={`${tick}-${index}`}>
                <line className={styles.gridLine} x1={margin.left} x2={width - margin.right} y1={tickY} y2={tickY} />
                <text className={styles.axisText} x={margin.left - 10} y={tickY + 4} textAnchor="end">{formatAxis(tick, true)}</text>
              </g>
            );
          })}
          {labelIndexes.map((index) => (
            <g key={index}>
              <line className={styles.verticalGridLine} x1={x(index)} x2={x(index)} y1={margin.top} y2={height - margin.bottom} />
              <text className={styles.axisText} x={x(index)} y={height - 13} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>
                {formatDate(points[index]?.date)}
              </text>
            </g>
          ))}
          <path className={styles.dataLine} d={path} />
          {points.map((point, index) => (
            <circle key={point.date} className={styles.dataPoint} cx={x(index)} cy={y(values[index])} r={compact ? 3.2 : 3.8}>
              <title>{formatDate(point.date)} : {formatAxis(values[index], false)}</title>
            </circle>
          ))}
          <circle className={styles.latestPoint} cx={x(points.length - 1)} cy={y(latest)} r={compact ? 4.5 : 5.5} />
        </svg>
      ) : (
        <p className={styles.emptyChart}>Aucune donnée sur cette période.</p>
      )}
    </section>
  );
}

export default function AdminFinancePage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState("90d");
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);

  const locale = normalizeLocale(i18n.language);
  const formatEuro = useCallback((value) => formatMoney(value, locale), [locale]);
  const formatStat = useCallback((value) => formatNumber(value, locale), [locale]);
  const moneyAxis = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }), [locale]);
  const countAxis = useMemo(() => new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }), [locale]);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }), [locale]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }), [locale]);
  const fullDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }), [locale]);

  const loadFinance = useCallback(async (nextPeriod) => {
    setLoading(true);
    setError("");
    try {
      const range = periodRange(nextPeriod);
      const [summaryResult, trendResult] = await Promise.all([
        adminGetFinanceSummary(token, range),
        adminGetFinanceTrend(token, range),
      ]);
      setSummary(summaryResult);
      setTrend(trendResult);
      setShowAllRows(false);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        navigate("/login", { replace: true });
        return;
      }
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      navigate("/login", { replace: true });
      return;
    }
    loadFinance(period);
  }, [loadFinance, navigate, period, user]);

  const changePeriod = (nextPeriod) => {
    if (nextPeriod !== period && !loading) setPeriod(nextPeriod);
  };

  if (loading && !summary) {
    return <PageState type="loading" title={t("adminFinance.loadingTitle")} message={t("adminFinance.loadingMessage")} />;
  }
  if (error && !summary) {
    return <PageState type="error" title={t("adminFinance.errorTitle")} message={error} actionLabel={t("common.retry")} onAction={() => loadFinance(period)} />;
  }
  if (!summary || !trend) return null;

  const points = trend.points || [];
  const formatChartDate = (date) => {
    if (!date) return "";
    const parsed = new Date(`${date}T00:00:00`);
    return trend.granularity === "MONTH" ? monthFormatter.format(parsed) : dayFormatter.format(parsed);
  };
  const sourceRows = [
    { label: t("finance.directRoomRevenue"), value: safe(summary.directRoomRevenue) },
    { label: t("finance.parkingRevenue"), value: safe(summary.parkingRevenue) },
    { label: t("finance.eventCommissions"), value: safe(summary.eventCommissionRevenue) },
    { label: t("finance.roomCostChargedToOrganizers"), value: safe(summary.roomCostChargedToOrganizers) },
  ];
  const maxSource = Math.max(1, ...sourceRows.map((row) => row.value));
  const detailRows = [...points].reverse();
  const visibleRows = showAllRows ? detailRows : detailRows.slice(0, 12);
  const rankedEvents = [...(summary.events || [])]
    .sort((left, right) => (
      safe(right.meetSpaceCommission) + safe(right.roomCost)
    ) - (
      safe(left.meetSpaceCommission) + safe(left.roomCost)
    ));
  const periodLabel = `${fullDateFormatter.format(new Date(`${trend.from}T00:00:00`))} — ${fullDateFormatter.format(new Date(`${trend.to}T00:00:00`))}`;

  return (
    <div className={styles.container} data-testid="admin-finance">
      <WorkspaceNav scope="admin" />
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>{t("adminFinance.kicker")}</p>
          <h1>{t("adminFinance.title")}</h1>
          <p>{t("adminFinance.subtitle")}</p>
        </div>
        <div className={styles.periodControl}>
          <span>{periodLabel}</span>
          <div role="group" aria-label={t("finance.periodLabel")}>
            {PERIODS.map((item) => (
              <button
                type="button"
                key={item}
                className={period === item ? styles.periodActive : ""}
                onClick={() => changePeriod(item)}
                disabled={loading}
                aria-pressed={period === item}
              >
                {t(`adminFinance.period.${item}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && <p className={styles.inlineError}>{error}</p>}

      <section className={styles.kpiRail} aria-label={t("adminFinance.keyFigures")}>
        <article className={styles.primaryKpi}>
          <span>{t("finance.adminRevenueConfirmed")}</span>
          <strong>{formatEuro(safe(summary.meetSpaceEstimatedRevenue))}</strong>
          <small>{t("adminFinance.commercialRevenueHelp")}</small>
        </article>
        <article>
          <span>{t("finance.netCashFlow")}</span>
          <strong>{formatEuro(safe(summary.netCashFlow))}</strong>
          <small>{t("adminFinance.cashHelp")}</small>
        </article>
        <article className={safe(summary.outstandingReceivables) > 0 ? styles.attentionKpi : ""}>
          <span>{t("finance.receivables")}</span>
          <strong>{formatEuro(safe(summary.outstandingReceivables))}</strong>
          <small>{t("adminFinance.receivablesHelp")}</small>
        </article>
        <article>
          <span>{t("adminFinance.transactions")}</span>
          <strong>{formatStat(safe(summary.transactionCount))}</strong>
          <small>{t("adminFinance.transactionsHelp")}</small>
        </article>
      </section>

      <section className={styles.analyticsGrid} aria-label={t("adminFinance.chartsTitle")}>
        <LineChart
          points={points}
          metric="platformRevenue"
          title={t("adminFinance.revenueTrend")}
          description={t("adminFinance.revenueTrendHelp")}
          formatAxis={(value, compact) => compact ? moneyAxis.format(value) : formatEuro(value)}
          formatDate={formatChartDate}
        />
        <div className={styles.sideCharts}>
          <LineChart
            points={points}
            metric="netCashFlow"
            title={t("adminFinance.cashTrend")}
            description={t("adminFinance.cashTrendHelp")}
            formatAxis={(value, compact) => compact ? moneyAxis.format(value) : formatEuro(value)}
            formatDate={formatChartDate}
            tone="cash"
            compact
          />
          <LineChart
            points={points}
            metric="transactionCount"
            title={t("adminFinance.transactionTrend")}
            description={t("adminFinance.transactionTrendHelp")}
            formatAxis={(value, compact) => compact ? countAxis.format(value) : formatStat(value)}
            formatDate={formatChartDate}
            tone="transactions"
            compact
          />
        </div>
      </section>

      <section className={styles.explanationGrid}>
        <article className={styles.sourcePanel}>
          <header>
            <p>{t("adminFinance.revenueSourcesKicker")}</p>
            <h2>{t("finance.adminSourceTitle")}</h2>
            <span>{t("finance.adminSourceHelp")}</span>
          </header>
          <div className={styles.sourceList}>
            {sourceRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{formatEuro(row.value)}</strong>
                <i aria-hidden="true"><b style={{ width: `${Math.max(2, (row.value / maxSource) * 100)}%` }} /></i>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.cashPanel}>
          <header>
            <p>{t("adminFinance.cashKicker")}</p>
            <h2>{t("adminFinance.cashDetailTitle")}</h2>
            <span>{t("adminFinance.cashDetailHelp")}</span>
          </header>
          <dl>
            <div><dt>{t("finance.grossCollected")}</dt><dd>{formatEuro(safe(summary.grossCollected))}</dd></div>
            <div className={styles.subtracted}><dt>{t("finance.refundedAmount")}</dt><dd>− {formatEuro(safe(summary.refundedAmount))}</dd></div>
            <div className={styles.subtracted}><dt>{t("finance.processingFees")}</dt><dd>− {formatEuro(safe(summary.estimatedProcessingFees))}</dd></div>
            <div className={styles.cashTotal}><dt>{t("finance.netCashFlow")}</dt><dd>{formatEuro(safe(summary.netCashFlow))}</dd></div>
          </dl>
          <p className={styles.cashNote}>{t("adminFinance.refundNote")}</p>
        </article>
      </section>

      <section className={styles.detailSection}>
        <header className={styles.sectionHeader}>
          <div>
            <p>{t("adminFinance.historyKicker")}</p>
            <h2>{t("adminFinance.historyTitle")}</h2>
            <span>{t("adminFinance.historyHelp")}</span>
          </div>
          {detailRows.length > 12 && (
            <button type="button" onClick={() => setShowAllRows((current) => !current)}>
              {showAllRows ? t("adminFinance.showRecent") : t("adminFinance.showAll", { count: detailRows.length })}
            </button>
          )}
        </header>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t("adminFinance.historyTitle")}>
          <table>
            <thead>
              <tr>
                <th>{t("adminFinance.periodColumn")}</th>
                <th>{t("adminFinance.platformRevenueColumn")}</th>
                <th>{t("finance.grossCollected")}</th>
                <th>{t("finance.refundedAmount")}</th>
                <th>{t("finance.processingFees")}</th>
                <th>{t("finance.netCashFlow")}</th>
                <th>{t("adminFinance.transactions")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatChartDate(point.date)}</th>
                  <td>{formatEuro(safe(point.platformRevenue))}</td>
                  <td>{formatEuro(safe(point.grossCollected))}</td>
                  <td>{formatEuro(safe(point.refundedAmount))}</td>
                  <td>{formatEuro(safe(point.processingFees))}</td>
                  <td><strong>{formatEuro(safe(point.netCashFlow))}</strong></td>
                  <td>{formatStat(safe(point.transactionCount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.eventSection}>
        <header className={styles.sectionHeader}>
          <div>
            <p>{t("adminFinance.eventsKicker")}</p>
            <h2>{t("adminFinance.eventsTitle")}</h2>
            <span>{t("adminFinance.eventsHelp")}</span>
          </div>
        </header>
        <div className={styles.eventList}>
          {rankedEvents.slice(0, 8).map((event) => {
            const contribution = safe(event.meetSpaceCommission) + safe(event.roomCost);
            return (
              <div key={event.eventId}>
                <span><strong>{event.eventTitle}</strong><small>{event.organizerName || "—"} · {event.roomName || t("finance.roomNotAssigned")}</small></span>
                <span><small>{t("finance.fillColumn")}</small><strong>{formatStat(safe(event.occupancyRate))}%</strong></span>
                <span><small>{t("finance.platformContribution")}</small><strong>{formatEuro(contribution)}</strong></span>
              </div>
            );
          })}
          {!summary.events?.length && <p>{t("finance.noFinancialEvents")}</p>}
        </div>
      </section>
    </div>
  );
}
