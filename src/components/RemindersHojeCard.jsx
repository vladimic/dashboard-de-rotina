import styles from './RemindersHojeCard.module.css';

export default function RemindersHojeCard({ semHorario, comHorario, loading, error, onRefresh, updatedLabel }) {
  const total = semHorario.length + comHorario.length;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Hoje · Lembretes</div>
        <div className={styles.headerRight}>
          <div className={styles.count}>{total}</div>
          <div className={styles.refresh} onClick={onRefresh} title={`atualizado às ${updatedLabel}`}>
            ⟳
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>Não deu pra carregar: {error}</div>}
      {!error && loading && total === 0 && <div className={styles.empty}>Carregando...</div>}
      {!error && !loading && total === 0 && <div className={styles.empty}>Nenhum lembrete pra hoje.</div>}

      {semHorario.map((r) => (
        <div key={r.id} className={styles.row}>
          <div className={styles.dot} />
          <div className={styles.label}>{r.title}</div>
        </div>
      ))}
      {comHorario.map((r) => (
        <div key={r.id} className={styles.row}>
          <div className={styles.dot} />
          <div className={styles.label}>{r.title}</div>
          <div className={styles.time}>{r.timeLabel}</div>
        </div>
      ))}
    </div>
  );
}
