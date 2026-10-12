import { useMemo, useState } from 'react';
import ChartCanvas, { GRID_COLOR, dayTitle, thirtyDayScale, valueLabelsPlugin } from './ChartCanvas';
import EntryEditor, { EditButton } from './EntryEditor';
import MaToggles, { maDataset, maTooltip } from './MaToggles';
import { entryKeys, iahBand, iahTrend, pendingEntryKeys, rollingByKey, thirtyDayAxis, TREND_UI } from '../../utils/health';
import styles from './Saude.module.css';

const num = (v) => v.toFixed(1).replace('.', ',');

const BAND_COLOR = { normal: '#2f8a5c', leve: '#c58a1f', moderado: '#d9772f', grave: '#d9534f' };

// CPAP apnea-hypopnea index, typed in by hand. `log` maps "YYYY-MM-DD" (the
// day you woke up, like sleep and quality) → value.
export default function IahCard({ log, skipped, onSave, onSkip, onClear, showMa7, showMa30, onToggleFlag }) {
  const [editing, setEditing] = useState(false);
  const keys = useMemo(() => entryKeys(), []);
  const pendingCount = pendingEntryKeys(keys, log, skipped).length;

  const axis = useMemo(() => thirtyDayAxis(), []);
  const trends = [7, 30].map((days) => ({ days, trend: iahTrend(log, days) }));

  const lastKey = Object.keys(log).sort().at(-1);
  const last = lastKey ? log[lastKey] : null;

  const config = useMemo(() => {
    const ma = { 7: rollingByKey(axis, (k) => log[k] ?? null, 7), 30: rollingByKey(axis, (k) => log[k] ?? null, 30) };
    const tip = maTooltip(ma[7], ma[30], num);
    return {
      type: 'line',
      data: {
        // Third-width chart: weekday as its initial (S, T, Q...).
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase()]),
        datasets: [
          {
            label: 'IAH',
            data: axis.map((d) => log[d.key] ?? null),
            borderColor: '#2f6fae',
            backgroundColor: '#2f6fae',
            borderWidth: 1.5,
            pointRadius: 3.5,
            tension: 0.2,
            spanGaps: true,
          },
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
              title: (items) => dayTitle(axis, items[0].dataIndex),
              label: (item) => `IAH: ${num(item.parsed.y)}`,
            },
          },
        },
        scales: { x: thirtyDayScale(axis, 9), y: { min: 0, suggestedMax: 8, grid: { color: GRID_COLOR } } },
      },
      plugins: [valueLabelsPlugin(axis, axis.map((d) => log[d.key] ?? null), num, { minHorizontal: 17 })],
    };
  }, [axis, log, showMa7, showMa30]);

  const parse = (text) => {
    const value = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isFinite(value) || value < 0 || value > 150) return { error: 'Digite um número entre 0 e 150' };
    return { value: Math.round(value * 10) / 10 };
  };

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="IAH (índice de apneia-hipopneia): eventos por hora de sono registrados pelo CPAP. Menos é melhor: abaixo de 5 normal, 5–15 leve, 15–30 moderado, acima de 30 grave. Lançamento manual, pelo dia em que você acordou. A cor do número mostra a faixa.">IAH · CPAP</span>
          {last != null && (
            <span className={styles.bigValue} style={{ color: BAND_COLOR[iahBand(last)] }} title={`Faixa: ${iahBand(last)}`}>
              {num(last)}
            </span>
          )}
          <div className={styles.trends}>
            {trends.map(({ days, trend }) => {
              const ui = trend ? TREND_UI[trend.direction] : null;
              // Fewer events per hour is the good direction here.
              const tone = !trend || trend.direction === 'stable' ? 'flat' : trend.direction === 'up' ? 'bad' : 'good';
              const comment = trend && { up: 'subindo, pior', down: 'descendo, melhor', stable: 'estável' }[trend.direction];
              return (
                <span
                  key={days}
                  className={styles.trend}
                  data-tone={tone}
                  data-tip={trend ? `Média dos últimos ${days} dias: ${num(trend.avg)} (${iahBand(trend.avg)}). Média de ontem: ${num(trend.prevAvg)} · ${comment}` : `${days} dias: registros insuficientes`}
                >
                  {days}
                  <b>{ui ? ui.symbol : '–'}</b>
                  {trend && <span className={styles.trendValue}>{num(trend.avg)}</span>}
                </span>
              );
            })}
          </div>
        </div>
        <div className={styles.headerRight}>
          <MaToggles show7={showMa7} show30={showMa30} onToggle7={() => onToggleFlag('iahShowMa7')} onToggle30={() => onToggleFlag('iahShowMa30')} />
          <EditButton pendingCount={pendingCount} onClick={() => setEditing(true)} />
        </div>
      </div>
      <ChartCanvas config={config} height={200} />
      {editing && (
        <EntryEditor
          title="IAH · acordou em"
          keys={keys}
          log={log}
          skipped={skipped}
          placeholder=""
          format={(v) => String(v).replace('.', ',')}
          parse={parse}
          onSet={onSave}
          onSkip={onSkip}
          onClear={onClear}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
