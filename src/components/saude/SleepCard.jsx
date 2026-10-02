import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { formatDuration, thirtyDayAxis } from '../../utils/health';
import styles from './Saude.module.css';

// Stacked bottom-up in this order; "Dormindo" is sleep logged without stage
// detail (iPhone-only nights, older data).
const STAGES = [
  { key: 'deep', label: 'Profundo', color: '#4b3fa8' },
  { key: 'core', label: 'Essencial', color: '#8f86e0' },
  { key: 'rem', label: 'REM', color: '#c4bef5' },
  { key: 'asleep', label: 'Dormindo', color: '#a9a3c9' },
  { key: 'awake', label: 'Acordado', color: '#f0a487' },
];

// Last 30 nights: total sleep and how it splits across stages. `nights` is
// sleepNights() output, keyed by the day you woke up.
export default function SleepCard({ nights, loading, error }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const inWindow = axis.map((d) => nights.get(d.key)).filter(Boolean);
  const avg = inWindow.length ? inWindow.reduce((a, n) => a + n.asleepMin, 0) / inWindow.length : null;
  const last = [...nights.values()].sort((a, b) => a.key.localeCompare(b.key)).at(-1);
  const hasUnstaged = inWindow.some((n) => n.stages.asleep > 0);

  const config = useMemo(
    () => ({
      type: 'bar',
      data: {
        // Half-width chart: weekday as its initial (S, T, Q...) so the 30
        // columns don't run into each other.
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
        datasets: STAGES.filter((s) => s.key !== 'asleep' || hasUnstaged).map((s) => ({
          label: s.label,
          data: axis.map((d) => {
            const min = nights.get(d.key)?.stages[s.key];
            return min ? Math.round((min / 60) * 100) / 100 : null;
          }),
          backgroundColor: s.color,
          stack: 'sleep',
          barPercentage: 0.75,
          categoryPercentage: 0.9,
        })),
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const night = nights.get(axis[items[0].dataIndex].key);
                const day = axis[items[0].dataIndex].label.slice(0, 2).join(' ');
                return night ? `${day} · dormiu ${formatDuration(night.asleepMin)}` : day;
              },
              label: (item) => `${item.dataset.label}: ${formatDuration(item.parsed.y * 60)}`,
            },
          },
        },
        scales: {
          x: { ...thirtyDayScale(axis, 9), stacked: true },
          y: { stacked: true, beginAtZero: true, suggestedMax: 9, grid: { color: GRID_COLOR }, ticks: { stepSize: 2, callback: (v) => `${v}h` } },
        },
      },
      plugins: [monthDividerPlugin(axis)],
    }),
    [axis, nights, hasUnstaged]
  );

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Sono · 30 dias</span>
          {last && <span className={styles.bigValue}>{formatDuration(last.asleepMin)}</span>}
          {avg != null && <span className={styles.muted}>média {formatDuration(avg)}</span>}
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar o sono: {error}</div>}
      {!error && !loading && nights.size === 0 && (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}
      {nights.size > 0 && <ChartCanvas config={config} height={260} />}

      {nights.size > 0 && (
        <div className={styles.footer}>
          {STAGES.filter((s) => s.key !== 'asleep' || hasUnstaged).map((s) => (
            <span key={s.key} className={styles.legend}>
              <i style={{ background: s.color, height: 8, width: 8, borderRadius: 2 }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
