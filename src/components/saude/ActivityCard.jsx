import { useMemo } from 'react';
import ChartCanvas, { GRID_COLOR, dayTitle, thirtyDayScale, valueLabelsPlugin } from './ChartCanvas';
import { thirtyDayAxis, TREND_UI } from '../../utils/health';
import { WORKOUT_TYPES } from '../../utils/activity';
import styles from './Saude.module.css';

const KCAL_COLOR = '#d9892b';

const dayMonth = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const weekday = (key) => WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()];

// Atividade: minutes of exercise per day (bars, value on top; colored by the
// main workout when workouts are known) and active energy in kcal (amber
// line, right axis). Steps are in the tooltip and the footer.
// `activity.days` is activityDays() output: the last 31 days, oldest first.
export default function ActivityCard({ activity }) {
  const axis = useMemo(() => thirtyDayAxis(), []);
  const all = activity.days;
  const days = useMemo(() => all.slice(-30), [all]);
  const today = all.at(-1);

  const avg = (n, offset = 0) => {
    const win = all.slice(all.length - n - offset, all.length - offset);
    return Math.round(win.reduce((a, d) => a + d.exMin, 0) / win.length);
  };
  const trends = [7, 30].map((n) => {
    const a = avg(n);
    const b = avg(n, 1);
    return { days: n, avg: a, prev: b, direction: Math.abs(a - b) < 1 ? 'stable' : a > b ? 'up' : 'down' };
  });

  const config = useMemo(
    () => ({
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
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Energia ativa',
            data: days.map((d) => (d.kcal > 0 ? d.kcal : null)),
            borderColor: KCAL_COLOR,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            spanGaps: true,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const d = days[items[0].dataIndex];
                return `${weekday(d.key)} ${dayMonth(d.key)}`;
              },
              label: (item) => {
                const d = days[item.dataIndex];
                if (item.datasetIndex === 1) return `${d.kcal} kcal ativas · ${d.steps.toLocaleString('pt-BR')} passos`;
                return [`${d.exMin} min de exercício`, ...d.workouts.map((w) => `${WORKOUT_TYPES[w.type].label} ${w.min} min`)];
              },
            },
          },
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: thirtyDayScale(axis, 9),
          // Left: minutes (green). Right: kcal (amber), its own scale.
          y: { min: 0, suggestedMax: 90, grid: { color: GRID_COLOR }, ticks: { stepSize: 30, callback: (v) => `${v}m` } },
          y1: { position: 'right', min: 0, suggestedMax: 1200, grid: { display: false }, ticks: { stepSize: 400, color: KCAL_COLOR } },
        },
      },
      plugins: [valueLabelsPlugin(axis, days.map((d) => (d.exMin > 0 ? d.exMin : null)), String, { minHorizontal: 13 })],
    }),
    [axis, days]
  );

  const recent = [...all]
    .reverse()
    .filter((d) => d.workouts.length)
    .slice(0, 3)
    .flatMap((d) => d.workouts.map((w) => ({ ...w, key: d.key, isToday: d === today })));
  const week = all.slice(-7).reduce((a, d) => a + d.exMin, 0);

  return (
    <div className={styles.card}>
      <div className={`${styles.header} ${styles.oneLine}`}>
        <div className={styles.headerLeft}>
          <span className={styles.title} data-tip="Atividade: as barras verdes são os minutos de exercício de cada dia (anel verde do Apple Watch, escala à esquerda); a linha laranja é a energia ativa em kcal (escala à direita). Passos ficam no pop-up e no rodapé. O número grande são os minutos de hoje; 7 e 30 comparam a média móvel de hoje com a de ontem.">Atividade</span>
          <span className={styles.bigValue}>
            {today.exMin}
            <span className={styles.unit}> min</span>
          </span>
          <div className={styles.trends}>
            {trends.map((t) => (
              <span
                key={t.days}
                className={styles.trend}
                data-tone={t.direction === 'up' ? 'good' : 'flat'}
                data-tip={`Média dos últimos ${t.days} dias: ${t.avg} min de exercício. Média de ontem: ${t.prev} min · ${TREND_UI[t.direction].label}`}
              >
                {t.days}
                <b>{TREND_UI[t.direction].symbol}</b>
                <span className={styles.trendValue}>{t.avg}m</span>
              </span>
            ))}
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.stageKey}>
            <i style={{ background: '#2f8a5c' }} />
            min
          </span>
          <span className={styles.stageKey}>
            <i style={{ background: KCAL_COLOR, height: 2, borderRadius: 0 }} />
            kcal
          </span>
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
      <div className={styles.actStrip}>
        <span>
          <b>{today.steps.toLocaleString('pt-BR')}</b> passos
        </span>
        <span>
          <b>{today.kcal}</b> kcal ativas
        </span>
        <span>
          7 dias: <b>{week}</b> min
        </span>
      </div>
    </div>
  );
}
