import { useMemo, useState } from 'react';
import ChartCanvas, { GRID_COLOR } from './ChartCanvas';
import { dailyWeights, formatKg as kg, movingAverage, TREND_UI, weightTrends } from '../../utils/health';
import styles from './Saude.module.css';

const PERIODS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '365d' },
  { days: 0, label: 'Geral' },
];

const COLORS = { weight: '#2f9e6f', ma7: 'rgba(229, 160, 58, 0.75)', ma30: 'rgba(107, 95, 199, 0.65)' };

const DAY_MS = 86400000;

const dayMonth = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
const dayMonthYear = (t) =>
  new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo' });

// Spacing between x-axis dates per period, so ticks land on evenly spaced
// days instead of wherever Chart.js's auto-skip happens to leave them.
const TICK_STEP_DAYS = { 7: 1, 30: 5, 90: 15 };

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// 365d / Geral: one tick on the 1st of every `stepMonths`-th month
// (labelled "out/26") instead of arbitrary day counts.
function monthTicks(min, max, stepMonths) {
  const ticks = [];
  const d = new Date(max);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  for (;;) {
    const t = Date.UTC(y, m, 1, 15); // noon in São Paulo
    if (t < min) break;
    if (t <= max) ticks.unshift({ value: t });
    m -= stepMonths;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
  }
  return ticks;
}

const monthYear = (t) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
};

// Evenly spaced ticks counted back from `max` in whole days (noon, like
// the plotted daily points), so the most recent date always gets a label.
function evenTicks(min, max, stepDays) {
  const ticks = [];
  for (let t = max; t >= min; t -= stepDays * DAY_MS) ticks.unshift({ value: t });
  return ticks;
}

// Horizontal dashed line at the current weight, across the whole chart.
function currentWeightLine(value) {
  return {
    id: 'currentWeight',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const y = scales.y.getPixelForValue(value);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(217, 83, 79, 0.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    },
  };
}

export default function WeightCard({ samples, loading, error, showMa7, showMa30, onToggleMa }) {
  const [periodDays, setPeriodDays] = useState(30);

  const daily = useMemo(() => dailyWeights(samples), [samples]);
  const ma7 = useMemo(() => movingAverage(daily, 7), [daily]);
  const ma30 = useMemo(() => movingAverage(daily, 30), [daily]);
  const trends = useMemo(() => weightTrends(daily), [daily]);

  const latest = samples.at(-1);
  // Memoized so the chart config (and the chart itself) isn't rebuilt on
  // every render just because Date.now() moved.
  const minT = useMemo(() => (periodDays ? Date.now() - periodDays * DAY_MS : -Infinity), [periodDays]);
  const firstInPeriod = daily.find((p) => p.t >= minT);

  const config = useMemo(() => {
    const inRange = (p) => p.t >= minT;
    const todayNoon = daily.length ? Math.max(daily.at(-1).t, new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}T12:00:00-03:00`).getTime()) : Date.now();
    const xMin = periodDays ? minT : daily[0]?.t;
    const stepDays = TICK_STEP_DAYS[periodDays];
    const stepMonths = periodDays === 365 ? 2 : Math.max(1, Math.ceil((todayNoon - xMin) / DAY_MS / 30.4 / 6));
    const xy = (points) => points.filter(inRange).map((p) => ({ x: p.t, y: Math.round(p.value * 100) / 100 }));
    return {
      type: 'line',
      data: {
        datasets: [
          { label: 'Peso', data: xy(daily), borderColor: COLORS.weight, backgroundColor: 'rgba(47, 158, 111, 0.08)', fill: true, borderWidth: 1.5, pointRadius: periodDays && periodDays <= 30 ? 2.5 : 0, tension: 0.25 },
          { label: 'Média 7d', data: xy(ma7), borderColor: COLORS.ma7, borderWidth: 1.75, borderDash: [5, 4], pointRadius: 0, tension: 0.3, hidden: !showMa7 },
          { label: 'Média 30d', data: xy(ma30), borderColor: COLORS.ma30, borderWidth: 1.75, borderDash: [5, 4], pointRadius: 0, tension: 0.3, hidden: !showMa30 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        // Room for the last date label, which sits right on the edge.
        layout: { padding: { right: 14 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => dayMonthYear(items[0].parsed.x),
              label: (item) => `${item.dataset.label}: ${kg(item.parsed.y)} kg`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            // Explicit bounds — left to itself the linear scale rounds out
            // to "nice" numbers months past either end of the data.
            min: xMin,
            max: todayNoon,
            grid: { display: false },
            afterBuildTicks: (scale) => {
              scale.ticks = stepDays ? evenTicks(scale.min, scale.max, stepDays) : monthTicks(scale.min, scale.max, stepMonths);
            },
            ticks: { autoSkip: false, maxRotation: 0, callback: (v) => (stepDays ? dayMonth(v) : monthYear(v)) },
          },
          y: { grid: { color: GRID_COLOR }, ticks: { callback: (v) => kg(v) } },
        },
      },
      plugins: daily.length ? [currentWeightLine(daily.at(-1).value)] : [],
    };
  }, [daily, ma7, ma30, periodDays, minT, showMa7, showMa30]);

  const delta = firstInPeriod && latest ? daily.at(-1).value - firstInPeriod.value : null;

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Peso</span>
          {latest && (
            <span className={styles.bigValue}>
              {kg(latest.value)}
              <span className={styles.unit}> kg</span>
            </span>
          )}
          <div className={styles.trends}>
            {trends.map(({ days, trend }) => {
              const ui = trend ? TREND_UI[trend.direction] : null;
              return (
                <span
                  key={days}
                  className={styles.trend}
                  data-dir={trend?.direction || 'none'}
                  title={ui ? `${days} dias: ${ui.label}` : `${days} dias: pesagens insuficientes`}
                >
                  {days}
                  <b>{ui ? ui.symbol : '–'}</b>
                </span>
              );
            })}
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pills}>
            <button type="button" className={styles.maToggle} data-on={showMa7} onClick={() => onToggleMa('weightShowMa7')} title="Média móvel de 7 dias">
              <i style={{ borderColor: COLORS.ma7 }} />
              7d
            </button>
            <button type="button" className={styles.maToggle} data-on={showMa30} onClick={() => onToggleMa('weightShowMa30')} title="Média móvel de 30 dias">
              <i style={{ borderColor: COLORS.ma30 }} />
              30d
            </button>
          </div>
          <div className={styles.pills}>
            {PERIODS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={styles.pill}
                data-on={periodDays === p.days}
                onClick={() => setPeriodDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar o peso: {error}</div>}
      {!error && !loading && samples.length === 0 && (
        <div className={styles.empty}>Nenhuma pesagem ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}
      {samples.length > 0 && <ChartCanvas config={config} height={260} />}

      {samples.length > 0 && (
        <div className={styles.footer}>
          {firstInPeriod ? (
            <span className={styles.muted}>
              início {dayMonthYear(firstInPeriod.t)}: <b className={styles.strong}>{kg(firstInPeriod.value)} kg</b>
              {delta != null && (
                <>
                  {' · '}variação{' '}
                  <b className={styles.delta} data-dir={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}>
                    {delta > 0 ? '+' : ''}
                    {kg(delta)} kg
                  </b>
                </>
              )}
            </span>
          ) : (
            <span className={styles.muted}>sem pesagens neste período</span>
          )}
          <span className={styles.footerRight}>
            última pesagem {dayMonthYear(latest.t)}
          </span>
        </div>
      )}
    </div>
  );
}
