import styles from './SummaryStrip.module.css';
import { TREND_UI } from '../utils/health';

function StatCard({ title, value, suffix, className, done, tip, tipAlign }) {
  return (
    <div className={`${styles.card} ${className || ''} ${done ? styles.cardDone : ''}`} data-tip={tip} data-tip-align={tipAlign}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>
        {value}
        {suffix != null && <span className={styles.cardSuffix}>{suffix}</span>}
      </div>
    </div>
  );
}

// One Saúde header tile, two lines: title and today's value, then the 7 and
// 30-day chips — arrow (green when moving the good way for that metric) and
// that window's average; the first chip is always 7 days, the second 30.
function MetricTile({ metric }) {
  return (
    <div className={`${styles.card} ${styles.saudeCard} ${styles.metric}`}>
      <div className={styles.metricTop}>
        <div className={styles.cardTitle} data-tip={metric.tip} data-tip-align={metric.tipAlign}>
          {metric.title}
          {metric.pending > 0 && (
            <span className={styles.pendingDot} title={`${metric.pending} dia(s) sem registro nos últimos 35 — preencha pelo lápis do card`} />
          )}
        </div>
        <div className={styles.cardValue}>
          {metric.value ?? '–'}
          {metric.value != null && metric.unit && <span className={styles.cardSuffix}>{metric.unit}</span>}
        </div>
      </div>
      <div className={styles.metricTrends}>
        {metric.trends.map((t) => (
          <span
            key={t.days}
            className={styles.metricTrend}
            data-tone={!t.direction || t.direction === 'stable' ? 'flat' : t.direction === metric.good ? 'good' : 'bad'}
            data-tip={t.tip}
            data-tip-align={metric.tipAlign}
          >
            <b>{t.direction ? TREND_UI[t.direction].symbol : '–'}</b>
            {t.label ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SummaryStrip({ page, counts, saude, lists, dayProgressPercent }) {
  const isSaude = page === 'saude';

  return (
    <div className={styles.strip} data-page={page}>
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
          <StatCard title="Starting" value={counts.manhaPend} className={styles.hojeCard} done={counts.manhaPend === 0} />
          <StatCard title="Ending" value={counts.noitePend} className={styles.hojeCard} done={counts.noitePend === 0} />
          <StatCard title="TickTick" value={lists.ticktickTotal} className={styles.hojeCard} done={lists.ticktickTotal === 0} />
          <StatCard title="Hábitos" value={counts.habitosPend} className={styles.hojeCard} done={counts.habitosPend === 0} />
        </div>
      </div>

      <div className={styles.saudeGroup}>
        {saude.map((m) => (
          <MetricTile key={m.id} metric={m} />
        ))}
      </div>
    </div>
  );
}
