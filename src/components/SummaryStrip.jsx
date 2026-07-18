import DayProgressBar from './DayProgressBar';
import styles from './SummaryStrip.module.css';

function StatCard({ title, value, suffix, className }) {
  return (
    <div className={`${styles.card} ${className || ''}`}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>
        {value}
        {suffix != null && <span className={styles.cardSuffix}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function SummaryStrip({ page, counts, habits, water, waterTarget, sleepHours, weight, lists, dayProgress }) {
  const isHoje = page === 'hoje';
  const isSaude = page === 'saude';

  const habitsDone = habits.filter((h) => h.done).length;

  return (
    <div className={styles.strip}>
      <div className={styles.hojeGroup} data-dim={isSaude}>
        <StatCard title="Meu Dia" value={counts.meuDiaCount} className={styles.hojeCard} />
        <StatCard title="Starting Day" value={counts.manhaPend} suffix={`/${counts.manhaTotal}`} className={styles.hojeCard} />
        <StatCard title="Ending Day" value={counts.noitePendSummary} suffix={`/${counts.noiteTotalSummary}`} className={styles.hojeCard} />
        <StatCard title="Lembretes" value={lists.lembretesTotal} className={styles.hojeCard} />
        <div className={styles.geralCard}>
          <div className={styles.geralTitle}>Geral</div>
          <div className={styles.geralBottom}>
            <div
              className={styles.geralRing}
              style={{
                background: `conic-gradient(#8fd9b6 ${dayProgress.percent * 3.6}deg, rgba(255,255,255,0.18) 0deg)`,
              }}
            >
              <div className={styles.geralRingInner}>{dayProgress.percent}%</div>
            </div>
            <div className={styles.geralValue}>{counts.geralTotal}</div>
          </div>
        </div>
        <StatCard title="HubSpot Tasks" value={lists.hubspotTasksTotal} className={styles.hojeCard} />
        <StatCard title="HubSpot Deals" value={lists.hubspotDealsTotal} className={styles.hojeCard} />
        <StatCard title="TickTick" value={lists.ticktickTotal} className={styles.hojeCard} />
        <StatCard title="Notion" value={lists.notionTotal} className={styles.hojeCard} />
        <div className={styles.progressRow}>
          <DayProgressBar percent={dayProgress.percent} done={dayProgress.done} total={dayProgress.total} />
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
