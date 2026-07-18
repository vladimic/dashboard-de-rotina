import styles from './SonoCard.module.css';

export default function SonoCard({ sleepWeek, sleepAvg }) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>Sono da semana</div>
      <div className={styles.bars}>
        {sleepWeek.map((s, i) => (
          <div key={i} className={styles.barCol}>
            <div className={styles.bar} style={{ background: s.barColor, height: s.barHeight }} />
            <div className={styles.barLabel}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className={styles.caption}>média {sleepAvg}h / meta 8h</div>
    </div>
  );
}
