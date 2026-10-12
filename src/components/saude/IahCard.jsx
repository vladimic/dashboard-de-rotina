import { useMemo, useState } from 'react';
import EntryEditor from './EntryEditor';
import ChartCanvas, { GRID_COLOR, monthDividerPlugin, thirtyDayScale } from './ChartCanvas';
import { entryKeys, iahBand, pendingEntryKeys, thirtyDayAxis } from '../../utils/health';
import styles from './Saude.module.css';

const num = (v) => v.toFixed(1).replace('.', ',');

// CPAP apnea-hypopnea index, typed in by hand once a day. `log` maps
// "YYYY-MM-DD" (the night's date — the day the user went to bed) → value.
export default function IahCard({ log, skipped, onSave, onSkip, onClear }) {
  const [editing, setEditing] = useState(false);
  const keys = useMemo(() => entryKeys('iah'), []);
  const pendingCount = pendingEntryKeys(keys, log, skipped).length;

  const axis = useMemo(() => thirtyDayAxis(), []);
  const values = axis.map((d) => log[d.key] ?? null);
  const recorded = values.filter((v) => v != null);
  const avg = recorded.length ? recorded.reduce((a, b) => a + b, 0) / recorded.length : null;

  const lastKey = Object.keys(log).sort().at(-1);
  const last = lastKey ? log[lastKey] : null;

  const config = useMemo(
    () => ({
      type: 'line',
      data: {
        // Third-width chart: weekday as its initial (S, T, Q...).
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase(), d.label[2]]),
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
          { label: 'limite', data: axis.map(() => 5), borderColor: '#d9534f', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.datasetIndex === 0,
            callbacks: { title: (items) => axis[items[0].dataIndex].label.slice(0, 2).join(' '), label: (item) => `IAH ${num(item.parsed.y)}` },
          },
        },
        scales: { x: thirtyDayScale(axis, 9), y: { min: 0, suggestedMax: 8, grid: { color: GRID_COLOR } } },
      },
      plugins: [monthDividerPlugin(axis)],
    }),
    [axis, log]
  );

  const parse = (text) => {
    const value = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isFinite(value) || value < 0 || value > 150) return { error: 'Digite um número entre 0 e 150' };
    return { value: Math.round(value * 10) / 10 };
  };

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="IAH (índice de apneia-hipopneia): eventos por hora de sono registrados pelo CPAP. Menos é melhor; abaixo de 5 é considerado normal (5–15 leve, 15–30 moderado, acima de 30 grave). Lançamento manual, uma nota por noite.">IAH · CPAP</span>
          {last != null && (
            <>
              <span className={styles.bigValue}>{num(last)}</span>
              <span className={styles.band} data-band={iahBand(last)}>
                {iahBand(last)}
              </span>
            </>
          )}
          {avg != null && <span className={styles.muted}>média {num(avg)}</span>}
        </div>
        <div className={styles.headerRight}>
          <button type="button" className={styles.saveBtn} data-alert={pendingCount > 0} onClick={() => setEditing(true)}>
            {pendingCount > 0 ? `Preencher (${pendingCount})` : 'Editar'}
          </button>
        </div>
      </div>
      <ChartCanvas config={config} height={240} />
      {editing && (
        <EntryEditor
          title="IAH · noite de"
          keys={keys}
          log={log}
          skipped={skipped}
          placeholder="2,1"
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
