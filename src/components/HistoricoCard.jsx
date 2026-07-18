import styles from './HistoricoCard.module.css';

export default function HistoricoCard({ weightLog }) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>Histórico</div>
      {weightLog.map((w, i) => (
        <div key={i} className={styles.row}>
          <span>{w.date}</span>
          <span>{w.value}kg</span>
        </div>
      ))}
    </div>
  );
}
