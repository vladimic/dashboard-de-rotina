import styles from './MetasCard.module.css';

export default function MetasCard({ goals }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Metas da semana</div>
        <div className={styles.count}>{goals.length} metas</div>
      </div>
      {goals.map((g, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.label}>{g.label}</div>
          <div className={styles.right}>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: g.pct }} />
            </div>
            <div className={styles.fraction}>
              {g.current}/{g.target}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
