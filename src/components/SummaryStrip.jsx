import styles from './SummaryStrip.module.css';

function StatCard({ title, value, suffix, className, done }) {
  return (
    <div className={`${styles.card} ${className || ''} ${done ? styles.cardDone : ''}`}>
      {done && (
        <div className={styles.doneBadge}>
          <span className={styles.doneBadgeCheck}>✓</span>
        </div>
      )}
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>
        {value}
        {suffix != null && <span className={styles.cardSuffix}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function SummaryStrip({ page, counts, habits, water, waterTarget, sleepHours, weight, lists, dayProgressPercent }) {
  const isHoje = page === 'hoje';
  const isSaude = page === 'saude';

  const habitsDone = habits.filter((h) => h.done).length;

  return (
    <div className={styles.strip}>
      <div className={styles.hojeGroup} data-dim={isSaude}>
        <div className={styles.kpiScroll}>
          <StatCard title="Meu Dia" value={counts.meuDiaCount} className={styles.hojeCard} done={counts.meuDiaCount === 0} />
          <StatCard title="Lembretes" value={lists.lembretesTotal} className={styles.hojeCard} done={lists.lembretesTotal === 0} />
          <StatCard title="Notion" value={lists.notionTotal} className={styles.hojeCard} done={lists.notionTotal === 0} />
          <StatCard title="HubSpot" value={counts.hubspotTotal} className={styles.hojeCard} done={counts.hubspotTotal === 0} />
          <div className={styles.geralCard}>
            <div className={styles.geralTop}>
              <div className={styles.geralTitle}>Geral</div>
              <div className={styles.geralSubtotal}>
                {counts.meuDiaCount + lists.lembretesTotal + lists.notionTotal + counts.hubspotTotal}
              </div>
            </div>
            <div className={styles.geralBottom}>
              <div
                className={styles.geralRing}
                style={{
                  background: `conic-gradient(#8fd9b6 ${dayProgressPercent * 3.6}deg, rgba(255,255,255,0.18) 0deg)`,
                }}
              >
                <div className={styles.geralRingInner}>{dayProgressPercent}%</div>
              </div>
              <div className={styles.geralValue}>{counts.geralTotal}</div>
            </div>
          </div>
          <StatCard title="Starting Day" value={counts.manhaPend} className={styles.hojeCard} done={counts.manhaPend === 0} />
          <StatCard title="Ending Day" value={counts.noitePend} className={styles.hojeCard} done={counts.noitePend === 0} />
          <StatCard title="TickTick" value={lists.ticktickTotal} className={styles.hojeCard} done={lists.ticktickTotal === 0} />
          <StatCard title="Hábitos" value={counts.habitosPend} className={styles.hojeCard} done={counts.habitosPend === 0} />
        </div>
      </div>

      <div className={styles.saudeGroup} data-dim={isHoje}>
        <StatCard title="Hábitos" value={habitsDone} suffix={`/${habits.length}`} className={styles.saudeCard} />
        <StatCard title="Água" value={water} suffix={`/${waterTarget}`} className={styles.saudeCard} />
        <StatCard title="Sono (ontem)" value={sleepHours} suffix="h" className={styles.saudeCard} />
        <StatCard title="Peso" value={weight} suffix="kg" className={styles.saudeCard} />
      </div>
    </div>
  );
}
