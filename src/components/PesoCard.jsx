import styles from './PesoCard.module.css';

export default function PesoCard({ weight, weightTarget, newWeightText, onWeightTextChange, onLogWeight }) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>Peso</div>
      <div className={styles.weight}>
        {weight}
        <span className={styles.unit}>kg</span>
      </div>
      <div className={styles.target}>meta {weightTarget}kg</div>
      <div className={styles.row}>
        <input
          className={styles.input}
          value={newWeightText}
          onChange={(e) => onWeightTextChange(e.target.value)}
          placeholder="Registrar hoje..."
        />
        <button type="button" className={styles.okBtn} onClick={onLogWeight}>
          Ok
        </button>
      </div>
    </div>
  );
}
