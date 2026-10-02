import { useMemo, useState } from 'react';
import ChartCanvas, { GRID_COLOR } from './ChartCanvas';
import { dailyWeights, movingAverage, weightTrend } from '../../utils/health';
import styles from './Saude.module.css';

const PERIODS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '365d' },
  { days: 0, label: 'Geral' },
];

const TREND_DAYS = [7, 30, 90];

const TREND_UI = {
  up: { symbol: '↗', label: 'subindo' },
  down: { symbol: '↘', label: 'descendo' },
  stable: { symbol: '→', label: 'estável' },
};

const DAY_MS = 86400000;

const kg = (v) => v.toFixed(1).replace('.', ',');
const dayMonth = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
const dayMonthYear = (t) =>
  new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo' });

export default function WeightCard({ samples, loading, error, onRefresh }) {
  const [periodDays, setPeriodDays] = useState(30);

  const daily = useMemo(() => dailyWeights(samples), [samples]);
  const ma7 = useMemo(() => movingAverage(daily, 7), [daily]);
  const ma30 = useMemo(() => movingAverage(daily, 30), [daily]);
  const trends = useMemo(() => TREND_DAYS.map((days) => ({ days, trend: weightTrend(daily, days) })), [daily]);

  const latest = samples.at(-1);

  const config = useMemo(() => {
    const minT = periodDays ? Date.now() - periodDays * DAY_MS : -Infinity;
    const inRange = (p) => p.t >= minT;
    const xy = (points) => points.filter(inRange).map((p) => ({ x: p.t, y: Math.round(p.value * 100) / 100 }));
    const showYear = periodDays === 0 || periodDays === 365;
    return {
      type: 'line',
      data: {
        datasets: [
          { label: 'Peso', data: xy(daily), borderColor: '#2f9e6f', backgroundColor: 'rgba(47, 158, 111, 0.08)', fill: true, borderWidth: 1.5, pointRadius: periodDays && periodDays <= 30 ? 2.5 : 0, tension: 0.25 },
          { label: 'Média 7d', data: xy(ma7), borderColor: '#e5a03a', borderWidth: 2, pointRadius: 0, tension: 0.3 },
          { label: 'Média 30d', data: xy(ma30), borderColor: '#6b5fc7', borderWidth: 2, pointRadius: 0, tension: 0.3 },
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
            max: Date.now(),
            grid: { display: false },
            ticks: { maxTicksLimit: 8, callback: (v) => (showYear ? dayMonthYear(v) : dayMonth(v)) },
          },
          y: { grid: { color: GRID_COLOR }, ticks: { callback: (v) => kg(v) } },
        },
      },
    };
  }, [daily, ma7, ma30, periodDays]);

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
          <span className={styles.legend}>
            <i style={{ background: '#2f9e6f' }} />
            Peso
          </span>
          <span className={styles.legend}>
            <i style={{ background: '#e5a03a' }} />
            Média 7d
          </span>
          <span className={styles.legend}>
            <i style={{ background: '#6b5fc7' }} />
            Média 30d
          </span>
          <span className={styles.footerRight}>
            última pesagem {dayMonthYear(latest.t)} · {samples.length} registros
          </span>
        </div>
      )}
    </div>
  );
}
