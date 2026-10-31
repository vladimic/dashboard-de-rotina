import styles from './Vendas.module.css';

const spark = (arr, color) => {
  const w = 90;
  const h = 20;
  const m = Math.max(...arr, 1);
  const pts = arr.length > 1 ? arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - 2 - (v / m) * (h - 4)}`).join(' ') : `0,${h - 2 - (arr[0] / m) * (h - 4)} ${w},${h - 2 - (arr[0] / m) * (h - 4)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={styles.spark}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
};

const sign = (n) => (n > 0 ? `+${n}` : String(n));
const tone = (d) => (d == null || d === 0 ? 'flat' : d > 0 ? 'up' : 'down');
const fmtPct = (v) => `${v.toFixed(1).replace('.', ',')}%`;

// One row per stage: today's count, its share of the funnel, change in 7
// days, the period's line and the average days the deals have sat in the
// stage; the last row sums the whole funnel.
export default function VendasTable({ rows }) {
  const sum = rows.reduce((t, s) => t + s.today, 0);
  const delta = rows.every((s) => s.delta7 != null) ? rows.reduce((t, s) => t + s.delta7, 0) : null;
  const series = rows[0]?.series.map((_, i) => rows.reduce((t, s) => t + s.series[i], 0)) ?? [];
  // Days in stage of the whole funnel: weighted by each stage's deals.
  const aged = rows.filter((s) => s.avgDays != null && s.today > 0);
  const agedDeals = aged.reduce((t, s) => t + s.today, 0);
  const avgAll = agedDeals ? Math.round(aged.reduce((t, s) => t + s.avgDays * s.today, 0) / agedDeals) : null;
  return (
    <div className={styles.tableWrap}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Estágio</th>
          <th className={styles.r}>Hoje</th>
          <th className={styles.r}>% hoje</th>
          <th className={styles.r}>Δ 7d</th>
          <th>Período</th>
          <th className={styles.r}>Dias no estágio</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>
              <i className={styles.dot} style={{ background: s.color }} />
              {s.label}
            </td>
            <td className={styles.r}>
              <b>{s.today}</b>
            </td>
            <td className={styles.r}>{sum ? fmtPct((s.today / sum) * 100) : '–'}</td>
            <td className={styles.r} data-tone={tone(s.delta7)}>
              {s.delta7 == null ? '–' : sign(s.delta7)}
            </td>
            <td>{spark(s.series, s.color)}</td>
            <td className={styles.r}>{s.avgDays ?? '–'}</td>
          </tr>
        ))}
        <tr className={styles.totalRow}>
          <td>Total</td>
          <td className={styles.r}>{sum}</td>
          <td className={styles.r}>{sum ? '100%' : '–'}</td>
          <td className={styles.r} data-tone={tone(delta)}>
            {delta == null ? '–' : sign(delta)}
          </td>
          <td>{spark(series, '#5b4a63')}</td>
          <td className={styles.r}>{avgAll ?? '–'}</td>
        </tr>
      </tbody>
    </table>
    </div>
  );
}
