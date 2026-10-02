import styles from './SummaryStrip.module.css';
import { formatClockIn, formatDuration, formatKg, TREND_UI } from '../utils/health';

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

export default function SummaryStrip({ page, counts, saude, lists, dayProgressPercent }) {
  const isHoje = page === 'hoje';
  const isSaude = page === 'saude';

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
        <div className={`${styles.card} ${styles.saudeCard}`}>
          <div className={styles.cardTitle}>Peso</div>
          <div className={styles.weightRow}>
            <div className={styles.weightTrends}>
              {(saude.weight?.trends || []).map(({ days, trend }) => (
                <span
                  key={days}
                  className={styles.weightTrend}
                  data-dir={trend?.direction || 'none'}
                  title={trend ? `${days} dias: ${TREND_UI[trend.direction].label}` : `${days} dias: pesagens insuficientes`}
                >
                  {trend ? TREND_UI[trend.direction].symbol : '–'}
                </span>
              ))}
            </div>
            <div className={styles.cardValue}>
              {saude.weight ? formatKg(saude.weight.value) : '–'}
              <span className={styles.cardSuffix}>kg</span>
            </div>
          </div>
        </div>
        <StatCard title="IAH" value={saude.iah != null ? formatKg(saude.iah) : '–'} className={styles.saudeCard} />
        <StatCard title="Sono" value={saude.lastNight ? formatDuration(saude.lastNight.asleepMin) : '–'} className={styles.saudeCard} />
        {/* Filled in once quality, steps and exercise are wired up. */}
        <StatCard title="Qualidade" value="–" className={styles.saudeCard} />
        <StatCard title="Dormiu" value={saude.lastNight ? formatClockIn(saude.lastNight.bedtime, saude.lastNightTz) : '–'} className={styles.saudeCard} />
        <StatCard title="Acordou" value={saude.lastNight ? formatClockIn(saude.lastNight.wake, saude.lastNightTz) : '–'} className={styles.saudeCard} />
        <StatCard title="Passos" value="–" className={styles.saudeCard} />
        <StatCard title="Exercício" value="–" className={styles.saudeCard} />
      </div>
    </div>
  );
}
