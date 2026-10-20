import { useMemo, useState } from 'react';
import ChartCanvas, { GRID_COLOR, dayTitle, thirtyDayScale } from './ChartCanvas';
import EntryEditor, { EditButton } from './EntryEditor';
import MaToggles, { maDataset, maTooltip } from './MaToggles';
import { entryKeys, formatDuration, pendingEntryKeys, rollingByKey, sleepTrend, thirtyDayAxis, TREND_UI } from '../../utils/health';
import styles from './Saude.module.css';

// Stacked bottom-up in this order; "Dormindo" is sleep logged without stage
// detail (iPhone-only nights, older data).
const STAGES = [
  { key: 'deep', label: 'Profundo', color: '#4b3fa8' },
  { key: 'core', label: 'Essencial', color: '#8f86e0' },
  { key: 'rem', label: 'REM', color: '#c4bef5' },
  { key: 'asleep', label: 'Dormindo', color: '#a9a3c9' },
  { key: 'awake', label: 'Acordado', color: '#2fa39a' },
];

// Header key for the stacked stages (full name, or the short one when the
// card is narrow). "Acordado" is its own on/off button next to these.
const LEGEND = [
  { key: 'deep', full: 'Profundo', short: 'Prof.', color: '#4b3fa8' },
  { key: 'core', full: 'Essencial', short: 'Ess.', color: '#8f86e0' },
  { key: 'rem', full: 'REM', short: 'REM', color: '#c4bef5' },
  { key: 'asleep', full: 'Dormindo', short: 'Dorm.', color: '#a9a3c9' },
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

export default function SleepCard({ nights, loading, error, skipped, onSkip, onClear, showAwake, onToggleAwake, showMa7, showMa30, onToggleFlag }) {
  const [editing, setEditing] = useState(false);
  const keys = useMemo(() => entryKeys(), []);
  const byDay = useMemo(() => Object.fromEntries([...nights].map(([key, n]) => [key, n.asleepMin])), [nights]);
  const pendingCount = pendingEntryKeys(keys, byDay, skipped).length;
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
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase()]),
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
          legend: { display: false },
          tooltip: {
            ...tip,
            callbacks: {
              ...tip.callbacks,
              title: (items) => {
                const night = nights.get(axis[items[0].dataIndex].key);
                const day = dayTitle(axis, items[0].dataIndex);
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
        <div className={styles.headerRight}>
          {nights.size > 0 && (
            <>
              {LEGEND.filter((l) => l.key !== 'asleep' || hasUnstaged).map((l) => (
                <span key={l.key} className={styles.stageKey} title={l.full}>
                  <i style={{ background: l.color }} />
                  <span className={styles.keyFull}>{l.full}</span>
                  <span className={styles.keyShort}>{l.short}</span>
                </span>
              ))}
              <button
                type="button"
                className={`${styles.stageKey} ${styles.stageKeyBtn}`}
                data-on={showAwake}
                onClick={onToggleAwake}
                title="Mostrar o tempo acordado em cima das barras"
              >
                <i style={{ background: '#2fa39a' }} />
                <span className={styles.keyFull}>Acordado</span>
                <span className={styles.keyShort}>Acord.</span>
              </button>
              <MaToggles show7={showMa7} show30={showMa30} onToggle7={() => onToggleFlag('sleepShowMa7')} onToggle30={() => onToggleFlag('sleepShowMa30')} />
            </>
          )}
          <EditButton pendingCount={pendingCount} onClick={() => setEditing(true)} />
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar o sono: {error}</div>}
      {!error && !loading && nights.size === 0 && (
        <div className={styles.empty}>Nenhuma noite ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      )}
      {nights.size > 0 && <ChartCanvas config={config} height={200} />}
      {editing && (
        <EntryEditor
          title="Sono · acordou em"
          synced
          keys={keys}
          log={byDay}
          skipped={skipped}
          format={formatDuration}
          onSkip={onSkip}
          onClear={onClear}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
