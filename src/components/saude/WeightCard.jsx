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

const COLORS = { weight: '#2f9e6f', ma7: '#e5a03a', ma30: '#6b5fc7' };

const DAY_MS = 86400000;

const dayMonth = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
const dayMonthYear = (t) =>
  new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo' });

export default function WeightCard({ samples, loading, error, onRefresh }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [showMa7, setShowMa7] = useState(true);
  const [showMa30, setShowMa30] = useState(true);

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
    const xy = (points) => points.filter(inRange).map((p) => ({ x: p.t, y: Math.round(p.value * 100) / 100 }));
    const showYear = periodDays === 0 || periodDays === 365;
    return {
      type: 'line',
      data: {
        datasets: [
          { label: 'Peso', data: xy(daily), borderColor: COLORS.weight, backgroundColor: 'rgba(47, 158, 111, 0.08)', fill: true, borderWidth: 1.5, pointRadius: periodDays && periodDays <= 30 ? 2.5 : 0, tension: 0.25 },
          { label: 'Média 7d', data: xy(ma7), borderColor: COLORS.ma7, borderWidth: 2, pointRadius: 0, tension: 0.3, hidden: !showMa7 },
          { label: 'Média 30d', data: xy(ma30), borderColor: COLORS.ma30, borderWidth: 2, pointRadius: 0, tension: 0.3, hidden: !showMa30 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
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
            min: periodDays ? minT : daily[0]?.t,
            max: Math.max(Date.now(), daily.at(-1)?.t ?? 0),
            grid: { display: false },
            ticks: { maxTicksLimit: 6, callback: (v) => (showYear ? dayMonthYear(v) : dayMonth(v)) },
          },
          y: { grid: { color: GRID_COLOR }, ticks: { callback: (v) => kg(v) } },
        },
      },
    };
  }, [daily, ma7, ma30, periodDays, minT, showMa7, showMa30]);

  const delta = firstInPeriod && latest ? daily.at(-1).value - firstInPeriod.value : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
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
                  {days}d <b>{ui ? ui.symbol : '–'}</b>
                </span>
              );
            })}
          </div>
        </div>
        <div className={styles.headerRight}>
          <button type="button" className={styles.maToggle} data-on={showMa7} onClick={() => setShowMa7((v) => !v)}>
            <i style={{ background: COLORS.ma7 }} />
            Média 7d
          </button>
          <button type="button" className={styles.maToggle} data-on={showMa30} onClick={() => setShowMa30((v) => !v)}>
            <i style={{ background: COLORS.ma30 }} />
            Média 30d
          </button>
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
          <button type="button" className={styles.refresh} onClick={onRefresh} title="Recarregar">
            ⟳
          </button>
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
                  <b className={styles.strong}>
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
            última pesagem {dayMonthYear(latest.t)} · {samples.length} registros
          </span>
        </div>
      )}
    </div>
  );
}
