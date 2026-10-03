import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { qualityTrend, sleepQuality, thirtyDayAxis, TREND_UI } from '../../utils/health';
import styles from './Saude.module.css';

const bandColor = (score) => (score >= 80 ? '#3f9b6b' : score >= 60 ? '#e5a03a' : '#d9534f');

// Last 30 nights' sleep quality score (see sleepQuality for the formula).
export default function SleepQualityCard({ nights }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const hasNights = axis.some((d) => nights.has(d.key));
  const trends = [7, 30].map((days) => ({ days, trend: qualityTrend(nights, days) }));
  const last = [...nights.values()].sort((a, b) => a.key.localeCompare(b.key)).at(-1);
  const lastScore = last ? sleepQuality(last).score : null;

  const config = useMemo(() => {
    const quality = axis.map((d) => (nights.has(d.key) ? sleepQuality(nights.get(d.key)) : null));
    return {
      type: 'bar',
      data: {
        // Third-width chart: weekday as its initial (S, T, Q...).
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
        datasets: [
          {
            data: quality.map((q) => q?.score ?? null),
            backgroundColor: quality.map((q) => (q ? bandColor(q.score) : 'transparent')),
            borderRadius: 3,
            barPercentage: 0.75,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => axis[items[0].dataIndex].label.slice(0, 2).join(' '),
              label: (item) => {
                const q = quality[item.dataIndex];
                return [`Nota ${q.score}/100`, `Duração ${q.parts.duration}/50`, `Profundo + REM ${q.parts.restorative}/30`, `Pouco acordado ${q.parts.efficiency}/20`];
              },
            },
          },
        },
        scales: {
          x: thirtyDayScale(axis, 9),
          y: { min: 0, max: 100, grid: { color: GRID_COLOR }, ticks: { stepSize: 20 } },
        },
      },
      plugins: [monthDividerPlugin(axis)],
    };
  }, [axis, nights]);

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Qualidade do sono</span>
          {lastScore != null && <span className={styles.bigValue}>{lastScore}</span>}
          <div className={styles.trends}>
            {trends.map(({ days, trend }) => {
              const ui = trend ? TREND_UI[trend.direction] : null;
              const tone = !trend || trend.direction === 'stable' ? 'flat' : trend.direction === 'up' ? 'good' : 'bad';
              return (
                <span
                  key={days}
                  className={styles.trend}
                  data-tone={tone}
                  data-tip={trend ? `Média de ${days} dias: ${Math.round(trend.avg)} (ontem ${Math.round(trend.prevAvg)}) · ${ui.label}` : `${days} dias: noites insuficientes`}
                >
                  {days}
                  <b>{ui ? ui.symbol : '–'}</b>
                  {trend && <span className={styles.trendValue}>{Math.round(trend.avg)}</span>}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {hasNights ? (
        <ChartCanvas config={config} height={240} />
      ) : (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}
    </div>
  );
}
