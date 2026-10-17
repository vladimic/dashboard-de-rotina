import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, dayTitle, thirtyDayScale, valueLabelsPlugin } from './ChartCanvas';
import MaToggles, { maDataset, maTooltip } from './MaToggles';
import { dailyTrend, rollingByKey, thirtyDayAxis, TREND_UI } from '../../utils/health';
import styles from './Saude.module.css';

// One Health daily total (active energy, steps) as 30 bars with 7d / 30d
// moving averages and trend chips, like the sleep cards. `activity` is the
// app's activity object (days from activityDays(), loading, error, hasData);
// `field` picks the number out of each day. A day with neither steps nor
// energy never synced, so it's a gap rather than a zero.
export default function DailyBarCard({ title, tip, activity, field, unit, color, fmt, labelFmt = fmt, stableBelow, yStep, showMa7, showMa30, onToggle7, onToggle30 }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const byKey = useMemo(() => new Map(activity.days.map((d) => [d.key, d])), [activity.days]);
  const valueOf = useMemo(
    () => (key) => {
      const d = byKey.get(key);
      return d && (d.kcal > 0 || d.steps > 0) ? d[field] : null;
    },
    [byKey, field]
  );
  const today = valueOf(axis.at(-1).key);
  const trends = [7, 30].map((days) => ({ days, trend: dailyTrend(valueOf, days, stableBelow, new Date(), true) }));

  const config = useMemo(() => {
    const values = axis.map((d) => valueOf(d.key));
    const ma = { 7: rollingByKey(axis, valueOf, 7, true), 30: rollingByKey(axis, valueOf, 30, true) };
    const tipOpts = maTooltip(ma[7], ma[30], (v) => `${fmt(v)} ${unit}`);
    return {
      type: 'bar',
      data: {
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase()]),
        datasets: [
          { data: values, backgroundColor: color, borderRadius: 3, barPercentage: 0.75 },
          ...[7, 30].filter((d) => (d === 7 ? showMa7 : showMa30)).map((d) => maDataset(d, ma[d])),
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tipOpts,
            callbacks: {
              ...tipOpts.callbacks,
              title: (items) => dayTitle(axis, items[0].dataIndex),
              label: (item) => `${fmt(item.parsed.y)} ${unit}`,
            },
          },
        },
        scales: {
          x: thirtyDayScale(axis, 9),
          y: { min: 0, grid: { color: GRID_COLOR }, ticks: { stepSize: yStep, callback: (v) => labelFmt(v) } },
        },
      },
      plugins: [valueLabelsPlugin(axis, values, labelFmt, { minHorizontal: 22 })],
    };
  }, [axis, valueOf, color, fmt, labelFmt, unit, yStep, showMa7, showMa30]);

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip={tip}>
            {title}
          </span>
          <span className={styles.bigValue}>
            {today != null ? fmt(today) : '–'}
            <span className={styles.unit}> {unit}</span>
          </span>
          <div className={styles.trends}>
            {trends.map(({ days, trend }) => (
              <span
                key={days}
                className={styles.trend}
                data-tone={!trend || trend.direction === 'stable' ? 'flat' : trend.direction === 'up' ? 'good' : 'bad'}
                data-tip={trend ? `Média dos ${days} dias até ontem (hoje não conta): ${fmt(trend.avg)} ${unit}. Média anterior (até anteontem): ${fmt(trend.prevAvg)} ${unit} · ${TREND_UI[trend.direction].label}` : `${days} dias: dados insuficientes`}
              >
                {days}
                <b>{trend ? TREND_UI[trend.direction].symbol : '–'}</b>
                {trend && <span className={styles.trendValue}>{labelFmt(trend.avg)}</span>}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.headerRight}>
          <MaToggles show7={showMa7} show30={showMa30} onToggle7={onToggle7} onToggle30={onToggle30} />
        </div>
      </div>
      {activity.error && <div className={styles.error}>Não deu pra carregar: {activity.error}</div>}
      {!activity.error && !activity.loading && !activity.hasData ? (
        <div className={styles.empty}>Sem dados ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      ) : (
        <ChartCanvas config={config} height={150} />
      )}
    </div>
  );
}
