import styles from './SummaryStrip.module.css';
import { TREND_UI } from '../utils/health';

function StatCard({ title, value, suffix, className, done, tip, tipAlign }) {
  return (
    <div className={`${styles.card} ${className || ''} ${done ? styles.cardDone : ''}`} data-tip={tip} data-tip-align={tipAlign}>
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

// Last 30 days as a line: the first 23 light, the last 7 dark and thicker
// ("evolução mensal" + "7 dias" in one), with a dot on the latest value.
// Gaps (days without data) are bridged.
function Sparkline({ values }) {
  const pts = values.map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
  if (pts.length < 2) return <div className={styles.sparkEmpty}>sem dados</div>;
  const vs = pts.map((p) => p[1]);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const x = (i) => (i / (values.length - 1)) * 100;
  const y = (v) => 22 - ((v - min) / span) * 20;
  const path = (list) => list.map(([i, v], n) => `${n ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const cut = values.length - 7;
  const month = pts.filter(([i]) => i <= cut);
  // The 7-day part starts at the last point before the cut, so it joins the
  // month line instead of floating.
  const week = [...month.slice(-1), ...pts.filter(([i]) => i > cut)];
  const last = pts.at(-1);
  return (
    <svg className={styles.spark} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      {month.length > 1 && <path d={path(month)} className={styles.sparkMonth} />}
      {week.length > 1 && <path d={path(week)} className={styles.sparkWeek} />}
      <path d={`M${x(last[0])},${y(last[1])} l0,0`} className={styles.sparkDot} />
    </svg>
  );
}

// One Saúde header tile: title, today's value, the 30-day sparkline and the
// 7 / 30 arrows (green when moving the good way for that metric).
function MetricTile({ metric }) {
  return (
    <div className={`${styles.card} ${styles.saudeCard} ${styles.metric}`}>
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
      <Sparkline values={metric.series} />
      <div className={styles.metricTrends}>
        {metric.trends.map((t) => (
          <span
            key={t.days}
            className={styles.metricTrend}
            data-tone={!t.direction || t.direction === 'stable' ? 'flat' : t.direction === metric.good ? 'good' : 'bad'}
            data-tip={t.tip}
            data-tip-align={metric.tipAlign}
          >
            {t.days}
            <b>{t.direction ? TREND_UI[t.direction].symbol : '–'}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SummaryStrip({ page, counts, saude, lists, dayProgressPercent }) {
  const isHoje = page === 'hoje';
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
          <StatCard title="Starting Day" value={counts.manhaPend} className={styles.hojeCard} done={counts.manhaPend === 0} />
          <StatCard title="Ending Day" value={counts.noitePend} className={styles.hojeCard} done={counts.noitePend === 0} />
          <StatCard title="TickTick" value={lists.ticktickTotal} className={styles.hojeCard} done={lists.ticktickTotal === 0} />
          <StatCard title="Hábitos" value={counts.habitosPend} className={styles.hojeCard} done={counts.habitosPend === 0} />
        </div>
      </div>

      <div className={styles.saudeGroup} data-dim={isHoje}>
        {saude.map((m) => (
          <MetricTile key={m.id} metric={m} />
        ))}
      </div>
    </div>
  );
}
