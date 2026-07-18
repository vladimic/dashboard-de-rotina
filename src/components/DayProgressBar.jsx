import styles from './DayProgressBar.module.css';

export default function DayProgressBar({ percent, done, total }) {
  if (total <= 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <span className={styles.label}>Progresso do dia</span>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.pct}>
          {percent}% · {done}/{total}
        </span>
      </div>
    </div>
  );
}
