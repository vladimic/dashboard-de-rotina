import styles from './HabitosCard.module.css';

export default function HabitosCard({ habits, onToggleHabit }) {
  const done = habits.filter((h) => h.done).length;
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Hábitos</div>
        <div className={styles.count}>
          {done}/{habits.length}
        </div>
      </div>
      {habits.map((h) => (
        <div key={h.id} className={styles.row} onClick={() => onToggleHabit(h.id)}>
          <div className={styles.rowTop} style={{ color: h.color }}>
            <span>{h.label}</span>
            <span className={styles.streak}>{h.streak}/7</span>
          </div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ background: h.barColor, width: h.pct }} />
          </div>
        </div>
      ))}
    </div>
  );
}
