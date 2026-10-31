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

// One row per stage: today's count, change in 7 days, the period's line and
// the average days the deals have sat in the stage.
export default function VendasTable({ rows }) {
  return (
    <div className={styles.tableWrap}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Estágio</th>
          <th className={styles.r}>Hoje</th>
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
            <td className={styles.r} data-tone={s.delta7 == null || s.delta7 === 0 ? 'flat' : s.delta7 > 0 ? 'up' : 'down'}>
              {s.delta7 == null ? '–' : sign(s.delta7)}
            </td>
            <td>{spark(s.series, s.color)}</td>
            <td className={styles.r}>{s.avgDays ?? '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
