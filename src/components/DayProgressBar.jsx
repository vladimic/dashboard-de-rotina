import styles from './DayProgressBar.module.css';

export default function DayProgressBar({ percent, done, total }) {
  const hasBaseline = total > 0;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Progresso do dia</span>
      <div className={styles.track}>
        {hasBaseline && <div className={styles.fill} style={{ width: `${percent}%` }} />}
      </div>
      <span className={styles.pct}>{hasBaseline ? `${percent}% · ${done}/${total}` : 'calculando...'}</span>
    </div>
  );
}
