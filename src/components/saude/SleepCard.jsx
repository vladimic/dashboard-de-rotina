import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, thirtyDayScale } from './ChartCanvas';
import MaToggles, { maDataset, maTooltip } from './MaToggles';
import { formatDuration, rollingByKey, sleepTrend, thirtyDayAxis, TREND_UI } from '../../utils/health';
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
// sleepNights() output, keyed by the day you woke up. "Acordado" can be
// hidden so each bar's height is just the time actually asleep.
// Writes each night's time asleep above its bar as h:mm ("7:07") — above the
// "acordado" slice too when that's showing. Narrow bars get it vertical.
const hourMinute = (min) => `${Math.floor(Math.round(min) / 60)}:${String(Math.round(min) % 60).padStart(2, '0')}`;

function sleepLabelsPlugin(axis, nights) {
  return {
    id: 'sleepLabels',
    afterDatasetsDraw(chart) {
      const { ctx, scales, chartArea } = chart;
      const horizontal = chartArea.width / axis.length >= 22;
      ctx.save();
      ctx.fillStyle = '#3f6b57';
      ctx.font = '600 9px Inter, sans-serif';
      axis.forEach((day, i) => {
        const night = nights.get(day.key);
        if (!night) return;
        let total = 0;
        chart.data.datasets.forEach((ds, di) => {
          if (ds.type !== 'line' && chart.isDatasetVisible(di)) total += ds.data[i] || 0;
        });
        const x = scales.x.getPixelForValue(i);
        const y = scales.y.getPixelForValue(total) - 3;
        const text = hourMinute(night.asleepMin);
        if (horizontal) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(text, x, y);
        } else {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      });
      ctx.restore();
    },
  };
}

export default function SleepCard({ nights, loading, error, showAwake, onToggleAwake, showMa7, showMa30, onToggleFlag }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const trends = [7, 30].map((days) => ({ days, trend: sleepTrend(nights, days) }));
  const hasUnstaged = axis.some((d) => nights.get(d.key)?.stages.asleep > 0);
  // Memoized so the chart config below isn't rebuilt on every render.
  const stages = useMemo(
    () => STAGES.filter((s) => (s.key !== 'asleep' || hasUnstaged) && (s.key !== 'awake' || showAwake)),
    [hasUnstaged, showAwake]
  );
  const last = [...nights.values()].sort((a, b) => a.key.localeCompare(b.key)).at(-1);

  const config = useMemo(() => {
    const valueOf = (k) => (nights.has(k) ? nights.get(k).asleepMin / 60 : null);
    const ma = { 7: rollingByKey(axis, valueOf, 7), 30: rollingByKey(axis, valueOf, 30) };
    const tip = maTooltip(ma[7], ma[30], (v) => formatDuration(v * 60));
    return {
      type: 'bar',
      data: {
        // Half-width chart: weekday as its initial (S, T, Q...) so the 30
        // columns don't run into each other.
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
        datasets: [
          ...stages.map((s) => ({
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
          ...[7, 30]
            .filter((d) => (d === 7 ? showMa7 : showMa30))
            .map((d) => maDataset(d, ma[d])),
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'start',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              padding: 8,
              font: { size: 10 },
              // Stage swatches only — not the moving-average lines.
              filter: (item) => item.datasetIndex < stages.length && item.text !== 'Acordado',
            },
          },
          tooltip: {
            ...tip,
            callbacks: {
              ...tip.callbacks,
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
          y: { stacked: true, beginAtZero: true, suggestedMax: 10, grid: { color: GRID_COLOR }, ticks: { stepSize: 1, autoSkip: false, callback: (v) => `${v}:00` } },
        },
      },
      plugins: [sleepLabelsPlugin(axis, nights)],
    };
  }, [axis, nights, stages, showMa7, showMa30]);

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="Sono: tempo dormindo por noite, empilhado por fase (profundo, essencial, REM; e acordado, se ligado). O número grande é a última noite; 7 e 30 comparam a média móvel de hoje com a de ontem.">Sono</span>
          {last && <span className={styles.bigValue}>{formatDuration(last.asleepMin)}</span>}
          <div className={styles.trends}>
            {trends.map(({ days, trend }) => {
              const ui = trend ? TREND_UI[trend.direction] : null;
              // More sleep is the good direction here (the opposite of weight).
              const tone = !trend || trend.direction === 'stable' ? 'flat' : trend.direction === 'up' ? 'good' : 'bad';
              return (
                <span
                  key={days}
                  className={styles.trend}
                  data-tone={tone}
                  data-tip={trend ? `Média dos últimos ${days} dias: ${formatDuration(trend.avg)} por noite. Média de ontem: ${formatDuration(trend.prevAvg)} · ${ui.label}` : `${days} dias: noites insuficientes`}
                >
                  {days}
                  <b>{ui ? ui.symbol : '–'}</b>
                  {trend && <span className={styles.trendValue}>{formatDuration(trend.avg)}</span>}
                </span>
              );
            })}
          </div>
        </div>
        {nights.size > 0 && (
          <div className={styles.headerRight}>
            <MaToggles show7={showMa7} show30={showMa30} onToggle7={() => onToggleFlag('sleepShowMa7')} onToggle30={() => onToggleFlag('sleepShowMa30')} />
            <button type="button" className={styles.maToggle} data-on={showAwake} onClick={onToggleAwake} title="Mostrar o tempo acordado em cima das barras">
              <i style={{ borderTop: 'none', height: 8, width: 8, borderRadius: 2, background: '#f0a487' }} />
              Acordado
            </button>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>Não deu pra carregar o sono: {error}</div>}
      {!error && !loading && nights.size === 0 && (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}
      {nights.size > 0 && <ChartCanvas config={config} height={240} />}
    </div>
  );
}
