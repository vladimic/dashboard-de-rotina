import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, thirtyDayScale, valueLabelsPlugin } from './ChartCanvas';
import MaToggles, { maDataset, maTooltip } from './MaToggles';
import { dailyTrend, rollingByKey, thirtyDayAxis, TREND_UI } from '../../utils/health';
import { WORKOUT_TYPES } from '../../utils/activity';
import styles from './Saude.module.css';

const dayMonth = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const weekday = (key) => WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()];

// Exercício: minutes of exercise per day (bars, value on top; colored by the
// main workout when workouts are known), with 7d / 30d moving averages and
// the latest workouts below. Energy and steps have their own cards.
// `activity.days` is activityDays() output: the last 31 days, oldest first.
export default function ActivityCard({ activity, showMa7, showMa30, onToggleFlag }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const all = activity.days;
  const days = useMemo(() => all.slice(-30), [all]);
  const today = all.at(-1);

  // A day with neither steps nor energy never synced: a gap, not 0 minutes.
  const valueOf = useMemo(() => {
    const byKey = new Map(all.map((d) => [d.key, d]));
    return (key) => {
      const d = byKey.get(key);
      return d && (d.kcal > 0 || d.steps > 0) ? d.exMin : null;
    };
  }, [all]);
  const trends = [7, 30].map((n) => ({ days: n, trend: dailyTrend(valueOf, n, 1) }));

  const config = useMemo(() => {
    const ma = { 7: rollingByKey(axis, valueOf, 7), 30: rollingByKey(axis, valueOf, 30) };
    const tip = maTooltip(ma[7], ma[30], (v) => `${Math.round(v)} min`);
    return {
      type: 'bar',
      data: {
        labels: axis.map((d) => [d.label[0], d.label[1][0].toUpperCase()]),
        datasets: [
          {
            label: 'Minutos de exercício',
            data: days.map((d) => (d.exMin > 0 ? d.exMin : null)),
            backgroundColor: days.map((d) => (d.main ? WORKOUT_TYPES[d.main].color : '#2f8a5c')),
            borderRadius: 3,
            barPercentage: 0.75,
          },
          ...[7, 30].filter((n) => (n === 7 ? showMa7 : showMa30)).map((n) => maDataset(n, ma[n])),
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tip,
            callbacks: {
              ...tip.callbacks,
              title: (items) => {
                const d = days[items[0].dataIndex];
                return `${weekday(d.key)} ${dayMonth(d.key)}`;
              },
              label: (item) => {
                const d = days[item.dataIndex];
                return [`${d.exMin} min de exercício`, ...d.workouts.map((w) => `${WORKOUT_TYPES[w.type].label} ${w.min} min`)];
              },
            },
          },
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: thirtyDayScale(axis, 9),
          y: { min: 0, suggestedMax: 90, grid: { color: GRID_COLOR }, ticks: { stepSize: 30, callback: (v) => `${v}m` } },
        },
      },
      plugins: [valueLabelsPlugin(axis, days.map((d) => (d.exMin > 0 ? d.exMin : null)), String, { minHorizontal: 13 })],
    };
  }, [axis, days, valueOf, showMa7, showMa30]);

  const recent = [...all]
    .reverse()
    .filter((d) => d.workouts.length)
    .slice(0, 3)
    .flatMap((d) => d.workouts.map((w) => ({ ...w, key: d.key, isToday: d === today })));

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="Exercício: minutos de exercício de cada dia (anel verde do Apple Watch; barra na cor do treino principal quando o treino é conhecido). Tracejadas: médias móveis de 7 e 30 dias. O número grande são os minutos de hoje; 7 e 30 comparam a média móvel de hoje com a de ontem. Embaixo, os últimos treinos.">Exercício</span>
          <span className={styles.bigValue}>
            {today.exMin}
            <span className={styles.unit}> min</span>
          </span>
          <div className={styles.trends}>
            {trends.map(({ days: n, trend: t }) => (
              <span
                key={n}
                className={styles.trend}
                data-tone={!t || t.direction === 'stable' ? 'flat' : t.direction === 'up' ? 'good' : 'bad'}
                data-tip={t ? `Média dos últimos ${n} dias: ${Math.round(t.avg)} min de exercício. Média de ontem: ${Math.round(t.prevAvg)} min · ${TREND_UI[t.direction].label}` : `${n} dias: dados insuficientes`}
              >
                {n}
                <b>{t ? TREND_UI[t.direction].symbol : '–'}</b>
                {t && <span className={styles.trendValue}>{Math.round(t.avg)}m</span>}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.headerRight}>
          <MaToggles show7={showMa7} show30={showMa30} onToggle7={() => onToggleFlag('exerciseShowMa7')} onToggle30={() => onToggleFlag('exerciseShowMa30')} />
        </div>
      </div>
      {activity.error && <div className={styles.error}>Não deu pra carregar a atividade: {activity.error}</div>}
      {!activity.error && !activity.loading && !activity.hasData ? (
        <div className={styles.empty}>Nenhuma atividade ainda — rode o atalho “Sincronizar Saúde” no iPhone.</div>
      ) : (
        <ChartCanvas config={config} height={150} />
      )}
      {recent.length > 0 && (
      <div className={styles.actList}>
        {recent.map((w, i) => (
          <div key={i} className={styles.actRow}>
            <i style={{ background: WORKOUT_TYPES[w.type].color }} />
            <span>{WORKOUT_TYPES[w.type].label}</span>
            <span className={styles.muted}>{w.isToday ? 'hoje' : `${weekday(w.key)} ${dayMonth(w.key)}`}</span>
            <b>{w.min} min</b>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
